import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { csvEscape } from "../csvEscape";
import { readCsvRecords } from "../csv";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { BASKET_WEIGHTS_ROOT, latestBasketWeightVintage, readVerifiedBasketWeightFiles } from "./basketWeightFiles";
import {
  assertReconstruction,
  buildContributionIndex,
  reconstructionErrors,
  type ReconstructionErrors,
} from "./contributions";
import { loadCpiCategoryFacts, loadCpiCityFacts, loadCpiFacts, loadInflationTargets } from "./importInflation";
import { periodFromKey, periodKey, periodYear } from "./periods";
import { readGeostatBasketWeights } from "./readBasketWeights";
import { CPI_FILE_ROLES, NATIONAL_SHEET, readGeostatCpiCategories, readGeostatCpiCitySheets, readGeostatCpiFile } from "./readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage, readVerifiedCpiFiles, type VerifiedCpiFile } from "./sourceFiles";
import {
  categoryIdFromCoicop,
  CITY_FIRST_PERIOD,
  CITY_SHEETS,
  CPI_CITY_IDS,
  CPI_CITY_MEASURES,
  type BasketWeightRow,
  type CpiCategoryFact,
  type CpiCityFact,
  type CpiCityMeasure,
  type CpiFact,
} from "./types";
import {
  assertImpliedCityWeights,
  assertLanguageParity,
  assertNoCategoryRevisions,
  assertNoCityRevisions,
  assertNoRevisions,
  cityConsistencyError,
  CITY_CONSISTENCY_TOLERANCE_PP,
  fitImpliedCityWeights,
  recomputeHeadline,
  validateBasketWeights,
  validateCategoryFacts,
  validateCityFacts,
  validateCpiFacts,
  type ImpliedCityWeights,
} from "./validateInflation";

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const CPI_FACTS_FILE = path.join(REPO_ROOT, "data/imports/cpi-national-monthly.csv");
const REPORT_FILE = path.join(REPO_ROOT, "data/reports/inflation-cpi-validation.json");
const PUBLIC_FILE = path.resolve(process.cwd(), "public/downloads/data/inflation-cpi-national.csv");
const CPI_HEADERS = ["series_id", "measure", "period", "value", "status", "source_id", "source_locator", "last_reviewed_at"];
const CATEGORY_FACTS_FILE = path.join(REPO_ROOT, "data/imports/cpi-categories-monthly.csv");
const BASKET_WEIGHTS_FILE = path.join(REPO_ROOT, "data/imports/cpi-basket-weights.csv");
const CATEGORY_HEADERS = [
  "category_id",
  "coicop_code",
  "level",
  "parent_id",
  "measure",
  "period",
  "value",
  "status",
  "source_id",
  "source_locator",
  "last_reviewed_at",
];
const WEIGHT_HEADERS = ["category_id", "year", "weight_pct", "source_id", "last_reviewed_at"];
const CITY_FACTS_FILE = path.join(REPO_ROOT, "data/imports/cpi-cities-monthly.csv");
const CITY_HEADERS = ["city_id", "series_id", "measure", "period", "value", "status", "source_id", "source_locator", "last_reviewed_at"];
// Leading byte-order mark, as on the GDP overview CSV, so Excel opens the file as UTF-8.
const BOM = String.fromCharCode(0xfeff);

export type InflationArtifactMode = "write" | "check" | "public" | "check-public";

export type InflationValidationReport = {
  status: "PASS";
  vintage: string;
  lastPeriod: string;
  counts: Record<string, number>;
  firstPeriods: Record<string, string>;
  maxRecomputeErrorPp: { yoy: number; mom: number; avg12: number };
  languageParity: "PASS";
  sourceHashes: Record<string, string>;
};

/** What data/reports/inflation-cpi-validation.json holds: the national report plus the category and city blocks. */
export type InflationReportFile = InflationValidationReport & { categories: InflationCategoryReport; cities: InflationCityReport };

async function loadPreviousFacts(): Promise<CpiFact[] | null> {
  try {
    return await loadCpiFacts();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function registeredSourceIds(): Promise<Set<string>> {
  return new Set((await readCsvRecords("../../data/sources/source-documents.csv")).map((row) => row.source_id));
}

/**
 * previousFacts: the canonical CSV to guard against revisions. Omit to read the
 * committed file; pass null for a first build.
 */
export async function prepareInflation(
  options: { rawRoot?: string; files?: VerifiedCpiFile[]; previousFacts?: CpiFact[] | null } = {},
) {
  const rawRoot = options.rawRoot ?? INFLATION_RAW_ROOT;
  const vintage = await latestCpiVintage(rawRoot);
  const files = options.files ?? (await readVerifiedCpiFiles(path.join(rawRoot, "geostat-cpi", vintage)));

  const facts: CpiFact[] = [];
  for (const role of CPI_FILE_ROLES) {
    const english = files.find((file) => file.file_role === role && file.language === "en")!;
    const georgian = files.find((file) => file.file_role === role && file.language === "ka")!;
    const parsed = readGeostatCpiFile(english.content, role, "en");
    assertLanguageParity(role, parsed, readGeostatCpiFile(georgian.content, role, "ka"));
    for (const series of parsed) {
      for (const cell of series.cells) {
        facts.push({
          seriesId: series.seriesId,
          measure: series.measure,
          period: periodKey(cell.period),
          value: cell.value,
          status: "published",
          sourceId: english.source_id,
          sourceLocator: cell.locator,
          lastReviewedAt: english.retrieved_at,
        });
      }
    }
  }
  facts.sort((a, b) => a.seriesId.localeCompare(b.seriesId) || a.measure.localeCompare(b.measure) || a.period.localeCompare(b.period));

  const coverage = validateCpiFacts(facts);
  if (coverage.lastPeriod !== vintage) {
    throw new Error(`Vintage folder ${vintage} must be named after the last month its files cover, ${coverage.lastPeriod}`);
  }
  const errors = recomputeHeadline(facts);
  const previous = options.previousFacts === undefined ? await loadPreviousFacts() : options.previousFacts;
  if (previous) assertNoRevisions(previous, facts);

  const sourceIds = await registeredSourceIds();
  const targets = await loadInflationTargets();
  const weightVintage = await latestBasketWeightVintage();
  const weightFiles = await readVerifiedBasketWeightFiles(path.join(BASKET_WEIGHTS_ROOT, weightVintage));
  const weightSources = weightFiles.filter((file) => file.language === "en").map((file) => ({ sourceId: file.source_id }));
  for (const id of new Set([...facts, ...targets, ...weightSources].map((row) => row.sourceId))) {
    if (!sourceIds.has(id)) throw new Error(`Inflation source ${id} is missing from data/sources/source-documents.csv`);
  }

  const round = (value: number) => Number(value.toFixed(4));
  const validation: InflationValidationReport = {
    status: "PASS",
    vintage,
    ...coverage,
    maxRecomputeErrorPp: { yoy: round(errors.yoy), mom: round(errors.mom), avg12: round(errors.avg12) },
    languageParity: "PASS",
    sourceHashes: Object.fromEntries(files.map((file) => [file.local_file, file.sha256])),
  };
  return { facts, validation };
}

export type InflationCategoryReport = {
  categoryCount: number;
  lastPeriod: string;
  gaps: string[];
  weightYears: number[];
  maxWeightSumErrorPct: number;
  reconstruction: ReconstructionErrors;
  /** Spec §12: the weights archive is evidenced here too, not only at read time. */
  weightSourceHashes: Record<string, string>;
};

/**
 * Category price changes come from the same yoy and mom workbooks the national
 * series reads; weights come from their own annual archive. Contributions are
 * derived here only to check that the parts still reconstruct the published
 * headline — they are never written to a CSV (spec §4.6).
 */
export async function prepareInflationCategories(
  options: { rawRoot?: string; files?: VerifiedCpiFile[]; previousFacts?: CpiCategoryFact[] | null; headlineFacts?: CpiFact[] } = {},
) {
  const rawRoot = options.rawRoot ?? INFLATION_RAW_ROOT;
  const vintage = await latestCpiVintage(rawRoot);
  const files = options.files ?? (await readVerifiedCpiFiles(path.join(rawRoot, "geostat-cpi", vintage)));

  const facts: CpiCategoryFact[] = [];
  for (const role of ["yoy", "mom"] as const) {
    const english = files.find((file) => file.file_role === role && file.language === "en")!;
    const georgian = files.find((file) => file.file_role === role && file.language === "ka")!;
    const en = readGeostatCpiCategories(english.content, role, "en");
    const ka = readGeostatCpiCategories(georgian.content, role, "ka");
    if (en.length !== ka.length) throw new Error(`English and Georgian ${role} files list different categories`);
    en.forEach((series, position) => {
      const other = ka[position]!;
      if (other.coicopCode !== series.coicopCode || other.level !== series.level) {
        throw new Error(`English and Georgian ${role} files differ in category order at ${series.coicopCode}`);
      }
      const left = series.cells.map((cell) => `${cell.period}=${cell.value}`).join("|");
      const right = other.cells.map((cell) => `${cell.period}=${cell.value}`).join("|");
      if (left !== right) throw new Error(`English and Georgian ${role} files differ for category ${series.coicopCode}`);
      const { categoryId, parentId } = categoryIdFromCoicop(series.coicopCode, series.level);
      for (const cell of series.cells) {
        facts.push({
          categoryId,
          coicopCode: series.coicopCode,
          level: series.level,
          parentId,
          measure: role === "yoy" ? "yoy_pct" : "mom_pct",
          period: periodKey(cell.period),
          value: cell.value,
          status: "published",
          sourceId: english.source_id,
          sourceLocator: cell.locator,
          lastReviewedAt: english.retrieved_at,
        });
      }
    });
  }
  facts.sort(
    (a, b) => a.categoryId.localeCompare(b.categoryId) || a.measure.localeCompare(b.measure) || a.period.localeCompare(b.period),
  );

  const weightVintage = await latestBasketWeightVintage();
  const weightFiles = await readVerifiedBasketWeightFiles(path.join(BASKET_WEIGHTS_ROOT, weightVintage));
  const weightSource = weightFiles.find((file) => file.language === "en")!;
  const georgianWeights = weightFiles.find((file) => file.language === "ka")!;
  const englishRows = readGeostatBasketWeights(weightSource.content);
  // The Georgian twin is archived to prove identical values, so it is read and
  // compared rather than merely hashed — the same discipline the CPI files get.
  const georgianRows = readGeostatBasketWeights(georgianWeights.content, "ka");
  if (englishRows.length !== georgianRows.length) throw new Error("English and Georgian weights list different categories");
  englishRows.forEach((row, position) => {
    const other = georgianRows[position]!;
    if (other.coicopCode !== row.coicopCode || other.level !== row.level) {
      throw new Error(`English and Georgian weights differ in order at ${row.coicopCode}`);
    }
    const left = [...row.byYear].map(([year, value]) => `${year}=${value}`).join("|");
    const right = [...other.byYear].map(([year, value]) => `${year}=${value}`).join("|");
    if (left !== right) throw new Error(`English and Georgian weights differ for category ${row.coicopCode}`);
  });
  const weights: BasketWeightRow[] = englishRows
    .flatMap((row) => {
      const { categoryId } = categoryIdFromCoicop(row.coicopCode, row.level);
      return [...row.byYear].map(([year, weightPct]) => ({
        categoryId,
        year,
        weightPct,
        sourceId: weightSource.source_id,
        lastReviewedAt: weightSource.retrieved_at,
      }));
    })
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.year - b.year);

  const coverage = validateCategoryFacts(facts);
  const weightCheck = validateBasketWeights(weights, new Set(facts.map((fact) => fact.categoryId)));
  const previous = options.previousFacts === undefined ? await loadPreviousCategoryFacts() : options.previousFacts;
  if (previous) assertNoCategoryRevisions(previous, facts);

  const served = facts.map((fact) => ({ ...fact, value: Number(fact.value) }));
  const servedWeights = weights.map((row) => ({ ...row, weightPct: Number(row.weightPct) }));
  // The headline must be the vintage being written, not the committed CSV: on a
  // monthly refresh the CSV is still a month behind when this runs, and the
  // reconstruction figures land in a byte-compared report.
  const headline = new Map(
    (options.headlineFacts ?? (await loadCpiFacts()))
      .filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct")
      .map((fact) => [periodFromKey(fact.period), Number(fact.value)]),
  );
  const reconstruction = reconstructionErrors(
    buildContributionIndex(
      served.filter((fact) => fact.level === 2),
      servedWeights,
    ),
    headline,
  );
  assertReconstruction(reconstruction);

  const validation: InflationCategoryReport = {
    categoryCount: coverage.categoryCount,
    lastPeriod: coverage.lastPeriod,
    gaps: coverage.gaps,
    weightYears: weightCheck.years,
    maxWeightSumErrorPct: Number(weightCheck.maxSumErrorPct.toFixed(6)),
    weightSourceHashes: Object.fromEntries(weightFiles.map((file) => [file.local_file, file.sha256])),
    reconstruction: {
      ...reconstruction,
      maxPp: Number(reconstruction.maxPp.toFixed(4)),
      meanPp: Number(reconstruction.meanPp.toFixed(4)),
    },
  };
  return { facts, weights, validation };
}

async function loadPreviousCategoryFacts(): Promise<CpiCategoryFact[] | null> {
  try {
    return await loadCpiCategoryFacts();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export type InflationCityReport = {
  cityCount: number;
  lastPeriod: string;
  firstPeriods: Record<string, string>;
  maxConsistencyErrorPp: number;
  /** Validation evidence only (spec §3.5): never written to a CSV, page, workbook or answer. */
  impliedWeights: ImpliedCityWeights[];
  skippedWeightYears: number[];
};

const CITY_ROLES = ["yoy", "mom", "avg12"] as const;
const CITY_ROLE_MEASURE: Record<(typeof CITY_ROLES)[number], CpiCityMeasure> = { yoy: "yoy_pct", mom: "mom_pct", avg12: "avg12_pct" };
const GEORGIA = "country.georgia";

/**
 * City rows come from the same yoy, mom and avg12 workbooks the national series
 * reads: one sheet per city. Georgia's sheet is read too, but only as evidence —
 * the reader must agree with the national reader on it, and the cities must add
 * up to it (spec 2026-09-26 §4.3). It is never written to the city CSV.
 */
export async function prepareInflationCities(
  options: { rawRoot?: string; files?: VerifiedCpiFile[]; previousFacts?: CpiCityFact[] | null; headlineFacts?: CpiFact[] } = {},
) {
  const rawRoot = options.rawRoot ?? INFLATION_RAW_ROOT;
  const files = options.files ?? (await readVerifiedCpiFiles(path.join(rawRoot, "geostat-cpi", await latestCpiVintage(rawRoot))));
  const lines = [GEORGIA, ...CPI_CITY_IDS] as const;
  const sheetFor = (line: (typeof lines)[number], language: "en" | "ka") => (line === GEORGIA ? NATIONAL_SHEET[language] : CITY_SHEETS[line][language]);

  const facts: CpiCityFact[] = [];
  // Full-history headline per line, for the consistency and weights checks.
  const full = new Map<string, Record<CpiCityMeasure, Map<number, number>>>(
    lines.map((line) => [line, { yoy_pct: new Map(), mom_pct: new Map(), avg12_pct: new Map() }]),
  );
  for (const role of CITY_ROLES) {
    const english = files.find((file) => file.file_role === role && file.language === "en")!;
    const georgian = files.find((file) => file.file_role === role && file.language === "ka")!;
    const en = readGeostatCpiCitySheets(english.content, role, "en", lines.map((line) => sheetFor(line, "en")));
    const ka = readGeostatCpiCitySheets(georgian.content, role, "ka", lines.map((line) => sheetFor(line, "ka")));
    const measure = CITY_ROLE_MEASURE[role];
    for (const line of lines) {
      const enSeries = en.get(sheetFor(line, "en"))!;
      const kaSeries = ka.get(sheetFor(line, "ka"))!;
      enSeries.forEach((series, position) => {
        const other = kaSeries[position];
        const left = series.cells.map((cell) => `${cell.period}=${cell.value}`).join("|");
        const right = other?.cells.map((cell) => `${cell.period}=${cell.value}`).join("|");
        if (other?.seriesId !== series.seriesId || left !== right) throw new Error(`English and Georgian ${role} files differ for ${line} ${series.seriesId}`);
        if (series.seriesId === "cpi.headline") for (const cell of series.cells) full.get(line)![measure].set(cell.period, Number(cell.value));
        if (line === GEORGIA) return;
        for (const cell of series.cells) {
          const period = periodKey(cell.period);
          if (period < CITY_FIRST_PERIOD) continue;
          facts.push({
            cityId: line,
            seriesId: series.seriesId,
            measure,
            period,
            // The Total row is a typed figure, but the divisions on a city sheet are
            // formula results carrying double-precision noise past what Geostat
            // displays (e.g. a cell shown as 104.4 stores 104.44085283679487) —
            // confirmed against the sheet's own formatted text. Six decimals matches
            // the mirror's DECIMAL(20,6) column and validateCityFacts' limit; the
            // national reader never needs this because its own workbook values are
            // already clean to four decimals.
            value: new Decimal(cell.value).toDecimalPlaces(6).toFixed(),
            status: "published",
            sourceId: english.source_id,
            sourceLocator: cell.locator,
            lastReviewedAt: english.retrieved_at,
          });
        }
      });
    }
  }
  facts.sort(
    (a, b) => a.cityId.localeCompare(b.cityId) || a.seriesId.localeCompare(b.seriesId) || a.measure.localeCompare(b.measure) || a.period.localeCompare(b.period),
  );

  const coverage = validateCityFacts(facts);

  // Both readers read the national sheet, so they must agree on it (spec §4.3).
  const headline = options.headlineFacts ?? (await loadCpiFacts());
  for (const measure of CPI_CITY_MEASURES) {
    for (const fact of headline.filter((row) => row.seriesId === "cpi.headline" && row.measure === measure && row.period >= CITY_FIRST_PERIOD)) {
      if (full.get(GEORGIA)![measure].get(periodFromKey(fact.period)) !== Number(fact.value)) {
        throw new Error(`City reader and national reader disagree on the national sheet: ${measure} ${fact.period}`);
      }
    }
  }

  let maxConsistencyErrorPp = 0;
  for (const [line, series] of full) {
    const result = cityConsistencyError({ yoy: series.yoy_pct, mom: series.mom_pct, avg12: series.avg12_pct });
    if (result.comparisons === 0) throw new Error(`City consistency: nothing to compare for ${line}`);
    if (result.maxPp > CITY_CONSISTENCY_TOLERANCE_PP) throw new Error(`City consistency: ${line} differs from its own m/m chain by ${result.maxPp.toFixed(4)} pp`);
    maxConsistencyErrorPp = Math.max(maxConsistencyErrorPp, result.maxPp);
  }

  const fit = fitImpliedCityWeights(
    full.get(GEORGIA)!.mom_pct,
    new Map(CPI_CITY_IDS.map((cityId) => [cityId, full.get(cityId)!.mom_pct])),
    periodYear(periodFromKey(CITY_FIRST_PERIOD)),
  );
  assertImpliedCityWeights(fit);

  const previous = options.previousFacts === undefined ? await loadPreviousCityFacts() : options.previousFacts;
  if (previous) assertNoCityRevisions(previous, facts);

  const round = (value: number) => Number(value.toFixed(6));
  const validation: InflationCityReport = {
    cityCount: CPI_CITY_IDS.length,
    lastPeriod: coverage.lastPeriod,
    firstPeriods: coverage.firstPeriods,
    maxConsistencyErrorPp: round(maxConsistencyErrorPp),
    impliedWeights: fit.years.map((entry) => ({
      year: entry.year,
      months: entry.months,
      weights: Object.fromEntries(Object.entries(entry.weights).map(([id, weight]) => [id, round(weight)])),
      maxResidualPp: round(entry.maxResidualPp),
    })),
    skippedWeightYears: fit.skippedYears,
  };
  return { facts, validation };
}

async function loadPreviousCityFacts(): Promise<CpiCityFact[] | null> {
  try {
    return await loadCpiCityFacts();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function serializeCityFacts(facts: CpiCityFact[]): string {
  const lines = facts.map((fact) =>
    [fact.cityId, fact.seriesId, fact.measure, fact.period, fact.value, fact.status, fact.sourceId, fact.sourceLocator, fact.lastReviewedAt].map(csvEscape).join(","),
  );
  return BOM + [CITY_HEADERS.join(","), ...lines].join("\n") + "\n";
}

export function serializeCategoryFacts(facts: CpiCategoryFact[]): string {
  const lines = facts.map((fact) =>
    [
      fact.categoryId,
      fact.coicopCode,
      String(fact.level),
      fact.parentId ?? "",
      fact.measure,
      fact.period,
      fact.value,
      fact.status,
      fact.sourceId,
      fact.sourceLocator,
      fact.lastReviewedAt,
    ]
      .map(csvEscape)
      .join(","),
  );
  return BOM + [CATEGORY_HEADERS.join(","), ...lines].join("\n") + "\n";
}

export function serializeBasketWeights(weights: BasketWeightRow[]): string {
  const lines = weights.map((row) =>
    [row.categoryId, String(row.year), row.weightPct, row.sourceId, row.lastReviewedAt].map(csvEscape).join(","),
  );
  return BOM + [WEIGHT_HEADERS.join(","), ...lines].join("\n") + "\n";
}

export function serializeCpiFacts(facts: CpiFact[]): string {
  const lines = facts.map((fact) =>
    [fact.seriesId, fact.measure, fact.period, fact.value, fact.status, fact.sourceId, fact.sourceLocator, fact.lastReviewedAt].map(csvEscape).join(","),
  );
  return BOM + [CPI_HEADERS.join(","), ...lines].join("\n") + "\n";
}

export async function writeInflationArtifacts(mode: InflationArtifactMode) {
  if (mode === "public" || mode === "check-public") {
    // The processed-data download is the reviewed CSV itself (validated on load).
    await loadCpiFacts();
    if (mode === "check-public") {
      // After the build, like the GDP public CSV: the shipped copy is the reviewed file.
      await assertGeneratedArtifactMatches("public inflation CPI", PUBLIC_FILE, await fs.readFile(CPI_FACTS_FILE, "utf8"));
    } else {
      await fs.mkdir(path.dirname(PUBLIC_FILE), { recursive: true });
      await fs.copyFile(CPI_FACTS_FILE, PUBLIC_FILE);
    }
    return null;
  }
  // One verified read of the workbooks for all three extractions: each workbook
  // is then parsed once (readGeostatCpi's book cache is keyed by the buffer).
  const files = await readVerifiedCpiFiles(path.join(INFLATION_RAW_ROOT, "geostat-cpi", await latestCpiVintage()));
  const { facts, validation } = await prepareInflation({ files });
  const categories = await prepareInflationCategories({ headlineFacts: facts, files });
  const cities = await prepareInflationCities({ headlineFacts: facts, files });
  const outputs: Array<[string, string]> = [
    [CPI_FACTS_FILE, serializeCpiFacts(facts)],
    [CATEGORY_FACTS_FILE, serializeCategoryFacts(categories.facts)],
    [BASKET_WEIGHTS_FILE, serializeBasketWeights(categories.weights)],
    [CITY_FACTS_FILE, serializeCityFacts(cities.facts)],
    [
      REPORT_FILE,
      `${JSON.stringify({ ...validation, categories: categories.validation, cities: cities.validation } satisfies InflationReportFile, null, 2)}\n`,
    ],
  ];
  for (const [file, content] of outputs) {
    if (mode === "write") {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content);
    } else {
      await assertGeneratedArtifactMatches("inflation CPI", file, content);
    }
  }
  return validation;
}

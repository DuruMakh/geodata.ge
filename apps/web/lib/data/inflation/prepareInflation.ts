import fs from "node:fs/promises";
import path from "node:path";
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
import { loadCpiCategoryFacts, loadCpiFacts, loadInflationTargets } from "./importInflation";
import { periodFromKey, periodKey } from "./periods";
import { readGeostatBasketWeights } from "./readBasketWeights";
import { CPI_FILE_ROLES, readGeostatCpiCategories, readGeostatCpiFile } from "./readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage, readVerifiedCpiFiles } from "./sourceFiles";
import { categoryIdFromCoicop, type BasketWeightRow, type CpiCategoryFact, type CpiFact } from "./types";
import {
  assertLanguageParity,
  assertNoCategoryRevisions,
  assertNoRevisions,
  recomputeHeadline,
  validateBasketWeights,
  validateCategoryFacts,
  validateCpiFacts,
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

/** What data/reports/inflation-cpi-validation.json holds: the national report plus the category block. */
export type InflationReportFile = InflationValidationReport & { categories: InflationCategoryReport };

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
export async function prepareInflation(options: { rawRoot?: string; previousFacts?: CpiFact[] | null } = {}) {
  const rawRoot = options.rawRoot ?? INFLATION_RAW_ROOT;
  const vintage = await latestCpiVintage(rawRoot);
  const files = await readVerifiedCpiFiles(path.join(rawRoot, "geostat-cpi", vintage));

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
  options: { rawRoot?: string; previousFacts?: CpiCategoryFact[] | null; headlineFacts?: CpiFact[] } = {},
) {
  const rawRoot = options.rawRoot ?? INFLATION_RAW_ROOT;
  const vintage = await latestCpiVintage(rawRoot);
  const files = await readVerifiedCpiFiles(path.join(rawRoot, "geostat-cpi", vintage));

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
  const { facts, validation } = await prepareInflation();
  const categories = await prepareInflationCategories({ headlineFacts: facts });
  const outputs: Array<[string, string]> = [
    [CPI_FACTS_FILE, serializeCpiFacts(facts)],
    [CATEGORY_FACTS_FILE, serializeCategoryFacts(categories.facts)],
    [BASKET_WEIGHTS_FILE, serializeBasketWeights(categories.weights)],
    [REPORT_FILE, `${JSON.stringify({ ...validation, categories: categories.validation } satisfies InflationReportFile, null, 2)}\n`],
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

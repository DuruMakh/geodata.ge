import { registryDebtSourceId } from "../data/governmentDebt/sourceLineage";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import type { EnglishCatalogue, Locale } from "../i18n/types";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import {
  loadReviewedSourceManifest,
  type ValidatedSourceManifestRow,
} from "./sourceManifest";
import type { MethodologyDatasetId } from "./types";

export type WorkbookSourceRole =
  | "revenue"
  | "expenditure-fields"
  | "expenditure-ministries"
  | "municipal-functional"
  | "municipal-total";

type WorkbookSourceCacheKey = `${Locale}:${MethodologyDatasetId}:${WorkbookSourceRole}`;

function documentText(documentId: string, title: string, organization: string, locale: Locale, englishDocuments?: EnglishCatalogue["documents"]) {
  if (locale === "ka") return { title, organization };
  const document = englishDocuments && Object.hasOwn(englishDocuments, documentId) ? englishDocuments[documentId] : undefined;
  if (!document) throw new Error(`Missing English document: ${documentId}`);
  return { title: document.title.text, organization: document.publisher.text };
}

const expenditureSourceId = (year: number, kind: string) => `source.mof.expenditure.${year}.${kind}`;

// These tables mirror the reviewed fact generators and the source lineage in
// docs/data-methodology/treasury-functional-expenditure-methodology-2004-2025.md,
// docs/data-methodology/ministries-drilldown-programs-methodology.md, and
// docs/data-methodology/2005-2014-ministries-expenditure-methodology.md. They
// intentionally name the exact manifest identity used for each year, including
// the 2013 Chapter VI PDF and the 2014 actual column carried by 2015-fact.xlsx.
const EXPENDITURE_FIELD_LINEAGE: Readonly<Record<number, readonly string[]>> = {
  2004: [expenditureSourceId(2004, "mof_annual_execution_annex")],
  2005: [expenditureSourceId(2005, "treasury_e11")],
  2006: [expenditureSourceId(2006, "treasury_e11")],
  2007: [expenditureSourceId(2007, "treasury_e11")],
  2008: [expenditureSourceId(2008, "treasury_e11"), expenditureSourceId(2008, "mof_annual_execution")],
  2009: [expenditureSourceId(2009, "treasury_e11"), expenditureSourceId(2009, "mof_annual_execution")],
  2010: [expenditureSourceId(2010, "treasury_e11"), expenditureSourceId(2010, "mof_annual_execution")],
  2011: [expenditureSourceId(2011, "treasury_e11"), expenditureSourceId(2011, "mof_annual_execution")],
  2012: [expenditureSourceId(2012, "treasury_e11"), expenditureSourceId(2012, "mof_annual_execution")],
  2013: [expenditureSourceId(2013, "treasury_e11"), expenditureSourceId(2013, "mof_final_fact")],
  2014: [expenditureSourceId(2014, "treasury_e11"), expenditureSourceId(2014, "mof_annual_execution")],
  2015: [expenditureSourceId(2015, "treasury_e11"), expenditureSourceId(2015, "mof_annual_execution")],
  2016: [expenditureSourceId(2016, "treasury_e11"), expenditureSourceId(2016, "mof_annual_execution")],
  ...Object.fromEntries(Array.from({ length: 9 }, (_, index) => {
    const year = 2017 + index;
    return [year, [expenditureSourceId(year, "treasury_e11"), expenditureSourceId(year, "mof_excel_fact")]];
  })),
};

const MINISTRY_LINEAGE: Readonly<Record<number, readonly string[]>> = {
  2004: [expenditureSourceId(2004, "mof_annual_execution_annex")],
  2005: [expenditureSourceId(2005, "mof_excel_fact"), expenditureSourceId(2005, "treasury_e11"), expenditureSourceId(2005, "mof_annual_execution")],
  2006: [expenditureSourceId(2006, "mof_annual_execution")],
  2007: [expenditureSourceId(2007, "mof_annual_execution")],
  2008: [expenditureSourceId(2008, "mof_annual_execution")],
  2009: [expenditureSourceId(2009, "mof_annual_execution")],
  2010: [expenditureSourceId(2010, "mof_annual_execution")],
  2011: [expenditureSourceId(2011, "mof_annual_execution")],
  2012: [expenditureSourceId(2012, "mof_annual_execution")],
  2013: [expenditureSourceId(2013, "mof_excel_fact")],
  // 2014 actuals are col_4 in 2015-fact.xlsx, not 2014-fact.xlsx.
  2014: [expenditureSourceId(2015, "mof_excel_fact")],
  2015: [expenditureSourceId(2015, "mof_annual_execution")],
  2016: [expenditureSourceId(2016, "mof_annual_execution")],
  ...Object.fromEntries(Array.from({ length: 9 }, (_, index) => {
    const year = 2017 + index;
    return [year, [expenditureSourceId(year, "mof_excel_fact")]];
  })),
};

export function projectWorkbookSources(
  rows: readonly ValidatedSourceManifestRow[],
  locale: Locale = "ka",
  englishDocuments?: EnglishCatalogue["documents"],
): WorkbookPublicSource[] {
  const preferred = new Map<string, { row: ValidatedSourceManifestRow; years: Set<number> }>();
  for (const row of rows) {
    const existing = preferred.get(row.sha256);
    if (!existing) {
      preferred.set(row.sha256, { row, years: new Set(row.years) });
    } else {
      for (const year of row.years) existing.years.add(year);
      const preference = sourcePreference(row) - sourcePreference(existing.row);
      if (preference < 0 || (preference === 0 && row.source_id.localeCompare(existing.row.source_id, "en") < 0)) {
        existing.row = row;
      }
    }
  }
  return [...preferred.values()].map(({ row, years }) => ({
    years: [...years].sort((left, right) => left - right),
    ...documentText(row.source_id, row.display_title_ka, row.source_organization, locale, englishDocuments),
    downloadHref: row.downloadHref,
    retrievedAt: row.retrieved_at,
  }));
}

function sourcePreference(row: ValidatedSourceManifestRow): number {
  if (row.source_id.includes("mof_excel_fact")) return 0;
  if (row.source_id.includes("mof_final_fact")) return 1;
  return 2;
}

function roleRows(
  datasetId: MethodologyDatasetId,
  rows: readonly ValidatedSourceManifestRow[],
  role: WorkbookSourceRole,
): readonly ValidatedSourceManifestRow[] {
  if (role === "revenue") return rows;
  if (role === "municipal-functional") {
    return rows.filter((row) => row.source_id === "source.mof.municipalities.2015_2019.portal_functionals" || row.source_id.endsWith("functional_classification"));
  }
  if (role === "municipal-total") {
    return rows
      .filter((row) => row.source_id.includes("budget_history") || row.source_id === "source.mof.municipalities.2015_2019.portal_functionals" || row.source_id === "source.mof.municipalities.2024.functional_classification" || row.source_id.includes("adjara.republic"))
      .map((row) => row.source_id === "source.mof.municipalities.2015_2019.portal_functionals" ? { ...row, years: [2015] } : row);
  }
  if (role === "expenditure-ministries") {
    const ids = new Set(Object.values(MINISTRY_LINEAGE).flat());
    return rows.filter((row) => ids.has(row.source_id)).map((row) => {
      if (row.source_id === expenditureSourceId(2015, "mof_excel_fact")) return { ...row, years: [2014] };
      return row;
    });
  }
  if (datasetId !== "expenditure") return rows;
  const ids = new Set(Object.values(EXPENDITURE_FIELD_LINEAGE).flat());
  return rows.filter((row) => ids.has(row.source_id));
}

const municipalHistoryHrefPattern = /\/mof-municipality-budget-history-(\d{2})\.xlsx$/;
const adjaraRepublicHrefPattern = /\/adjara-republic-actual-payments\.(?:pdf|xlsx)$/;

export function scopeMunicipalWorkbookSources(
  sources: readonly WorkbookPublicSource[],
  scope: {
    municipalityCodes: readonly string[];
    includeAdjaraRepublic: boolean;
    includeAggregateOnlyCodes?: boolean;
  },
): WorkbookPublicSource[] {
  const includedCodes = new Set(scope.municipalityCodes);
  if (scope.includeAggregateOnlyCodes) {
    for (let code = 4; code <= 72; code += 1) includedCodes.add(String(code).padStart(2, "0"));
  }
  return sources.flatMap((source) => {
    const historyCode = municipalHistoryHrefPattern.exec(source.downloadHref)?.[1];
    if (historyCode !== undefined) {
      if (!includedCodes.has(historyCode)) return [];
      if (historyCode === "11" && source.years.includes(2024)) {
        return [{ ...source, years: source.years.filter((year) => year !== 2024) }];
      }
      return [source];
    }
    if (source.downloadHref.includes("mof-functional-classification")) {
      return includedCodes.has("11") && source.years.includes(2024) ? [source] : [];
    }
    return scope.includeAdjaraRepublic || !adjaraRepublicHrefPattern.test(source.downloadHref) ? [source] : [];
  });
}

const gdpWorkbookSourceRowSchema = z.object({
  source_id: z.string().trim().min(1),
  accounting_standard: z.enum(["sna_1993", "sna_2008"]),
  retrieved_file_url: z.string().url().startsWith("https://"),
  retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  selected_year_min: z.coerce.number().int(),
  selected_year_max: z.coerce.number().int(),
});

const titleByStandard = {
  sna_1993: "მშპ მიმდინარე ფასებში — SNA 1993",
  sna_2008: "მშპ მიმდინარე ფასებში — SNA 2008",
} as const;

export function projectGdpWorkbookSources(rows: readonly unknown[], locale: Locale = "ka", englishDocuments?: EnglishCatalogue["documents"]): WorkbookPublicSource[] {
  return rows.map((row, index) => {
    const parsed = gdpWorkbookSourceRowSchema.parse(row);
    if (parsed.selected_year_max < parsed.selected_year_min) {
      throw new Error(`Invalid descending GDP selected year range at row ${index + 1}`);
    }
    const years = Array.from(
      { length: parsed.selected_year_max - parsed.selected_year_min + 1 },
      (_, offset) => parsed.selected_year_min + offset,
    );
    return {
      years,
      ...documentText(parsed.source_id, titleByStandard[parsed.accounting_standard], "საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)", locale, englishDocuments),
      downloadHref: parsed.retrieved_file_url as `https://${string}`,
      retrievedAt: parsed.retrieved_at,
    };
  });
}

const cache = new Map<WorkbookSourceCacheKey, Promise<WorkbookPublicSource[]>>();
const gdpCache = new Map<Locale, Promise<WorkbookPublicSource[]>>();

export function loadWorkbookSources(
  datasetId: MethodologyDatasetId,
  role: WorkbookSourceRole = datasetId === "revenue" ? "revenue" : datasetId === "municipalities" ? "municipal-functional" : "expenditure-fields",
  locale: Locale = "ka",
): Promise<WorkbookPublicSource[]> {
  const cacheKey: WorkbookSourceCacheKey = `${locale}:${datasetId}:${role}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const pending = Promise.all([
    loadReviewedSourceManifest(repositoryRoot, datasetId),
    locale === "en" ? loadEnglishCatalogue(repositoryRoot) : undefined,
  ]).then(([rows, catalogue]) => projectWorkbookSources(roleRows(datasetId, rows, role), locale, catalogue?.documents));
  cache.set(cacheKey, pending);
  return pending;
}

export type SourcedWorkbookPublicSource = WorkbookPublicSource & { sourceId: string };

/**
 * Debt workbook sources keyed by registry source id, so the explorer matches a
 * fact's documents exactly instead of by filename substring. The join key is the
 * archive row's download path, which is unique per archived document.
 */
export async function loadDebtWorkbookSources(locale: Locale = "ka"): Promise<SourcedWorkbookPublicSource[]> {
  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const [rows, projected] = await Promise.all([
    loadReviewedSourceManifest(repositoryRoot, "debt"),
    loadWorkbookSources("debt", undefined, locale),
  ]);
  return projected.flatMap((source) => {
    const row = rows.find((candidate) => candidate.downloadHref === source.downloadHref);
    return row ? [{ ...source, sourceId: registryDebtSourceId(row.source_id) }] : [];
  });
}

export function loadGdpWorkbookSources(locale: Locale = "ka"): Promise<WorkbookPublicSource[]> {
  const existing = gdpCache.get(locale);
  if (existing) return existing;

  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const manifestPath = path.join(
    repositoryRoot,
    "docs",
    "Raw Data",
    "GDP",
    "national-nominal-gdp",
    "source-manifest.csv",
  );
  const pending = Promise.all([
    readFile(manifestPath, "utf8"), locale === "en" ? loadEnglishCatalogue(repositoryRoot) : undefined,
  ]).then(([csv, catalogue]) => projectGdpWorkbookSources(parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as unknown[], locale, catalogue?.documents));
  gdpCache.set(locale, pending);
  return pending;
}

const imfWeoManifestSchema = z.object({
  retrieved_file_url: z.string().url().startsWith("https://"),
  retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  publication_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  year_min: z.coerce.number().int(),
  year_max: z.coerce.number().int(),
});

let imfWeoManifest: Promise<ImfWeoManifest> | null = null;

export type ImfWeoManifest = {
  retrievedFileUrl: string;
  retrievedAt: string;
  publicationDate: string;
  yearMin: number;
  yearMax: number;
};

/** The reviewed IMF WEO edition behind the deficit dataset, read from its package manifest. */
export function loadImfWeoManifest(): Promise<ImfWeoManifest> {
  imfWeoManifest ??= (async () => {
    const manifestPath = path.resolve(
      process.cwd(),
      "../..",
      "docs/Raw Data/Deficit/imf-weo-general-government-balance/source-manifest.csv",
    );
    const rows = parse(await readFile(manifestPath, "utf8"), { bom: true, columns: true, skip_empty_lines: true, trim: true }) as unknown[];
    if (rows.length !== 1) throw new Error("Expected exactly one IMF WEO manifest row");
    const row = imfWeoManifestSchema.parse(rows[0]);
    return {
      retrievedFileUrl: row.retrieved_file_url,
      retrievedAt: row.retrieved_at,
      publicationDate: row.publication_date,
      yearMin: row.year_min,
      yearMax: row.year_max,
    };
  })();
  return imfWeoManifest;
}

export function resetWorkbookSourceCacheForTests(): void {
  cache.clear();
  gdpCache.clear();
  imfWeoManifest = null;
}

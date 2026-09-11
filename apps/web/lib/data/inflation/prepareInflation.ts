import fs from "node:fs/promises";
import path from "node:path";
import { csvEscape } from "../csvEscape";
import { readCsvRecords } from "../csv";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { loadCpiFacts, loadInflationTargets } from "./importInflation";
import { periodKey } from "./periods";
import { CPI_FILE_ROLES, readGeostatCpiFile } from "./readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage, readVerifiedCpiFiles } from "./sourceFiles";
import type { CpiFact } from "./types";
import { assertLanguageParity, assertNoRevisions, recomputeHeadline, validateCpiFacts } from "./validateInflation";

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const CPI_FACTS_FILE = path.join(REPO_ROOT, "data/imports/cpi-national-monthly.csv");
const REPORT_FILE = path.join(REPO_ROOT, "data/reports/inflation-cpi-validation.json");
const PUBLIC_FILE = path.resolve(process.cwd(), "public/downloads/data/inflation-cpi-national.csv");
const CPI_HEADERS = ["series_id", "measure", "period", "value", "status", "source_id", "source_locator", "last_reviewed_at"];
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
  const errors = recomputeHeadline(facts);
  const previous = options.previousFacts === undefined ? await loadPreviousFacts() : options.previousFacts;
  if (previous) assertNoRevisions(previous, facts);

  const sourceIds = await registeredSourceIds();
  const targets = await loadInflationTargets();
  for (const id of new Set([...facts, ...targets].map((row) => row.sourceId))) {
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
  const outputs: Array<[string, string]> = [
    [CPI_FACTS_FILE, serializeCpiFacts(facts)],
    [REPORT_FILE, `${JSON.stringify(validation, null, 2)}\n`],
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

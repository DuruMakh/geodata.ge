import Decimal from "decimal.js";
import { readCsvRecords } from "../csv";
import { assertSameServedRows } from "../servedDataParity";
import {
  CPI_MEASURES,
  CPI_SERIES_IDS,
  type CpiFact,
  type InflationTargetRow,
  type ServedCpiFact,
  type ServedInflationTargetRow,
} from "./types";
import { factKey, validateCpiFacts, validateTargetRows } from "./validateInflation";

// Relative to apps/web, like every served CSV path (lib/data/servedData.ts).
export const CPI_FACTS_CSV = "../../data/imports/cpi-national-monthly.csv";
export const INFLATION_TARGETS_CSV = "../../data/imports/nbg-inflation-target.csv";

export async function loadCpiFacts(relativePath = CPI_FACTS_CSV): Promise<CpiFact[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map((row): CpiFact => {
    if (!(CPI_SERIES_IDS as readonly string[]).includes(row.series_id)) throw new Error(`Unknown CPI series ${row.series_id}`);
    if (!(CPI_MEASURES as readonly string[]).includes(row.measure)) throw new Error(`Unknown CPI measure ${row.measure}`);
    return {
      seriesId: row.series_id as CpiFact["seriesId"],
      measure: row.measure as CpiFact["measure"],
      period: row.period,
      value: new Decimal(row.value).toFixed(),
      status: row.status as CpiFact["status"],
      sourceId: row.source_id,
      sourceLocator: row.source_locator,
      lastReviewedAt: row.last_reviewed_at,
    };
  });
  validateCpiFacts(facts);
  return facts;
}

export async function loadInflationTargets(relativePath = INFLATION_TARGETS_CSV): Promise<InflationTargetRow[]> {
  const rows = await readCsvRecords(relativePath);
  const targets = rows.map((row): InflationTargetRow => ({
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to === "" ? null : row.effective_to,
    targetPct: new Decimal(row.target_pct).toFixed(),
    sourceId: row.source_id,
    lastReviewedAt: row.last_reviewed_at,
  }));
  validateTargetRows(targets);
  return targets;
}

const SOURCE_DOCUMENTS_CSV = "../../data/sources/source-documents.csv";

export function assertInflationParity(
  csv: { facts: CpiFact[]; targets: InflationTargetRow[] },
  db: { facts: CpiFact[]; targets: InflationTargetRow[] },
): void {
  validateCpiFacts(db.facts);
  validateTargetRows(db.targets);
  assertSameServedRows("Inflation CPI", csv.facts, db.facts, factKey);
  assertSameServedRows("NBG inflation target", csv.targets, db.targets, (row) => row.effectiveFrom);
}

export async function loadServedInflationData(): Promise<{ facts: ServedCpiFact[]; targets: ServedInflationTargetRow[] }> {
  const mode = (process.env.GEODATA_DATA_SOURCE ?? "csv").trim().toLowerCase();
  if (mode !== "csv" && mode !== "" && mode !== "db") throw new Error("Invalid GEODATA_DATA_SOURCE");
  let facts = await loadCpiFacts();
  let targets = await loadInflationTargets();
  const registered = new Set((await readCsvRecords(SOURCE_DOCUMENTS_CSV)).map((row) => row.source_id));
  for (const id of new Set([...facts, ...targets].map((row) => row.sourceId))) {
    if (!registered.has(id)) throw new Error(`Inflation source ${id} is not registered in data/sources/source-documents.csv`);
  }
  if (mode === "db") {
    const { loadInflationDataFromDb } = await import("../../db/servedDataDb");
    const db = await loadInflationDataFromDb();
    assertInflationParity({ facts, targets }, db);
    facts = db.facts;
    targets = db.targets;
  }
  return {
    facts: facts.map((fact) => ({ ...fact, value: Number(fact.value) })),
    targets: targets.map((row) => ({ ...row, targetPct: Number(row.targetPct) })),
  };
}

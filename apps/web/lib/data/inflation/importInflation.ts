import Decimal from "decimal.js";
import { readCsvRecords } from "../csv";
import { CPI_MEASURES, CPI_SERIES_IDS, type CpiFact, type InflationTargetRow } from "./types";
import { validateCpiFacts, validateTargetRows } from "./validateInflation";

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

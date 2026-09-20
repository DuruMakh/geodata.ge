import Decimal from "decimal.js";
import { readCsvRecords } from "../csv";
import { assertSameServedRows } from "../servedDataParity";
import { validateGdpObservations } from "./validation";
import {
  GDP_SERIES,
  type GdpObservation,
  type GdpSeriesId,
  type ServedGdpObservation,
} from "./types";
import { resolveServedDataSource } from "../servedDataSource";

export function assertGdpParity(csv: GdpObservation[], db: GdpObservation[]) {
  validateGdpObservations(csv);
  validateGdpObservations(db);
  assertSameServedRows(
    "GDP overview",
    csv,
    db,
    (f) => `${f.seriesId}:${f.year}`,
  );
}
export async function loadGdpOverviewFacts(
  relativePath = "../../data/imports/gdp-overview-annual.csv",
): Promise<GdpObservation[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map((r) => {
    if (!(r.series_id in GDP_SERIES)) throw new Error("Unknown GDP series");
    if (
      !r.source_id ||
      !r.source_locator ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.last_reviewed_at)
    )
      throw new Error("GDP provenance missing");
    return {
      seriesId: r.series_id as GdpSeriesId,
      year: Number(r.year),
      value: new Decimal(r.value).toFixed(),
      unit: r.unit as GdpObservation["unit"],
      status: r.status as GdpObservation["status"],
      accountingStandard: (r.accounting_standard ||
        null) as GdpObservation["accountingStandard"],
      sourceId: r.source_id,
      sourceLocator: r.source_locator,
      lastReviewedAt: r.last_reviewed_at,
    };
  });
  validateGdpObservations(facts);
  return facts;
}
export async function loadServedGdpOverviewData(): Promise<{
  facts: ServedGdpObservation[];
}> {
  const mode = resolveServedDataSource();
  let facts = await loadGdpOverviewFacts();
  if (mode === "db") {
    const { loadGdpOverviewFactsFromDb } = await import(
      "../../db/servedDataDb"
    );
    const db = await loadGdpOverviewFactsFromDb();
    assertGdpParity(facts, db);
    facts = db;
  }
  return { facts: facts.map((f) => ({ ...f, value: Number(f.value) })) };
}

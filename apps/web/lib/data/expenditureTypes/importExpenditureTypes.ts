import { readFileSync } from "node:fs";
import path from "node:path";
import { readCsvRecords } from "../csv";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import type { SectorDefinition, SectorObservation, ServedSectorObservation } from "../economicSectors/types";
import { EXPENDITURE_TYPES_CSV_PATH, EXPENDITURE_TYPES_REGISTRY_PATH } from "./types";
import { validateExpenditureTypeObservations } from "./validation";

// Read at build time, like the canonical CSVs; the taxonomy is outside the app's bundle root.
export const EXPENDITURE_TYPES: SectorDefinition[] = JSON.parse(readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..", EXPENDITURE_TYPES_REGISTRY_PATH), "utf8"));

export function assertExpenditureTypesParity(csv: SectorObservation[], db: SectorObservation[]) {
  validateExpenditureTypeObservations(csv, EXPENDITURE_TYPES);
  validateExpenditureTypeObservations(db, EXPENDITURE_TYPES);
  assertSameServedRows("Spending by type", csv, db, f => `${f.seriesId}:${f.measure}:${f.year}`);
}

export async function loadExpenditureTypeFacts(relativePath = `../../${EXPENDITURE_TYPES_CSV_PATH}`): Promise<SectorObservation[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map(r => ({
    seriesId: r.series_id, year: Number(r.year), measure: r.measure as SectorObservation["measure"],
    value: r.value, unit: r.unit as SectorObservation["unit"],
    valuation: r.valuation as SectorObservation["valuation"], priceBasis: r.price_basis as SectorObservation["priceBasis"],
    calculation: r.calculation as SectorObservation["calculation"], status: r.status as SectorObservation["status"],
    sourceId: r.source_id, sourceLocator: r.source_locator, lastReviewedAt: r.last_reviewed_at,
  }));
  validateExpenditureTypeObservations(facts, EXPENDITURE_TYPES);
  return facts;
}

// Build-time memo, as servedData.ts documents: one load per process, and a cached
// rejection so the first parity failure is the build failure.
let served: Promise<{ facts: ServedSectorObservation[] }> | null = null;

export function loadServedExpenditureTypesData(): Promise<{ facts: ServedSectorObservation[] }> {
  served ??= (async () => {
    let facts = await loadExpenditureTypeFacts();
    if (resolveServedDataSource() === "db") {
      const { loadExpenditureTypeFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadExpenditureTypeFactsFromDb();
      assertExpenditureTypesParity(facts, mirror);
      facts = mirror;
    }
    return { facts: facts.map(fact => ({ ...fact, value: Number(fact.value) })) };
  })();
  return served;
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { readCsvRecords } from "../csv";
import { assertSameServedRows } from "../servedDataParity";
import { validateSectorObservations } from "./validation";
import type { SectorDefinition, SectorObservation, ServedSectorObservation } from "./types";

// Read at build time, like the canonical CSVs; the taxonomy is outside the app's bundle root.
const registry: SectorDefinition[] = JSON.parse(readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/taxonomy/economic-sectors.json"), "utf8"));

export const ECONOMIC_SECTORS = registry;

export function assertEconomicSectorParity(csv: SectorObservation[], db: SectorObservation[]) {
  validateSectorObservations(csv, registry);
  validateSectorObservations(db, registry);
  assertSameServedRows("Economic sectors", csv, db, f => `${f.seriesId}:${f.measure}:${f.year}`);
}

export async function loadEconomicSectorFacts(
  relativePath = "../../data/imports/economic-sectors-annual.csv",
): Promise<SectorObservation[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map(r => ({
    seriesId: r.series_id, year: Number(r.year), measure: r.measure as SectorObservation["measure"],
    value: r.value, unit: r.unit as SectorObservation["unit"],
    valuation: r.valuation as SectorObservation["valuation"], priceBasis: r.price_basis as SectorObservation["priceBasis"],
    calculation: r.calculation as SectorObservation["calculation"], status: r.status as SectorObservation["status"],
    sourceId: r.source_id, sourceLocator: r.source_locator, lastReviewedAt: r.last_reviewed_at,
  }));
  validateSectorObservations(facts, registry);
  if (!facts.length) throw new Error("Economic sector facts are empty");
  return facts;
}

export async function loadServedEconomicSectorsData(): Promise<{ facts: ServedSectorObservation[] }> {
  const mode = (process.env.GEODATA_DATA_SOURCE ?? "csv").trim().toLowerCase();
  if (!["", "csv", "db"].includes(mode)) throw new Error("Invalid GEODATA_DATA_SOURCE");
  let facts = await loadEconomicSectorFacts();
  if (mode === "db") {
    const { loadEconomicSectorFactsFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadEconomicSectorFactsFromDb();
    assertEconomicSectorParity(facts, mirror);
    facts = mirror;
  }
  return { facts: facts.map(f => ({ ...f, value: Number(f.value) })) };
}

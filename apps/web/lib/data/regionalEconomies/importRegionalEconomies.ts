import { readFileSync } from "node:fs";
import path from "node:path";
import { readCsvRecords } from "../csv";
import { assertSameServedRows } from "../servedDataParity";
import type { MunicipalRegion } from "../municipal/types";
import type { SectorDefinition } from "../economicSectors/types";
import type {
  RegionalEconomyObservation,
  ServedRegionalEconomyObservation,
} from "./types";
import { validateRegionalEconomyObservations } from "./validation";
import { resolveServedDataSource } from "../servedDataSource";

const repositoryFile = (relativePath: string) =>
  path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);

const regions = JSON.parse(
  readFileSync(repositoryFile("../../data/taxonomy/municipal-regions.json"), "utf8"),
) as MunicipalRegion[];
const sectors = JSON.parse(
  readFileSync(repositoryFile("../../data/taxonomy/economic-sectors.json"), "utf8"),
) as SectorDefinition[];

export const REGIONAL_ECONOMY_REGIONS = regions;
export const REGIONAL_ECONOMY_SECTORS = sectors.filter((sector) => sector.classificationCode !== null);

export function assertRegionalEconomyParity(
  csv: RegionalEconomyObservation[],
  db: RegionalEconomyObservation[],
) {
  try {
    validateRegionalEconomyObservations(csv, regions, sectors);
    validateRegionalEconomyObservations(db, regions, sectors);
    assertSameServedRows(
      "Regional economies",
      csv,
      db,
      (row) => `${row.regionId}:${row.seriesId}:${row.measure}:${row.year}`,
    );
  } catch (error) {
    throw new Error(
      `Regional economies parity failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function loadRegionalEconomyFacts(
  relativePath = "../../data/imports/regional-economies-annual.csv",
): Promise<RegionalEconomyObservation[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map((row): RegionalEconomyObservation => ({
    regionId: row.region_id,
    seriesId: row.series_id,
    year: Number(row.year),
    measure: row.measure as RegionalEconomyObservation["measure"],
    value: row.value,
    unit: row.unit as RegionalEconomyObservation["unit"],
    valuation: row.valuation as RegionalEconomyObservation["valuation"],
    priceBasis: row.price_basis as RegionalEconomyObservation["priceBasis"],
    calculation: row.calculation as RegionalEconomyObservation["calculation"],
    status: row.status as RegionalEconomyObservation["status"],
    sourceId: row.source_id,
    sourceLocator: row.source_locator,
    lastReviewedAt: row.last_reviewed_at,
  }));
  if (facts.length === 0) throw new Error("Regional economy facts are empty");
  validateRegionalEconomyObservations(facts, regions, sectors);
  return facts;
}

export async function loadServedRegionalEconomyData(): Promise<{
  facts: ServedRegionalEconomyObservation[];
}> {
  const mode = resolveServedDataSource();
  let facts = await loadRegionalEconomyFacts();
  if (mode === "db") {
    const { loadRegionalEconomyFactsFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadRegionalEconomyFactsFromDb();
    assertRegionalEconomyParity(facts, mirror);
    facts = mirror;
  }
  return { facts: facts.map((fact) => ({ ...fact, value: Number(fact.value) })) };
}

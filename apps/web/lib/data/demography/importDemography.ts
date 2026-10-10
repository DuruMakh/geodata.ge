import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { assertSameServedRows, demographyFactParityKey } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { parseCanonicalDemographyRows } from "./canonicalRows";
import { FAMILIES, populationEstimateBasis, SERIES } from "./series";
import type { DemographyObservation, EstimateBasis, ServedDemographyObservation } from "./types";

// The files this release serves. SERVED_DATA_FILES names the same paths (a test keeps the two
// equal); they are spelled here too because servedData.ts imports this module, and importing it
// back would close a cycle. Later demography pages add their files here and to SERVED_DATA_FILES.
export const SERVED_DEMOGRAPHY_FILES = [
  "../../data/imports/demography-population-annual.csv",
  "../../data/imports/demography-density-annual.csv",
  "../../data/imports/demography-migration-annual.csv",
  "../../data/imports/demography-vital-annual.csv",
  "../../data/imports/demography-fertility-age-annual.csv",
] as const;

// The migration, vital-events and fertility files are mirrored whole, as the import mirrors files as they are.
// Pages read only the series they show; the infant mortality rate and the crude rates are mirrored, not shown.
const MIGRATION_SERIES = new Set<string>(FAMILIES.migration);
const REGISTERED_SERIES = new Set<string>([...FAMILIES.vital, ...FAMILIES.fertility]);
const SERVED_SERIES = new Set<string>([SERIES.populationTotal, SERIES.populationDensity, ...MIGRATION_SERIES, ...REGISTERED_SERIES]);

/** Population and density follow the lineage of their year; migration is border-police data and vital events are registered events in every year. */
function expectedBasis(fact: DemographyObservation): EstimateBasis {
  if (MIGRATION_SERIES.has(fact.seriesId)) return "border_police";
  if (REGISTERED_SERIES.has(fact.seriesId)) return "registered";
  return populationEstimateBasis(fact.year);
}

// Everything the loader can check without the Geostat workbooks: the series are served ones, no
// key repeats, and every row's basis is the one its series and year require (foundation section 4).
function validateServedDemography(facts: readonly DemographyObservation[]): void {
  if (facts.length === 0) throw new Error("Demography facts are empty");
  const keys = new Set<string>();
  for (const fact of facts) {
    if (!SERVED_SERIES.has(fact.seriesId)) throw new Error(`Demography series is not served: ${fact.seriesId}`);
    const expected = expectedBasis(fact);
    if (fact.estimateBasis !== expected) {
      throw new Error(`Demography basis ${fact.estimateBasis} is not ${expected} in ${fact.year} for ${fact.seriesId}|${fact.geographyId}`);
    }
    const key = demographyFactParityKey(fact);
    if (keys.has(key)) throw new Error(`Duplicate demography row ${key}`);
    keys.add(key);
  }
}

export function assertDemographyParity(csv: DemographyObservation[], db: DemographyObservation[]) {
  try {
    validateServedDemography(csv);
    validateServedDemography(db);
    assertSameServedRows("Demography", csv, db, demographyFactParityKey);
  } catch (error) {
    throw new Error(`Demography parity failed: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

export async function loadDemographyFacts(
  relativePaths: readonly string[] = SERVED_DEMOGRAPHY_FILES,
): Promise<DemographyObservation[]> {
  const facts: DemographyObservation[] = [];
  for (const relativePath of relativePaths) {
    const filePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);
    const text = await readFile(filePath, "utf8");
    // The mirror stores a Decimal and hands back its shortest text, so "65.0" must read as "65"
    // here or db mode would reject a faithful import.
    for (const fact of parseCanonicalDemographyRows(text, relativePath)) {
      facts.push({ ...fact, value: new Decimal(fact.value).toFixed() });
    }
  }
  validateServedDemography(facts);
  return facts;
}

// Build-time memo, for the reasons servedData.ts documents: one load per process, concurrent
// callers collapsed onto it, and a cached rejection so the first parity failure is the build failure.
let servedDemographyPromise: Promise<{ facts: DemographyObservation[] }> | null = null;
let servedDemographyNumbersPromise: Promise<{ facts: ServedDemographyObservation[] }> | null = null;

export function loadServedDemographyRows(): Promise<{ facts: DemographyObservation[] }> {
  servedDemographyPromise ??= loadServedDemographyRowsUncached();
  return servedDemographyPromise;
}

export function loadServedDemographyData(): Promise<{ facts: ServedDemographyObservation[] }> {
  servedDemographyNumbersPromise ??= loadServedDemographyRows().then(({ facts }) => ({
    facts: facts.map((fact) => ({ ...fact, value: Number(fact.value) })),
  }));
  return servedDemographyNumbersPromise;
}

export function resetDemographyCacheForTests(): void {
  servedDemographyPromise = null;
  servedDemographyNumbersPromise = null;
}

async function loadServedDemographyRowsUncached(): Promise<{ facts: DemographyObservation[] }> {
  const mode = resolveServedDataSource();
  let facts = await loadDemographyFacts();
  if (mode === "db") {
    const { loadDemographyFactsFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadDemographyFactsFromDb();
    assertDemographyParity(facts, mirror);
    facts = mirror;
  }
  return { facts };
}

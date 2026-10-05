import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { assertSameServedRows, demographyFactParityKey } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { parseCanonicalDemographyRows } from "./canonicalRows";
import { populationEstimateBasis, SERIES } from "./series";
import type { DemographyObservation, ServedDemographyObservation } from "./types";

// The files this release serves. SERVED_DATA_FILES names the same paths (a test keeps the two
// equal); they are spelled here too because servedData.ts imports this module, and importing it
// back would close a cycle. Later demography pages add their files here and to SERVED_DATA_FILES.
export const SERVED_DEMOGRAPHY_FILES = [
  "../../data/imports/demography-population-annual.csv",
  "../../data/imports/demography-density-annual.csv",
] as const;

const SERVED_SERIES = new Set<string>([SERIES.populationTotal, SERIES.populationDensity]);

// Everything the loader can check without the Geostat workbooks: the series are served ones, no
// key repeats, and every row's basis is the lineage of its year (foundation section 4).
function validateServedDemography(facts: readonly DemographyObservation[]): void {
  if (facts.length === 0) throw new Error("Demography facts are empty");
  const keys = new Set<string>();
  for (const fact of facts) {
    if (!SERVED_SERIES.has(fact.seriesId)) throw new Error(`Demography series is not served: ${fact.seriesId}`);
    if (fact.estimateBasis !== populationEstimateBasis(fact.year)) {
      throw new Error(
        `Demography basis ${fact.estimateBasis} disagrees with the lineage of ${fact.year} for ${fact.seriesId}|${fact.geographyId}`,
      );
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

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { ENERGY_FOOD_UNIT_DECIMALS, energyFoodFactKey, type ClientEnergyFoodFact, type EnergyFoodAcceptance, type EnergyFoodFact } from "./types";
import { validateEnergyFoodFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];

/** `repositoryRoot` defaults to the repository the web app runs in; tests point it at a temporary copy. */
export async function loadEnergyFoodFacts(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Promise<EnergyFoodFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/imports/energy-food-annual.csv")),
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/reports/energy-food-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as EnergyFoodAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Energy and food acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Energy and food canonical fields missing");
  const facts: EnergyFoodFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as EnergyFoodFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as EnergyFoodFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as EnergyFoodFact["valueStatus"],
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: row.last_reviewed_at,
  }));
  validateEnergyFoodFacts(facts);
  if (facts.length !== report.observations) throw new Error("Energy and food acceptance count mismatch");
  return facts;
}

export function assertEnergyFoodParity(csv: readonly EnergyFoodFact[], mirror: readonly EnergyFoodFact[]): void {
  validateEnergyFoodFacts(csv);
  validateEnergyFoodFacts(mirror);
  const normalized = (facts: readonly EnergyFoodFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Energy and food", normalized(csv), normalized(mirror), energyFoodFactKey);
}

let servedPromise: Promise<{ facts: EnergyFoodFact[] }> | null = null;
export function loadServedEnergyFoodData(): Promise<{ facts: EnergyFoodFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadEnergyFoodFacts();
    if (resolveServedDataSource() === "db") {
      const { loadEnergyFoodFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadEnergyFoodFactsFromDb();
      assertEnergyFoodParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** Client values are the figures Geostat prints (published precision); exact stored values stay server-side. */
export function toClientEnergyFoodFact(fact: EnergyFoodFact): ClientEnergyFoodFact {
  const { year, indicatorId, sourceId, valueStatus } = fact;
  return { year, indicatorId, sourceId, valueStatus, value: Number(fact.publishedValue), decimals: ENERGY_FOOD_UNIT_DECIMALS[fact.unit] };
}

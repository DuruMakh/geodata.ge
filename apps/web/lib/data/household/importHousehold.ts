import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { householdFactKey, type ClientHouseholdFact, type HouseholdAcceptance, type HouseholdFact } from "./types";
import { validateHouseholdFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "area_id", "measure", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];

export async function loadHouseholdFacts(): Promise<HouseholdFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/household-income-spending-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/household-income-spending-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as HouseholdAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Household acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Household canonical fields missing");
  const facts: HouseholdFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as HouseholdFact["indicatorId"], areaId: row.area_id as HouseholdFact["areaId"], measure: row.measure as HouseholdFact["measure"],
    value: row.value, publishedValue: row.published_value, unit: row.unit as "gel_month", basis: row.basis as "actual", valueStatus: row.value_status as "survey_estimate",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: row.last_reviewed_at,
  }));
  validateHouseholdFacts(facts);
  if (facts.length !== report.observations) throw new Error("Household acceptance count mismatch");
  return facts;
}

export function assertHouseholdParity(csv: readonly HouseholdFact[], mirror: readonly HouseholdFact[]): void {
  validateHouseholdFacts(csv);
  validateHouseholdFacts(mirror);
  const normalized = (facts: readonly HouseholdFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Household income and spending", normalized(csv), normalized(mirror), householdFactKey);
}

let servedPromise: Promise<{ facts: HouseholdFact[] }> | null = null;
export function loadServedHouseholdData(): Promise<{ facts: HouseholdFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadHouseholdFacts();
    if (resolveServedDataSource() === "db") {
      const { loadHouseholdFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadHouseholdFactsFromDb();
      assertHouseholdParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** Client values are the figures Geostat prints (published precision); exact stored values stay server-side. */
export function toClientHouseholdFact(fact: HouseholdFact): ClientHouseholdFact {
  const { year, indicatorId, areaId, measure } = fact;
  return { year, indicatorId, areaId, measure, value: Number(fact.publishedValue) };
}

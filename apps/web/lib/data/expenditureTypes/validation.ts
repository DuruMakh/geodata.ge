import Decimal from "decimal.js";
import type { SectorDefinition, SectorObservation } from "../economicSectors/types";
import { EXPENDITURE_TYPES_FIRST_YEAR as FIRST_YEAR, EXPENDITURE_TYPES_SOURCE_ID } from "./types";

const MEASURES = ["nominal", "share_of_gdp"] as const;
const key = (f: Pick<SectorObservation, "seriesId" | "measure" | "year">) => `${f.seriesId}:${f.measure}:${f.year}`;
const UNIT = { nominal: "gel", share_of_gdp: "percent" } as const;
const CALCULATION = { nominal: "published", share_of_gdp: "ratio_to_gdp" } as const;

function assertCanonicalDecimal(value: string, id: string): void {
  // Decimal(40,20) in the mirror: reject rather than round.
  if (typeof value !== "string" || !/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value) || value === "-0") throw new Error(`Invalid decimal ${id}`);
  const decimal = new Decimal(value);
  if (decimal.decimalPlaces() > 20 || decimal.abs().gte("100000000000000000000")) throw new Error(`Decimal does not fit the mirror ${id}`);
}

/**
 * Row validity and complete coverage of the served spending-by-type observations. The shares' GDP denominators are
 * checked where they are calculated (the preparation, whose `--check` runs in `data:validate`).
 */
export function validateExpenditureTypeObservations(facts: readonly SectorObservation[], registry: readonly SectorDefinition[]): void {
  if (!facts.length) throw new Error("Spending by type facts are empty");
  const ids = new Set(registry.map(r => r.id));
  const rows = new Map<string, SectorObservation>();
  const lastYear = Math.max(...facts.map(f => f.year));
  for (const f of facts) {
    const id = key(f);
    if (!ids.has(f.seriesId)) throw new Error(`Unknown spending by type series ${f.seriesId}`);
    if (!Number.isInteger(f.year) || f.year < FIRST_YEAR || f.year > new Date().getUTCFullYear()) throw new Error(`Invalid year ${id}`);
    if (rows.has(id)) throw new Error(`Duplicate spending by type observation ${id}`);
    rows.set(id, f);
    if (f.measure !== "nominal" && f.measure !== "share_of_gdp") throw new Error(`Unpublished measure ${id}`);
    assertCanonicalDecimal(f.value, id);
    if (f.unit !== UNIT[f.measure] || f.calculation !== CALCULATION[f.measure] || f.priceBasis !== "current_prices" || f.valuation !== "market_prices")
      throw new Error(`Invalid measure fields ${id}`);
    // The Ministry's amounts are final; a share is preliminary only through its GDP denominator.
    if (f.status !== "published" && !(f.status === "preliminary" && f.measure === "share_of_gdp")) throw new Error(`Invalid status ${id}`);
    if (f.sourceId !== EXPENDITURE_TYPES_SOURCE_ID || !f.sourceLocator || !/^\d{4}-\d{2}-\d{2}$/.test(f.lastReviewedAt)) throw new Error(`Missing provenance ${id}`);
  }
  const missing = registry.flatMap(({ id }) => MEASURES.flatMap(measure =>
    Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, i) => key({ seriesId: id, measure, year: FIRST_YEAR + i })).filter(k => !rows.has(k))));
  if (missing.length) throw new Error(`Incomplete spending by type coverage: ${missing[0]}`);
}

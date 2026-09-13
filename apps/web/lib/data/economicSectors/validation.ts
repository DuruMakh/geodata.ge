import Decimal from "decimal.js";
import { sharePercent } from "./calculations";
import type { SectorDefinition, SectorObservation, SectorStatus, SectorValidationReport } from "./types";

const GDP = "economy.gdp_total";
const measures = ["nominal", "share_of_gdp", "real_growth"] as const;
const key = (f: Pick<SectorObservation, "seriesId" | "measure" | "year">) => `${f.seriesId}:${f.measure}:${f.year}`;
const nonempty = (value: string) => typeof value === "string" && value.trim().length > 0;
const validStatus = (value: SectorStatus) => value === "published" || value === "preliminary";
const statusOf = (inputs: { status: SectorStatus }[]): SectorStatus =>
  inputs.some((f) => f.status === "preliminary") ? "preliminary" : "published";

function validateDecimal(value: string): void {
  // Decimal(40,20): reject rather than round a published value for the mirror.
  if (typeof value !== "string" || !/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value))
    throw new Error("Invalid canonical decimal");
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || (decimal.isZero() && value.startsWith("-")) ||
      decimal.decimalPlaces() > 20 || decimal.abs().gte("100000000000000000000"))
    throw new Error("Decimal does not fit the sector mirror");
}

function validateProvenance(f: { sourceId: string; sourceLocator: string; lastReviewedAt: string }): void {
  const date = f.lastReviewedAt;
  if (!nonempty(f.sourceId) || !nonempty(f.sourceLocator) || typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
    throw new Error("Missing or invalid source provenance/review date");
}

export function validateSectorObservations(
  facts: SectorObservation[],
  registry: readonly SectorDefinition[],
): SectorValidationReport {
  const ids = new Set(registry.map((f) => f.id));
  const rows = new Map<string, SectorObservation>();
  for (const f of facts) {
    if (!ids.has(f.seriesId)) throw new Error(`Unknown sector ${f.seriesId}`);
    if (!Number.isInteger(f.year) || f.year < 2010 || f.year > 2025)
      throw new Error(`Invalid annual sector year ${f.year}`);
    if (rows.has(key(f))) throw new Error(`Duplicate sector observation ${key(f)}`);
    rows.set(key(f), f);
    validateDecimal(f.value);
    validateProvenance(f);
    if (!validStatus(f.status)) throw new Error(`Invalid sector status ${key(f)}`);
    if (f.valuation !== (f.seriesId === GDP ? "market_prices" : "basic_prices"))
      throw new Error(`Invalid sector valuation ${key(f)}`);
    if (!measures.includes(f.measure) || f.unit !== (f.measure === "nominal" ? "gel" : "percent"))
      throw new Error(`Invalid sector measure/unit ${key(f)}`);
    if (f.priceBasis !== (f.measure === "real_growth" ? "volume_change" : "current_prices") ||
        (f.measure === "nominal" && f.calculation !== "published") ||
        (f.measure === "share_of_gdp" && f.calculation !== "ratio_to_gdp") ||
        (f.measure === "real_growth" && !["published", "year_over_year", "index_to_growth"].includes(f.calculation)))
      throw new Error(`Invalid sector calculation/price basis ${key(f)}`);
  }

  const find = (seriesId: string, measure: SectorObservation["measure"], year: number) =>
    rows.get(key({ seriesId, measure, year }));
  for (const f of facts) {
    if (f.measure === "nominal") {
      const gdp = find(GDP, "nominal", f.year);
      if (gdp && sharePercent(f.value, gdp.value) !== null && !find(f.seriesId, "share_of_gdp", f.year))
        throw new Error(`Missing calculated GDP share ${key(f)}`);
    }
    if (f.measure === "share_of_gdp") {
      const numerator = find(f.seriesId, "nominal", f.year);
      const denominator = find(GDP, "nominal", f.year);
      if (!numerator || !denominator || f.value !== sharePercent(numerator.value, denominator.value))
        throw new Error(`Invalid same-year nominal/share pair ${key(f)}`);
      if (f.status !== statusOf([numerator, denominator]))
        throw new Error(`Invalid GDP share status ${key(f)}`);
      if (numerator.sourceId !== denominator.sourceId || f.sourceId !== numerator.sourceId ||
          f.sourceLocator !== `${numerator.sourceLocator}; ${denominator.sourceLocator}`)
        throw new Error(`GDP share requires both cells from the same workbook ${key(f)}`);
    }
    if (f.measure !== "real_growth") continue;
    if (!find(GDP, "real_growth", f.year))
      throw new Error(`Missing separately sourced GDP growth for ${f.year}`);
    if (f.seriesId !== GDP) {
      const gdp = find(GDP, "real_growth", f.year)!;
      if (f.sourceId === gdp.sourceId && f.sourceLocator === gdp.sourceLocator)
        throw new Error(`GDP growth must have its own source cells for ${f.year}`);
    }
    // Task 3 preparation validates original index-to-percent conversion, compatible
    // volume inputs, contributing locators and propagation of input status before
    // emitting these flat reviewed rows. Serving does not reconstruct raw inputs.
  }

  // Coverage reporting is separate from row validity. Only observed years are
  // inspected; the public period is not selected here. No 2010 growth is demanded.
  const missingCells: SectorValidationReport["missingCells"] = [];
  for (const year of [...new Set(facts.map((f) => f.year))].sort((a, b) => a - b)) {
    for (const { id } of registry) {
      for (const measure of measures) {
        if (!find(id, measure, year)) missingCells.push({ seriesId: id, year, measure });
      }
    }
  }
  return { missingCells };
}

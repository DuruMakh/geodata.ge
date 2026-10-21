import Decimal from "decimal.js";
import { sharePercent } from "../economicSectors/calculations";
import type { SectorDefinition, SectorObservation } from "../economicSectors/types";
import { GDP_EXPENDITURE_GDP, gdpExpenditureMeasures } from "./types";

const FIRST_YEAR = 2010;
const key = (f: Pick<SectorObservation, "seriesId" | "measure" | "year">) => `${f.seriesId}:${f.measure}:${f.year}`;
const UNIT = { nominal: "gel", share_of_gdp: "percent", real_growth: "percent" } as const;
const PRICE_BASIS = { nominal: "current_prices", share_of_gdp: "current_prices", real_growth: "volume_change" } as const;
const CALCULATION = { nominal: "published", share_of_gdp: "ratio_to_gdp", real_growth: "index_to_growth" } as const;

function assertCanonicalDecimal(value: string, id: string): void {
  // Decimal(40,20) in the mirror: reject rather than round.
  if (typeof value !== "string" || !/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value) || value === "-0") throw new Error(`Invalid decimal ${id}`);
  const decimal = new Decimal(value);
  if (decimal.decimalPlaces() > 20 || decimal.abs().gte("100000000000000000000")) throw new Error(`Decimal does not fit the mirror ${id}`);
}

/** Row validity and complete coverage of the served GDP by expenditure observations. */
export function validateGdpExpenditureObservations(facts: readonly SectorObservation[], registry: readonly SectorDefinition[]): void {
  if (!facts.length) throw new Error("GDP by expenditure facts are empty");
  const ids = new Set(registry.map(r => r.id));
  const rows = new Map<string, SectorObservation>();
  const lastYear = Math.max(...facts.map(f => f.year));
  for (const f of facts) {
    const id = key(f);
    if (!ids.has(f.seriesId)) throw new Error(`Unknown GDP by expenditure series ${f.seriesId}`);
    if (!Number.isInteger(f.year) || f.year < FIRST_YEAR || f.year > new Date().getUTCFullYear()) throw new Error(`Invalid year ${id}`);
    if (rows.has(id)) throw new Error(`Duplicate GDP by expenditure observation ${id}`);
    rows.set(id, f);
    if (!gdpExpenditureMeasures(f.seriesId).includes(f.measure)) throw new Error(`Unpublished measure ${id}`);
    assertCanonicalDecimal(f.value, id);
    if (f.unit !== UNIT[f.measure] || f.priceBasis !== PRICE_BASIS[f.measure] || f.calculation !== CALCULATION[f.measure] || f.valuation !== "market_prices")
      throw new Error(`Invalid measure fields ${id}`);
    if (f.status !== "published" && f.status !== "preliminary") throw new Error(`Invalid status ${id}`);
    if (!f.sourceId || !f.sourceLocator || !/^\d{4}-\d{2}-\d{2}$/.test(f.lastReviewedAt)) throw new Error(`Missing provenance ${id}`);
  }
  for (const f of facts) {
    if (f.measure !== "share_of_gdp") continue;
    const numerator = rows.get(key({ ...f, measure: "nominal" }));
    const gdp = rows.get(key({ seriesId: GDP_EXPENDITURE_GDP, measure: "nominal", year: f.year }));
    if (!numerator || !gdp || f.value !== sharePercent(numerator.value, gdp.value)) throw new Error(`Invalid GDP share ${key(f)}`);
    const status = numerator.status === "preliminary" || gdp.status === "preliminary" ? "preliminary" : "published";
    if (f.status !== status || f.sourceLocator !== `${numerator.sourceLocator}; ${gdp.sourceLocator}`) throw new Error(`Invalid GDP share provenance ${key(f)}`);
  }
  const missing = registry.flatMap(({ id }) => gdpExpenditureMeasures(id).flatMap(measure => {
    const first = measure === "real_growth" ? FIRST_YEAR + 1 : FIRST_YEAR;
    return Array.from({ length: lastYear - first + 1 }, (_, i) => key({ seriesId: id, measure, year: first + i })).filter(k => !rows.has(k));
  }));
  if (missing.length || facts.some(f => f.measure === "real_growth" && f.year === FIRST_YEAR))
    throw new Error(`Incomplete GDP by expenditure coverage: ${missing[0] ?? `real growth in ${FIRST_YEAR}`}`);
  const preliminary = [...new Set(facts.filter(f => f.status === "preliminary").map(f => f.year))].sort((a, b) => a - b);
  if (preliminary.some((year, i) => year !== lastYear - preliminary.length + 1 + i) || facts.some(f => (f.status === "preliminary") !== preliminary.includes(f.year)))
    throw new Error("Preliminary years must be the newest years, in every series and measure");
}

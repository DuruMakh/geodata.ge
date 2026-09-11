import Decimal from "decimal.js";
import { GDP_SERIES, type GdpObservation } from "./types";

export function validateGdpObservations(facts: GdpObservation[]): void {
  const keys = new Set<string>();
  for (const f of facts) {
    const definition = GDP_SERIES[f.seriesId];
    if (!definition || f.unit !== definition.unit)
      throw new Error("Invalid GDP series unit");
    const key = `${f.seriesId}:${f.year}`;
    if (keys.has(key)) throw new Error(`Duplicate GDP observation ${key}`);
    keys.add(key);
    if (!new Decimal(f.value).isFinite())
      throw new Error(`Non-finite GDP observation ${key}`);
    if (f.seriesId !== "real_growth_percent" && new Decimal(f.value).lte(0))
      throw new Error(`Non-positive GDP amount ${key}`);
    const geostat = !f.seriesId.startsWith("real_");
    if (f.status !== (geostat && f.year === 2025 ? "preliminary" : "published"))
      throw new Error(`Invalid GDP status ${key}`);
    if (
      f.accountingStandard !==
      (geostat ? (f.year < 2010 ? "sna_1993" : "sna_2008") : null)
    )
      throw new Error(`Invalid GDP accounting standard ${key}`);
  }
  for (const [id, { first, last }] of Object.entries(GDP_SERIES)) {
    const years = facts
      .filter((f) => f.seriesId === id)
      .map((f) => f.year)
      .sort((a, b) => a - b);
    if (
      JSON.stringify(years) !==
      JSON.stringify(
        Array.from({ length: last - first + 1 }, (_, i) => first + i),
      )
    )
      throw new Error(`GDP coverage mismatch: ${id}`);
  }
}


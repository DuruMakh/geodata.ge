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
    if (f.status !== "published" && f.status !== "preliminary")
      throw new Error(`Invalid GDP status ${key}`);
    // The World Bank marks nothing preliminary; Geostat marks its newest years.
    if (!geostat && f.status !== "published")
      throw new Error(`Invalid GDP status ${key}`);
    if (
      f.accountingStandard !==
      (geostat ? (f.year < 2010 ? "sna_1993" : "sna_2008") : null)
    )
      throw new Error(`Invalid GDP accounting standard ${key}`);
  }
  // Coverage: contiguous from each series' first year, and series from one
  // publisher end together. A truncated refresh fails here instead of silently
  // shortening a chart.
  const lastYear = new Map<string, number>();
  for (const [id, { first }] of Object.entries(GDP_SERIES)) {
    const years = facts
      .filter((f) => f.seriesId === id)
      .map((f) => f.year)
      .sort((a, b) => a - b);
    const last = years.at(-1);
    if (
      last === undefined ||
      JSON.stringify(years) !==
      JSON.stringify(
        Array.from({ length: last - first + 1 }, (_, i) => first + i),
      )
    ) {
      throw new Error(`GDP coverage mismatch: ${id}`);
    }
    lastYear.set(id, last);
  }
  const endsOf = (publisherGeostat: boolean) =>
    new Set(
      Object.keys(GDP_SERIES)
        .filter((id) => !id.startsWith("real_") === publisherGeostat)
        .map((id) => lastYear.get(id)!),
    );
  const geostatEnds = endsOf(true);
  const worldBankEnds = endsOf(false);
  if (geostatEnds.size !== 1 || worldBankEnds.size !== 1) {
    throw new Error("GDP coverage mismatch: series from one publisher end in different years");
  }
  if (Math.abs([...geostatEnds][0]! - [...worldBankEnds][0]!) > 1) {
    throw new Error("GDP coverage mismatch: Geostat and World Bank coverage are more than a year apart");
  }

  // Statuses are a publisher property, not a year literal. Geostat's preliminary
  // years are the newest ones, and its four series must agree on which they are.
  const geostatFacts = facts.filter((fact) => !fact.seriesId.startsWith("real_"));
  const preliminary = [
    ...new Set(
      geostatFacts.filter((fact) => fact.status === "preliminary").map((fact) => fact.year),
    ),
  ].sort((left, right) => left - right);
  for (const id of new Set(geostatFacts.map((fact) => fact.seriesId))) {
    const own = geostatFacts
      .filter((fact) => fact.seriesId === id && fact.status === "preliminary")
      .map((fact) => fact.year)
      .sort((left, right) => left - right);
    if (JSON.stringify(own) !== JSON.stringify(preliminary)) {
      throw new Error(`GDP preliminary years differ between Geostat series: ${id}`);
    }
  }
  const published = geostatFacts
    .filter((fact) => fact.status === "published")
    .map((fact) => fact.year);
  if (
    preliminary.length > 0 &&
    published.length > 0 &&
    preliminary[0]! <= Math.max(...published)
  ) {
    throw new Error("Preliminary GDP years must be the newest years");
  }
}

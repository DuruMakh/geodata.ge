import { expect, test } from "vitest";
import registry from "../../../../../data/taxonomy/economic-sectors.json";
import type { SectorObservation } from "../../../lib/data/economicSectors/types";
import { validateSectorObservations } from "../../../lib/data/economicSectors/validation";

const nominal = (seriesId = "sector.a", value = "15"): SectorObservation => ({
  seriesId, year: 2024, measure: "nominal", value, unit: "gel",
  valuation: seriesId === "economy.gdp_total" ? "market_prices" : "basic_prices",
  priceBasis: "current_prices", calculation: "published", status: "published",
  sourceId: "nominal", sourceLocator: seriesId === "economy.gdp_total" ? "GDP!B26" : "GDP!B3",
  lastReviewedAt: "2026-09-11",
});
const fixture = (): SectorObservation[] => {
  const a = nominal();
  const gdp = nominal("economy.gdp_total", "120");
  return [a, gdp, ...[a, gdp].map((f): SectorObservation => ({
    ...f, measure: "share_of_gdp", value: f === a ? "12.5" : "100", unit: "percent",
    calculation: "ratio_to_gdp", sourceLocator: `${f.sourceLocator}; ${gdp.sourceLocator}`,
  }))];
};
const growth = (seriesId = "sector.a"): SectorObservation => ({
  ...nominal(seriesId), measure: "real_growth", value: "-10", unit: "percent",
  priceBasis: "volume_change", sourceId: "growth", sourceLocator: `${seriesId}!C3`,
});

test("accepts reviewed nominal/share pairs and separately sourced GDP growth", () => {
  expect(() => validateSectorObservations([...fixture(), growth(), growth("economy.gdp_total")], registry)).not.toThrow();
});
test.each([
  { seriesId: "sector.z" }, { year: "I 2024" }, { year: 2024.25 }, { year: 2009 }, { year: 2026 },
  { value: "" }, { value: " " }, { value: "NaN" }, { value: "Infinity" }, { value: "1e3" },
  { value: "01" }, { value: "-0" }, { value: "1.000000000000000000001" }, { value: "100000000000000000000" },
  { sourceId: " " }, { sourceLocator: "" }, { lastReviewedAt: "" }, { lastReviewedAt: "2026-02-30" },
  { measure: "unknown" }, { unit: "percent" }, { priceBasis: "volume_change" },
  { calculation: "year_over_year" }, { status: "estimated" }, { valuation: "market_prices" },
])("rejects invalid metadata or decimal %j", (patch) => {
  const rows = fixture();
  rows[0] = { ...rows[0], ...patch } as SectorObservation;
  expect(() => validateSectorObservations(rows, registry)).toThrow();
});
test("rejects duplicate series/measure/year", () => {
  expect(() => validateSectorObservations([...fixture(), nominal()], registry)).toThrow(/Duplicate/);
});
test("GDP reference must use market prices", () => {
  const rows = fixture(); rows[1].valuation = "basic_prices";
  expect(() => validateSectorObservations(rows, registry)).toThrow(/valuation/i);
});
test.each([
  { value: "25" }, { year: 2023 }, { calculation: "published" }, { status: "preliminary" },
  { sourceId: "another-workbook" }, { sourceLocator: "GDP!B3" }, { priceBasis: "volume_change" },
])("rejects inconsistent GDP share %j", (patch) => {
  const rows = fixture(); rows[2] = { ...rows[2], ...patch } as SectorObservation;
  expect(() => validateSectorObservations(rows, registry)).toThrow();
});
test.each([0, 1])("GDP share inherits preliminary status from input %s", (index) => {
  const rows = fixture(); rows[index].status = "preliminary";
  expect(() => validateSectorObservations(rows, registry)).toThrow(/status/i);
  rows[2].status = "preliminary";
  if (index === 1) rows[3].status = "preliminary";
  expect(() => validateSectorObservations(rows, registry)).not.toThrow();
});
test("requires a share when its nominal inputs permit calculation", () => {
  expect(() => validateSectorObservations(fixture().slice(0, 2), registry)).toThrow(/share/i);
});
test("zero is observed data; absent denominator is a reported gap", () => {
  const rows = fixture(); rows[0].value = "0"; rows[2].value = "0";
  expect(() => validateSectorObservations(rows, registry)).not.toThrow();
  const result = validateSectorObservations([nominal()], registry);
  expect(result.missingCells).toContainEqual({ seriesId: "sector.a", year: 2024, measure: "share_of_gdp" });
});
test("accepts 2010 nominal without manufacturing or requiring 2010 growth", () => {
  const rows = fixture().map((f) => ({ ...f, year: 2010 }));
  const result = validateSectorObservations(rows, registry);
  expect(result.missingCells).toContainEqual({ seriesId: "sector.a", year: 2010, measure: "real_growth" });
  expect(rows.some((f) => f.measure === "real_growth")).toBe(false);
});
test("published precision within Decimal(40,20) is retained without mutation", () => {
  const row = growth("economy.gdp_total"); row.value = "7.50000000000000000001";
  const before = structuredClone(row);
  validateSectorObservations([row], registry);
  expect(row).toEqual(before);
});
test("sector growth requires its independently sourced GDP reference", () => {
  expect(() => validateSectorObservations([growth()], registry)).toThrow(/GDP growth/);
});
test("accepts a flat reviewed index_to_growth observation without nested source data", () => {
  const row: SectorObservation = {
    ...growth("economy.gdp_total"), calculation: "index_to_growth",
    value: "7.46161492416432", sourceId: "source.geostat_sector_growth",
    sourceLocator: "Real GDP Growth!BY26", year: 2025, status: "preliminary",
  };
  expect(() => validateSectorObservations([row], registry)).not.toThrow();
});
test("accepts flat reviewed year_over_year growth with contributing locators", () => {
  const row: SectorObservation = {
    ...growth(), calculation: "year_over_year", sourceId: "volume",
    sourceLocator: "Volume!C3; Volume!B3",
  };
  expect(() => validateSectorObservations([row, growth("economy.gdp_total")], registry)).not.toThrow();
});
test("all twenty registered activities are accepted in A–T order and GDP stays separate", () => {
  expect(registry.filter((r) => r.classificationCode !== null).map((r) => [r.id, r.classificationCode, r.sortOrder])).toEqual(
    Array.from("ABCDEFGHIJKLMNOPQRST", (code, i) => [`sector.${code.toLowerCase()}`, code, i + 1]),
  );
  for (const entry of registry) {
    expect(entry.officialName.length).toBeGreaterThan(0);
    expect(entry.labelKa).toMatch(/[ა-ჰ]/);
    const rows = entry.id === "economy.gdp_total" ? fixture().filter((f) => f.seriesId === entry.id) : [nominal(entry.id)];
    expect(() => validateSectorObservations(rows, registry)).not.toThrow();
  }
});

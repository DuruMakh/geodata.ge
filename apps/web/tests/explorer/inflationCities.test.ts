import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import type { CityFactInput } from "../../lib/data/inflation/types";
import {
  CITY_CATEGORIES,
  CITY_LINE_IDS,
  buildCityIndex,
  buildCityLines,
  cityAnnualAverages,
  cityCoverage,
  defaultCityState,
  effectiveCityTableSeries,
  packCityFacts,
  parseCityHash,
  resolveCityRange,
  restoreCityState,
  serializeCityHash,
  toggleAllCityLines,
  toggleCityLine,
  unpackCityFacts,
} from "../../lib/explorer/inflationCities";
import { GEORGIA_VIEW, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const index = buildCityIndex(fixtureCityFacts);
const BATUMI: CityView = { kind: "city", cityId: "city.batumi" };

describe("Georgia page state", () => {
  it("defaults to the chart, the full range and all seven lines, Georgia first", () => {
    expect(defaultCityState(GEORGIA_VIEW)).toEqual({ mode: "chart", range: { kind: "all" }, selected: [...CITY_LINE_IDS], tableSeries: null });
    expect(CITY_LINE_IDS[0]).toBe("country.georgia");
  });

  it("round-trips the facts through the packed wire form", () => {
    expect(unpackCityFacts(packCityFacts(fixtureCityFacts))).toHaveLength(fixtureCityFacts.length);
  });

  it("draws each selected place's annual total", () => {
    const state = defaultCityState(GEORGIA_VIEW);
    const { lines } = buildCityLines(index, GEORGIA_VIEW, state, resolveCityRange(state, index, GEORGIA_VIEW));
    expect(lines.map((line) => line.key)).toEqual([...CITY_LINE_IDS]);
    expect(lines.find((line) => line.key === "city.batumi")!.values.at(-1)).toBeCloseTo(7.0857, 4);
  });

  it("keeps Georgia first and removable when toggling", () => {
    const without = toggleCityLine(defaultCityState(GEORGIA_VIEW), GEORGIA_VIEW, "country.georgia");
    expect(without.selected[0]).toBe("city.tbilisi");
    expect(toggleCityLine(without, GEORGIA_VIEW, "country.georgia").selected[0]).toBe("country.georgia");
    expect(toggleAllCityLines(defaultCityState(GEORGIA_VIEW), GEORGIA_VIEW).selected).toEqual([]);
  });

  it("gives every line the annual average, since every line is a total", () => {
    expect(cityAnnualAverages(index, GEORGIA_VIEW, "city.batumi")?.get(2025)).toBe(4.1);
  });

  it("round-trips the hash with place slugs and ignores the retired tab and category keys", () => {
    const state = { ...defaultCityState(GEORGIA_VIEW), mode: "table" as const, selected: ["country.georgia", "city.batumi"], tableSeries: "city.batumi" };
    const hash = serializeCityHash(state, GEORGIA_VIEW);
    expect(hash).toContain("sel=georgia%2Cbatumi");
    expect(hash).not.toMatch(/(^|&)(i|c)=/);
    expect(parseCityHash(`#${hash}`, GEORGIA_VIEW)).toMatchObject({ mode: "table", selected: ["country.georgia", "city.batumi"], tableSeries: "city.batumi" });
    expect(parseCityHash("#i=mom&c=07&sel=rustavi,batumi&t=rustavi", GEORGIA_VIEW)).toMatchObject({ selected: ["city.batumi"], tableSeries: null });
  });
});

describe("city page state", () => {
  const facts: CityFactInput[] = [
    ...fixtureCityFacts,
    { lineId: "city.batumi", seriesId: "cpi.cat.07", measure: "yoy_pct", period: "2026-08", value: 1.2 },
  ];
  const cityIndex = buildCityIndex(facts);

  it("selects only the total by default and offers the total plus 12 divisions", () => {
    expect(defaultCityState(BATUMI).selected).toEqual(["cpi.headline"]);
    expect(CITY_CATEGORIES).toHaveLength(13);
  });

  it("draws the city's own series", () => {
    const state = { ...defaultCityState(BATUMI), selected: ["cpi.headline", "cpi.cat.01"] };
    const { lines } = buildCityLines(cityIndex, BATUMI, state, resolveCityRange(state, cityIndex, BATUMI));
    expect(lines.map((line) => line.key)).toEqual(["cpi.headline", "cpi.cat.01"]);
    expect(lines[1]!.values.at(-1)).toBeCloseTo(5.9542, 4);
  });

  it("gives the annual average to the total only", () => {
    expect(cityAnnualAverages(cityIndex, BATUMI, "cpi.headline")?.get(2025)).toBe(4.1);
    expect(cityAnnualAverages(cityIndex, BATUMI, "cpi.cat.01")).toBeUndefined();
  });

  it("round-trips the hash with COICOP codes", () => {
    const state = { ...defaultCityState(BATUMI), selected: ["cpi.headline", "cpi.cat.07"], tableSeries: "cpi.cat.07" };
    const hash = serializeCityHash(state, BATUMI);
    expect(hash).toContain("sel=total%2C07");
    expect(hash).toContain("t=07");
    expect(parseCityHash(`#${hash}`, BATUMI)).toMatchObject({ selected: ["cpi.headline", "cpi.cat.07"], tableSeries: "cpi.cat.07" });
  });

  it("falls back to the first selected series in the table", () => {
    const state = { ...defaultCityState(BATUMI), selected: ["cpi.cat.01"] };
    expect(effectiveCityTableSeries(cityIndex, BATUMI, state)).toBe("cpi.cat.01");
  });

  it("takes coverage from that city's own series", () => {
    const zugdidi = buildCityIndex([
      { lineId: "city.zugdidi", seriesId: "cpi.headline", measure: "yoy_pct", period: "2016-12", value: 1 },
      { lineId: "city.zugdidi", seriesId: "cpi.headline", measure: "yoy_pct", period: "2026-08", value: 2 },
      { lineId: "city.tbilisi", seriesId: "cpi.headline", measure: "yoy_pct", period: "2016-01", value: 3 },
    ]);
    expect(cityCoverage(zugdidi, { kind: "city", cityId: "city.zugdidi" })).toEqual({ min: makePeriod(2016, 12), max: makePeriod(2026, 8) });
  });

  it("clamps a restored range that lies outside the coverage", () => {
    const restored = restoreCityState("#r=2030-01-2030-06", cityIndex, BATUMI);
    expect(restored.range).toEqual({ kind: "all" });
  });
});

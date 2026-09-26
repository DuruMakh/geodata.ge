import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import {
  CITY_LINE_IDS,
  DEFAULT_CITY_STATE,
  buildCityIndex,
  buildCityLines,
  changeCityTab,
  cityAnnualAverages,
  latestCityIndicators,
  packCityFacts,
  parseCityHash,
  resolveCityRange,
  serializeCityHash,
  toggleAllCityLines,
  toggleCityLine,
  unpackCityFacts,
} from "../../lib/explorer/inflationCities";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const index = buildCityIndex(fixtureCityFacts);

describe("inflation cities state", () => {
  it("defaults to annual inflation, the total and all seven lines, Georgia first", () => {
    expect(DEFAULT_CITY_STATE).toMatchObject({ tab: "yoy", mode: "chart", category: "cpi.headline", tableSeries: null });
    expect(DEFAULT_CITY_STATE.selected).toEqual([...CITY_LINE_IDS]);
    expect(CITY_LINE_IDS[0]).toBe("country.georgia");
  });

  it("round-trips the facts through the packed wire form", () => {
    expect(unpackCityFacts(packCityFacts(fixtureCityFacts))).toHaveLength(fixtureCityFacts.length);
  });

  it("draws one line per selected series for the picked category", () => {
    const state = { ...DEFAULT_CITY_STATE, category: "cpi.cat.01" };
    const range = resolveCityRange(state, index);
    const { lines } = buildCityLines(index, state, range);
    expect(lines.map((line) => line.key)).toEqual([...CITY_LINE_IDS]);
    expect(lines.find((line) => line.key === "city.kutaisi")!.values.at(-1)).toBeCloseTo(6.507, 4);
  });

  it("keeps Georgia first and removable when toggling", () => {
    const without = toggleCityLine(DEFAULT_CITY_STATE, "country.georgia");
    expect(without.selected[0]).toBe("city.tbilisi");
    expect(toggleCityLine(without, "country.georgia").selected[0]).toBe("country.georgia");
    expect(toggleAllCityLines(DEFAULT_CITY_STATE).selected).toEqual([]);
    expect(toggleAllCityLines({ ...DEFAULT_CITY_STATE, selected: [] }).selected).toEqual([...CITY_LINE_IDS]);
  });

  it("offers the annual average only for the total on the annual tab", () => {
    expect(cityAnnualAverages(index, DEFAULT_CITY_STATE, "city.batumi")?.get(2025)).toBe(4.1);
    expect(cityAnnualAverages(index, { ...DEFAULT_CITY_STATE, category: "cpi.cat.01" }, "city.batumi")).toBeUndefined();
    expect(cityAnnualAverages(index, { ...DEFAULT_CITY_STATE, tab: "mom" }, "city.batumi")).toBeUndefined();
  });

  it("refits the range when the tab changes", () => {
    const state = changeCityTab({ ...DEFAULT_CITY_STATE, range: { kind: "manual", start: makePeriod(2026, 1), end: makePeriod(2026, 8) } }, "mom", index);
    expect(state.tab).toBe("mom");
  });

  it("round-trips the hash with short, stable values", () => {
    const state = { ...DEFAULT_CITY_STATE, tab: "mom" as const, mode: "table" as const, category: "cpi.cat.07", selected: ["country.georgia", "city.batumi"] as typeof DEFAULT_CITY_STATE.selected, tableSeries: "city.batumi" as const };
    const hash = serializeCityHash(state);
    expect(hash).toContain("c=07");
    expect(hash).toContain("sel=georgia%2Cbatumi");
    expect(parseCityHash(`#${hash}`)).toMatchObject({ tab: "mom", mode: "table", category: "cpi.cat.07", selected: ["country.georgia", "city.batumi"], tableSeries: "city.batumi" });
  });

  it("drops unknown hash values rather than failing", () => {
    expect(parseCityHash("#i=index&c=99&sel=rustavi,batumi&t=rustavi")).toMatchObject({ tab: "yoy", category: "cpi.headline", selected: ["city.batumi"], tableSeries: null });
  });
});

describe("latestCityIndicators", () => {
  it("names the highest and lowest city against Georgia for the total", () => {
    const latest = latestCityIndicators(index, "cpi.headline")!;
    expect(latest.period).toBe(makePeriod(2026, 8));
    expect(latest.highest.cityIds).toEqual(["city.batumi"]);
    expect(latest.highest.deltaPp).toBeCloseTo(7.0857 - 5.6479, 6);
    expect(latest.lowest.cityIds).toEqual(["city.telavi"]);
    expect(latest.lowest.fell).toBe(false);
    expect(latest.gap.value).toBeCloseTo(7.0857 - 4.3561, 6);
    expect(latest.aboveNational).toMatchObject({ count: 2, total: 6 });
  });

  it("follows the picked category", () => {
    const latest = latestCityIndicators(index, "cpi.cat.01")!;
    expect(latest.highest.cityIds).toEqual(["city.kutaisi"]);
    expect(latest.aboveNational?.count).toBe(2);
  });

  it("never ranks Georgia", () => {
    const latest = latestCityIndicators(index, "cpi.headline")!;
    expect([...latest.highest.cityIds, ...latest.lowest.cityIds]).not.toContain("country.georgia");
  });

  it("names every tied city", () => {
    // Set exactly, not by arithmetic: 5.3103 + 1.7754 need not equal 7.0857 in floating point.
    const tied = buildCityIndex(fixtureCityFacts.map((fact) => (fact.lineId === "city.gori" && fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2026-08" ? { ...fact, value: 7.0857 } : fact)));
    expect(latestCityIndicators(tied, "cpi.headline")!.highest.cityIds).toEqual(["city.batumi", "city.gori"]);
  });
});

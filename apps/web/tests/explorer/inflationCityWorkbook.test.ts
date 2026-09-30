import { describe, expect, it } from "vitest";
import type { CityFactInput } from "../../lib/data/inflation/types";
import { buildCityIndex, defaultCityState, resolveCityRange, type CityState } from "../../lib/explorer/inflationCities";
import { GEORGIA_VIEW, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { buildInflationCityWorkbookExportModel } from "../../lib/explorer/inflationCityWorkbook";
import { SUMMARY_COLUMN } from "../../lib/explorer/inflationWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const BATUMI: CityView = { kind: "city", cityId: "city.batumi" };

async function model(view: CityView, state: CityState = defaultCityState(view), facts: CityFactInput[] = fixtureCityFacts) {
  const messages = await getMessages("en", ["inflation"]);
  const built = buildCityIndex(facts);
  return buildInflationCityWorkbookExportModel({
    index: built,
    view,
    state,
    range: resolveCityRange(state, built, view),
    presentation: { locale: "en", messages, englishLabels: {} },
    sources: [],
    siteOrigin: "https://fiscal.ge",
  });
}

describe("buildInflationCityWorkbookExportModel", () => {
  it("writes one readable row per place and year on the Georgia page, with the annual average", async () => {
    const workbook = await model(GEORGIA_VIEW);
    expect(workbook.readable.years).toContain(SUMMARY_COLUMN);
    expect(new Set(workbook.readable.rows.map((row) => row.parentLabel))).toEqual(new Set(["Georgia", "Tbilisi", "Kutaisi", "Batumi", "Gori", "Telavi", "Zugdidi"]));
    expect(workbook.readable.title).toBe("Cities · Georgia");
    expect(workbook.readable.subtitle).toContain("recorded once and applied to every city");
    expect(workbook.filename).toMatch(/inflation-cities-2025-09-2026-08/);
  });

  it("names the city's series on a city page and keeps the average for the total only", async () => {
    const workbook = await model(BATUMI, { ...defaultCityState(BATUMI), selected: ["cpi.headline", "cpi.cat.01"] });
    expect(workbook.readable.title).toBe("Cities · Batumi");
    expect(workbook.readable.years).toContain(SUMMARY_COLUMN);
    const food = workbook.analysis.rows.find((row) => row[3] !== "Total")!;
    expect(food[2]).toBe("Batumi");
    expect(food[4]).toBe("01");
    expect(workbook.filename).toMatch(/inflation-batumi-/);
  });

  it("drops the average column when no total is selected", async () => {
    const workbook = await model(BATUMI, { ...defaultCityState(BATUMI), selected: ["cpi.cat.01"] });
    expect(workbook.readable.years).not.toContain(SUMMARY_COLUMN);
  });

  it("exports rates as fractions and never an implied weight", async () => {
    const workbook = await model(GEORGIA_VIEW);
    const batumi = workbook.analysis.rows.find((row) => row[2] === "Batumi" && row[0] === 2026 && row[1] === 8)!;
    expect(batumi[5]).toBeCloseTo(0.070857, 6);
    expect(JSON.stringify(workbook).toLowerCase()).not.toContain("weight");
  });
});

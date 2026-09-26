import { describe, expect, it } from "vitest";
import { buildCityIndex, DEFAULT_CITY_STATE, resolveCityRange } from "../../lib/explorer/inflationCities";
import { buildInflationCityWorkbookExportModel } from "../../lib/explorer/inflationCityWorkbook";
import { SUMMARY_COLUMN } from "../../lib/explorer/inflationWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const index = buildCityIndex(fixtureCityFacts);

async function model(state = DEFAULT_CITY_STATE) {
  const messages = await getMessages("en", ["inflation"]);
  return buildInflationCityWorkbookExportModel({
    index,
    state,
    range: resolveCityRange(state, index),
    presentation: { locale: "en", messages, englishLabels: {} },
    sources: [],
    siteOrigin: "https://fiscal.ge",
  });
}

describe("buildInflationCityWorkbookExportModel", () => {
  it("writes one readable row per line and year, with the annual average for the total", async () => {
    const workbook = await model();
    expect(workbook.readable.years).toContain(SUMMARY_COLUMN);
    expect(new Set(workbook.readable.rows.map((row) => row.parentLabel))).toEqual(new Set(["Georgia", "Tbilisi", "Kutaisi", "Batumi", "Gori", "Telavi", "Zugdidi"]));
    expect(workbook.readable.subtitle).toContain("recorded once and applied to every city");
  });

  it("drops the annual average for a category and names the category", async () => {
    const workbook = await model({ ...DEFAULT_CITY_STATE, category: "cpi.cat.01" });
    expect(workbook.readable.years).not.toContain(SUMMARY_COLUMN);
    expect(workbook.readable.title).toContain("Food");
    expect(workbook.filename).toContain("inflation-cities-yoy-01-");
  });

  it("exports rates as fractions and never an implied weight", async () => {
    const workbook = await model();
    const batumi = workbook.analysis.rows.find((row) => row[2] === "Batumi" && row[0] === 2026 && row[1] === 8)!;
    expect(batumi[5]).toBeCloseTo(0.070857, 6);
    expect(JSON.stringify(workbook).toLowerCase()).not.toContain("weight");
  });
});

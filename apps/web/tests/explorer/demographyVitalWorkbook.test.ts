import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SOURCE_ID } from "../../lib/data/demography/series";
import { buildVitalWorkbookExportModel } from "../../lib/explorer/demographyVitalWorkbook";
import { vitalFactsForPlace } from "../../lib/explorer/demographyVital";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { loadPopulationBasics, loadPopulationSources } from "../../lib/pages/demography-population";

let input: Parameters<typeof buildVitalWorkbookExportModel>[0];
let presentation: Awaited<ReturnType<typeof getPresentation>>;
beforeAll(async () => {
  const [{ facts }, sources, basics] = await Promise.all([loadServedDemographyData(), loadPopulationSources("en"), loadPopulationBasics("en")]);
  presentation = await getPresentation("en", ["demography", "workbook"], []);
  const place = basics.places.find((candidate) => candidate.id === "06")!;
  input = { facts: vitalFactsForPlace(facts, "06"), place, sources, siteOrigin: "https://fiscal.ge", scope: "batumi" };
});

describe("births and deaths workbook", () => {
  it("names the place and its years, and lists births, deaths and natural increase", () => {
    const model = buildVitalWorkbookExportModel(input, presentation);
    expect(model.filename).toContain("demography-births-deaths-batumi-2015-2025");
    expect(model.readable.years).toEqual([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(model.readable.rows.map((row) => [row.kind, row.label])).toEqual([["item", "Births"], ["item", "Deaths"], ["total", "Natural increase"]]);
    expect(model.readable.rows[0]!.valuesByYear[2025]).toBe(2_630);
    expect(model.readable.rows[2]!.valuesByYear[2025]).toBe(851);
  });

  it("has one data row per year and cites only the three originals", () => {
    const model = buildVitalWorkbookExportModel(input, presentation);
    expect(model.analysis.rows).toHaveLength(11);
    expect(model.analysis.rows.at(-1)!.slice(2, 6)).toEqual([2025, 2_630, 1_779, 851]);
    const cited = input.sources.filter((source) => [SOURCE_ID.births, SOURCE_ID.deaths, SOURCE_ID.naturalIncrease].includes(source.sourceId as never));
    expect(model.sources).toHaveLength(cited.length);
    expect(model.sources.every((source) => source.downloadHref.startsWith("https://fiscal.ge/"))).toBe(true);
  });
});

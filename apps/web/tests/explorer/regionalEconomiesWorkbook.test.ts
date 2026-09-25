import { expect, test } from "vitest";
import ExcelJS from "exceljs";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import type { ServedRegionalEconomyObservation } from "../../lib/data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../../lib/data/regionalEconomies/types";
import { DEFAULT_REGIONAL_ECONOMY_STATE } from "../../lib/explorer/regionalEconomies";
import { buildRegionalEconomyWorkbookExportModel } from "../../lib/explorer/regionalEconomiesWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";

const facts: ServedRegionalEconomyObservation[] = [
  { seriesId: REGIONAL_GDP_TOTAL, nominal: 1_000_000_000, share: 100 },
  { seriesId: "sector.a", nominal: 250_000_000, share: 25 },
  { seriesId: "sector.b", nominal: 0, share: 0 },
].flatMap((entry) => [2023, 2024].flatMap((year): ServedRegionalEconomyObservation[] => [
  {
    regionId: "region.imereti", seriesId: entry.seriesId, year, measure: "nominal", value: entry.nominal,
    unit: "gel", valuation: entry.seriesId === REGIONAL_GDP_TOTAL ? "market_prices" : "basic_prices",
    priceBasis: "current_prices", calculation: "published", status: "published",
    sourceId: entry.seriesId === REGIONAL_GDP_TOTAL ? "source.geostat_regional_gdp" : "source.geostat_regional_gdp_by_activity",
    sourceLocator: "Sheet!A1", lastReviewedAt: "2026-09-13",
  },
  {
    regionId: "region.imereti", seriesId: entry.seriesId, year, measure: "share_of_region_gdp", value: entry.share,
    unit: "percent", valuation: entry.seriesId === REGIONAL_GDP_TOTAL ? "market_prices" : "basic_prices",
    priceBasis: "current_prices", calculation: "ratio_to_region_gdp", status: "published",
    sourceId: "source.fiscal_regional_economy_share", sourceLocator: "Sheet!A1; Total!A1", lastReviewedAt: "2026-09-13",
  },
]));

const presentation = {
  locale: "en" as const,
  englishLabels: {},
  messages: {
    "regionalEconomies.total": "Total regional GDP",
    "regionalEconomies.region": "Region",
    "regionalEconomies.sector": "Economic activity",
    "regionalEconomies.nominal": "Nominal value in GEL",
    "regionalEconomies.shareOfRegionGdp": "Share of regional GDP",
    "regionalEconomies.workbookTitle": "Imereti regional economy — {measure}",
    "format.bnGel": "GEL bn",
  },
};
const sources = [
  { sourceId: "source.geostat_regional_gdp", years: [2023, 2024], title: "Totals", organization: "Geostat", downloadHref: "/downloads/methodology/totals.xlsx" as const, retrievedAt: "2026-09-10" },
  { sourceId: "source.geostat_regional_gdp_by_activity", years: [2023, 2024], title: "Activities", organization: "Geostat", downloadHref: "/downloads/methodology/activities.xlsx" as const, retrievedAt: "2026-09-10" },
  { sourceId: "unrelated", years: [2023, 2024], title: "Unrelated", organization: "Other", downloadHref: "/downloads/methodology/unrelated.xlsx" as const, retrievedAt: "2026-09-10" },
];
const region = { id: "region.imereti", slug: "imereti", labelKa: "იმერეთი", labelEn: "Imereti" };

test("nominal and share workbooks retain GEL numerators, percentage fractions, zero and sources", async () => {
  for (const measure of ["nominal", "share_of_region_gdp"] as const) {
    const model = buildRegionalEconomyWorkbookExportModel(
      facts,
      registry,
      { ...DEFAULT_REGIONAL_ECONOMY_STATE, measure, selectedIds: [REGIONAL_GDP_TOTAL, "sector.a", "sector.b"] },
      region,
      presentation,
      sources,
      "https://fiscal.ge",
    );
    expect(model.filename).toBe(`fiscal-regional-economy-imereti-${measure}-2023-2024-en.xlsx`);
    expect(model.analysis.headers[0]).toBe("Region");
    expect(model.analysis.rows[0]?.slice(0, 2)).toEqual(["Imereti", 2023]);
    expect(model.readable.rows[0].valuesByYear[2024]).toBe(measure === "nominal" ? 1 : 1);
    expect(model.analysis.rows.find((row) => row[2] === "Mining and quarrying")?.[3]).toBe(0);
    if (measure === "share_of_region_gdp") {
      expect(model.analysis.rows.find((row) => row[2] === "Agriculture, forestry and fishing")?.slice(3, 5))
        .toEqual([250_000_000, 0.25]);
      expect(model.sources).toHaveLength(2);
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(model));
    expect(workbook.worksheets).toHaveLength(3);
    if (measure === "share_of_region_gdp") {
      const readable = workbook.getWorksheet(model.sheetNames[0])!;
      expect(readable.getCell("B5").value).toBe(0.25);
      expect(readable.getCell("B5").numFmt).toContain("%");
    }
  }
});

test("empty selection exports no rows or sources", () => {
  const model = buildRegionalEconomyWorkbookExportModel(
    facts,
    registry,
    { ...DEFAULT_REGIONAL_ECONOMY_STATE, selectedIds: [] },
    region,
    presentation,
    sources,
    "https://fiscal.ge",
  );
  expect(model.readable.rows).toEqual([]);
  expect(model.analysis.rows).toEqual([]);
  expect(model.sources).toEqual([]);
});

test("builds a stable model for a fixed input", () => {
  for (const measure of ["nominal", "share_of_region_gdp"] as const) {
    expect(buildRegionalEconomyWorkbookExportModel(
      facts,
      registry,
      { ...DEFAULT_REGIONAL_ECONOMY_STATE, measure, selectedIds: [REGIONAL_GDP_TOTAL, "sector.a", "sector.b"] },
      region,
      presentation,
      sources,
      "https://fiscal.ge",
    )).toMatchSnapshot(measure);
  }
});

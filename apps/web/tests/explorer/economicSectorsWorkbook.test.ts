import { expect, test } from "vitest";
import ExcelJS from "exceljs";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import type { ServedSectorObservation } from "../../lib/data/economicSectors/types";
import { sourceIdByMeasure } from "../../lib/explorer/clientData";
import { DEFAULT_SECTOR_STATE } from "../../lib/explorer/economicSectors";
import { buildEconomicSectorsWorkbookExportModel } from "../../lib/explorer/economicSectorsWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";

const facts: ServedSectorObservation[] = [
  "nominal",
  "share_of_gdp",
  "real_growth",
].flatMap((measure) =>
  [2024, 2025].map((year) => ({
    seriesId: "sector.a",
    year,
    measure: measure as ServedSectorObservation["measure"],
    value:
      measure === "nominal"
        ? 2_500_000_000
        : measure === "share_of_gdp"
          ? 12.5
          : year === 2024
            ? 0
            : -7.5,
    unit: measure === "nominal" ? ("gel" as const) : ("percent" as const),
    valuation: "basic_prices" as const,
    priceBasis:
      measure === "real_growth"
        ? ("volume_change" as const)
        : ("current_prices" as const),
    calculation:
      measure === "real_growth"
        ? ("index_to_growth" as const)
        : ("published" as const),
    status: year === 2025 ? ("preliminary" as const) : ("published" as const),
    sourceId: measure === "real_growth" ? "volume" : "nominal",
    sourceLocator: "Sheet!A1",
    lastReviewedAt: "2026-09-11",
  })),
);
const sources = ["nominal", "volume", "unrelated"].map((sourceId) => ({
  sourceId,
  years: [2023, 2024, 2025],
  title: sourceId,
  organization: "Geostat",
  downloadHref: `/downloads/methodology/${sourceId}.xlsx` as const,
  retrievedAt: "2026-09-11",
}));

test("exports full GEL, single-conversion percentages, mixed status, missing rows and narrowed originals in both languages", async () => {
  for (const locale of ["ka", "en"] as const) {
    const presentation = {
      locale,
      messages: await getMessages(locale, ["sectors", "workbook", "format"]),
      englishLabels: {},
    };
    for (const measure of ["nominal", "share_of_gdp", "real_growth"] as const) {
      const model = buildEconomicSectorsWorkbookExportModel(
        facts,
        registry,
        {
          ...DEFAULT_SECTOR_STATE,
          measure,
          selectedIds: ["sector.a", "sector.b"],
        },
        presentation,
        sources,
        "https://fiscal.ge",
        sourceIdByMeasure(facts),
      );
      expect(model.readable.rows).toHaveLength(2);
      expect(model.readable.rows[1].valuesByYear[2025]).toBeNull();
      expect(model.readable.rows[0].basisByYear).toEqual({
        2024: "published",
        2025: "preliminary",
      });
      expect(model.readable.rows[0].valuesByYear[2025]).toBe(
        measure === "nominal"
          ? 2.5
          : measure === "share_of_gdp"
            ? 0.125
            : -0.075,
      );
      expect(model.analysis.rows[0][2]).toBe(
        measure === "real_growth" ? 0 : 2_500_000_000,
      );
      if (measure === "share_of_gdp")
        expect(model.analysis.rows[0][3]).toBe(0.125);
      if (measure === "real_growth")
        expect(model.analysis.headers.join(" ")).not.toMatch(/GEL|₾/);
      expect(model.sources).toHaveLength(1);
      expect(model.sources[0].years).toEqual([2024, 2025]);
      expect(model.sources[0].absoluteUrl).toBe(
        `https://fiscal.ge/downloads/methodology/${measure === "real_growth" ? "volume" : "nominal"}.xlsx`,
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await createWorkbookBuffer(model));
      expect(workbook.worksheets).toHaveLength(3);
      expect(workbook.worksheets[0].getCell("C4").value).toBe(
        measure === "nominal"
          ? 2.5
          : measure === "share_of_gdp"
            ? 0.125
            : -0.075,
      );
      if (measure !== "nominal")
        expect(workbook.worksheets[0].getCell("C4").numFmt).toContain("%");
      expect(workbook.worksheets[0].getCell("C4").numFmt).toContain(
        locale === "en" ? "Preliminary" : "წინასწარი",
      );
      const empty = buildEconomicSectorsWorkbookExportModel(
        facts,
        registry,
        { ...DEFAULT_SECTOR_STATE, measure, selectedIds: [] },
        presentation,
        sources,
        "https://fiscal.ge",
        sourceIdByMeasure(facts),
      );
      expect(empty.readable.rows).toEqual([]);
      expect(empty.analysis.rows).toEqual([]);
      expect(empty.sources).toEqual([]);
    }
  }
});

test("a one-year rate cites that year's source once, and shared originals are not duplicated", async () => {
  const presentation = {
    locale: "en" as const,
    messages: await getMessages("en", ["sectors", "workbook", "format"]),
    englishLabels: {},
  };
  const model = buildEconomicSectorsWorkbookExportModel(
    facts,
    registry,
    {
      ...DEFAULT_SECTOR_STATE,
      measure: "real_growth",
      range: { kind: "manual", start: 2025, end: 2025 },
      selectedIds: ["sector.a"],
    },
    presentation,
    [...sources, sources[1]],
    "https://fiscal.ge/",
    sourceIdByMeasure(facts),
  );
  expect(model.readable.years).toEqual([2025]);
  // One entry although the same original is passed twice, and only the year
  // the range covers: no sector row is a year_over_year calculation, so
  // nothing pulls in the preceding source year.
  expect(model.sources).toHaveLength(1);
  expect(model.sources[0].years).toEqual([2025]);
  expect(model.analysis.rows).toEqual([
    [
      2025,
      registry.find((r) => r.id === "sector.a")!.labelEn,
      -0.075,
      "Preliminary",
    ],
  ]);
});

test("zero remains numeric and only the explicitly selected sector is exported", async () => {
  const presentation = {
    locale: "en" as const,
    messages: await getMessages("en", ["sectors", "workbook", "format"]),
    englishLabels: {},
  };
  const model = buildEconomicSectorsWorkbookExportModel(
    facts.map((f) => ({ ...f, value: 0 })),
    registry,
    { ...DEFAULT_SECTOR_STATE, selectedIds: ["sector.a"] },
    presentation,
    sources,
    "https://fiscal.ge",
    sourceIdByMeasure(facts),
  );
  expect(model.readable.rows).toHaveLength(1);
  expect(model.readable.rows[0].valuesByYear).toEqual({ 2024: 0, 2025: 0 });
  expect(model.analysis.rows.map((r) => r[2])).toEqual([0, 0]);
});

test("builds a stable model for a fixed input", async () => {
  for (const locale of ["ka", "en"] as const) {
    const presentation = {
      locale,
      messages: await getMessages(locale, ["sectors", "workbook", "format"]),
      englishLabels: {},
    };
    for (const measure of ["nominal", "share_of_gdp", "real_growth"] as const) {
      expect(buildEconomicSectorsWorkbookExportModel(
        facts,
        registry,
        { ...DEFAULT_SECTOR_STATE, measure, selectedIds: ["sector.a", "sector.b"] },
        presentation,
        sources,
        "https://fiscal.ge",
        sourceIdByMeasure(facts),
      )).toMatchSnapshot(`${locale} ${measure}`);
    }
  }
});

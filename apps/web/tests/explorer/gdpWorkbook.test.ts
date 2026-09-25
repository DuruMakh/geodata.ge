import { expect, it } from "vitest";
import { prepareGdpOverview } from "../../lib/data/gdpOverview/prepareGdpOverview";
import { sourceIdRangesBySeries } from "../../lib/explorer/clientData";
import { DEFAULT_GDP_STATE } from "../../lib/explorer/gdpOverview";
import { buildGdpWorkbookExportModel } from "../../lib/explorer/gdpWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import ExcelJS from "exceljs";
it("keeps USD and percentage units distinct and excludes cumulative change", async () => {
  const facts = (await prepareGdpOverview()).facts.map((f) => ({
    ...f,
    value: Number(f.value),
  }));
  const presentation = {
    locale: "en" as const,
    messages: await getMessages("en", ["gdp"]),
    englishLabels: {},
  };
  const nominal = buildGdpWorkbookExportModel(
    facts,
    { ...DEFAULT_GDP_STATE, indicator: "nominal", currency: "usd" },
    presentation,
    [],
    "https://fiscal.ge",
    sourceIdRangesBySeries(facts),
  );
  expect(nominal.analysis.headers.join(" ")).toContain("USD");
  expect(nominal.analysis.headers.join(" ")).not.toContain("GEL");
  expect(nominal.readable.showChangeColumn).toBe(false);
  expect(nominal.analysis.rows.at(-1)).toContain("Preliminary");
  const growth = buildGdpWorkbookExportModel(
    facts,
    { ...DEFAULT_GDP_STATE, indicator: "growth" },
    presentation,
    [],
    "https://fiscal.ge",
    sourceIdRangesBySeries(facts),
  );
  expect(growth.analysis.rows.at(-1)?.[1]).toBeCloseTo(0.0746161504152039);
});
it("writes readable values, preliminary status and percentage cells in both languages", async () => {
  const facts = (await prepareGdpOverview()).facts.map((f) => ({
    ...f,
    value: Number(f.value),
  }));
  for (const locale of ["en", "ka"] as const)
    for (const indicator of [
      "real",
      "nominal",
      "growth",
      "per_capita",
    ] as const) {
      const p = {
        locale,
        messages: await getMessages(locale, ["gdp"]),
        englishLabels: {},
      };
      const model = buildGdpWorkbookExportModel(
        facts,
        {
          ...DEFAULT_GDP_STATE,
          indicator,
          currency: "usd",
          range: { kind: "manual", start: 2024, end: 2025 },
        },
        p,
        [],
        "https://fiscal.ge",
        sourceIdRangesBySeries(facts),
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await createWorkbookBuffer(model));
      expect(workbook.worksheets).toHaveLength(3);
      expect(workbook.worksheets[0].getCell("D3").value).toBeNull();
      expect(workbook.worksheets[1].getCell("B3").value).toBe(
        model.analysis.rows[1][1],
      );
      if (indicator === "growth")
        expect(workbook.worksheets[1].getCell("B3").numFmt).toBe("0.0%");
      if (indicator === "nominal" || indicator === "per_capita")
        expect(workbook.worksheets[0].getCell("C4").numFmt).toContain(
          locale === "en" ? "Preliminary" : "წინასწარი",
        );
    }
});
it("names the workbook per reader language and links only the sources in range", async () => {
  const facts = (await prepareGdpOverview()).facts.map((f) => ({
    ...f,
    value: Number(f.value),
  }));
  const sources = [
    {
      years: [2023, 2024, 2025],
      title: "GDP release",
      organization: "Geostat",
      downloadHref: "/downloads/methodology/gdp/release.xlsx" as const,
      retrievedAt: "2026-01-01",
    },
    {
      years: [2010],
      title: "Old release",
      organization: "Geostat",
      downloadHref: "/downloads/methodology/gdp/old.xlsx" as const,
      retrievedAt: "2026-01-01",
    },
  ];
  const models = await Promise.all(
    (["ka", "en"] as const).map(async (locale) =>
      buildGdpWorkbookExportModel(
        facts,
        { ...DEFAULT_GDP_STATE, indicator: "nominal", currency: "gel", range: { kind: "manual", start: 2024, end: 2025 } },
        { locale, messages: await getMessages(locale, ["gdp"]), englishLabels: {} },
        sources,
        "https://fiscal.ge",
        sourceIdRangesBySeries(facts),
      ),
    ),
  );
  expect(models.map((model) => model.filename)).toEqual([
    "fiscal-gdp-nominal-gel-2024-2025.xlsx",
    "fiscal-gdp-nominal-gel-2024-2025-en.xlsx",
  ]);
  for (const model of models)
    expect(model.sources).toEqual([
      {
        ...sources[0],
        years: [2024, 2025],
        absoluteUrl: "https://fiscal.ge/downloads/methodology/gdp/release.xlsx",
      },
    ]);
});

import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { sourceIdBySeriesMeasure } from "../../lib/explorer/clientData";
import { makePeriod } from "../../lib/data/inflation/periods";
import type { ServedInflationTargetRow } from "../../lib/data/inflation/types";
import { DEFAULT_INFLATION_STATE, indexInflationFacts, resolveInflationRange, type InflationIndex, type InflationState } from "../../lib/explorer/inflationOverview";
import { buildInflationWorkbookExportModel, type InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";

let index: InflationIndex;
let targets: ServedInflationTargetRow[];
const source = (sourceId: string, language: "ka" | "en"): InflationWorkbookSource => ({
  sourceId, language, years: Array.from({ length: 27 }, (_, offset) => 2000 + offset),
  title: `${sourceId} ${language}`, organization: "Geostat", downloadHref: `/downloads/methodology/inflation/files/${language}/${sourceId}.xlsx`, retrievedAt: "2026-09-12",
});
const sources = ["source.geostat_cpi_yoy", "source.geostat_cpi_avg12", "source.geostat_core_yoy", "source.nbg_inflation_target", "source.geostat_cpi_index_2010"].flatMap((id) => [source(id, "ka"), source(id, "en")]);

beforeAll(async () => {
  const data = await loadServedInflationData();
  index = indexInflationFacts(data.facts, sourceIdBySeriesMeasure(data.facts));
  targets = data.targets;
});

async function build(locale: "ka" | "en", state: InflationState) {
  const presentation = { locale, messages: await getMessages(locale, ["inflation"]), englishLabels: {} };
  return buildInflationWorkbookExportModel({ index, targets, state, range: resolveInflationRange(state, index), presentation, sources, siteOrigin: "https://fiscal.ge" });
}

const year2025: InflationState["range"] = { kind: "manual", start: makePeriod(2025, 1), end: makePeriod(2025, 12) };

describe("inflation workbook", () => {
  it("mirrors the grid: series — year rows, month columns, annual average, fractions", async () => {
    const model = await build("ka", { ...DEFAULT_INFLATION_STATE, range: year2025 });
    expect(model.filename).toBe("fiscal-inflation-yoy-2025-01-2025-12.xlsx");
    expect(model.readable.showChangeColumn).toBe(false);
    expect(model.readable.years).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(model.readable.headerLabels?.columns[0]).toBe("იანვარი");
    expect(model.readable.headerLabels?.columns[12]).toBe("წლის საშუალო");
    expect(model.readable.rows.map((row) => `${row.parentLabel} — ${row.label}`)).toEqual(["საერთო ინფლაცია — 2025", "მიზნობრივი მაჩვენებელი — 2025"]);
    const dec = index.values.get("cpi.headline:yoy_pct")!.get(makePeriod(2025, 12))!;
    expect(model.readable.rows[0]!.valuesByYear[12]).toBeCloseTo(dec / 100, 10);
    expect(model.readable.rows[0]!.valuesByYear[13]).toBeCloseTo(index.values.get("cpi.headline:avg12_pct")!.get(makePeriod(2025, 12))! / 100, 10);
    expect(model.readable.rows[1]!.valuesByYear[6]).toBe(0.03);
    expect(model.readable.rows[1]!.valuesByYear[13]).toBeNull();
    expect(model.sourceYears).toEqual([2025]);
    expect(model.analysis.rows).toHaveLength(24);
    expect(model.analysis.numericFormats).toEqual({ 4: "0.00%" });
    expect(model.sources.map((row) => row.title).sort()).toEqual(["source.geostat_cpi_avg12 ka", "source.geostat_cpi_yoy ka", "source.nbg_inflation_target ka"]);
  });

  it("exports the index as levels with English labels and no summary", async () => {
    const model = await build("en", { ...DEFAULT_INFLATION_STATE, tab: "index", range: year2025, selected: ["cpi", "core", "target"] });
    expect(model.filename).toBe("fiscal-inflation-index-2025-01-2025-12-en.xlsx");
    expect(model.readable.years).toHaveLength(12);
    expect(model.readable.rows.map((row) => row.parentLabel)).toEqual(["Consumer price index"]);
    expect(model.readable.rows[0]!.valuesByYear[1]).toBe(index.values.get("cpi.headline:index_2010")!.get(makePeriod(2025, 1)));
    expect(model.analysis.numericFormats).toEqual({ 4: "#,##0.00" });
    expect(model.sources.map((row) => row.title)).toEqual(["source.geostat_cpi_index_2010 en"]);
  });

  it("writes month headers and calendar-year source coverage", async () => {
    const model = await build("ka", { ...DEFAULT_INFLATION_STATE, range: year2025 });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(model));
    const [readable, analysis, sheetSources] = workbook.worksheets;
    expect(readable!.getCell("A3").value).toBe("სერია — წელი");
    expect(readable!.getCell("B3").value).toBe("იანვარი");
    expect(readable!.getCell("N3").value).toBe("წლის საშუალო");
    expect(readable!.getCell("O3").value).toBeNull();
    expect(readable!.getCell("A4").value).toBe("საერთო ინფლაცია — 2025");
    expect(String(readable!.getCell("B4").numFmt)).toContain("%");
    expect(analysis!.getCell("D2").numFmt).toBe("0.00%");
    expect(String(sheetSources!.getCell("A2").value)).toContain("2025");
    expect(String(sheetSources!.getCell("A2").value)).not.toContain("1–13");
  });

  it("never colours deflation or hides a zero in the readable sheet", async () => {
    const year2012: InflationState["range"] = { kind: "manual", start: makePeriod(2012, 1), end: makePeriod(2012, 12) };
    for (const [tab, format] of [["yoy", "0.0%"], ["mom", "0.0%"], ["index", "#,##0.0"]] as const) {
      const model = await build("en", { ...DEFAULT_INFLATION_STATE, tab, range: year2012, selected: ["cpi"] });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await createWorkbookBuffer(model));
      const readable = workbook.worksheets[0]!;
      const values = readable.getRow(4).values as unknown[];
      if (tab === "yoy") expect(values.some((value) => typeof value === "number" && value < 0)).toBe(true);
      for (let column = 2; column <= model.readable.years.length + 1; column += 1) {
        expect(readable.getCell(4, column).numFmt).toBe(format);
      }
    }
  });
});

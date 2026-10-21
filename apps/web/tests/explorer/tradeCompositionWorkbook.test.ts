import { expect, test } from "vitest";
import ExcelJS from "exceljs";
import { SSF } from "xlsx";
import { buildTradePartnersWorkbookModel } from "../../lib/explorer/tradePartnersWorkbook";
import { parseTradePartnersHash, tradePartnersBulkSelection } from "../../lib/explorer/tradePartnersState";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { workbookMessage } from "../../lib/i18n/workbook";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { compositionFixture, compositionPresentation } from "./tradeCompositionFixtures";

const sources: WorkbookPublicSource[] = ["export-sitc", "import-sitc", "export-bec", "import-bec", "ftrade_1995"].map(name => {
  const filename = name === "ftrade_1995" ? "ftrade_1995-2026.xlsx" : `${name}${name === "import-bec" ? "-" : "_"}2000-2026.xlsx`;
  return { years: [2024, 2025], title: filename, organization: "Geostat", downloadHref: `/downloads/methodology/trade/${filename}`, retrievedAt: "2026-10-14" };
});
test.each(["en", "ka"] as const)("%s exports every selected series/year with correct sources and private status omitted", async locale => {
  for (const classification of ["sitc", "bec"] as const) for (const measure of ["trade.exports", "trade.imports"] as const) {
    const data = compositionFixture(classification), p = await compositionPresentation(locale, data);
    data.facts = data.facts.map(([entity, year, flow]) => [entity, year, flow, [25, 0, -2, null, 0.000001][entity] ?? (entity === 3 ? null : 2)]);
    const state = { ...parseTradePartnersHash(`#measure=${measure}`, data), selectedIds: tradePartnersBulkSelection(data) };
    const input = { dataset: "composition" as const, data, state, sources, siteOrigin: "https://fiscal.ge" };
    const workbook = buildTradePartnersWorkbookModel(input, p);
    expect(workbook.sheetNames).toHaveLength(3); expect(workbook.analysis.headers).toHaveLength(5);
    expect(workbook.analysis.rows).toHaveLength((data.entities.length + 1) * 2);
    expect(workbook.analysis.headers.join(" ")).not.toMatch(/%|publication|გამოქვეყ|entity_id|source_id|confidence|GEL|₾/i);
    const original = { sitc: { "trade.exports": "export-sitc_2000-2026.xlsx", "trade.imports": "import-sitc_2000-2026.xlsx" }, bec: { "trade.exports": "export-bec_2000-2026.xlsx", "trade.imports": "import-bec-2000-2026.xlsx" } }[classification][measure];
    expect(workbook.sources.map(s => s.title).sort()).toEqual([original, "ftrade_1995-2026.xlsx"].sort());
    const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(workbook));
    expect(excel.worksheets).toHaveLength(3);
    workbook.analysis.rows.forEach((row, index) => expect(excel.worksheets[1].getCell(index + 2, 4).value).toBe(row[3]));
    expect(workbook.analysis.rows.slice(0, 6).map(row => row[3])).toEqual([measure === "trade.exports" ? 200 : 2000, 25, 0, -2, null, 0.000001]);
    expect(excel.worksheets[1].getCell("D4").value).toBe(0);
    expect(excel.worksheets[1].getCell("D5").value).toBe(-2);
    expect(excel.worksheets[1].getCell("D6").value).toBeNull();
    expect(excel.worksheets[1].getCell("E6").value).toBe(workbookMessage(locale, "workbook.unavailable"));
    expect(excel.worksheets[1].getCell("E4").value).toBe(workbookMessage(locale, "workbook.actual"));
    expect(excel.worksheets[1].getCell("D7").value).toBe(0.000001);
    expect(excel.worksheets[1].columnCount).toBe(5);
    expect(JSON.stringify(excel.worksheets.map(sheet => sheet.getSheetValues()))).not.toContain(p.messages["trade.publicationUnspecified"]);
    const tiny = excel.worksheets[0].getCell("B9");
    expect(Number(SSF.format(tiny.numFmt, tiny.value).replace("−", "-").replaceAll(",", ""))).not.toBe(0);
    expect(JSON.stringify(excel.worksheets[2].getSheetValues())).toContain(`https://fiscal.ge/downloads/methodology/trade/${original}`);
    expect(buildTradePartnersWorkbookModel({ ...input, state: { ...state, selectedIds: [data.entities[0].id] } }, p).sources.map(s => s.title)).toEqual([original]);
    expect(buildTradePartnersWorkbookModel({ ...input, state: { ...state, selectedIds: ["goods.total"] } }, p).sources.map(s => s.title)).toEqual(["ftrade_1995-2026.xlsx"]);
    expect(buildTradePartnersWorkbookModel({ ...input, state: { ...state, selectedIds: [] } }, p).sources).toEqual([]);
  }
});

import { expect, test } from "vitest";
import ExcelJS from "exceljs";
import { loadTradeServicesData, toClientTradeServicesData } from "../../lib/data/tradeServices/importTradeServices";
import { getMessages } from "../../lib/i18n/messages.server";
import { buildTradePartnersWorkbookModel } from "../../lib/explorer/tradePartnersWorkbook";
import { buildTradeOverviewWorkbookExportModel } from "../../lib/explorer/tradeOverviewWorkbook";
import { parseTradePartnersHash, tradePartnersBulkSelection } from "../../lib/explorer/tradePartnersState";
import { parseTradeOverviewHash } from "../../lib/explorer/tradeOverviewState";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { workbookMessage } from "../../lib/i18n/workbook";
import { editClientPartnerFacts } from "../data/tradePartners/fixtures";

// Task 4 registers these native originals in the public archive; this tests the shared writer independently.
const sourceNames = ["Georgian-Exports-of-Services-by-Types.xlsx", "Georgian-Imports-of-Services-by-Types.xlsx"];
const sources: WorkbookPublicSource[] = [...sourceNames, "FTrade_1995-2026.xlsx", "1004_180325_EN.PDF"].map(name => ({ years: [2020, 2021, 2022, 2023, 2024], title: name, organization: "Geostat", downloadHref: `/downloads/methodology/trade/${name}`, retrievedAt: "2026-10-07" }));
test.each(["en", "ka"] as const)("services %s native workbooks preserve selections, missingness, status and applicable sources", async locale => {
  const data = toClientTradeServicesData(await loadTradeServicesData()), presentation = { locale, englishLabels: data.englishLabels, messages: await getMessages(locale, ["trade", "workbook", "format"]) }, siteOrigin = "https://fiscal.ge";
  for (const measure of ["trade.exports", "trade.imports", "trade.balance", "trade.turnover"] as const) {
    const state = { ...parseTradePartnersHash(`#measure=${measure}&start=2020&end=2021`, data.types), selectedIds: tradePartnersBulkSelection(data.types) };
    const model = buildTradePartnersWorkbookModel({ data: data.types, state, sources, siteOrigin, dataset: "services" }, presentation);
    expect(model.filename).toContain("trade-services-types");
    expect(model.analysis.rows).toHaveLength(26);
    expect(model.readable.years).toEqual([2020, 2021]);
    expect(model.readable.rows).toHaveLength(13);
    const expectedSources = measure === "trade.exports" ? [sourceNames[0]] : measure === "trade.imports" ? [sourceNames[1]] : sourceNames;
    expect(model.sources.map(s => s.title).sort()).toEqual([...expectedSources].sort());
    expect(model.analysis.headers.join(" ")).not.toMatch(/entity_id|source_id|source_refs|source_block|source_cell|confidence/);
    const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
    expect(excel.worksheets).toHaveLength(3);
    const rows = excel.worksheets[1].getSheetValues() as unknown[][];
    model.analysis.rows.forEach((row, index) => expect(excel.worksheets[1].getCell(index + 2, 4).value).toBe(row[3]));
    const maintenance = rows.filter(row => row?.includes(locale === "en" ? data.englishLabels["services.maintenance_repair"] : data.types.entities.find(e => e.id === "services.maintenance_repair")!.labelKa));
    expect(maintenance).toHaveLength(2);
    const first = maintenance.find(row => row.includes(2020))!;
    if (measure === "trade.imports") expect(first[4]).toBeTypeOf("number");
    else expect(first[4] ?? null).toBeNull();
    const cells = JSON.stringify(rows);
    expect(cells).toContain(presentation.messages["trade.publicationUnspecified"]);
    expect(cells).toContain(workbookMessage(locale, "workbook.actual"));
    if (measure === "trade.balance") expect(model.analysis.rows.some(row => typeof row[3] === "number" && row[3] < 0)).toBe(true);
    const sourceCells = JSON.stringify(excel.worksheets[2].getSheetValues());
    for (const name of expectedSources) expect(sourceCells).toContain(`https://fiscal.ge/downloads/methodology/trade/${name}`);
    expect(sourceCells).not.toMatch(/FTrade|1004_180325/);
  }
  for (const selection of ["trade.exports", "trade.imports", "trade.balance", "trade.turnover", "trade.exports,trade.imports,trade.balance,trade.turnover"]) {
    const state = parseTradeOverviewHash(`#sel=${selection}&start=2022&end=2024`, data.national);
    const model = buildTradeOverviewWorkbookExportModel({ facts: data.national, state, sources, siteOrigin, dataset: "services" }, presentation);
    expect(model.filename).toContain("trade-services-overview");
    expect(model.analysis.rows).toHaveLength(state.selectedIds.length * 3);
    expect(model.readable.title).toBe(presentation.messages["trade.services.title"]);
    expect(model.sources).toHaveLength(selection === "trade.exports" || selection === "trade.imports" ? 1 : 2);
    const expectedSources = selection === "trade.exports" ? [sourceNames[0]] : selection === "trade.imports" ? [sourceNames[1]] : sourceNames;
    expect(model.sources.map(s => s.title).sort()).toEqual([...expectedSources].sort());
    const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
    expect(excel.worksheets[0].getCell("A1").value).toBe(model.readable.title);
    model.analysis.rows.forEach((row, index) => expect(excel.worksheets[1].getCell(index + 2, 4).value).toBe(row[3]));
    expect(JSON.stringify(excel.worksheets[2].getSheetValues())).not.toMatch(/FTrade|1004_180325/);
  }
  const zeroData = { ...data.types, facts: editClientPartnerFacts(data.types, f => f.entityId === "services.travel" && f.year === 2024 && f.indicatorId === "trade.exports" ? 0 : f.valueUsd) };
  const zero = buildTradePartnersWorkbookModel({ data: zeroData, state: parseTradePartnersHash("#sel=services.travel&measure=trade.exports&start=2024&end=2024", zeroData), sources, siteOrigin }, presentation);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(zero));
  expect(excel.worksheets[1].getCell("D2").value).toBe(0);
});

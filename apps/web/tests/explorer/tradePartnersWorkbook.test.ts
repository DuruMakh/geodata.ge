import ExcelJS from "exceljs";
import { SSF } from "xlsx";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { toClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { DEFAULT_TRADE_PARTNERS_STATE } from "../../lib/explorer/tradePartnersState";
import { tradePartnerEntities, tradePartnerFacts, tradePartnerNationalFacts } from "../data/tradePartners/fixtures";
const data = toClientTradePartnersData({ entities: tradePartnerEntities(), facts: tradePartnerFacts() }, tradePartnerNationalFacts());
const names = ["ftrade_1995-2026.xlsx", "export-country-1995-2026.xlsx", "import-country-1995-2026.xlsx", "export-country-group-1995-2026.xlsx", "import-country-group-1995-2026.xlsx"];
const sources: WorkbookPublicSource[] = names.map(name => ({ years: [2024, 2025], title: name, organization: "Geostat", downloadHref: `/downloads/methodology/trade/files/${name}`, retrievedAt: "2026-10-07" }));
async function presentation(locale: "en" | "ka"): Promise<Presentation> {
  return { locale, englishLabels: { "partner.1995-2025.643": "Russia", "partner.1995-2025.530": "Netherlands Antilles", "group.eu": "European Union (EU)", "group.oecd": "OECD" }, messages: { ...await getMessages(locale, ["workbook", "trade"]), "trade.partners.title": "Trading partners", "trade.partners.countries": "Countries", "trade.partners.groups": "Country groups", "trade.partners.total": "Georgia total", "trade.partners.groupOverlap": "Groups overlap and must not be added together." } };
}
const builder = async () => (await import("../../lib/explorer/tradePartnersWorkbook")).buildTradePartnersWorkbookModel;

test.each(["en", "ka"] as const)("native %s workbook includes mixed selections, USD, status and original source links", async locale => {
  const p = await presentation(locale), build = await builder();
  const state = { ...DEFAULT_TRADE_PARTNERS_STATE, measure: "trade.balance" as const, tab: "countries" as const, selectedIds: ["partner.1995-2025.643", "group.eu"], range: { kind: "manual" as const, start: 2025, end: 2025 } };
  const model = build({ data, state, sources, siteOrigin: "https://fiscal.ge" }, p);
  expect(model.filename).toContain("trade-partners");
  expect(model.readable.rows.map(row => row.label)).toEqual(locale === "en" ? ["Russia", "European Union (EU)"] : ["რუსეთი", "ევროკავშირი (EU)"]);
  expect(model.readable.years).toEqual([2025]);
  expect(model.readable.showChangeColumn).toBe(false);
  expect(model.readable.subtitle).toContain("Groups overlap");
  expect(model.analysis.rows.map(row => row[3])).toEqual([-150, 200]);
  expect(model.analysis.headers.join(" ")).not.toMatch(/GEL|₾|%|source_cell|entity_id/);
  expect(model.analysis.headers[3]).toMatch(/USD|აშშ დოლარი/);
  expect(model.sources).toHaveLength(4);
  expect(model.sources.every(source => source.years.join() === "2025" && source.absoluteUrl.startsWith("https://fiscal.ge/downloads/methodology/trade/"))).toBe(true);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
  expect(excel.worksheets[1].getCell("D2").value).toBe(-150);
  expect(excel.worksheets[1].getCell("D2").numFmt).not.toContain("Red");
  expect(excel.worksheets[1].getCell("E2").value).toBe(locale === "en" ? "Actual" : "ფაქტი");
  expect(excel.worksheets[1].getCell("F2").value).toBe(p.messages["trade.publicationUnspecified"]);
});
test("source selection follows the measure and shared selection, including the optional national reference", async () => {
  const build = await builder(), p = await presentation("en");
  const input = { data, sources, siteOrigin: "https://fiscal.ge", state: { ...DEFAULT_TRADE_PARTNERS_STATE, measure: "trade.exports" as const, selectedIds: ["group.eu"] } };
  expect(build(input, p).sources.map(s => s.title)).toEqual(["export-country-group-1995-2026.xlsx"]);
  expect(build({ ...input, state: { ...input.state, selectedIds: ["goods.total", "group.eu"] } }, p).sources.map(s => s.title)).toEqual(["ftrade_1995-2026.xlsx", "export-country-group-1995-2026.xlsx"]);
  const empty = build({ ...input, state: { ...input.state, selectedIds: [] } }, p);
  expect(empty.readable.rows).toEqual([]); expect(empty.analysis.rows).toEqual([]); expect(empty.sources).toEqual([]);
});
test("missing workbook amounts stay blank while tiny signed amounts remain numeric", async () => {
  const build = await builder(), p = await presentation("en");
  const tiny = { ...data, facts: data.facts.map(f => f.entityId.endsWith(".643") && f.indicatorId === "trade.imports" ? { ...f, valueUsd: 0.000001 } : f) };
  const model = build({ data: tiny, state: { ...DEFAULT_TRADE_PARTNERS_STATE, measure: "trade.imports", selectedIds: ["partner.1995-2025.643", "partner.1995-2025.530"], range: { kind: "manual", start: 2025, end: 2025 } }, sources, siteOrigin: "https://fiscal.ge" }, p);
  expect(model.analysis.rows.map(row => row[3])).toEqual([0.000001, null]);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets[1].getCell("D2").value).toBe(0.000001);
  expect(excel.worksheets[1].getCell("D3").value).toBeNull();
});

test.each(["en", "ka"] as const)("%s Summary keeps small positive and negative amounts visibly nonzero, zero and blanks distinct", async locale => {
  const build = await builder(), p = await presentation(locale);
  for (const divisor of [1_000_000_000, 1_000_000]) {
    const small = { ...data,
      nationalFacts: data.nationalFacts.map(f => f.indicatorId === "trade.balance" ? { ...f, valueUsd: 2 * divisor } : f),
      facts: data.facts.map(f => f.indicatorId === "trade.balance" ? { ...f, valueUsd: f.entityId.endsWith(".643") ? 4_736_258.239671868 : f.entityId === "group.eu" ? -42.03 : 0 } : f),
    };
    const model = build({ data: small, state: { ...DEFAULT_TRADE_PARTNERS_STATE, measure: "trade.balance", selectedIds: ["partner.1995-2025.643", "group.eu", "group.oecd", "partner.1995-2025.530"], range: { kind: "manual", start: 2025, end: 2025 } }, sources, siteOrigin: "https://fiscal.ge" }, p);
    const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
    const summary = excel.worksheets[0];
    const cells = [4, 6, 7, 5].map(row => summary.getCell(`B${row}`));
    expect(cells.map(cell => cell.value)).toEqual([4_736_258.239671868 / divisor, -42.03 / divisor, 0, null]);
    const displayed = (index: number) => Number(SSF.format(cells[index].numFmt, cells[index].value).replace("−", "-").replaceAll(",", ""));
    expect(displayed(0)).toBeGreaterThan(0);
    expect(displayed(1)).toBeLessThan(0);
    expect(displayed(2)).toBe(0);
    expect(cells[1].numFmt).not.toContain("Red");
  }
});

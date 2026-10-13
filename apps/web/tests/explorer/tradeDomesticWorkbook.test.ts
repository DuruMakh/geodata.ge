import { expect, test } from "vitest";
import ExcelJS from "exceljs";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { loadTradeDomesticData, toClientTradeDomesticData } from "../../lib/data/tradeDomestic/importTradeDomestic";
import { loadTradeOverviewFacts } from "../../lib/data/tradeOverview/importTradeOverview";
import { TRADE_CHART_INDICATORS } from "../../lib/data/tradeOverview/types";
import { getMessages } from "../../lib/i18n/messages.server";
import { loadWorkbookSources } from "../../lib/methodology/workbookSources";
import { buildTradeOverviewWorkbookExportModel } from "../../lib/explorer/tradeOverviewWorkbook";
import { buildTradePartnersWorkbookModel } from "../../lib/explorer/tradePartnersWorkbook";
import { buildTradeProductsWorkbookModel } from "../../lib/explorer/tradeProductsWorkbook";
import { parseTradeOverviewHash } from "../../lib/explorer/tradeOverviewState";
import { parseTradePartnersHash } from "../../lib/explorer/tradePartnersState";
import { parseTradeProductsHash, tradeProductsBulkSelection } from "../../lib/explorer/tradeProductsState";

test.each(["en", "ka"] as const)("domestic %s workbooks keep complete selections, correct totals and applicable original sources", async locale => {
  const [domestic, national, messages, sources] = await Promise.all([loadTradeDomesticData(), loadTradeOverviewFacts(), getMessages(locale, ["trade", "workbook", "format"]), loadWorkbookSources("trade", undefined, locale)]);
  const data = toClientTradeDomesticData(domestic, national), presentation = { locale, messages, englishLabels: data.englishLabels }, siteOrigin = "https://fiscal.ge";
  const all = buildTradeOverviewWorkbookExportModel({ facts: data.national, state: parseTradeOverviewHash("#sel=trade.exports,trade.domestic_exports,trade.reexports", data.national), sources, siteOrigin }, presentation);
  expect(all.analysis.rows).toHaveLength(36);
  expect(all.sources).toHaveLength(2);
  expect(all.sources.some(source => source.downloadHref.endsWith("domestic-export-country-2014-2026.xlsx"))).toBe(true);
  const countryState = { ...parseTradePartnersHash("", data.countries), measure: "trade.reexports" as const, selectedIds: ["partner.2014-2025.807", "partner.2014-2025.643"] };
  const countries = buildTradePartnersWorkbookModel({ data: data.countries, state: countryState, sources, siteOrigin }, presentation);
  expect(countries.analysis.rows).toHaveLength(24);
  const missing = countries.analysis.rows.filter(row => row[2] === (locale === "en" ? "Macedonia (FYR)" : "მაკედონია (ყოფილი იუგოსლავიის რესპუბლიკა)"));
  expect(missing).toHaveLength(12);
  expect(missing.every(row => row[3] === null)).toBe(true);
  expect(countries.sources.map(source => source.downloadHref.split("/").at(-1)).sort()).toEqual(["domestic-export-country-2014-2026.xlsx", "export-country-1995-2026.xlsx"]);
  const products = buildTradeProductsWorkbookModel({ data: data.products, state: { ...parseTradeProductsHash("", data.products), selectedIds: tradeProductsBulkSelection(data.products) }, sources, siteOrigin }, presentation);
  expect(products.analysis.rows).toHaveLength(606);
  expect(products.readable.subtitle).toContain("2020–2025");
  expect(products.sources.map(source => source.downloadHref.split("/").at(-1)).sort()).toEqual(["domestic-export-country-2014-2026.xlsx", "domestic-exports-by-4-digit-2014-2026.xlsx"]);
  expect(products.readable.rows.some(row => row.label.includes(locale === "en" ? "Other commodities" : "სხვა საქონელი"))).toBe(true);
  const oneYear = buildTradeOverviewWorkbookExportModel({ facts: data.national, state: { ...parseTradeOverviewHash("#sel=trade.exports,trade.domestic_exports,trade.reexports", data.national), range: { kind: "manual", start: 2025, end: 2025 } }, sources, siteOrigin }, presentation);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(oneYear));
  expect(excel.worksheets[0].getRow(2).height).toBeGreaterThan(15);
});

test("client trade values are whole dollars", async () => {
  const [domestic, national] = await Promise.all([loadTradeDomesticData(), loadTradeOverviewFacts()]);
  const data = toClientTradeDomesticData(domestic, national);
  const values = [...data.national, ...data.countries.nationalFacts, ...data.products.nationalFacts].map(fact => fact.valueUsd).concat([...data.countries.facts, ...data.products.facts].map(fact => fact[3]!));
  expect(values.length).toBeGreaterThan(5000);
  expect(values.filter(value => !Number.isInteger(value))).toEqual([]);
  // Each country and product value moves by less than a dollar.
  const source = new Map(domestic.facts.map(fact => [`${fact.entityId}:${fact.year}:${fact.indicatorId}`, Number(fact.valueUsd)]));
  const moves = [
    ...data.countries.facts.map(([entity, year, measure, value]) => value! - source.get(`${data.countries.entities[entity]!.id}:${year}:${TRADE_CHART_INDICATORS[measure]}`)!),
    ...data.products.facts.map(([entity, year, , value]) => value! - source.get(`${data.products.entities[entity]!.id}:${year}:trade.domestic_exports`)!),
  ];
  expect(moves).toHaveLength(data.countries.facts.length + data.products.facts.length);
  expect(moves.filter(move => !(Math.abs(move) < 1))).toEqual([]);
  // National re-exports follow the rounded totals, as the workbook's formula states.
  const amount = (year: number, indicator: string) => data.national.find(fact => fact.year === year && fact.indicatorId === indicator)!.valueUsd;
  for (const fact of data.national.filter(fact => fact.indicatorId === "trade.reexports")) expect(fact.valueUsd).toBe(amount(fact.year, "trade.exports") - amount(fact.year, "trade.domestic_exports"));
});

test("a workbook total equals the sum of its rows", async () => {
  const [domestic, national, messages] = await Promise.all([loadTradeDomesticData(), loadTradeOverviewFacts(), getMessages("ka", ["trade", "workbook", "format"])]);
  const data = toClientTradeDomesticData(domestic, national), presentation = { locale: "ka" as const, messages, englishLabels: data.englishLabels }, siteOrigin = "https://fiscal.ge";
  const countryIds = ["goods.total", ...data.countries.entities.map(entity => entity.id)];
  const models = [
    buildTradePartnersWorkbookModel({ data: data.countries, state: { ...parseTradePartnersHash("", data.countries), measure: "trade.domestic_exports", selectedIds: countryIds }, sources: [], siteOrigin }, presentation),
    buildTradeProductsWorkbookModel({ data: data.products, state: { ...parseTradeProductsHash("", data.products), selectedIds: tradeProductsBulkSelection(data.products) }, sources: [], siteOrigin }, presentation),
  ];
  for (const model of models) {
    const totalLabel = model.readable.rows.find(row => row.kind === "total")!.label;
    expect(model.readable.years.length).toBeGreaterThan(5);
    for (const year of model.readable.years) {
      const rows = model.analysis.rows.filter(row => row[0] === year), total = rows.find(row => row[2] === totalLabel)![3];
      expect(rows.filter(row => row[2] !== totalLabel).reduce((sum, row) => sum + (row[3] as number | null ?? 0), 0), `${model.filename} ${year}`).toBe(total);
    }
  }
});

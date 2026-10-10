import ExcelJS from "exceljs";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { DEFAULT_TRADE_PRODUCTS_STATE } from "../../lib/explorer/tradeProductsState";
import { productData, productPresentation } from "./tradeProductsFixtures";

const filenames = ["ftrade_1995-2026.xlsx", "export-product-by-4-digit-1995-1999.xlsx", "export-product-by-4-digit-2000-2014.xlsx", "export-product-by-4-digit-2015-2026.xlsx", "import-products--1995-1999_eng.xlsx", "import-product-by-4-digit-2000-2014.xlsx", "import-product-by-4-digit-2015-2026.xlsx"];
const sources: WorkbookPublicSource[] = filenames.map(name => ({ years: Array.from({ length: name.includes("1995-1999") ? 5 : 31 }, (_, index) => 1995 + index), title: name, organization: "Geostat", downloadHref: `/downloads/methodology/trade/files/${name}`, retrievedAt: "2026-10-07" }));
const builder = async () => (await import("../../lib/explorer/tradeProductsWorkbook")).buildTradeProductsWorkbookModel;
async function presentation(locale: "en" | "ka") {
  const p = productPresentation(locale);
  return { ...p, messages: { ...p.messages, ...await getMessages(locale, ["trade", "workbook"]) } };
}

test("exports only the selected product's observed span while retaining its historical identity", async () => {
  const build = await builder(), p = await presentation("en"), data = productData();
  const model = build({ data, state: { ...DEFAULT_TRADE_PRODUCTS_STATE, selectedIds: ["goods.hs4.2020-2025.8703"] }, sources, siteOrigin: "https://fiscal.ge" }, p);
  expect(model.readable.subtitle).toContain("2024–2025");
  expect(model.analysis.rows).toHaveLength(2);
  expect(model.analysis.rows.map(row => row[3])).toEqual([200, 200]);
  expect(model.readable.rows[0].label).toContain("8703 · 2020–2025");
});

test.each(["en", "ka"] as const)("%s exports all committed historical series beyond the table page", async locale => {
  const build = await builder(), p = await presentation(locale), data = productData();
  const base = data.entities[0];
  data.entities.push(...Array.from({ length: 26 }, (_, index) => ({ ...base, id: `fixture.${index}`, code: String(3000 + index), sourceLabelEn: `Product ${index}` })));
  p.englishLabels = Object.fromEntries(data.entities.map(entity => [entity.id, entity.sourceLabelEn]));
  data.years = [2019, 2020, 2021];
  data.facts = data.entities.map((_, index) => [index, index === 1 ? 2021 : 2019, 0, index === 2 ? 0 : index === 3 ? -0.0056 : index + 1]);
  const state = { ...DEFAULT_TRADE_PRODUCTS_STATE, selectedIds: data.entities.map(entity => entity.id), range: { kind: "manual" as const, start: 2019, end: 2021 } };
  const model = build({ data, state, sources, siteOrigin: "https://fiscal.ge" }, p);
  expect(model.analysis.rows).toHaveLength(90);
  const actualLabel = locale === "en" ? "Actual" : "ფაქტი";
  expect(model.analysis.rows.some(row => row.includes(actualLabel))).toBe(true);
  expect(model.readable.subtitle).toContain("2019–2021");
  expect(model.readable.subtitle).toContain(p.messages["trade.products.historicalNote"]);
  expect(model.readable.rows.map(row => row.label).join(" ")).toMatch(/8703 · 2015–2019/);
  expect(model.readable.rows.map(row => row.label).join(" ")).toMatch(/8703 · 2020–2025/);
  expect(model.analysis.headers.join(" ")).not.toMatch(/GEL|₾|%|source_cell|entity_id/);
  expect(model.analysis.headers[3]).toMatch(/USD|აშშ დოლარი/);
  expect(model.sources.map(source => source.title)).toEqual(["export-product-by-4-digit-2015-2026.xlsx"]);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
  const sheet = excel.worksheets[1];
  expect(sheet.getCell("D3").value).toBeNull();
  expect(sheet.getCell("D4").value).toBe(0);
  expect(sheet.getCell("D5").value).toBe(-0.0056);
  expect(sheet.getCell("D5").numFmt).not.toContain("Red");
  expect(sheet.getCell("F2").value).toBe(p.messages["trade.publicationUnspecified"]);
  expect(excel.worksheets[2].getCell("D4").value).toEqual(expect.objectContaining({ hyperlink: "https://fiscal.ge/downloads/methodology/trade/files/export-product-by-4-digit-2015-2026.xlsx" }));
});

test("retains an old version's original source even when the selected years have no observations", async () => {
  const build = await builder(), p = await presentation("en"), data = productData();
  data.entities[0] = { ...data.entities[0], id: "goods.hs4.1995-1999.8703", sourceBlock: "1995-1999" };
  data.years = [1995, 2024, 2025]; data.facts = data.facts.map(fact => fact[0] === 0 ? [fact[0], 1995, fact[2], fact[3]] : fact);
  p.englishLabels = { ...p.englishLabels, [data.entities[0].id]: "Motor cars" };
  const state = { ...DEFAULT_TRADE_PRODUCTS_STATE, selectedIds: ["goods.total", data.entities[0].id], range: { kind: "manual" as const, start: 2025, end: 2025 } };
  const model = build({ data, state, sources, siteOrigin: "https://fiscal.ge" }, p);
  expect(model.analysis.rows.map(row => row[3])).toEqual([1000, null]);
  expect(model.sources.map(source => source.title)).toEqual(["ftrade_1995-2026.xlsx", "export-product-by-4-digit-1995-1999.xlsx"]);
  expect(model.sources[1].years).toEqual([1995, 1996, 1997, 1998, 1999]);
  const imports = build({ data, state: { ...state, measure: "trade.imports" }, sources, siteOrigin: "https://fiscal.ge" }, p);
  expect(imports.sources.map(source => source.title)).toEqual(["ftrade_1995-2026.xlsx", "import-products--1995-1999_eng.xlsx"]);
  expect(build({ data, state: { ...state, selectedIds: [] }, sources, siteOrigin: "https://fiscal.ge" }, p).sources).toEqual([]);
});

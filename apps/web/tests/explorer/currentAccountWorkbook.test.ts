import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { loadCurrentAccountFacts, toClientCurrentAccountFacts } from "../../lib/data/externalFlows/importCurrentAccount";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { DEFAULT_CURRENT_ACCOUNT_STATE, type CurrentAccountState } from "../../lib/explorer/currentAccountState";

const gdpRows = parse(readFileSync(path.resolve(process.cwd(), "../../data/imports/gdp-overview-annual.csv")), { columns: true, bom: true }) as Record<string, string>[];
const gdp = gdpRows.filter(row => row.series_id === "nominal_usd").map(row => ({ year: Number(row.year), valueUsd: Number(row.value), preliminary: row.status === "preliminary" }));
const names = ["bop-6_bopbpm6eng.xlsx", "remc_money-transfers-by-countries-eng.xlsx", "external-sector-methodology-eng-bpm6updated.pdf"];
const sources: WorkbookPublicSource[] = names.map(name => ({ years: Array.from({ length: 26 }, (_, i) => 2000 + i), title: name, organization: "National Bank of Georgia", downloadHref: `/downloads/methodology/external-flows/files/${name}`, retrievedAt: "2026-10-10" }));
async function presentation(locale: "en" | "ka"): Promise<Presentation> {
  return { locale, englishLabels: {}, messages: await getMessages(locale, ["workbook", "external", "main"]) };
}
const build = async () => (await import("../../lib/explorer/currentAccountWorkbook")).buildCurrentAccountWorkbookModel;
const state = (change: Partial<CurrentAccountState>): CurrentAccountState => ({ ...DEFAULT_CURRENT_ACCOUNT_STATE, ...change });
const facts = async () => toClientCurrentAccountFacts(await loadCurrentAccountFacts());

test.each(["en", "ka"] as const)("the %s Balance workbook exports all five net series with negative USD amounts and the BoP source only", async locale => {
  const p = await presentation(locale), model = (await build())({ facts: await facts(), gdp, sources, siteOrigin: "https://fiscal.ge", state: state({ selectedIds: [], range: { kind: "manual", start: 2024, end: 2025 } }) }, p);
  expect(model.filename).toContain("current-account");
  expect(model.readable.rows.map(row => row.label)).toEqual(["ca.balance", "ca.goods", "ca.services", "ca.primary_income", "ca.secondary_income"].map(id => p.messages[`external.account.series.${id}`]));
  const balance2025 = model.analysis.rows.find(row => row[0] === 2025 && row[2] === p.messages["external.account.series.ca.balance"])!;
  expect(balance2025[3] as number).toBeCloseTo(-1123241112.31, 1);
  expect(model.readable.numberFormat).toContain('"−"');
  expect(model.sources.map(s => s.title)).toEqual(["bop-6_bopbpm6eng.xlsx"]);
  expect(model.analysis.headers.join(" ")).not.toMatch(/GEL|₾|series_id|source_cell/);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
});

test("Money out exports only the selected debit series, and % of GDP exports percentages beside the USD amounts", async () => {
  const p = await presentation("en"), run = await build(), all = await facts();
  const out = run({ facts: all, gdp, sources, siteOrigin: "https://fiscal.ge", state: state({ tab: "out", selectedIds: ["ca.services"], range: { kind: "manual", start: 2025, end: 2025 } }) }, p);
  expect(out.readable.rows.map(row => row.label)).toEqual(["Services"]);
  expect(out.analysis.rows[0][3] as number).toBeCloseTo(3863.6e6, -5);
  const share = run({ facts: all, gdp, sources, siteOrigin: "https://fiscal.ge", state: state({ unit: "gdp", range: { kind: "manual", start: 2025, end: 2025 } }) }, p);
  expect(share.readable.unitLabel).toBe("% of GDP");
  expect(share.readable.rows[0].valuesByYear[2025]!).toBeCloseTo(-2.944769, 5);
  expect(share.analysis.headers.at(-1)).toBe("% of GDP");
  expect(share.analysis.numericFormats?.[share.analysis.headers.length]).toContain('"−"');
  expect(share.analysis.rows[0][3] as number).toBeCloseTo(-1123241112.31, 1);
  const empty = run({ facts: all, gdp, sources, siteOrigin: "https://fiscal.ge", state: state({ tab: "in", selectedIds: [] }) }, p);
  expect(empty.readable.rows).toEqual([]); expect(empty.sources).toEqual([]);
});

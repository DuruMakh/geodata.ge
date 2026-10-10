import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { expect, test } from "vitest";
import { loadCurrentAccountFacts, toClientCurrentAccountFacts } from "../../lib/data/externalFlows/importCurrentAccount";
import type { Presentation } from "../../lib/i18n/types";
import type { CurrentAccountState } from "../../lib/explorer/currentAccountState";

const series = { "ca.balance": "Current account", "ca.goods": "Goods", "ca.services": "Services", "ca.primary_income": "Primary income", "ca.secondary_income": "Secondary income" };
const presentation: Presentation = { locale: "en", messages: { "external.unit.million": "million USD", "external.unit.billion": "billion USD", "main.percentGdp": "% of GDP", ...Object.fromEntries(Object.entries(series).map(([id, label]) => [`external.account.series.${id}`, label])) }, englishLabels: {} };
const gdpRows = parse(readFileSync(path.resolve(process.cwd(), "../../data/imports/gdp-overview-annual.csv")), { columns: true, bom: true }) as Record<string, string>[];
const gdp = gdpRows.filter(row => row.series_id === "nominal_usd").map(row => ({ year: Number(row.year), valueUsd: Number(row.value), preliminary: row.status === "preliminary" }));
const initial: CurrentAccountState = { tab: "balance", unit: "usd", mode: "line", range: { kind: "all" }, selectedIds: ["ca.balance"] };
const modules = async () => ({ ...await import("../../lib/explorer/currentAccount"), facts: toClientCurrentAccountFacts(await loadCurrentAccountFacts()) });

test("the Balance tab reads net values for 2000–2025 and its parts add up to the balance", async () => {
  const { buildCurrentAccountModel: build, facts } = await modules();
  const model = build(facts, gdp, initial, presentation);
  expect(model.years[0]).toBe(2000); expect(model.years.at(-1)).toBe(2025);
  expect(model.series.map(s => s.label)).toEqual(Object.values(series));
  expect(model.unit.label).toBe("billion USD");
  expect(model.valuesById["ca.balance"][2025]).toBeCloseTo(-1123241112.31, 1);
  for (const year of model.years) {
    const parts = (["ca.goods", "ca.services", "ca.primary_income", "ca.secondary_income"] as const).reduce((sum, id) => sum + model.valuesById[id][year]!, 0);
    expect(Math.abs(parts - model.valuesById["ca.balance"][year]!)).toBeLessThan(1);
  }
  expect(model.endValues["ca.goods"]).toBeLessThan(0);
  expect(model.preliminaryGdpYears).toEqual([]);
});

test("Money in reads credit and Money out reads debit", async () => {
  const { buildCurrentAccountModel: build, facts } = await modules();
  expect(build(facts, gdp, { ...initial, tab: "in" }, presentation).valuesById["ca.services"][2025]).toBeCloseTo(8572.9e6, -5);
  expect(build(facts, gdp, { ...initial, tab: "out" }, presentation).valuesById["ca.services"][2025]).toBeCloseTo(3863.6e6, -5);
});

test("% of GDP divides by nominal GDP in USD, names preliminary GDP years and leaves a year without GDP empty", async () => {
  const { buildCurrentAccountModel: build, facts } = await modules();
  const model = build(facts, gdp, { ...initial, unit: "gdp" }, presentation);
  expect(model.unit).toMatchObject({ divisor: 1, label: "% of GDP" });
  expect(Math.abs(model.valuesById["ca.balance"][2025]! - -2.944768734150)).toBeLessThan(1e-6);
  expect(model.preliminaryGdpYears).toEqual([2025]);
  expect(build(facts, gdp, { ...initial, unit: "gdp", range: { kind: "manual", start: 2000, end: 2024 } }, presentation).preliminaryGdpYears).toEqual([]);
  const withoutGdp = build(facts, gdp.filter(row => row.year !== 2010), { ...initial, unit: "gdp" }, presentation);
  expect(withoutGdp.valuesById["ca.goods"][2010]).toBeNull();
  for (const year of model.years) {
    const parts = (["ca.goods", "ca.services", "ca.primary_income", "ca.secondary_income"] as const).reduce((sum, id) => sum + model.valuesById[id][year]!, 0);
    expect(Math.abs(parts - model.valuesById["ca.balance"][year]!)).toBeLessThan(1e-6);
  }
});

test("only selected series that exist are kept, in the page order", async () => {
  const { buildCurrentAccountModel: build, facts } = await modules();
  expect(build(facts, gdp, { ...initial, tab: "in", selectedIds: ["ca.services", "ca.balance"] }, presentation).selectedIds).toEqual(["ca.balance", "ca.services"]);
});

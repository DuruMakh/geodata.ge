import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { loadForeignInvestmentData, toClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
import type { Presentation } from "../../lib/i18n/types";
const labels = JSON.parse(readFileSync(path.resolve(process.cwd(), "../../data/localization/en/labels.json"), "utf8")) as Record<string, { text: string }>;
const presentation: Presentation = { locale: "en", messages: { "external.unit.million": "million USD", "external.unit.billion": "billion USD", "external.investment.otherCountries": "Other countries" }, englishLabels: Object.fromEntries(Object.entries(labels).filter(([id]) => id.startsWith("fdi.")).map(([id, label]) => [id, label.text])) };
const modules = async () => ({ ...await import("../../lib/explorer/foreignInvestmentState"), ...await import("../../lib/explorer/foreignInvestment"), data: toClientForeignInvestmentData(await loadForeignInvestmentData()) });
const initial: import("../../lib/explorer/foreignInvestmentState").ForeignInvestmentState = { dimension: "country", mode: "line", range: { kind: "all" }, selectedIds: ["fdi.total"] };

test("the country tab lists the total, the end year's top 10 countries and Other countries, which add up to the total", async () => {
  const { buildForeignInvestmentModel: build, data } = await modules();
  const model = build(data, initial, presentation);
  expect(model.series.map(s => s.label).slice(0, 4)).toEqual(["Foreign direct investment, total", "United Kingdom", "Azerbaijan", "Türkiye"]);
  expect(model.series).toHaveLength(12); expect(model.series.at(-1)).toMatchObject({ id: "fdi.others", label: "Other countries" });
  for (const year of model.years) {
    const total = model.valuesByEntity["fdi.total"][year]!;
    const listed = model.series.slice(1).reduce((sum, s) => sum + (model.valuesByEntity[s.id][year] ?? 0), 0);
    expect(Math.abs(listed - total)).toBeLessThan(0.01);
  }
  expect(model.ranking[0]).toMatchObject({ entityId: "fdi.country.m49_826", rank: 1 });
  expect(model.ranking[0].valueUsd).toBeCloseTo(426631499.8, 1);
  expect(model.ranking[0].share).toBeCloseTo(426631499.8 / 1900386201, 6);
  expect(model.other).toMatchObject({ entityId: "fdi.others", rank: null });
});

test("a country Geostat marks '-' in early years stays missing, never zero", async () => {
  const { buildForeignInvestmentModel: build, data } = await modules();
  const model = build(data, initial, presentation);
  const missing = data.facts.find(f => f.entityId.startsWith("fdi.country.m49_") && f.valueUsd === null && f.year === 1996)!;
  expect(model.valuesByEntity[missing.entityId]?.[1996] ?? null).toBeNull();
});

test("the sector tab lists all 18 sectors from 2016; the region tab all 11 regions with split regions missing before 2016", async () => {
  const { buildForeignInvestmentModel: build, data } = await modules();
  const sectors = build(data, { ...initial, dimension: "sector" }, presentation);
  expect(sectors.series).toHaveLength(19); expect(sectors.years[0]).toBe(2016); expect(sectors.other).toBeNull();
  expect(sectors.ranking).toHaveLength(18); expect(sectors.ranking[0].entityId).toBe("fdi.sector.k");
  const regions = build(data, { ...initial, dimension: "region", selectedIds: ["fdi.region.guria"] }, presentation);
  expect(regions.series).toHaveLength(12); expect(regions.years[0]).toBe(2009);
  expect(regions.valuesByEntity["fdi.region.guria"][2015]).toBeNull();
  expect(regions.valuesByEntity["fdi.region.guria"][2016]).not.toBeNull();
  expect(regions.ranking[0].entityId).toBe("fdi.region.tbilisi");
  const imereti = regions.ranking.at(-1)!;
  expect(imereti).toMatchObject({ entityId: "fdi.region.imereti", rank: 11 });
  expect(imereti.valueUsd).toBeLessThan(0); expect(imereti.share).toBeLessThan(0);
});

test("the ranking follows the range end year and skips items without a value that year", async () => {
  const { buildForeignInvestmentModel: build, data } = await modules();
  const model = build(data, { ...initial, dimension: "region", range: { kind: "manual", start: 2009, end: 2012 } }, presentation);
  expect(model.range.end).toBe(2012);
  expect(model.ranking.map(r => r.entityId)).not.toContain("fdi.region.guria");
  expect(model.ranking.every(r => r.valueUsd !== null)).toBe(true);
});

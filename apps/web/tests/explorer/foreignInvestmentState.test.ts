import { expect, test } from "vitest";
import { loadForeignInvestmentData, toClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
const state = () => import("../../lib/explorer/foreignInvestmentState");
const load = async () => toClientForeignInvestmentData(await loadForeignInvestmentData());

test("defaults to the country tab, a line chart, every year and the total only", async () => {
  const { parseForeignInvestmentHash, foreignInvestmentCoverage } = await state(), data = await load();
  expect(parseForeignInvestmentHash("", data)).toEqual({ dimension: "country", mode: "line", range: { kind: "all" }, selectedIds: ["fdi.total"] });
  expect(foreignInvestmentCoverage(data, "country")).toMatchObject({ min: 1996, max: 2025 });
  expect(foreignInvestmentCoverage(data, "sector")).toMatchObject({ min: 2016, max: 2025 });
  expect(foreignInvestmentCoverage(data, "region")).toMatchObject({ min: 2009, max: 2025 });
});

test("a saved view round-trips; years outside the tab are refitted and ids from another tab dropped", async () => {
  const { parseForeignInvestmentHash, serializeForeignInvestmentHash } = await state(), data = await load();
  const saved = parseForeignInvestmentHash("#tab=sector&view=table&sel=fdi.sector.k,fdi.region.tbilisi,fdi.total&start=2000&end=2018", data);
  expect(saved).toEqual({ dimension: "sector", mode: "table", range: { kind: "manual", start: 2016, end: 2018 }, selectedIds: ["fdi.total", "fdi.sector.k"] });
  expect(parseForeignInvestmentHash(serializeForeignInvestmentHash(saved), data)).toEqual(saved);
  expect(parseForeignInvestmentHash("#tab=moon&sel=", data)).toMatchObject({ dimension: "country", selectedIds: [] });
  expect(parseForeignInvestmentHash("#sel=fdi.others,fdi.country.m49_826", data).selectedIds).toEqual(["fdi.country.m49_826", "fdi.others"]);
});

test("switching tabs selects the total only and fits the range to the new tab's years", async () => {
  const { switchForeignInvestmentTab, foreignInvestmentCoverage } = await state(), data = await load();
  const next = switchForeignInvestmentTab({ dimension: "country", mode: "table", range: { kind: "manual", start: 2000, end: 2020 }, selectedIds: ["fdi.country.m49_826"] }, "region", data);
  expect(next).toEqual({ dimension: "region", mode: "table", range: { kind: "manual", start: 2009, end: 2020 }, selectedIds: ["fdi.total"] });
  expect(switchForeignInvestmentTab({ ...next, range: { kind: "manual", start: 2009, end: 2012 } }, "sector", data).range).toEqual({ kind: "all" });
  expect(foreignInvestmentCoverage(data, "sector").years).toHaveLength(10);
});

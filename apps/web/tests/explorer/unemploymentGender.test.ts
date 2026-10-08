import { beforeAll, expect, test } from "vitest";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import { buildUnemploymentModel } from "../../lib/explorer/unemployment";
import type { UnemploymentSeriesDefinition } from "../../lib/explorer/unemploymentOverview";
import { changeUnemploymentOverviewSelection, parseUnemploymentHash, serializeUnemploymentHash } from "../../lib/explorer/unemploymentState";

let facts: ClientUnemploymentObservation[];
beforeAll(async () => { facts = (await loadServedUnemploymentData()).facts; });
const parse = (hash: string) => parseUnemploymentHash(hash, facts, UNEMPLOYMENT_GROUPS, "gender");

test("gender defaults to the national rate with the existing indicators beneath Men and Women", () => {
  const state = parse("");
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  const definitions: UnemploymentSeriesDefinition[] = model.definitions;
  expect(state.selectedIds).toEqual(["georgia:unemployment_rate"]);
  expect(model.series[0].vals.at(-1)).toBeCloseTo(13.9, 1);
  expect(definitions.filter(group => !group.parentId).map(group => group.id)).toEqual(["georgia:unemployment_rate", "men:unemployment_rate", "women:unemployment_rate"]);
  for (const groupId of ["men", "women"]) {
    const children = definitions.filter(group => group.parentId === `${groupId}:unemployment_rate`);
    expect(children).toHaveLength(7);
    expect(children.map(group => group.indicatorId)).toContain("employment_rate");
    expect(model.definitions.filter(group => group.groupId === groupId)).toHaveLength(8);
  }
});

test("former gender links restore each group's indicator, years and table view", () => {
  const state = parse("indicator=employed&sel=women,georgia,men&start=2021&end=2025&view=table");
  expect(state.selectedIds).toEqual(["women:employed", "men:employed"]);
  expect(state.range).toEqual({ kind: "manual", start: 2021, end: 2025 });
  expect(state.mode).toBe("table");
  expect(parse(serializeUnemploymentHash(state))).toEqual(state);
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.percent).toBe(false);
  expect(model.series.find(series => series.id === "women:employed")?.vals.at(-1)).toBeCloseTo(619.47560792423394, 10);
  expect(model.series.find(series => series.id === "men:employed")?.vals.at(-1)).toBeCloseTo(770.17689056414815, 10);
});

test.each(["indicator=employed", "indicator=employment_rate&sel=georgia"])("former national-only gender links retain a visible reference: %s", hash => {
  const state = parse(`${hash}&view=table&start=2021&end=2025`);
  expect(state).toMatchObject({ indicator: "unemployment_rate", selectedIds: ["georgia:unemployment_rate"], mode: "table", range: { kind: "manual", start: 2021, end: 2025 } });
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.hasData).toBe(true);
  expect(model.series[0].vals.at(-1)).toBeCloseTo(13.9, 1);
});

test("gender selections compare different indicators of one unit and switch units safely", () => {
  const rates = parse("sel=women:employment_rate,men:participation_rate&start=2025&end=2025");
  const counts = changeUnemploymentOverviewSelection(rates, [...rates.selectedIds, "women:unemployed", "men:employed"], facts, UNEMPLOYMENT_GROUPS);
  expect(counts.selectedIds).toEqual(["women:unemployed", "men:employed"]);
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, counts);
  expect(model.percent).toBe(false);
  expect(model.series.find(series => series.id === "women:unemployed")?.vals[0]).toBeCloseTo(79.40887847046638, 10);
  expect(model.series.find(series => series.id === "men:employed")?.vals[0]).toBeCloseTo(770.17689056414815, 10);
  const restored = changeUnemploymentOverviewSelection(counts, [...counts.selectedIds, "women:employment_rate"], facts, UNEMPLOYMENT_GROUPS);
  expect(restored.selectedIds).toEqual(["women:employment_rate"]);
  expect(buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, restored).rows[0].valuesByYear[2025]).toBeCloseTo(0.39145729678687665, 10);
});

test("saved gender selections keep the last valid unit and an explicitly empty selection", () => {
  expect(parse("sel=women:unemployed,men:unemployment_rate")).toMatchObject({ indicator: "unemployment_rate", selectedIds: ["men:unemployment_rate"] });
  expect(parse("sel=women:unemployment_rate,men:unemployed")).toMatchObject({ indicator: "unemployed", selectedIds: ["men:unemployed"] });
  expect(parse("sel=").selectedIds).toEqual([]);
});

import { beforeAll, expect, test } from "vitest";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import { buildUnemploymentModel, buildUnemploymentComposition } from "../../lib/explorer/unemployment";
import { DEFAULT_UNEMPLOYMENT_STATE } from "../../lib/explorer/unemploymentState";

let facts: ClientUnemploymentObservation[];
beforeAll(async () => { facts = (await loadServedUnemploymentData()).facts; });
const model = (patch = {}) => buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, { ...DEFAULT_UNEMPLOYMENT_STATE, ...patch });
test("default view shows only Georgia's comparable national unemployment rate", () => {
  const view = model();
  expect([view.range.start, view.range.end]).toEqual([2010, 2025]);
  expect(view.series.map(s => s.id)).toEqual(["georgia"]);
  expect(view.headline?.publishedValue).toBe(13.9);
  expect(view.series[0].vals.at(-1)).toBeCloseTo(13.9, 1);
  expect(view.rows[0].valuesByYear[2025]).toBeCloseTo(0.139, 3);
});
test("count values stay in thousand persons instead of being divided as percentages", () => {
  const view = model({ indicator: "unemployed" });
  expect(view.headline?.publishedValue).toBe(224);
  expect(view.rows[0].valuesByYear[2025]).toBe(view.series[0].vals.at(-1));
});
test.each(["total", "women", "men"] as const)("education %s coverage does not inherit the longer reference history", sex => {
  const view = model({ breakdown: "education", educationSex: sex, selectedIds: [sex === "total" ? "georgia" : sex, "education.higher"] });
  expect([view.range.min, view.range.max]).toEqual([2020, 2025]);
  expect(view.referenceId).toBe(sex === "total" ? "georgia" : sex);
  expect(view.definitions[0].id).toBe(view.referenceId);
  expect(view.headline?.publishedValue).toBe(sex === "total" ? 13.9 : sex === "women" ? 11.4 : 15.8);
  expect(view.activeFacts.every(f => f.year >= 2020)).toBe(true);
});
test("historical age bands keep their own identity and missing years", () => {
  const view = model({ breakdown: "age", selectedIds: ["age.15_24", "age.15_19"] });
  const older = view.series.find(s => s.id === "age.15_24")!, newer = view.series.find(s => s.id === "age.15_19")!;
  expect(older.vals.slice(10)).toEqual(Array(6).fill(null));
  expect(newer.vals.slice(0, 10)).toEqual(Array(10).fill(null));
  expect(older.vals[9]).not.toBeNull(); expect(newer.vals[10]).not.toBeNull();
});
test("combined historic regions are not backfilled as their current members", () => {
  const view = model({ breakdown: "region", selectedIds: ["region.imereti", "region.imereti_racha_lechkhumi_kvemo_svaneti"] });
  expect(view.series.find(s => s.id === "region.imereti")!.vals.slice(0, 9)).toEqual(Array(9).fill(null));
  expect(view.series.find(s => s.id.endsWith("imereti_racha_lechkhumi_kvemo_svaneti"))!.vals.slice(9)).toEqual(Array(7).fill(null));
});
test("empty selection and a selected historical group with no current values remain empty", () => {
  expect(model({ selectedIds: [] }).hasData).toBe(false);
  expect(model({ selectedIds: [] }).sourceIds).toEqual([]);
  const view = model({ breakdown: "age", selectedIds: ["age.15_24"], range: { kind: "manual", start: 2020, end: 2025 } });
  expect(view.hasData).toBe(false); expect(view.endValues["age.15_24"]).toBeNull();
  expect(view.rows).toHaveLength(1);
});
test("long-term rate and share retain the two different official percentages", () => {
  expect(model({ breakdown: "long_term", indicator: "long_term_unemployment_rate" }).headline?.publishedValue).toBe(4.9);
  expect(model({ breakdown: "long_term", indicator: "long_term_unemployed_share" }).headline?.publishedValue).toBe(35.5);
});
test("colors remain stable across metrics and years and distinguish current age series", () => {
  const ids = facts.filter(f => f.dimension === "age" && f.year === 2025).map(f => f.groupId);
  const selectedIds = [...new Set(ids)];
  const first = model({ breakdown: "age", selectedIds });
  const second = model({ breakdown: "age", selectedIds, indicator: "employed", range: { kind: "manual", start: 2020, end: 2023 } });
  expect(first.series.map(s => [s.id, s.color]).sort()).toEqual(second.series.map(s => [s.id, s.color]).sort());
  expect(new Set(first.series.map(s => s.color)).size).toBe(selectedIds.length);
});
test("national stacked counts reconcile to the same survey population for every year", () => {
  const composition = buildUnemploymentComposition(facts, model().years);
  expect(composition.segments.map(s => s.id)).toEqual(["employed", "unemployed", "outside_labour_force"]);
  expect(composition.overlay).toBeNull();
  composition.periods.forEach((year, index) => {
    const sum = composition.segments.reduce((total, s) => total + s.values[index]!, 0);
    const population = facts.find(f => f.dimension === "national" && f.year === year && f.indicatorId === "population_15_plus")!;
    expect(sum).toBeCloseTo(population.value, 6);
  });
});

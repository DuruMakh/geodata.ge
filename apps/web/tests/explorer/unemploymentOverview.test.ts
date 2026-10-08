import { beforeAll, expect, test } from "vitest";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import { buildUnemploymentModel } from "../../lib/explorer/unemployment";
import { parseUnemploymentHash, serializeUnemploymentHash } from "../../lib/explorer/unemploymentState";

let facts: ClientUnemploymentObservation[];
beforeAll(async () => { facts = (await loadServedUnemploymentData()).facts; });
const parse = (hash: string) => parseUnemploymentHash(hash, facts, UNEMPLOYMENT_GROUPS, "overview");

test("overview defaults to the unemployment-rate checkbox and restores multiple indicators", () => {
  expect(parse("").selectedIds).toEqual(["georgia:unemployment_rate"]);
  const state = parse("sel=georgia:unemployment_rate,georgia:participation_rate&start=2021&end=2025&view=table");
  expect(state.selectedIds).toEqual(["georgia:unemployment_rate", "georgia:participation_rate"]);
  expect(parse(serializeUnemploymentHash(state))).toEqual(state);
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.series).toHaveLength(2);
  expect(model.percent).toBe(true);
  expect(model.rows[0].valuesByYear[2025]).toBeCloseTo(0.139, 3);
});

test.each([
  ["georgia:unemployment_rate,georgia:employed", "employed", ["georgia:employed"]],
  ["georgia:employed,georgia:unemployment_rate", "unemployment_rate", ["georgia:unemployment_rate"]],
] as const)("mixed saved selections retain only the last selected unit: %s", (selection, indicator, expected) => {
  expect(parse(`sel=${selection}`)).toMatchObject({ indicator, selectedIds: expected });
});

test("hired and self-employed children retain official counts and their employed parent", () => {
  const children = facts.filter(f => ["national", "settlement"].includes(f.dimension) && ["hired", "self_employed"].includes(f.indicatorId));
  expect(children).toHaveLength(96);
  const state = parse("sel=georgia:employed,georgia:self_employed,georgia:hired&start=2025&end=2025");
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.percent).toBe(false);
  expect(model.series).toHaveLength(3);
  expect(model.series.find(s => s.id === "georgia:hired")?.vals[0]).toBeCloseTo(961.1005993998547, 10);
  expect(model.series.find(s => s.id === "georgia:self_employed")?.vals[0]).toBeCloseTo(426.2940841069528, 10);
  expect(model.series.find(s => s.id === "georgia:employed")?.vals[0]).toBeGreaterThan(961.1005993998547 + 426.2940841069528);
});

test("urban and rural rows use their own selected indicators", () => {
  const state = parse("breakdown=settlement&sel=urban:unemployed,rural:hired&start=2025&end=2025");
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.series.map(s => s.id).sort()).toEqual(["rural:hired", "urban:unemployed"]);
  expect(model.series.find(s => s.id === "rural:hired")?.vals[0]).toBeCloseTo(318.7847892411309, 10);
  expect(model.activeFacts.every(f => f.dimension === "settlement")).toBe(true);
});

test("long-term percentages can be compared while retaining their distinct denominators", () => {
  const state = parse("breakdown=long_term&sel=georgia:long_term_unemployment_rate,women:long_term_unemployed_share&start=2025&end=2025");
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect(model.series).toHaveLength(2);
  expect(model.percent).toBe(true);
  expect(model.series[0].vals[0]).toBeCloseTo(4.9, 1);
  expect(model.activeFacts.map(f => f.indicatorId).sort()).toEqual(["long_term_unemployed_share", "long_term_unemployment_rate"]);
});

test("removed rates normalize to unemployment rate and education keeps its group selections", () => {
  expect(parse("indicator=employment_rate&sel=georgia")).toMatchObject({ indicator: "unemployment_rate", selectedIds: ["georgia:unemployment_rate"] });
  expect(parse("breakdown=education&indicator=participation_rate&sex=women&sel=education.higher")).toMatchObject({ indicator: "unemployment_rate", selectedIds: ["education.higher"], educationSex: "women" });
  expect(parse("sel=").selectedIds).toEqual([]);
  expect(parse("sel=unknown,georgia:employment_rate").selectedIds).toEqual([]);
});

import { expect, test } from "vitest";
import { roundTradeFactsToWholeDollars, type ClientTradePartnerFact } from "../../../lib/data/tradePartners/importTradePartners";

// Each case is [entity id, value]; `grouped` puts them all in one partition, otherwise each is rounded on its own.
const round = (rows: [id: string, value: number | null][], grouped = true) => {
  const facts = rows.map(([, value], index): ClientTradePartnerFact => [index, 2025, 0, value]);
  return roundTradeFactsToWholeDollars(facts, () => grouped ? "group" : null, ([entity]) => rows[entity]![0]).map(fact => fact[3]);
};

test("an exact half-dollar tie goes to the smaller entity id, whatever the row order", () => {
  expect(round([["b", 0.5], ["a", 0.5]])).toEqual([0, 1]);
  expect(round([["a", 0.5], ["b", 0.5]])).toEqual([1, 0]);
});

test("a group with negative values still adds up to its rounded sum, each value within a dollar", () => {
  const rows: [string, number][] = [["a", -1.25], ["b", -2.75], ["c", 0.4]];
  const rounded = round(rows) as number[];
  expect(rounded).toEqual([-1, -3, 0]);
  expect(rounded.reduce((sum, value) => sum + value, 0)).toBe(Math.round(-3.6));
});

test("every value in a group can be bumped", () => {
  expect(round([["a", 0.9], ["b", 0.9], ["c", 0.9]])).toEqual([1, 1, 1]);
});

test("ungrouped values round to the nearest dollar, a tiny negative becomes +0 and null stays null", () => {
  const rounded = round([["a", 2.4], ["b", 2.5], ["c", -2.5], ["d", -1e-9], ["e", null]], false);
  expect(rounded).toEqual([2, 3, -2, 0, null]);
  expect(Object.is(rounded[3], 0)).toBe(true);
});

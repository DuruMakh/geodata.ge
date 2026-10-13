import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { loadPovertyFactsFromMirror, povertyMirrorCreateRows } from "../../../lib/db/mirrorRows";
import { assertPovertyParity, loadPovertyFacts, toClientPovertyFact } from "../../../lib/data/poverty/importPoverty";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { validatePovertyFacts } from "../../../lib/data/poverty/validation";
import type { PovertyFact } from "../../../lib/data/poverty/types";

const find = (facts: readonly PovertyFact[], indicatorId: string, groupId: string, year: number) =>
  facts.find(f => f.indicatorId === indicatorId && f.groupId === groupId && f.year === year)!;
/** Sets an exact value and keeps its published rounding consistent, so only the rule under test fails. */
const setValue = (f: PovertyFact, value: string) => Object.assign(f, { value, publishedValue: new Decimal(value).toDecimalPlaces(f.unit === "index" ? 2 : 1, Decimal.ROUND_HALF_UP).toFixed(f.unit === "index" ? 2 : 1) });

test("serves all 491 reviewed values", async () => {
  const facts = await loadPovertyFacts();
  expect(facts).toHaveLength(491);
  expect(find(facts, "poverty.absolute", "georgia", 2025).publishedValue).toBe("7.1");
  expect(find(facts, "poverty.absolute", "georgia", 2004).publishedValue).toBe("34.3");
  expect(find(facts, "gini.total_income", "georgia", 2025).publishedValue).toBe("0.34");
  expect(Math.max(...facts.filter(f => f.indicatorId === "poverty.international_300").map(f => f.year))).toBe(2024);
  expect(Math.min(...facts.filter(f => f.indicatorId.startsWith("gini.")).map(f => f.year))).toBe(2006);
});

test.each([
  ["an altered published value", (facts: PovertyFact[]) => { facts[0].publishedValue = "0.99"; }, /published value/],
  ["a duplicate observation", (facts: PovertyFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: PovertyFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2025 international value", (facts: PovertyFact[]) => { facts.push({ ...find(facts, "poverty.international_300", "georgia", 2024), year: 2025 }); }, /outside the approved coverage/],
  ["a 2005 Gini value", (facts: PovertyFact[]) => { facts.push({ ...find(facts, "gini.total_income", "georgia", 2006), year: 2005 }); }, /outside the approved coverage/],
  ["a percent above 100", (facts: PovertyFact[]) => { setValue(find(facts, "poverty.absolute", "sex.male", 2010), "101"); }, /range/],
  ["a Gini above 1", (facts: PovertyFact[]) => { setValue(find(facts, "gini.cash_inflows", "georgia", 2010), "1.2"); }, /range/],
  ["Georgia outside towns and villages", (facts: PovertyFact[]) => { setValue(find(facts, "poverty.relative_60", "georgia", 2012), "40"); }, /between/],
  ["under 40% above under 60%", (facts: PovertyFact[]) => { setValue(find(facts, "poverty.relative_40", "settlement.urban", 2020), "25"); }, /40/],
  ["international lines out of order", (facts: PovertyFact[]) => { setValue(find(facts, "poverty.international_420", "georgia", 2015), "5"); }, /international/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadPovertyFacts()).map(f => ({ ...f }));
  mutate(facts);
  expect(() => validatePovertyFacts(facts)).toThrow(error);
});

test("client facts carry the published figure and its display precision", async () => {
  const facts = await loadPovertyFacts();
  expect(toClientPovertyFact(find(facts, "poverty.absolute", "georgia", 2025))).toMatchObject({ value: 7.1, decimals: 1 });
  expect(toClientPovertyFact(find(facts, "gini.total_income", "georgia", 2025))).toMatchObject({ value: 0.34, decimals: 2 });
});

test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
  const facts = await loadPovertyFacts();
  const padded = facts.map(f => ({ ...f, publishedValue: f === facts[0] ? `${f.publishedValue}0` : f.publishedValue }));
  expect(() => assertPovertyParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
  expect(() => assertPovertyParity(facts, padded)).not.toThrow();
  const changed = facts.map(f => ({ ...f }));
  changed[5].value = new Decimal(changed[5].value).plus("0.00000001").toFixed();
  expect(() => assertPovertyParity(facts, changed)).toThrow();
  expect(() => assertPovertyParity(facts, facts.slice(1))).toThrow();
});

test("the database mirror round-trips exact decimals and source relations", async () => {
  const facts = await loadPovertyFacts();
  const rows = povertyMirrorCreateRows(facts, "poverty-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const db = (list: typeof rows) => ({ povertyFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "povertyFact">;
  const mirror = await loadPovertyFactsFromMirror(db(rows));
  expect(() => assertPovertyParity(facts, mirror)).not.toThrow();
  expect(rows[0].importRunId).toBe("poverty-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
  await expect(loadPovertyFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
});

import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { loadWagesFactsFromMirror, wagesMirrorCreateRows } from "../../../lib/db/mirrorRows";
import { assertWagesParity, loadWagesFacts, toClientWagesFact } from "../../../lib/data/wages/importWages";
import { validateWagesFacts } from "../../../lib/data/wages/validation";
import type { WagesFact } from "../../../lib/data/wages/types";
import type { Prisma } from "../../../lib/generated/prisma/client";

const find = (facts: readonly WagesFact[], indicatorId: string, dimension: string, groupId: string, sectorId: string, year: number) =>
  facts.find(f => f.indicatorId === indicatorId && f.dimension === dimension && f.groupId === groupId && f.sectorId === sectorId && f.year === year)!;

test("serves all 1,917 published values and the 12 unavailable public-sector mining cells", async () => {
  const facts = await loadWagesFacts();
  expect(facts.filter(f => f.value !== null)).toHaveLength(1917);
  const unavailable = facts.filter(f => f.value === null);
  expect(unavailable).toHaveLength(12);
  expect(new Set(unavailable.map(f => `${f.dimension}:${f.groupId}:${f.sectorId}`))).toEqual(new Set(["ownership:public:sector.b"]));
  expect(find(facts, "average_monthly_nominal_earnings", "national", "georgia", "total", 2025).publishedValue).toBe("2165.2");
  expect(find(facts, "median_monthly_earnings", "national", "georgia", "total", 2025).publishedValue).toBe("1531");
  expect(Math.min(...facts.map(f => f.year))).toBe(1995);
  expect(new Set(facts.filter(f => f.indicatorId === "median_monthly_earnings").map(f => f.valueStatus))).toEqual(new Set(["administrative"]));
});

test("client facts carry the published figure and its display precision", async () => {
  const facts = await loadWagesFacts();
  expect(toClientWagesFact(find(facts, "average_monthly_nominal_earnings", "national", "georgia", "total", 2025))).toMatchObject({ value: 2165.2, decimals: 1, valueStatus: "survey_estimate" });
  expect(toClientWagesFact(find(facts, "median_monthly_earnings", "national", "georgia", "total", 2025))).toMatchObject({ value: 1531, decimals: 0 });
  expect(toClientWagesFact(find(facts, "average_monthly_nominal_earnings", "ownership", "public", "sector.b", 2025))).toMatchObject({ value: null, valueStatus: "unavailable" });
});

test.each([
  ["an altered published value", (facts: WagesFact[]) => { const f = facts.find(x => x.value !== null)!; f.publishedValue = new Decimal(f.publishedValue!).plus(1).toFixed(); }, /published value/],
  ["a missing observation", (facts: WagesFact[]) => { facts.pop(); }, /Incomplete/],
  ["a duplicate observation", (facts: WagesFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["an extra indicator", (facts: WagesFact[]) => { facts.push({ ...facts[0], indicatorId: "real_wage" as WagesFact["indicatorId"] }); }, /identity/],
  ["a NACE Rev.1.1 section", (facts: WagesFact[]) => { facts.push({ ...facts.find(x => x.sectorId === "sector.a")!, sectorId: "sector.t" as WagesFact["sectorId"] }); }, /identity/],
  ["an industry year before 2014", (facts: WagesFact[]) => { facts.push({ ...facts.find(x => x.sectorId === "sector.a")!, year: 2013 }); }, /outside the approved coverage/],
  ["a lost unavailable cell", (facts: WagesFact[]) => { const f = facts.find(x => x.value === null)!; Object.assign(f, { value: "1000", publishedValue: "1000.0", valueStatus: "survey_estimate", sourceNumberFormat: "0.0" }); }, /unavailable/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadWagesFacts()).map(f => ({ ...f }));
  mutate(facts);
  expect(() => validateWagesFacts(facts)).toThrow(error);
});

test("the database mirror round-trips exact decimals, nulls and source relations, and parity rejects a changed value", async () => {
  const facts = await loadWagesFacts();
  const rows = wagesMirrorCreateRows(facts, "wages-run-1").map(row => ({ ...row, value: row.value === null ? null : new Decimal(row.value as string), publishedValue: row.publishedValue === null ? null : new Decimal(row.publishedValue as string) }));
  const db = (list: typeof rows) => ({ wagesFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "wagesFact">;
  const mirror = await loadWagesFactsFromMirror(db(rows));
  expect(() => assertWagesParity(facts, mirror)).not.toThrow();
  expect(rows[0].importRunId).toBe("wages-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
  await expect(loadWagesFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
  const changed = mirror.map(f => ({ ...f }));
  const target = changed.find(f => f.value !== null)!;
  target.value = new Decimal(target.value!).plus("0.00000001").toFixed();
  expect(() => assertWagesParity(facts, changed)).toThrow();
});

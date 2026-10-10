import { expect, test } from "vitest";
import { validateCurrentAccountFacts } from "../../../lib/data/externalFlows/currentAccountValidation";
import type { CurrentAccountFact } from "../../../lib/data/externalFlows/types";

const base = { unit: "usd", basis: "actual", sourceId: "source.nbg_balance_of_payments_bpm6", sourceSheet: "BOP–BPM6(short)", sourceCells: "F4", sourceUnit: "million_usd", vintage: "2026-09-30", lastReviewedAt: "2026-10-10" } as const;
/** One complete year: goods −5, services 3, primary −1, secondary 2 → balance −1. */
function year(y: number): CurrentAccountFact[] {
  const parts: Record<string, [string, string]> = { "ca.goods": ["10", "15"], "ca.services": ["8", "5"], "ca.primary_income": ["2", "3"], "ca.secondary_income": ["3", "1"], "ca.balance": ["23", "24"] };
  return Object.entries(parts).flatMap(([seriesId, [credit, debit]]) => [
    { ...base, seriesId, year: y, flow: "credit", valueUsd: credit },
    { ...base, seriesId, year: y, flow: "debit", valueUsd: debit },
    { ...base, seriesId, year: y, flow: "net", valueUsd: String(Number(credit) - Number(debit)) },
  ] as CurrentAccountFact[]);
}
const all = () => Array.from({ length: 26 }, (_, i) => year(2000 + i)).flat();

test("accepts a complete, consistent current account", () => {
  expect(() => validateCurrentAccountFacts(all())).not.toThrow();
});
test.each([
  ["missing year", (f: CurrentAccountFact[]) => f.filter(x => x.year !== 2010)],
  ["extra series", (f: CurrentAccountFact[]) => [...f, { ...f[0], seriesId: "ca.capital" }]],
  ["duplicate", (f: CurrentAccountFact[]) => [...f, f[0]]],
  ["null value", (f: CurrentAccountFact[]) => f.map((x, i) => i === 0 ? { ...x, valueUsd: null as unknown as string } : x)],
  ["net not credit minus debit", (f: CurrentAccountFact[]) => f.map(x => x.seriesId === "ca.goods" && x.flow === "net" && x.year === 2005 ? { ...x, valueUsd: "-3" } : x)],
  ["parts not adding to the balance", (f: CurrentAccountFact[]) => f.map(x => x.seriesId === "ca.balance" && x.flow === "credit" && x.year === 2005 ? { ...x, valueUsd: "30" } : x).map(x => x.seriesId === "ca.balance" && x.flow === "net" && x.year === 2005 ? { ...x, valueUsd: "6" } : x)],
  ["wrong source", (f: CurrentAccountFact[]) => f.map((x, i) => i === 0 ? { ...x, sourceId: "source.other" } : x)],
] as const)("rejects a %s", (_name, mutate) => {
  expect(() => validateCurrentAccountFacts(mutate(all()))).toThrow(/current account/i);
});

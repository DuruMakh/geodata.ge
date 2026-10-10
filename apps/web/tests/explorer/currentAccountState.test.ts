import { expect, test } from "vitest";
import { DEFAULT_CURRENT_ACCOUNT_STATE, parseCurrentAccountHash, serializeCurrentAccountHash, type CurrentAccountState } from "../../lib/explorer/currentAccountState";
import type { ClientCurrentAccountFact } from "../../lib/data/externalFlows/importCurrentAccount";

const facts: ClientCurrentAccountFact[] = [2000, 2010, 2025].map(year => ({ seriesId: "ca.balance", year, flow: "net", valueUsd: -1 }));

test("an empty hash opens the Balance tab in USD with the current account selected", () => {
  expect(parseCurrentAccountHash("", facts)).toEqual(DEFAULT_CURRENT_ACCOUNT_STATE);
  expect(DEFAULT_CURRENT_ACCOUNT_STATE).toEqual({ tab: "balance", unit: "usd", mode: "line", range: { kind: "all" }, selectedIds: ["ca.balance"] });
});

test("a saved view round-trips", () => {
  const state: CurrentAccountState = { tab: "out", unit: "gdp", mode: "table", range: { kind: "manual", start: 2010, end: 2025 }, selectedIds: ["ca.goods", "ca.services"] };
  expect(parseCurrentAccountHash(`#${serializeCurrentAccountHash(state)}`, facts)).toEqual(state);
});

test("unknown tabs, units and series fall back without throwing; an explicit empty selection stays empty", () => {
  expect(parseCurrentAccountHash("#tab=capital&unit=eur&view=pie&sel=ca.capital,ca.goods", facts)).toEqual({ ...DEFAULT_CURRENT_ACCOUNT_STATE, selectedIds: ["ca.goods"] });
  expect(parseCurrentAccountHash("#tab=in&sel=", facts).selectedIds).toEqual([]);
});

import { expect, test } from "vitest";
import { toClientTradePartnersData, loadTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { tradePartnerEntities, tradePartnerFacts, tradePartnerNationalFacts } from "../data/tradePartners/fixtures";
const data = toClientTradePartnersData({ entities: tradePartnerEntities(), facts: tradePartnerFacts() }, tradePartnerNationalFacts());
const stateModule = () => import("../../lib/explorer/tradePartnersState");

test("default is total trade, all partner years and only the removable national reference", async () => {
  const { parseTradePartnersHash, DEFAULT_TRADE_PARTNERS_STATE, tradePartnersCoverage } = await stateModule();
  expect(parseTradePartnersHash("", data)).toEqual(DEFAULT_TRADE_PARTNERS_STATE);
  expect(DEFAULT_TRADE_PARTNERS_STATE).toMatchObject({ measure: "trade.turnover", tab: "countries", mode: "line", selectedIds: ["goods.total"] });
  expect(tradePartnersCoverage({ ...data, nationalFacts: [...data.nationalFacts, { ...data.nationalFacts[0], year: 1995 }] })).toEqual({ min: 2024, max: 2025, years: [2024, 2025] });
});
test("mixed and empty selections survive URL reloads, table view and tab switching", async () => {
  const { parseTradePartnersHash: parse, serializeTradePartnersHash: serialize, setTradePartnersTab } = await stateModule();
  const saved = parse("#sel=partner.1995-2025.643,group.eu&tab=groups&measure=trade.exports&view=table&start=2025&end=2025", data);
  expect(parse(serialize(saved), data)).toEqual(saved);
  expect(setTradePartnersTab(saved, "countries").selectedIds).toEqual(saved.selectedIds);
  const empty = parse("#sel=&tab=groups&measure=trade.balance", data);
  expect(parse(serialize(empty), data)).toEqual(empty); expect(empty.selectedIds).toEqual([]);
  expect(parse("#sel=unknown,group.eu,group.eu&measure=unknown&tab=unknown", data)).toMatchObject({ selectedIds: ["group.eu"], measure: "trade.turnover", tab: "countries" });
});
test("ranges clamp to loaded coverage and invalid bounds remain safe", async () => {
  const { parseTradePartnersHash: parse } = await stateModule();
  expect(parse("#start=2025&end=2024", data).range).toEqual({ kind: "all" });
  expect(parse("#start=2000&end=2024", data).range).toEqual({ kind: "manual", start: 2024, end: 2024 });
  expect(parse("#start=2000&end=2001", data).range).toEqual({ kind: "all" });
  expect(parse("#start=oops&end=2025", data).range).toEqual({ kind: "all" });
});
test("bulk selection covers both catalogues and puts the national reference first", async () => {
  const { tradePartnersBulkSelection } = await stateModule();
  expect(tradePartnersBulkSelection(data)).toEqual(["goods.total", ...data.entities.map(e => e.id)]);
  const accepted = await loadTradePartnersData();
  expect(tradePartnersBulkSelection(toClientTradePartnersData(accepted, []))).toHaveLength(218);
});

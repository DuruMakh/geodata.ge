import { expect, test } from "vitest";
import { parseTradePartnersHash, serializeTradePartnersHash, tradePartnersBulkSelection } from "../../lib/explorer/tradePartnersState";
import { compositionFixture } from "./tradeCompositionFixtures";

test.each(["sitc", "bec"] as const)("%s normalizes foreign IDs/unsupported measures but keeps sel=", classification => {
  const data = compositionFixture(classification);
  expect(parseTradePartnersHash("", data)).toEqual({ mode: "line", measure: "trade.exports", tab: "categories", range: { kind: "all" }, selectedIds: ["goods.total"] });
  expect(parseTradePartnersHash("#sel=&measure=trade.balance", data).selectedIds).toEqual([]);
  expect(parseTradePartnersHash(`#sel=trade.${classification === "sitc" ? "bec" : "sitc"}1.1`, data).selectedIds).toEqual([]);
  expect(parseTradePartnersHash("#measure=trade.balance&tab=groups", data)).toMatchObject({ measure: "trade.exports", tab: "categories" });
  for (const measure of ["trade.exports", "trade.imports"] as const) {
    const state = parseTradePartnersHash(`#measure=${measure}&view=table&start=2025&end=2025&sel=${tradePartnersBulkSelection(data).join(",")}`, data);
    const hash = serializeTradePartnersHash(state, data);
    expect(hash).toContain(`section=${classification}`);
    expect(parseTradePartnersHash(hash, data)).toEqual(state);
  }
  expect(parseTradePartnersHash("#start=1900&end=2099", data).range).toEqual({ kind: "all" });
});

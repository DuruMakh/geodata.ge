import { expect, test } from "vitest";
import type { Presentation } from "../../lib/i18n/types";
import { tradeFixtureFacts } from "../data/tradeOverview/fixtures";
import { TRADE_OVERVIEW_INDICATORS } from "../../lib/data/tradeOverview/types";
import { buildTradeOverviewModel } from "../../lib/explorer/tradeOverview";
import { DEFAULT_TRADE_OVERVIEW_STATE } from "../../lib/explorer/tradeOverviewState";
const facts = tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) * 1_000_000 }));
const presentation: Presentation = { locale: "en", messages: { "trade.unit.million": "million USD", "trade.unit.billion": "billion USD" }, englishLabels: {} };
test("all 16 checkbox combinations share units, summary amounts and signed balance context", () => {
  const base = buildTradeOverviewModel(facts, DEFAULT_TRADE_OVERVIEW_STATE, presentation);
  for (let mask = 0; mask < 16; mask++) {
    const ids = TRADE_OVERVIEW_INDICATORS.filter((_, i) => mask & (1 << i));
    const model = buildTradeOverviewModel(facts, { ...DEFAULT_TRADE_OVERVIEW_STATE, selectedIds: [...ids].reverse() }, presentation);
    expect(model.selectedIds).toEqual(ids);
    expect(model.unit).toEqual(base.unit);
    expect(model.endValues).toEqual(base.endValues);
    expect(model.balanceValues).toEqual([-70_000_000, -100_250_000]);
  }
  expect(base.endValues["trade.turnover"]).toBe(300_750_000);
  expect(base.unit.label).toBe("million USD");
});
test("an absent active end-year value stays missing rather than borrowing an earlier year", () => {
  const model = buildTradeOverviewModel(facts.filter(f => f.indicatorId !== "trade.exports" || f.year !== 2025), DEFAULT_TRADE_OVERVIEW_STATE, presentation);
  expect(model.endValues["trade.exports"]).toBeNull();
  expect(model.valuesByIndicator["trade.exports"][2025]).toBeNull();
});
test("the active end year controls all context values independently of selection", () => {
  const model = buildTradeOverviewModel(facts, { mode: "table", range: { kind: "manual", start: 2024, end: 2024 }, selectedIds: [] }, presentation);
  expect(model.years).toEqual([2024]);
  expect(model.endValues["trade.turnover"]).toBe(230_000_000);
  expect(model.balanceValues).toEqual([-70_000_000]);
});

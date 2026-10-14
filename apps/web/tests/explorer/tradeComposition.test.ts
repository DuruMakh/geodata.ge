import { expect, test } from "vitest";
import { buildTradePartnersModel, tradePartnerColor } from "../../lib/explorer/tradePartners";
import { parseTradePartnersHash, tradePartnersBulkSelection } from "../../lib/explorer/tradePartnersState";
import { INK } from "../../lib/explorer/colors";
import { compositionFixture, compositionPresentation } from "./tradeCompositionFixtures";

test.each(["sitc", "bec"] as const)("%s uses national end-year shares and independent complete ranking", async classification => {
  const data = compositionFixture(classification), p = await compositionPresentation("en", data);
  for (const measure of ["trade.exports", "trade.imports"] as const) {
    const state = parseTradePartnersHash(`#sel=&measure=${measure}`, data), model = buildTradePartnersModel(data, state, p);
    expect(model.ranking).toHaveLength(classification === "sitc" ? 10 : 7);
    expect(model.ranking[0]).toMatchObject({ valueUsd: measure === "trade.exports" ? 25 : 250, shareOfNational: 0.25 });
    expect(buildTradePartnersModel(data, { ...state, range: { kind: "manual", start: 2024, end: 2024 } }, p).ranking[0].shareOfNational).toBe(0.125);
    expect(model.offTabSelected).toEqual([]);
    expect(model.totalCount).toBe(classification === "sitc" ? 11 : 8);
    const noDenominator = { ...data, nationalFacts: data.nationalFacts.map(f => ({ ...f, valueUsd: 0 })) };
    expect(buildTradePartnersModel(noDenominator, state, p).ranking.every(row => row.shareOfNational === null)).toBe(true);
    expect(buildTradePartnersModel({ ...data, nationalFacts: data.nationalFacts.filter(f => f.year !== 2025) }, state, p).ranking.every(row => row.shareOfNational === null)).toBe(true);
  }
});
test.each(["sitc", "bec"] as const)("%s keeps null, zero, negative and tiny source values distinct", async classification => {
  const data = compositionFixture(classification), p = await compositionPresentation("en", data);
  data.facts = data.facts.map(([entity, year, measure]) => [entity, year, measure, [25, 0, -2, null, 0.000001][entity] ?? (entity === 3 ? null : 2)]);
  for (const measure of ["trade.exports", "trade.imports"] as const) {
    const model = buildTradePartnersModel(data, parseTradePartnersHash(`#measure=${measure}`, data), p);
    expect(model.ranking.find(r => r.entityId === data.entities[1].id)?.valueUsd).toBe(0);
    expect(model.ranking.at(-1)?.valueUsd).toBe(-2);
    expect(model.missingRanking[0].valueUsd).toBeNull();
    expect(model.ranking.find(r => r.entityId === data.entities[4].id)?.valueUsd).toBe(0.000001);
    expect(model.ranking.map(r => r.entityId)).toEqual(classification === "sitc"
      ? ["trade.sitc1.0", "trade.sitc1.5", "trade.sitc1.6", "trade.sitc1.7", "trade.sitc1.8", "trade.sitc1.9", "trade.sitc1.4", "trade.sitc1.1", "trade.sitc1.2"]
      : ["trade.bec1.1", "trade.bec1.6", "trade.bec1.7", "trade.bec1.5", "trade.bec1.2", "trade.bec1.3"]);
  }
});
test.each(["sitc", "bec"] as const)("%s keeps colors and scale independent of selected lines", async classification => {
  const data = compositionFixture(classification), p = await compositionPresentation("en", data);
  data.facts = data.facts.map(([entity, year, measure, value]) => [entity, year, measure, entity === 0 && year === 2024 ? 2e9 : value]);
  expect(new Set(data.entities.map(e => tradePartnerColor(e.id))).size).toBe(data.entities.length);
  expect(data.entities.slice(0, 2).map(e => tradePartnerColor(e.id))).toEqual(["#B3402A", "#1F6E56"]);
  expect(tradePartnerColor("goods.total")).toBe(INK);
  for (const measure of ["trade.exports", "trade.imports"] as const) {
    const state = parseTradePartnersHash(`#measure=${measure}`, data);
    expect(buildTradePartnersModel(data, { ...state, selectedIds: tradePartnersBulkSelection(data) }, p).unit).toEqual(buildTradePartnersModel(data, state, p).unit);
    expect(buildTradePartnersModel(data, { ...state, selectedIds: [data.entities[1].id] }, p).unit.divisor).toBe(1_000_000_000);
    expect(buildTradePartnersModel(data, { ...state, range: { kind: "manual", start: 2025, end: 2025 } }, p).unit.divisor).toBe(1_000_000);
  }
});

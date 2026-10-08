import { expect, test } from "vitest";
import type { Presentation } from "../../lib/i18n/types";
import { formatInUnit } from "../../lib/explorer/format";
import { toClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { tradePartnerEntities, tradePartnerFacts, tradePartnerNationalFacts } from "../data/tradePartners/fixtures";
const data = toClientTradePartnersData({ entities: tradePartnerEntities(), facts: tradePartnerFacts() }, tradePartnerNationalFacts());
const presentation: Presentation = { locale: "en", messages: { "trade.unit.million": "million USD", "trade.unit.billion": "billion USD" }, englishLabels: { "partner.1995-2025.643": "Russia", "partner.1995-2025.530": "Netherlands Antilles", "group.eu": "European Union (EU)", "group.oecd": "OECD" } };
const modules = async () => ({ ...await import("../../lib/explorer/tradePartnersState"), ...await import("../../lib/explorer/tradePartners") });

test("shared selection keeps off-tab choices, values, colors and one global count", async () => {
  const { buildTradePartnersModel: build, DEFAULT_TRADE_PARTNERS_STATE: initial, tradePartnerColor } = await modules();
  const state = { ...initial, selectedIds: ["group.eu", "goods.total", "partner.1995-2025.643"] };
  const countries = build(data, state, presentation), groups = build(data, { ...state, tab: "groups" }, presentation);
  expect(countries.selectedIds).toEqual(["goods.total", "partner.1995-2025.643", "group.eu"]);
  expect(countries.offTabSelected.map(e => e.id)).toEqual(["group.eu"]);
  expect(groups.offTabSelected.map(e => e.id)).toEqual(["partner.1995-2025.643"]);
  expect(countries.valuesByEntity).toEqual(groups.valuesByEntity);
  expect(countries.selectedCount).toBe(3); expect(countries.totalCount).toBe(5);
  expect(tradePartnerColor("group.eu")).toBe(groups.ranking.find(r => r.entityId === "group.eu")?.color);
});
test("ranking uses matching national totals and ignores the selected-line collection", async () => {
  const { buildTradePartnersModel: build, DEFAULT_TRADE_PARTNERS_STATE: initial } = await modules();
  const groups = build(data, { ...initial, tab: "groups", selectedIds: [] }, presentation);
  expect(groups.ranking.find(r => r.entityId === "group.eu")).toMatchObject({ valueUsd: 600, shareOfNational: 0.2, rank: 2 });
  const exports = build(data, { ...initial, tab: "groups", measure: "trade.exports", selectedIds: ["group.eu", "group.oecd"] }, presentation);
  expect(exports.ranking.find(r => r.entityId === "group.eu")?.shareOfNational).toBe(0.4);
  expect(exports.ranking.find(r => r.entityId === "group.oecd")?.shareOfNational).toBe(0.8);
  const balance = build(data, { ...initial, tab: "groups", measure: "trade.balance" }, presentation);
  expect(balance.ranking.map(r => [r.entityId, r.valueUsd, r.shareOfNational])).toEqual([["group.oecd", 700, null], ["group.eu", 200, null]]);
});
test("missing amounts are unranked, true zero is ranked and negative balance ranks by magnitude", async () => {
  const { buildTradePartnersModel: build, DEFAULT_TRADE_PARTNERS_STATE: initial } = await modules();
  const missing = build(data, { ...initial, measure: "trade.balance" }, presentation);
  expect(missing.ranking[0]).toMatchObject({ valueUsd: -150, shareOfNational: null, rank: 1 });
  expect(missing.missingRanking[0]).toMatchObject({ entityId: "partner.1995-2025.530", valueUsd: null, rank: null });
  expect(missing.valuesByEntity["partner.1995-2025.530"][2025]).toBeNull();
  const zeroData = { ...data, facts: data.facts.map(f => f.entityId.endsWith(".530") ? { ...f, valueUsd: 0 } : f) };
  expect(build(zeroData, { ...initial, measure: "trade.imports" }, presentation).ranking.find(r => r.entityId.endsWith(".530"))).toMatchObject({ valueUsd: 0, rank: 2, shareOfNational: 0 });
});
test("an absent same-year national denominator never borrows a previous year", async () => {
  const { buildTradePartnersModel: build, DEFAULT_TRADE_PARTNERS_STATE: initial } = await modules();
  const noTotal = { ...data, nationalFacts: data.nationalFacts.filter(f => f.year !== 2025) };
  expect(build(noTotal, initial, presentation).ranking[0].shareOfNational).toBeNull();
  const earlier = build(data, { ...initial, tab: "groups", range: { kind: "manual", start: 2024, end: 2024 } }, presentation);
  expect(earlier.ranking.find(r => r.entityId === "group.eu")).toMatchObject({ valueUsd: 480, shareOfNational: 0.2 });
});
test("balance orders deficits and surpluses by magnitude and resolves ties by label", async () => {
  const { buildTradePartnersModel: build, DEFAULT_TRADE_PARTNERS_STATE: initial } = await modules();
  const signed = { ...data, facts: data.facts.map(f => f.entityId === "group.eu" && f.indicatorId === "trade.balance" ? { ...f, valueUsd: -800 } : f) };
  expect(build(signed, { ...initial, tab: "groups", measure: "trade.balance" }, presentation).ranking.map(r => r.valueUsd)).toEqual([-800, 700]);
  const ties = { ...data, facts: data.facts.map(f => ({ ...f, valueUsd: 0 })) };
  expect(build(ties, { ...initial, tab: "groups" }, presentation).ranking.map(r => r.entityId)).toEqual(["group.eu", "group.oecd"]);
});
test("tiny signed amounts in a billion unit remain visibly nonzero", async () => {
  const { buildTradePartnersModel: build, DEFAULT_TRADE_PARTNERS_STATE: initial } = await modules();
  const tiny = { ...data, facts: data.facts.map(f => f.indicatorId === "trade.balance" ? { ...f, valueUsd: f.entityId === "group.eu" ? 1 : -1 } : f), nationalFacts: data.nationalFacts.map(f => ({ ...f, valueUsd: f.indicatorId === "trade.balance" ? -2e9 : f.valueUsd })) };
  const model = build(tiny, { ...initial, measure: "trade.balance" }, presentation);
  expect(formatInUnit(1, model.unit)).toBe("<0.01");
  expect(formatInUnit(-1, model.unit)).toBe(">−0.01");
});

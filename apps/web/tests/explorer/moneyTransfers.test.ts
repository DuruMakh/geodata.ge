import { expect, test } from "vitest";
import type { Presentation } from "../../lib/i18n/types";
import { toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { moneyTransferEntities, moneyTransferFacts } from "../data/externalFlows/fixtures";
const data = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() });
const presentation: Presentation = { locale: "en", messages: { "external.unit.million": "million USD", "external.unit.billion": "billion USD" }, englishLabels: { "transfer.total": "Money transfers, all countries", "bop.personal_transfers": "Personal transfers (official estimate)", "transfer.italy": "Italy", "transfer.sudan": "Sudan", "transfer.other_countries": "Other Countries" } };
const modules = async () => ({ ...await import("../../lib/explorer/moneyTransfersState"), ...await import("../../lib/explorer/moneyTransfers") });

test("the official estimate follows the measure: credit for received, debit for sent", async () => {
  const { buildMoneyTransfersModel: build, DEFAULT_MONEY_TRANSFERS_STATE: initial } = await modules();
  expect(build(data, initial, presentation).valuesByEntity["bop.personal_transfers"][2019]).toBe(900);
  expect(build(data, { ...initial, measure: "sent" }, presentation).valuesByEntity["bop.personal_transfers"][2019]).toBeNull();
  expect(build(data, { ...initial, measure: "sent" }, presentation).valuesByEntity["transfer.total"][2019]).toBe(100);
});

test("unlisted years stay missing, partial months are marked and blanks never become zero", async () => {
  const { buildMoneyTransfersModel: build, DEFAULT_MONEY_TRANSFERS_STATE: initial } = await modules();
  const model = build(data, initial, presentation);
  expect(model.years).toEqual(Array.from({ length: 13 }, (_, i) => 2007 + i));
  expect(model.valuesByEntity["transfer.italy"][2007]).toBeNull();
  expect(model.valuesByEntity["transfer.other_countries"][2019]).toBeNull();
  expect(model.partialMonths["transfer.sudan"]).toEqual({ 2019: 11 });
  expect(build(data, { ...initial, measure: "sent" }, presentation).valuesByEntity["transfer.sudan"][2019]).toBeNull();
});

test("tabs split Georgia series from countries, keeping off-tab choices and remainders last", async () => {
  const { buildMoneyTransfersModel: build, DEFAULT_MONEY_TRANSFERS_STATE: initial } = await modules();
  const state = { ...initial, selectedIds: ["transfer.italy", "transfer.total"] };
  const georgia = build(data, state, presentation), countries = build(data, { ...state, tab: "countries" as const }, presentation);
  expect(georgia.activeEntities.map(e => e.id)).toEqual(["transfer.total", "bop.personal_transfers"]);
  expect(georgia.offTabSelected.map(e => e.id)).toEqual(["transfer.italy"]);
  expect(countries.activeEntities.map(e => e.id)).toEqual(["transfer.italy", "transfer.sudan", "transfer.other_countries"]);
  expect(countries.selectedCount).toBe(2); expect(countries.totalCount).toBe(5);
});

test("the ranking divides by that year's all-country total and leaves remainders unranked", async () => {
  const { buildMoneyTransfersModel: build, DEFAULT_MONEY_TRANSFERS_STATE: initial } = await modules();
  const model = build(data, { ...initial, selectedIds: [] }, presentation);
  expect(model.ranking.map(r => [r.entityId, r.valueUsd, r.share, r.rank, r.monthsReported])).toEqual([["transfer.italy", 600, 0.6, 1, null], ["transfer.sudan", 400, 0.4, 2, 11]]);
  expect(model.remainders.map(r => r.entityId)).toEqual([]);
  const sent = build(data, { ...initial, measure: "sent" }, presentation);
  expect(sent.ranking.map(r => r.entityId)).toEqual(["transfer.italy"]);
  expect(sent.missingRanking.map(r => r.entityId)).toEqual(["transfer.other_countries", "transfer.sudan"]);
  const early = build(data, { ...initial, range: { kind: "manual" as const, start: 2007, end: 2007 } }, presentation);
  expect(early.remainders.map(r => [r.entityId, r.valueUsd, r.share])).toEqual([["transfer.other_countries", 50, null]]);
});

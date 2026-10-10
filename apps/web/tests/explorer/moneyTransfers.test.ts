import { expect, test } from "vitest";
import type { Presentation } from "../../lib/i18n/types";
import { toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { moneyTransferEntities, moneyTransferFacts } from "../data/externalFlows/fixtures";
const data = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() });
const presentation: Presentation = { locale: "en", messages: { "external.unit.million": "million USD", "external.unit.billion": "billion USD", "external.money.otherCountries": "Other countries" }, englishLabels: { "transfer.total": "Money transfers, all countries", "bop.personal_transfers": "Personal transfers (official estimate)", "transfer.italy": "Italy", "transfer.sudan": "Sudan", "transfer.other_countries": "Other Countries" } };
const modules = async () => ({ ...await import("../../lib/explorer/moneyTransfersState"), ...await import("../../lib/explorer/moneyTransfers") });

test("the page serves money transfers only, following the measure", async () => {
  const { buildMoneyTransfersModel: build, DEFAULT_MONEY_TRANSFERS_STATE: initial } = await modules();
  expect(data.entities.map(e => e.id)).not.toContain("bop.personal_transfers");
  expect(data.facts.some(f => f.entityId === "bop.personal_transfers")).toBe(false);
  expect(build(data, initial, presentation).valuesByEntity["transfer.total"][2019]).toBe(1000);
  expect(build(data, { ...initial, measure: "sent" }, presentation).valuesByEntity["transfer.total"][2019]).toBe(100);
});

test("unlisted years stay missing, partial months are marked and blanks never become zero", async () => {
  const { buildMoneyTransfersModel: build, DEFAULT_MONEY_TRANSFERS_STATE: initial } = await modules();
  const model = build(data, initial, presentation);
  expect(model.years).toEqual(Array.from({ length: 13 }, (_, i) => 2007 + i));
  expect(model.valuesByEntity["transfer.italy"][2007]).toBeNull();
  expect(model.valuesByEntity["transfer.others"][2007]).toBeNull();
  expect(model.partialMonths["transfer.sudan"]).toEqual({ 2019: 11 });
  expect(build(data, { ...initial, measure: "sent" }, presentation).series.map(e => e.id)).not.toContain("transfer.sudan");
});

test("the list is the total, the end year's countries by size, then Other countries", async () => {
  const { buildMoneyTransfersModel: build, DEFAULT_MONEY_TRANSFERS_STATE: initial } = await modules();
  const model = build(data, { ...initial, selectedIds: ["transfer.italy", "transfer.total"] }, presentation);
  expect(model.series.map(e => [e.id, e.label])).toEqual([["transfer.total", "Money transfers, all countries"], ["transfer.italy", "Italy"], ["transfer.sudan", "Sudan"], ["transfer.others", "Other countries"]]);
  expect(model.selectedCount).toBe(2); expect(model.totalCount).toBe(4);
});

test("only the top 10 countries are listed; Other countries carries the rest, so the list adds up to the total", async () => {
  const { buildMoneyTransfersModel: build, DEFAULT_MONEY_TRANSFERS_STATE: initial } = await modules();
  const countries = Array.from({ length: 12 }, (_, i) => ({ id: `transfer.c${i}`, kind: "country" as const, labelKa: `c${i}` }));
  const fact = (entityId: string, year: number, valueUsd: number | null, valueStatus: "numeric" | "partial_months" = "numeric") => ({ entityId, year, measure: "received" as const, valueUsd, valueStatus, monthsReported: valueStatus === "partial_months" ? 9 : 12, sourceId: "s", vintage: "v" });
  const wide = {
    entities: [{ id: "transfer.total", kind: "total" as const, labelKa: "ჯამი" }, ...countries, { id: "transfer.other_territories", kind: "remainder" as const, labelKa: "სხვა ტერიტორიები" }],
    facts: [fact("transfer.total", 2024, 1000), fact("transfer.total", 2025, 1200), fact("transfer.other_territories", 2025, 5),
      ...countries.flatMap((c, i) => [fact(c.id, 2024, 10 * (i + 1)), fact(c.id, 2025, 100 - 5 * i, i === 11 ? "partial_months" : "numeric")])],
  };
  const model = build(wide, { ...initial, selectedIds: ["transfer.others", "transfer.c11"] }, { ...presentation, locale: "ka" });
  expect(model.series.map(e => e.id)).toEqual(["transfer.total", ...countries.slice(0, 10).map(c => c.id), "transfer.others"]);
  expect(model.selectedIds).toEqual(["transfer.others"]);
  expect(model.ranking).toHaveLength(10);
  const top2025 = countries.slice(0, 10).reduce((sum, _, i) => sum + 100 - 5 * i, 0), top2024 = countries.slice(0, 10).reduce((sum, _, i) => sum + 10 * (i + 1), 0);
  expect(model.valuesByEntity["transfer.others"]).toEqual({ 2024: 1000 - top2024, 2025: 1200 - top2025 });
  expect(model.other).toMatchObject({ valueUsd: 1200 - top2025, rank: null, share: (1200 - top2025) / 1200 });
  expect(model.partialMonths["transfer.others"]).toEqual({ 2025: 9 });
});

test("the ranking divides by that year's all-country total", async () => {
  const { buildMoneyTransfersModel: build, DEFAULT_MONEY_TRANSFERS_STATE: initial } = await modules();
  const model = build(data, { ...initial, selectedIds: [] }, presentation);
  expect(model.ranking.map(r => [r.entityId, r.valueUsd, r.share, r.rank, r.monthsReported])).toEqual([["transfer.italy", 600, 0.6, 1, null], ["transfer.sudan", 400, 0.4, 2, 11]]);
  expect(model.other).toMatchObject({ entityId: "transfer.others", valueUsd: 0, share: 0 });
  const sent = build(data, { ...initial, measure: "sent" }, presentation);
  expect(sent.ranking.map(r => r.entityId)).toEqual(["transfer.italy"]);
  expect(sent.other?.valueUsd).toBe(40);
});

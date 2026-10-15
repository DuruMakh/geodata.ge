import { expect, test } from "vitest";
import { loadTradeServicesData, toClientTradeServicesData } from "../../lib/data/tradeServices/importTradeServices";
import { buildTradePartnersModel, tradePartnerColor } from "../../lib/explorer/tradePartners";
import { parseTradePartnersHash, serializeTradePartnersHash, tradePartnersBulkSelection, tradePartnersTotalId } from "../../lib/explorer/tradePartnersState";
import { parseTradeOverviewHash, serializeTradeOverviewHash } from "../../lib/explorer/tradeOverviewState";
import { buildTradeOverviewModel } from "../../lib/explorer/tradeOverview";
import { getMessages } from "../../lib/i18n/messages.server";
import { INK } from "../../lib/explorer/colors";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { TRADE_CHART_INDICATORS } from "../../lib/data/tradeOverview/types";

async function fixture() {
  const raw = await loadTradeServicesData(), data = toClientTradeServicesData(raw);
  return { raw, data, presentation: { locale: "en" as const, englishLabels: data.englishLabels, messages: await getMessages("en", ["trade", "format"]) } };
}
test("services adapter preserves the national identity, twenty numeric points and missing type exports", async () => {
  const { raw, data } = await fixture();
  expect(data.national).toHaveLength(20);
  expect(data.national.every(f => Number.isFinite(f.valueUsd))).toBe(true);
  expect(data.types.dataset).toBe("services");
  expect(data.types.entities).toHaveLength(12);
  expect(data.types.entities.every(e => e.kind === "service_type")).toBe(true);
  // Source and review metadata stay on the server (platform review U21-15); the raw facts below keep it.
  expect(data.national.every(f => Object.keys(f).sort().join() === "indicatorId,valueUsd,year")).toBe(true);
  expect(raw.facts.filter(f => f.indicatorId === "trade.turnover" || f.indicatorId === "trade.balance").every(f => f.sourceId === null)).toBe(true);
  expect(raw.facts.filter(f => f.indicatorId === "trade.exports" || f.indicatorId === "trade.imports").every(f => f.sourceId?.startsWith("geostat_services_"))).toBe(true);
  expect(tradePartnersTotalId(data.types)).toBe("services.total");
  expect(tradePartnersTotalId({})).toBe("goods.total");
  expect(tradePartnerColor("services.total")).toBe(INK);
  expect(new Set(data.types.entities.map(e => tradePartnerColor(e.id))).size).toBe(12);
  const repairIndex = data.types.entities.findIndex(e => e.id === "services.maintenance_repair");
  expect(data.types.facts.find(([entityIndex, year, measureIndex]) => entityIndex === repairIndex && year === 2020 && TRADE_CHART_INDICATORS[measureIndex] === "trade.exports")?.[3]).toBeNull();
});
test("services defaults, complete bulk scope and explicit empty selections survive saved links", async () => {
  const { data } = await fixture(), initial = parseTradePartnersHash("", data.types);
  expect(initial).toEqual({ mode: "line", measure: "trade.turnover", tab: "types", range: { kind: "all" }, selectedIds: ["services.total"] });
  expect(tradePartnersBulkSelection(data.types)).toHaveLength(13);
  const searchResults = data.types.entities.filter(e => matchesLabelQuery("Travel", [e.labelKa, data.englishLabels[e.id]]));
  expect(searchResults.map(e => e.id)).toEqual(["services.travel"]);
  expect(tradePartnersBulkSelection(data.types)).toEqual(["services.total", ...data.types.entities.map(e => e.id)]);
  for (const selectedIds of [[], ["services.total"], tradePartnersBulkSelection(data.types)]) {
    const state = { ...initial, selectedIds, mode: "table" as const, measure: "trade.balance" as const, range: { kind: "manual" as const, start: 2020, end: 2022 } };
    const hash = serializeTradePartnersHash(state, data.types);
    expect(new URLSearchParams(hash).get("section")).toBe("types");
    expect(parseTradePartnersHash(hash, data.types)).toEqual(state);
  }
  expect(parseTradePartnersHash("#tab=countries&sel=goods.total,partner.1995-2025.643&start=1995&end=2026", data.types).selectedIds).toEqual([]);
  expect(parseTradePartnersHash("#tab=groups", data.types).tab).toBe("types");
  const outOfRange = parseTradePartnersHash("#start=1995&end=2026", data.types);
  expect(outOfRange.range).toEqual({ kind: "all" });
  expect(parseTradePartnersHash("#measure=trade.domestic_exports", data.types).measure).toBe("trade.turnover");
  const overview = parseTradeOverviewHash("#sel=&view=table&start=2021&end=2023", data.national);
  expect(parseTradeOverviewHash(serializeTradeOverviewHash(overview), data.national)).toEqual(overview);
  expect(parseTradeOverviewHash("", data.national).selectedIds).toEqual(["trade.turnover"]);
  for (const mode of ["line", "table"] as const) for (const measure of ["trade.turnover", "trade.exports", "trade.imports", "trade.balance"] as const) {
    const saved = { ...initial, mode, measure, selectedIds: ["services.travel"], range: { kind: "manual" as const, start: 2021, end: 2023 } };
    const hash = serializeTradePartnersHash(saved, data.types);
    // The language switch carries this same fragment; parsing never depends on translated labels.
    expect(parseTradePartnersHash(`#${hash}`, data.types)).toEqual(saved);
  }
});
test("all twelve types rank independently, shares use the same-year services total, scales ignore selection", async () => {
  const { data, presentation } = await fixture(), state = parseTradePartnersHash("", data.types);
  const model = buildTradePartnersModel(data.types, state, presentation);
  expect(model.ranking).toHaveLength(12);
  expect(model.totalCount).toBe(13);
  for (const row of model.ranking) expect(row.shareOfNational).toBe(row.valueUsd! / model.valuesByEntity["services.total"][2024]!);
  expect(buildTradePartnersModel(data.types, { ...state, selectedIds: [] }, presentation).unit).toEqual(model.unit);
  const overview = parseTradeOverviewHash("", data.national);
  expect(buildTradeOverviewModel(data.national, { ...overview, selectedIds: [] }, presentation).unit).toEqual(buildTradeOverviewModel(data.national, overview, presentation).unit);
  const empty = buildTradeOverviewModel(data.national, { ...overview, selectedIds: [] }, presentation), full = buildTradeOverviewModel(data.national, overview, presentation);
  expect(empty.endValues).toEqual(full.endValues);
  expect(empty.balanceValues).toEqual(full.balanceValues);
  const zero = { ...data.types, nationalFacts: data.national.map(f => ({ ...f, valueUsd: 0 })) };
  expect(buildTradePartnersModel(zero, state, presentation).ranking.every(row => row.shareOfNational === null)).toBe(true);
});

test("country comparisons keep saved selections, national shares and real missing values", async () => {
  const { data, presentation } = await fixture(), initial = parseTradePartnersHash("", data.countries);
  expect(initial.tab).toBe("countries");
  expect(initial.selectedIds).toEqual(["services.total"]);
  expect(tradePartnersBulkSelection(data.countries)).toHaveLength(154);
  for (const selectedIds of [[], ["partner.2020-2024.826"], tradePartnersBulkSelection(data.countries)]) {
    const state = { ...initial, selectedIds, mode: "table" as const, measure: "trade.imports" as const, range: { kind: "manual" as const, start: 2022, end: 2024 } };
    const hash = serializeTradePartnersHash(state, data.countries);
    expect(new URLSearchParams(hash).get("section")).toBe("countries");
    expect(parseTradePartnersHash(hash, data.countries)).toEqual(state);
  }
  const imports = buildTradePartnersModel(data.countries, { ...initial, measure: "trade.imports", selectedIds: [] }, presentation);
  expect(imports.valuesByEntity["partner.2020-2024.826"][2024]).toBeCloseTo(96175488.549999951, 6);
  expect(imports.activeEntities).toHaveLength(153);
  expect(imports.ranking.length + imports.missingRanking.length).toBe(149);
  expect(imports.ranking.every(row => row.kind === "country")).toBe(true);
  for (const row of imports.ranking) expect(row.shareOfNational).toBe(row.valueUsd! / imports.valuesByEntity["services.total"][2024]!);
  for (const measure of ["trade.imports", "trade.turnover", "trade.balance"] as const) {
    const model = buildTradePartnersModel(data.countries, { ...initial, measure, range: { kind: "manual", start: 2020, end: 2020 } }, presentation);
    expect(model.valuesByEntity["partner.2020-2024.496"][2020]).toBeNull();
  }
  const balance = buildTradePartnersModel(data.countries, { ...initial, measure: "trade.balance" }, presentation);
  expect(balance.valuesByEntity["partner.2020-2024.174"][2024]).toBeNull();
  expect(balance.ranking.every(row => row.shareOfNational === null)).toBe(true);
});
test("negative balances rank by magnitude without shares and missing derivations stay gaps", async () => {
  const { data, presentation } = await fixture();
  const balance = buildTradePartnersModel(data.types, parseTradePartnersHash("#measure=trade.balance", data.types), presentation);
  expect(balance.ranking.some(r => r.valueUsd! < 0)).toBe(true);
  expect(balance.ranking.every(r => r.shareOfNational === null)).toBe(true);
  expect(balance.ranking.map(r => Math.abs(r.valueUsd!))).toEqual(balance.ranking.map(r => Math.abs(r.valueUsd!)).sort((a, b) => b - a));
  for (const measure of ["trade.exports", "trade.imports", "trade.turnover", "trade.balance"] as const) {
    const model = buildTradePartnersModel(data.types, parseTradePartnersHash(`#measure=${measure}&start=2020&end=2020&sel=services.maintenance_repair`, data.types), presentation);
    const value = model.valuesByEntity["services.maintenance_repair"][2020];
    if (measure === "trade.imports") expect(value).toBeTypeOf("number");
    else { expect(value).toBeNull(); expect(model.missingRanking.map(r => r.entityId)).toContain("services.maintenance_repair"); }
  }
});

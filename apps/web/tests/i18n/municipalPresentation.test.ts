import { beforeAll, describe, expect, it } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import {
  aggregateFactsForEntity, applyAdjaraBudgetAdjustment, buildCountryKpis, buildCountryListRow,
  buildEntityKpis, buildIndexKpis, buildMovers, buildComparisonRows, buildMunicipalEntityModel,
  buildMunicipalListRows, buildCountryTotalByYear, regionFactsFor,
} from "../../lib/explorer/municipalData";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";

let data: Awaited<ReturnType<typeof loadServedMunicipalData>>;
let ka: Presentation;
let en: Presentation;
beforeAll(async () => {
  data = await loadServedMunicipalData();
  const ids = ["country.georgia", "municipal.total", ...data.municipalities.flatMap(entity => [entity.code, `${entity.code}.official-name`]), ...data.regions.map(region => region.id), ...data.functions.map(fn => fn.id)];
  [ka, en] = await Promise.all([getPresentation("ka", ["municipal"], ids), getPresentation("en", ["municipal"], ids)]);
});

function factsFor(id: string) {
  if (id === "country.georgia") return { functionFacts: data.countryFunctionFacts, totalFacts: data.countryTotalFacts };
  if (!id.startsWith("region.")) return { functionFacts: data.functionFacts.filter(fact => fact.municipalityCode === id), totalFacts: data.totalFacts.filter(fact => fact.municipalityCode === id) };
  const members = regionFactsFor(id, data.municipalities, data.functionFacts, data.totalFacts);
  const aggregate = aggregateFactsForEntity(id, members.functionFacts, members.totalFacts);
  return id === "region.adjara" ? { ...aggregate, totalFacts: applyAdjaraBudgetAdjustment(aggregate.totalFacts, data.adjaraBudgetAdjustments) } : aggregate;
}

describe("municipal English presentation", () => {
  it.each(["11", "region.imereti", "region.adjara", "country.georgia"])("keeps %s amounts, shares, ordering and growth unchanged", id => {
    const input = { functions: data.functions, ...factsFor(id), startYear: 2020, endYear: 2025 };
    const original = buildMunicipalEntityModel(input, ka);
    const english = buildMunicipalEntityModel(input, en);
    expect(english).toEqual(original);
    expect(english.rows.every(row => row.enLabel.trim().length > 0)).toBe(true);
    const kpis = id === "country.georgia" ? buildCountryKpis(english, 69, en) : buildEntityKpis({ model: english, nationalTotalByYear: buildCountryTotalByYear(data.countryTotalFacts), rankByYear: { 2025: 1 }, rankOutOf: 64 }, en);
    expect(Object.values(kpis).flatMap(kpi => [kpi.label, kpi.value, kpi.unit ?? "", kpi.detail]).join(" ")).not.toMatch(/\p{Script=Georgian}/u);
    const moversKa = buildMovers(original, ka), moversEn = buildMovers(english, en);
    expect(moversEn.up.map(row => [row.rank, row.growth, row.color])).toEqual(moversKa.up.map(row => [row.rank, row.growth, row.color]));
    expect(moversEn.down.map(row => [row.rank, row.growth, row.color])).toEqual(moversKa.down.map(row => [row.rank, row.growth, row.color]));
    expect(buildComparisonRows(english, en).map(row => [row.isTotal, row.fromGel, row.toGel, row.changeShare, row.changeGel, row.color])).toEqual(buildComparisonRows(original, ka).map(row => [row.isTotal, row.fromGel, row.toGel, row.changeShare, row.changeGel, row.color]));
  });
  it("keeps the 64-place ranking and per-resident values, with no country per-resident figure", () => {
    const input = { ...data, regionLabels: new Map(data.regions.map(region => [region.id, region.kaLabel])), year: 2025 };
    // Both page languages consume this same list/ranking calculation. Names and
    // subtitles are resolved by the localized index and picker components.
    const list = buildMunicipalListRows(input);
    expect(list.municipalities).toHaveLength(64);
    expect(list.regions).toHaveLength(11);
    expect(list.municipalities.some(row => ["05", "42", "43", "46", "64"].includes(row.id))).toBe(false);
    expect(list.municipalities.every(row => row.budgetPerResidentGel !== null && row.budgetPerResidentGel > 0)).toBe(true);
    expect(buildCountryListRow(data.countryTotalFacts, 2025).budgetPerResidentGel).toBeNull();
    const kpis = buildIndexKpis({ ...data, firstYear: 2015, comparisonYear: 2025, latestYear: 2025 }, en);
    expect(kpis.flatMap(kpi => [kpi.label, kpi.value, kpi.detail]).join(" ")).not.toMatch(/\p{Script=Georgian}/u);
  });
});

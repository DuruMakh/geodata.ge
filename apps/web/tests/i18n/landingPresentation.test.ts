import { beforeAll, describe, expect, it } from "vitest";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../../lib/data/servedData";
import { buildLandingModel } from "../../lib/landing/landingData";
import { buildHubCards } from "../../lib/explorer/hubCards";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";
import { GEORGIA_GEO } from "../../lib/landing/georgiaGeo";

let input: Parameters<typeof buildLandingModel>[0];
let ka: Presentation, en: Presentation;
beforeAll(async () => {
  const [landing, municipal, debt, balance] = await Promise.all([loadServedLandingData(), loadServedMunicipalData(), loadServedGovernmentDebtData(), loadServedGeneralGovernmentBalanceData()]);
  input = { ...landing, municipalities: municipal.municipalities, municipalTotalFacts: municipal.totalFacts, municipalCountryTotalFacts: municipal.countryTotalFacts, debtFacts: debt.facts, balanceFacts: balance.facts };
  const ids = [...landing.glossary.keys(), ...municipal.municipalities.map(entity => entity.code), "debt.stock.domestic", "debt.stock.external"];
  [ka, en] = await Promise.all([getPresentation("ka", ["common", "landing", "hub"], ids), getPresentation("en", ["common", "landing", "hub"], ids)]);
});

describe("public content presentation", () => {
  it("provides English display names for every hero city", () => {
    expect(GEORGIA_GEO.cityMarkers).toHaveLength(21);
    expect(GEORGIA_GEO.cityMarkers.every(city => city.en.trim().length > 0 && !/\p{Script=Georgian}/u.test(city.en))).toBe(true);
  });
  it("keeps homepage totals, shares, actual years, ordering and coverage unchanged", () => {
    const original = buildLandingModel(input, ka);
    const english = buildLandingModel(input, en);
    const withoutLabels = (value: unknown) => JSON.parse(JSON.stringify(value, (key, item) => key === "label" ? undefined : item));
    expect(withoutLabels(english)).toEqual(withoutLabels(original));
    expect(original).toEqual(buildLandingModel(input));
    for (const scope of ["expenditure", "revenue", "municipalities"] as const) {
      for (const row of english[scope].rows) expect(row.label).toBe(en.englishLabels[row.id]);
    }
    expect(english.debt.latestYear).toBe(Math.max(...input.debtFacts.filter(fact => fact.family === "stock" && fact.status === "actual").map(fact => fact.year)));
    expect(english.deficit.latestActualYear).toBe(Math.max(...input.balanceFacts.filter(fact => fact.status === "actual").map(fact => fact.year)));
  });
  it("keeps hub destinations, sparkline values, coverage and ordering unchanged", () => {
    const totals = new Map(input.municipalCountryTotalFacts.map(fact => [fact.year, fact.publicTotalGel]));
    const original = buildHubCards(input.facts, totals, input.debtFacts, input.balanceFacts, ka);
    const english = buildHubCards(input.facts, totals, input.debtFacts, input.balanceFacts, en);
    const data = (cards: typeof original) => cards.map(card => ({ ...card, title: undefined, description: undefined, footer: card.footer?.match(/[−+]?\d[\d,.]*%?/g) }));
    expect(data(english)).toEqual(data(original));
    expect(original).toEqual(buildHubCards(input.facts, totals, input.debtFacts, input.balanceFacts));
    expect(english.flatMap(card => [card.title, card.description, card.footer ?? ""]).join(" ")).not.toMatch(/\p{Script=Georgian}/u);
    expect(english.find(card => card.href === "/explorer/municipalities")?.description).toContain("69");
  });
});

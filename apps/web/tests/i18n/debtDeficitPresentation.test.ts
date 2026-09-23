import { beforeAll, describe, expect, it } from "vitest";
import { loadServedExplorerData, loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData } from "../../lib/data/servedData";
import { buildDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { buildDeficitExplorerModel, DEFICIT_SERIES_ID } from "../../lib/explorer/deficitExplorer";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { message } from "../../lib/i18n/messages";
import type { Presentation } from "../../lib/i18n/types";

let debt: Awaited<ReturnType<typeof loadServedGovernmentDebtData>>;
let deficit: Awaited<ReturnType<typeof loadServedGeneralGovernmentBalanceData>>;
let gdp: Awaited<ReturnType<typeof loadServedExplorerData>>;
let ka: Presentation, en: Presentation;
beforeAll(async () => {
  [debt, deficit, gdp] = await Promise.all([loadServedGovernmentDebtData(), loadServedGeneralGovernmentBalanceData(), loadServedExplorerData()]);
  const ids = [...new Set(debt.facts.map(fact => fact.seriesId)), DEFICIT_SERIES_ID];
  [ka, en] = await Promise.all([getPresentation("ka", ["debt", "deficit"], ids), getPresentation("en", ["debt", "deficit"], ids)]);
});

function withoutEnglishLabels(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, item) => key === "enLabel" ? undefined : item));
}

describe("debt and deficit English presentation", () => {
  it.each(["stock", "service", "rate"] as const)("preserves every %s value, status, gap and selection", family => {
    for (const shareOfGdp of [false, true]) {
      const selectedIds = [...new Set(debt.facts.filter(fact => fact.family === family).map(fact => fact.seriesId))];
      const input = { facts: debt.facts, gdpFacts: gdp.gdpFacts, family, selectedIds, range: { start: 2013, end: 2030 }, shareOfGdp };
      const original = buildDebtExplorerModel(input);
      const english = buildDebtExplorerModel(input, en);
      expect(english).toEqual(buildDebtExplorerModel(input, ka));
      expect(withoutEnglishLabels(english)).toEqual(withoutEnglishLabels(original));
      expect(english.items.every(item => item.enLabel === en.englishLabels[item.id])).toBe(true);
      if (family === "service") {
        expect(english.forecastStartYear).toBe(2026);
        expect(english.points.some(point => point.status === "actual")).toBe(true);
        expect(english.points.some(point => point.status === "projection_existing_portfolio")).toBe(true);
      }
      if (family === "rate") expect(english.points.some(point => point.status === "not_available" && point.value === null)).toBe(true);
    }
  });
  it("preserves signed deficit values and the actual/projection boundary in both measures", () => {
    for (const percentage of [false, true]) {
      const input = { facts: deficit.facts, range: { start: 1995, end: 2031 }, percentage, selected: true };
      const english = buildDeficitExplorerModel(input, en);
      expect(english).toEqual(buildDeficitExplorerModel(input, ka));
      expect(english.tableRow.enLabel).toBe(en.englishLabels[DEFICIT_SERIES_ID]);
      expect(english.points.some(point => point.value < 0)).toBe(true);
      expect(english.forecastStartYear).toBe(2026);
      expect(english.points.filter(point => point.status === "projection").map(point => point.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
    }
  });
  it("explains portfolio forecasts, unavailable rates and the government boundary in English", () => {
    expect(message(en.messages, "debt.portfolioForecast")).toContain("portfolio outstanding on 31 December 2025");
    expect(message(en.messages, "debt.missingRates")).toContain("have not been replaced with zero");
    expect(message(en.messages, "deficit.definition")).toContain("general government balance");
    expect(Object.values(en.messages).join(" ")).not.toMatch(/\p{Script=Georgian}/u);
  });
});

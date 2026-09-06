import { beforeAll, describe, expect, it } from "vitest";
import { loadServedExplorerData } from "../../lib/data/servedData";
import { projectAdminFact, projectBudgetFact } from "../../lib/explorer/clientData";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";

let data: Awaited<ReturnType<typeof loadServedExplorerData>>;
let ka: Presentation;
let en: Presentation;
beforeAll(async () => {
  data = await loadServedExplorerData();
  const ids = [...data.glossary.keys(), ...data.adminCategories.map(category => category.id), "snapshot.other"];
  [ka, en] = await Promise.all(["ka", "en"].map(locale => getPresentation(locale as "ka" | "en", ["analysis"], ids)));
});

describe("single-year analysis language parity", () => {
  it.each([ ["expenditure", "fields"], ["expenditure", "ministries"], ["revenue", "fields"] ] as const)("preserves every served year's %s / %s geometry, ranking and numerical headlines", (side, grouping) => {
    const facts = data.facts.map(projectBudgetFact);
    const adminFacts = data.adminFacts.filter(fact => fact.level === "admin_category").map(projectAdminFact);
    const years = [...new Set((grouping === "ministries" ? adminFacts : facts.filter(fact => fact.side === side)).map(fact => fact.year))];
    for (const year of years) {
      const input = { facts, adminFacts, adminCategories: new Map(data.adminCategories.map(category => [category.id, category])), glossary: data.glossary, side, grouping, year };
      const original = buildSingleYearSnapshotModel(input, ka);
      const english = buildSingleYearSnapshotModel(input, en);
      expect(english.items).toEqual(original.items);
      expect(english.every100).toEqual(original.every100);
      expect(english.radarItems).toEqual(original.radarItems);
      expect(english.rankingRows).toEqual(original.rankingRows);
      expect([english.totalGel, english.previousYear, english.basis, english.hasPlannedValues, english.hasGrowthData]).toEqual([original.totalGel, original.previousYear, original.basis, original.hasPlannedValues, original.hasGrowthData]);
      expect(english.headlineCards.map(card => [card.id, card.value, card.negative])).toEqual(original.headlineCards.map(card => [card.id, card.value, card.negative]));
      expect(english.every100.reduce((sum, item) => sum + item.gelFrom100, 0)).toBe(100);
      expect(english.headlineCards.map(card => [card.label, card.detail, card.unit]).flat().join(" ")).not.toMatch(/\p{Script=Georgian}/u);
      expect(english.items.map(item => item.enLabel).join(" ")).not.toMatch(/\p{Script=Georgian}/u);
    }
  });
  it("explains an unavailable year in English without inventing observations", () => {
    const model = buildSingleYearSnapshotModel({ facts: [], glossary: data.glossary, side: "revenue", year: 2050 }, en);
    expect(model.items).toEqual([]);
    expect(model.emptyReason).toBe("Budget receipts data for this year has not been loaded yet.");
  });
});

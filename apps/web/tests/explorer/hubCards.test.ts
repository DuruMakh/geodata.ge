import { describe, expect, it } from "vitest";
import { buildHubCards } from "../../lib/explorer/hubCards";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";

function fact(side: "expenditure" | "revenue", itemId: string, year: number, amountGel: number): BudgetFactImportRow {
  return {
    year,
    side,
    itemId,
    amountGel,
    basis: "actual",
    sourceId: "test-source",
    officialInstitution: null,
    officialProgram: null,
    officialSubprogram: null,
    publicSpendingFieldId: null,
    mappingConfidence: null,
    mappingNotes: "",
  };
}

const FACTS = [
  fact("expenditure", "spending.health", 2024, 1_000_000_000),
  fact("expenditure", "spending.health", 2025, 2_000_000_000),
  fact("revenue", "revenue.vat", 2024, 3_000_000_000),
  fact("revenue", "revenue.vat", 2025, 4_000_000_000),
];

describe("buildHubCards", () => {
  it("orders expenditure, revenue, municipalities, analysis", () => {
    const cards = buildHubCards(FACTS);

    expect(cards.map((card) => card.title)).toEqual(["ხარჯები", "შემოსავლები", "მუნიციპალიტეტები", "ანალიზი"]);
    expect(cards.map((card) => card.index)).toEqual(["01", "02", "03", "04"]);
  });

  it("derives each live card's footer from the latest year", () => {
    const cards = buildHubCards(FACTS);

    expect(cards[0].footer).toContain("2025");
    expect(cards[0].footer).toContain("2.00");
    expect(cards[1].footer).toContain("4.00");
  });

  it("gives live cards a real series to draw", () => {
    const cards = buildHubCards(FACTS);

    expect(cards[0].series).toEqual([1_000_000_000, 2_000_000_000]);
    expect(cards[1].series).toEqual([3_000_000_000, 4_000_000_000]);
  });

  it("ships municipalities as a coming-soon card with nothing invented", () => {
    const card = buildHubCards(FACTS)[2];

    expect(card.comingSoon).toBe(true);
    expect(card.href).toBeNull();
    expect(card.footer).toBeNull();
    expect(card.series).toBeNull();
  });

  it("points the analysis card at the route it actually opens", () => {
    const card = buildHubCards(FACTS)[3];

    expect(card.href).toBe("/explorer/analysis");
    expect(card.comingSoon).toBe(false);
    expect(card.footer).toContain("2025");
    expect(card.footer).toContain("კატეგორია");
  });
});

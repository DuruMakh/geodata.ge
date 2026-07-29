import { describe, expect, it } from "vitest";
import { buildHubCards } from "../../lib/explorer/hubCards";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";

function fact(
  side: "expenditure" | "revenue",
  itemId: string,
  year: number,
  amountGel: number,
  basis: "actual" | "planned" = "actual",
): BudgetFactImportRow {
  return {
    year,
    side,
    itemId,
    amountGel,
    basis,
    sourceId: "test-source",
    officialInstitution: null,
    officialProgram: null,
    officialSubprogram: null,
    publicSpendingFieldId: null,
    mappingConfidence: null,
    mappingNotes: "",
  };
}

// The served CSV carries neither shape today, so without these two 2025 rows the
// hub's data-integrity guards are silently deletable. They sit on the latest
// year because that is the one the headline figure and the category count read:
// a derived total (isDerivedTotalItemId matches the exact ids expenditure.total,
// revenue.total and the admin total) and a planned value ahead of its actual.
const FACTS = [
  fact("expenditure", "spending.health", 2024, 1_000_000_000),
  fact("expenditure", "spending.health", 2025, 5_000_000_000, "planned"),
  fact("expenditure", "spending.health", 2025, 2_000_000_000),
  fact("expenditure", "expenditure.total", 2025, 9_000_000_000),
  fact("revenue", "revenue.vat", 2024, 3_000_000_000),
  fact("revenue", "revenue.vat", 2025, 9_000_000_000, "planned"),
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
    // 2025 expenditure carries an explicit total row, so the card reads it
    // rather than the 2bn category sum — see the parity test below.
    expect(cards[0].footer).toContain("9.00");
    expect(cards[1].footer).toContain("4.00");
  });

  it("gives live cards a real series to draw", () => {
    const cards = buildHubCards(FACTS);

    expect(cards[0].series).toEqual([1_000_000_000, 9_000_000_000]);
    expect(cards[1].series).toEqual([3_000_000_000, 4_000_000_000]);
  });

  it("emits a null for a year with no facts instead of dropping it", () => {
    const cards = buildHubCards([
      fact("expenditure", "spending.health", 2020, 1_000_000_000),
      fact("expenditure", "spending.health", 2022, 3_000_000_000),
    ]);

    // Dropping 2021 would re-space the two surviving points evenly and stop the
    // sparkline's x axis being time; the gap has to reach it as a null.
    expect(cards[0].series).toEqual([1_000_000_000, null, 3_000_000_000]);
  });

  it("lets an explicit total row win its year, the way the section pages do", () => {
    const cards = buildHubCards(FACTS);

    // singleYear.ts and explorerData.ts both prefer an explicit `<side>.total`
    // over the category sum, so the hub has to agree or the same year reads
    // differently on the card and on the page behind it. 2.00 would be the bare
    // category sum; 11.00 would be the sum with the total double-counted in.
    expect(cards[0].footer).toBe("2025 · 9.00 მლრდ ₾");
    // The total row is still not a category.
    expect(cards[3].footer).toContain("1 კატეგორია");
  });

  it("lets an actual value beat a planned value for the same year and item", () => {
    const cards = buildHubCards(FACTS);

    // 2025 VAT is planned 9bn then actual 4bn. Keeping the planned row, or
    // summing both, would put an unreviewed figure on the hub's revenue card.
    expect(cards[1].series?.at(-1)).toBe(4_000_000_000);
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

import React from "react";
import { describe, expect, test } from "vitest";
import { MainExplorer } from "../../components/main-explorer/main-explorer";
import type { ClientBudgetFact } from "../../lib/explorer/clientData";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale } from "../../lib/i18n/types";
import { renderPageMarkup } from "../helpers/render-localized";

const fact = (year: number, itemId: string, amountGel: number, basis: "actual" | "planned"): ClientBudgetFact =>
  ({ year, side: "expenditure", itemId, amountGel, basis });

// 2025 actual and 2026 planned, as the state budget law and the 2025 execution report give them (thousand GEL x 1000).
const WITH_PLAN = [
  fact(2024, "spending.education", 2_000_000_000, "actual"),
  fact(2025, "spending.education", 27_723_319_000, "actual"),
  fact(2026, "spending.education", 30_881_358_000, "planned"),
];
const ALL_ACTUAL = WITH_PLAN.filter((row) => row.year !== 2026);

async function deckOf(locale: Locale, facts: ClientBudgetFact[]): Promise<string> {
  const messages = await getMessages(locale, ["format", "main"]);
  const html = renderPageMarkup(locale, (
    <MainExplorer
      presentation={{ locale, englishLabels: { "expenditure.total": "Total expenditure", "spending.education": "Education" }, messages }}
      nav="expenditure"
      facts={facts}
      glossaryEntries={[]}
      lastUpdatedAt=""
    />
  ));
  return html.match(/<p data-testid="budget-deck"[^>]*>([\s\S]*?)<\/p>/)![1]!.replace(/<[^>]+>/g, "|");
}

describe("the Spending headline when its latest year is a plan", () => {
  test("names the year a plan and compares it with the actual year before", async () => {
    expect(await deckOf("en", WITH_PLAN)).toBe("|2026 plan: Total||30.9 bn GEL||+11.4%|");
    expect(await deckOf("ka", WITH_PLAN)).toContain("2026 გეგმა: სულ");
    expect(await deckOf("ka", WITH_PLAN)).toContain("30.9");
    expect(await deckOf("ka", WITH_PLAN)).toContain("+11.4%");
    expect(await deckOf("ka", WITH_PLAN)).not.toContain("წინა წელთან");
  });

  test("is unchanged when the latest year is actual", async () => {
    expect(await deckOf("en", ALL_ACTUAL)).toMatch(/^\|2025: Total\|/);
    expect(await deckOf("en", ALL_ACTUAL)).not.toContain("plan");
    expect(await deckOf("ka", ALL_ACTUAL)).toMatch(/^\|2025: სულ\|/);
  });
});

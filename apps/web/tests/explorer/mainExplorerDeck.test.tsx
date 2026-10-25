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

async function pageOf(locale: Locale, facts: ClientBudgetFact[]): Promise<string> {
  const messages = await getMessages(locale, ["format", "main"]);
  return renderPageMarkup(locale, (
    <MainExplorer
      presentation={{ locale, englishLabels: { "expenditure.total": "Total expenditure", "spending.education": "Education", "spending.health": "Health" }, messages }}
      nav="expenditure"
      facts={facts}
      glossaryEntries={[]}
      lastUpdatedAt=""
    />
  ));
}

async function deckOf(locale: Locale, facts: ClientBudgetFact[]): Promise<string> {
  return (await pageOf(locale, facts)).match(/<p data-testid="budget-deck"[^>]*>([\s\S]*?)<\/p>/)![1]!.replace(/<[^>]+>/g, "|");
}

async function sourceNoteOf(locale: Locale, facts: ClientBudgetFact[]): Promise<string> {
  return (await pageOf(locale, facts)).match(/<p[^>]*data-testid="source-label"[^>]*>([\s\S]*?)<\/p>/)![1]!.replace(/<[^>]+>/g, "");
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

describe("the Spending source note when its latest year is a plan", () => {
  test("names the plan year apart from the actual execution", async () => {
    expect(await sourceNoteOf("en", WITH_PLAN)).toContain("2024–2026 · Actual execution for the full 12 months; 2026: the approved budget plan.");
    expect(await sourceNoteOf("ka", WITH_PLAN)).toContain("· 12-თვიანი ფაქტობრივი შესრულება; 2026 — დამტკიცებული ბიუჯეტის გეგმა.");
    expect(await sourceNoteOf("en", ALL_ACTUAL)).toContain("2024–2025 · Actual execution for the full 12 months.");
  });

  test("marks a latest year that mixes actual and planned rows, and not one whose actual replaced the plan", async () => {
    const mixed = [...WITH_PLAN, fact(2026, "spending.health", 1_000_000_000, "actual")];
    expect(await deckOf("en", mixed)).toMatch(/^\|2026 plan: Total\|/);
    expect(await sourceNoteOf("en", mixed)).toContain("2026: the approved budget plan.");
    const replaced = [...WITH_PLAN, fact(2026, "spending.education", 30_000_000_000, "actual")];
    expect(await deckOf("en", replaced)).toMatch(/^\|2026: Total\|/);
    expect(await sourceNoteOf("en", replaced)).not.toContain("plan");
  });
});

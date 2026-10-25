import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ replace() {} }) }));

import { ExplorerCard } from "../../components/explorer-groups/explorer-card";
import { buildSearchPages } from "../../lib/explorer/allDataIndex";
import { isPlannedYear } from "../../lib/explorer/explorerData";
import { groupHeadlines } from "../../lib/explorer/groupHeadlines";
import { buildHubCards, type HubCardModel } from "../../lib/explorer/hubCards";
import { loadServedLandingData } from "../../lib/data/servedData";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import { getCommonMessages } from "../../lib/i18n/common.server";
import { getGroupsMessages } from "../../lib/i18n/groups.server";
import { getMessages } from "../../lib/i18n/messages.server";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Locale } from "../../lib/i18n/types";
import { renderGroupPage } from "../../lib/pages/group";
import { loadTopicHubs } from "../../lib/pages/topicHubs.server";
import type { ServedGeneralGovernmentBalanceFact, ServedGovernmentDebtFact } from "../../lib/servedRows";

// Review finding C1 (2026-10-24, owner: show the 2026 plan, marked): a planned latest Spending year reaches the Budget group page,
// its headline, the Expenditure lead card, the Analysis card and All data as the plan the Spending page's line names, never as a
// bare year beside the actual Receipts, Debt and Deficit. Pages outside the plan's scope keep their actual year.

const fact = (side: "expenditure" | "revenue", itemId: string, year: number, amountGel: number, basis: "actual" | "planned" = "actual"): BudgetFactImportRow => ({
  year, side, itemId, amountGel, basis, sourceId: "test-source", officialInstitution: null, officialProgram: null, officialSubprogram: null,
  publicSpendingFieldId: null, mappingConfidence: null, mappingNotes: "",
});

const ACTUAL = [
  fact("expenditure", "spending.health", 2024, 9_000_000_000),
  fact("expenditure", "spending.health", 2025, 10_000_000_000),
  fact("revenue", "revenue.vat", 2024, 8_000_000_000),
  fact("revenue", "revenue.vat", 2025, 9_000_000_000),
];
const WITH_PLAN = [...ACTUAL, fact("expenditure", "spending.health", 2026, 11_000_000_000, "planned")];
const MUNICIPAL = new Map([[2024, 2_000_000_000], [2025, 2_100_000_000]]);
const TYPES = new Map([[2024, 30_000_000_000], [2025, 32_000_000_000]]);
const REFUNDS = new Map([[2024, 2_000_000_000], [2025, 2_700_000_000]]);
const DEBT: ServedGovernmentDebtFact[] = [2024, 2025].map((year) => ({
  year, family: "stock", seriesId: "debt.stock.total", value: 35_000_000_000, valueKind: "amount_gel", status: "actual", sourceId: "debt-source", snapshotDate: null, lastReviewedAt: "2026-09-01",
}));
const BALANCE: ServedGeneralGovernmentBalanceFact[] = [2024, 2025].map((year) => ({
  year, generalGovernmentBalancePctGdp: -1.5, generalGovernmentBalanceGel: -1_500_000_000, status: "actual", sourceId: "source.imf", lastReviewedAt: "2026-09-04",
}));

const PLAN = { ka: "2026 გეგმა", en: "2026 plan" } as const;
/** The cards whose pages the plan does not cover: Spending by type, Receipts, Tax breaks and refunds, Municipalities, Debt, Deficit. */
const OUT_OF_SCOPE = ["/explorer/expenditure-types", "/explorer/revenue", "/explorer/tax-breaks-refunds", "/explorer/municipalities", "/explorer/debt", "/explorer/deficit"];

const byHref = (cards: HubCardModel[], href: string) => cards.find((card) => card.href === href)!;

describe.each(["ka", "en"] as const)("a planned latest Spending year on the Budget cards (%s)", (locale: Locale) => {
  let planned: HubCardModel[];
  let actual: HubCardModel[];
  beforeAll(async () => {
    const presentation = await getPresentation(locale, ["common", "main", "hub"], []);
    planned = buildHubCards(WITH_PLAN, MUNICIPAL, DEBT, BALANCE, presentation, TYPES, REFUNDS, true);
    actual = buildHubCards(ACTUAL, MUNICIPAL, DEBT, BALANCE, presentation, TYPES, REFUNDS, true);
  });

  it("gives the Expenditure figure the plan as its period, and marks it planned", () => {
    expect(byHref(planned, "/explorer/expenditure").latest).toMatchObject({ period: PLAN[locale], planned: true });
    expect(byHref(planned, "/explorer/expenditure").latest?.value).toMatch(/^11\.0 /);
  });

  it("names the plan on the Analysis card, which has no single figure", () => {
    const analysis = byHref(planned, "/explorer/analysis");
    expect(analysis.latest).toBeUndefined();
    expect(analysis.plan).toBe(PLAN[locale]);
    expect(analysis.years).toBe("2024–2026");
  });

  it("keeps the actual year on every card outside the plan's scope", () => {
    for (const href of OUT_OF_SCOPE) {
      expect(byHref(planned, href).latest?.planned, href).toBeUndefined();
      expect(byHref(planned, href).latest?.period, href).toBe("2025");
    }
  });

  it("marks nothing when the latest year is actual", () => {
    expect(byHref(actual, "/explorer/expenditure").latest).toEqual({ value: expect.any(String), period: "2025" });
    expect(byHref(actual, "/explorer/analysis").plan).toBeUndefined();
  });

  it("carries the plan into the group headline, and only into Expenditure's", () => {
    const messages = { ...getCommonMessages(locale), ...getGroupsMessages(locale) };
    const headlines = groupHeadlines("budget", planned, messages);
    expect(headlines.map(({ href, period, planned: isPlanned }) => [href, period, isPlanned])).toEqual([
      ["/explorer/revenue", "2025", false],
      ["/explorer/expenditure", PLAN[locale], true],
      ["/explorer/debt", "2025", false],
      ["/explorer/deficit", "2025", false],
    ]);
  });

  it("draws the lead card's planned last point hollow and states the plan beside the figure", () => {
    const lead = renderToStaticMarkup(<ExplorerCard card={byHref(planned, "/explorer/expenditure")} locale={locale} lead="lead2" regionCount={11} />);
    expect(lead).toContain('data-testid="sparkline-hollow-end"');
    expect(lead).toContain(`>${PLAN[locale]}</span>`);
    const small = renderToStaticMarkup(<ExplorerCard card={byHref(planned, "/explorer/expenditure")} locale={locale} regionCount={11} />);
    expect(small).toContain('data-testid="sparkline-hollow-end"');
    const unplanned = renderToStaticMarkup(<ExplorerCard card={byHref(actual, "/explorer/expenditure")} locale={locale} lead="lead2" regionCount={11} />);
    expect(unplanned).not.toContain("sparkline-hollow-end");
    for (const href of OUT_OF_SCOPE) {
      expect(renderToStaticMarkup(<ExplorerCard card={byHref(planned, href)} locale={locale} regionCount={11} />), href).not.toContain("sparkline-hollow-end");
    }
  });

  it("names the plan in the Analysis card's footer", () => {
    const analysis = renderToStaticMarkup(<ExplorerCard card={byHref(planned, "/explorer/analysis")} locale={locale} regionCount={11} />);
    expect(analysis).toContain(`>2024–2026 · ${PLAN[locale]}</span>`);
  });
});

describe.each(["ka", "en"] as const)("the Budget group page and All data over the served data (%s)", (locale: Locale) => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
  afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

  let year: number;
  let isPlan: boolean;
  beforeAll(async () => {
    const { facts } = await loadServedLandingData();
    year = Math.max(...facts.filter((candidate) => candidate.side === "expenditure").map((candidate) => candidate.year));
    isPlan = isPlannedYear(facts, "expenditure", year);
  });

  it("serves the 2026 plan as the latest Spending year today", () => {
    // The 2026 budget law's plan (main #219). When its actual replaces it the mark goes, and this pin moves with the data.
    expect([year, isPlan]).toEqual([2026, true]);
  });

  it("marks the plan in the Expenditure headline and nowhere else among the four", async () => {
    const html = renderToStaticMarkup(await renderGroupPage("budget", locale));
    const headlines = [...html.matchAll(/<a[^>]*data-testid="group-headline"[^>]*>[\s\S]*?<\/a>/g)].map((match) => match[0]);
    expect(headlines).toHaveLength(4);
    const marked = headlines.filter((headline) => headline.includes('data-planned="true"'));
    expect(marked).toHaveLength(1);
    expect(marked[0]).toMatch(/href="[^"]*\/explorer\/expenditure"/);
    expect(marked[0]).toContain(` ${PLAN[locale]}</small>`);
    for (const headline of headlines.filter((candidate) => !marked.includes(candidate))) expect(headline).not.toContain(PLAN[locale]);
  });

  it("gives All data's Expenditure row the plan as its period, and the out-of-scope rows their actual year", async () => {
    const [ka, en] = await Promise.all([getMessages("ka", ["common", "allData"]), getMessages("en", ["common", "allData"])]);
    const pages = buildSearchPages(await loadTopicHubs(locale, ["budget"]), ka, en);
    expect(pages.find((page) => page.href === "/explorer/expenditure")?.period).toBe(PLAN[locale]);
    for (const href of OUT_OF_SCOPE) expect(pages.find((page) => page.href === href)?.period, href).toMatch(/^\d{4}$/);
  });
});

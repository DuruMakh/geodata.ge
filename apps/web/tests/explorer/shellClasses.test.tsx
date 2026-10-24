import { describe, expect, it, vi } from "vitest";
import type { Locale } from "../../lib/i18n/types";
import { renderPageMarkup } from "../helpers/render-localized";

// The group pages' topic scroll reads the router.
vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), useRouter: () => ({ replace() {} }) }));

// The class lists the explorer shell renders on each page, pinned before the
// shell was consolidated into components/explorer-shell. A difference here is
// a visual change, not a refactor: fix the shared component, never the snapshot.
const PAGES: ReadonlyArray<{ name: string; render: (locale: Locale) => Promise<unknown> }> = [
  { name: "expenditure", render: async (l) => (await import("../../lib/pages/expenditure")).renderExpenditurePage(l) },
  { name: "debt", render: async (l) => (await import("../../lib/pages/debt")).renderDebtPage(l) },
  { name: "deficit", render: async (l) => (await import("../../lib/pages/deficit")).renderDeficitPage(l) },
  { name: "gdp", render: async (l) => (await import("../../lib/pages/gdp")).renderGdpPage(l) },
  { name: "sectors", render: async (l) => (await import("../../lib/pages/economic-sectors")).renderEconomicSectorsPage(l) },
  { name: "economy", render: async (l) => (await import("../../lib/pages/group")).renderGroupPage("economy", l) },
  { name: "prices", render: async (l) => (await import("../../lib/pages/group")).renderGroupPage("prices", l) },
  { name: "inflation-overview", render: async (l) => (await import("../../lib/pages/inflation-overview")).renderInflationOverview(l) },
  { name: "inflation-categories", render: async (l) => (await import("../../lib/pages/inflation-categories")).renderInflationCategories(l) },
  { name: "regions", render: async (l) => (await import("../../lib/pages/regional-economies")).renderRegionalEconomiesPage(l) },
  { name: "region", render: async (l) => (await import("../../lib/pages/regional-economy")).renderRegionalEconomyPage("imereti", l) },
];

const attributesOf = (markup: string, pattern: RegExp): string[] =>
  [...markup.matchAll(pattern)].map((match) => match[0]);

describe.each(PAGES)("'$name' shell", ({ render }) => {
  it("keeps its wrapper, heading, workspace, aside and measure pill", async () => {
    const markup = renderPageMarkup("ka", (await render("ka")) as never);

    expect({
      main: attributesOf(markup, /<main[^>]*>(?:<div[^>]*>)?/g),
      h1: attributesOf(markup, /<h1[^>]*>/g),
      workspace: attributesOf(markup, /<div[^>]*grid items-start gap-8[^>]*>/g),
      aside: attributesOf(markup, /<aside[^>]*>/g),
      pill: attributesOf(markup, /<button[^>]*data-testid="measure-share-toggle"[^>]*>/g),
    }).toMatchSnapshot();
  });

  // U02-03: the explorer layout already fills the screen and pins the footer; a full-screen <main> on top
  // of it left a blank band between the last section and the footer on every short page.
  it("leaves the full-screen height to the layout", async () => {
    const markup = renderPageMarkup("ka", (await render("ka")) as never);
    for (const main of attributesOf(markup, /<main[^>]*>/g)) expect(main).not.toContain("min-h-screen");
  });
});

// U02-04: the budget hub's source and update date live in the footer note and the header's coverage label; the page
// repeated both in a source note of its own (and showed the date twice on one screen). The Budget group page replaced it.
it("the budget group page states its source and update date once", async () => {
  const markup = renderPageMarkup("en", (await (await import("../../lib/pages/group")).renderGroupPage("budget", "en")) as never);
  expect(markup).not.toContain("Last updated");
  expect(markup).not.toContain("World Economic Outlook");
  expect(markup).toMatch(/Updated \d{1,2} [A-Z][a-z]+ \d{4}/);
});

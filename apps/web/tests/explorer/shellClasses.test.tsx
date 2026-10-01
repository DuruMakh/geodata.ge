import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Locale } from "../../lib/i18n/types";

// The class lists the explorer shell renders on each page, pinned before the
// shell was consolidated into components/explorer-shell. A difference here is
// a visual change, not a refactor: fix the shared component, never the snapshot.
const PAGES: ReadonlyArray<{ name: string; render: (locale: Locale) => Promise<unknown> }> = [
  { name: "expenditure", render: async (l) => (await import("../../lib/pages/expenditure")).renderExpenditurePage(l) },
  { name: "debt", render: async (l) => (await import("../../lib/pages/debt")).renderDebtPage(l) },
  { name: "deficit", render: async (l) => (await import("../../lib/pages/deficit")).renderDeficitPage(l) },
  { name: "gdp", render: async (l) => (await import("../../lib/pages/gdp")).renderGdpPage(l) },
  { name: "sectors", render: async (l) => (await import("../../lib/pages/economic-sectors")).renderEconomicSectorsPage(l) },
  { name: "economy", render: async (l) => (await import("../../lib/pages/economy")).renderEconomyPage(l) },
  { name: "inflation", render: async (l) => (await import("../../lib/pages/inflation")).renderInflationHub(l) },
  { name: "inflation-overview", render: async (l) => (await import("../../lib/pages/inflation")).renderInflationOverview(l) },
  { name: "inflation-categories", render: async (l) => (await import("../../lib/pages/inflation")).renderInflationCategories(l) },
  { name: "regions", render: async (l) => (await import("../../lib/pages/regional-economies")).renderRegionalEconomiesPage(l) },
  { name: "region", render: async (l) => (await import("../../lib/pages/regional-economy")).renderRegionalEconomyPage("imereti", l) },
];

const attributesOf = (markup: string, pattern: RegExp): string[] =>
  [...markup.matchAll(pattern)].map((match) => match[0]);

describe.each(PAGES)("'$name' shell", ({ render }) => {
  it("keeps its wrapper, heading, workspace, aside and measure pill", async () => {
    const markup = renderToStaticMarkup((await render("ka")) as never);

    expect({
      main: attributesOf(markup, /<main[^>]*>(?:<div[^>]*>)?/g),
      h1: attributesOf(markup, /<h1[^>]*>/g),
      workspace: attributesOf(markup, /<div[^>]*grid items-start gap-8[^>]*>/g),
      aside: attributesOf(markup, /<aside[^>]*>/g),
      pill: attributesOf(markup, /<button[^>]*data-testid="measure-share-toggle"[^>]*>/g),
    }).toMatchSnapshot();
  });
});

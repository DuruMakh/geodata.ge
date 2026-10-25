import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderExplorerLayout } from "../../lib/pages/explorer-layout";
import { SiteFooter } from "../../components/site/site-footer";
import { renderPageMarkup } from "../helpers/render-localized";
import { renderDeficitPage } from "../../lib/pages/deficit";
import { renderRegionalEconomyPage } from "../../lib/pages/regional-economy";
import { renderEconomicSectorsPage } from "../../lib/pages/economic-sectors";
import { renderGdpPage } from "../../lib/pages/gdp";
import { renderInflationOverview } from "../../lib/pages/inflation-overview";
import { renderInflationCategories } from "../../lib/pages/inflation-categories";
import { renderUnemploymentPage } from "../../lib/pages/unemployment";
import { renderLabourPage } from "../../lib/pages/labour";
import { renderDemographyPopulationPage } from "../../lib/pages/demography-population";
import { renderDemographyBirthsDeathsPage } from "../../lib/pages/demography-births-deaths";
import { renderTradeOverviewPage } from "../../lib/pages/trade";
import type { Locale } from "../../lib/i18n/types";

const route = vi.hoisted(() => ({ pathname: "/en/explorer/deficit" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => ({ push: () => {} }) }));

function footerText(markup: string) {
  const footer = markup.match(/<footer[\s\S]*?<\/footer>/)?.[0];
  expect(footer).toBeDefined();
  return footer!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

/** The text of a page's source note: the paragraph with this test id, its tags dropped. */
function sourceNote(markup: string, testId: string) {
  const note = new RegExp(`<p[^>]*data-testid="${testId}"[^>]*>([\\s\\S]*?)</p>`).exec(markup)?.[1];
  expect(note, testId).toBeDefined();
  return note!.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

// deep-review quality Q4: the institution checks the explorer footer carried, moved to each chart page's own source note.
describe("chart page source attribution", () => {
  const cases: [name: string, locale: Locale, render: () => Promise<React.ReactNode>, testId: string, source: string, unrelated: string][] = [
    ["Deficit", "en", () => renderDeficitPage("en"), "source-label", "IMF", "Ministry of Finance"],
    ["Deficit", "ka", () => renderDeficitPage("ka"), "source-label", "IMF", "ფინანსთა სამინისტრო"],
    ["Tbilisi's economy", "en", () => renderRegionalEconomyPage("tbilisi", "en"), "regional-source-label", "Geostat", "World Bank"],
    ["Economic sectors", "en", () => renderEconomicSectorsPage("en"), "source-label", "Geostat", "World Bank"],
    ["GDP overview", "en", () => renderGdpPage("en"), "source-label", "World Bank", "Ministry of Finance"],
    ["Inflation overview", "en", () => renderInflationOverview("en"), "source-label", "Geostat", "Ministry of Finance"],
    ["Inflation categories", "en", () => renderInflationCategories("en"), "source-label", "Geostat", "National Bank"],
    ["Population", "en", () => renderDemographyPopulationPage("en"), "municipal-source-note", "Geostat", "Ministry of Finance"],
    ["Births and deaths", "en", () => renderDemographyBirthsDeathsPage("en"), "national-source-note", "Geostat", "World Bank"],
    ["Trade overview", "en", () => renderTradeOverviewPage("en"), "source-label", "Geostat", "Ministry of Finance"],
    ["Trade overview", "ka", () => renderTradeOverviewPage("ka"), "source-label", "საქსტატი", "ფინანსთა სამინისტრო"],
  ];
  it.each(cases)("names its institution on the %s page (%s)", async (_name, locale, render, testId, source, unrelated) => {
    const note = sourceNote(renderPageMarkup(locale, await render()), testId);
    expect(note).toContain(source);
    expect(note).not.toContain(unrelated);
  });

  it("names both publishers on the Inflation overview, in Georgian too", async () => {
    expect(sourceNote(renderPageMarkup("en", await renderInflationOverview("en")), "source-label")).toContain("National Bank");
    const ka = sourceNote(renderPageMarkup("ka", await renderInflationOverview("ka")), "source-label");
    expect(ka).toContain("საქსტატი");
    expect(ka).toContain("ეროვნული ბანკი");
  });

  // Unemployment's eight pages: four from the unemployment survey tables (Regions is a map with the region index's source
  // note), four from the Labour Force Survey's detail tables. Inflation products draws its note once its data has loaded, so
  // tests/browser/hubs.spec.ts checks it.
  it.each(["ka", "en"] as const)("credits all eight Unemployment and jobs pages to Geostat (%s)", async (locale) => {
    const pages = [
      ...(["overview", "regions", "age", "gender"] as const).map((section) => [() => renderUnemploymentPage(locale, section), section === "regions" ? "regional-source-note" : "source-label"] as const),
      ...(["hours", "informal", "industries", "young-people"] as const).map((section) => [() => renderLabourPage(locale, section), "source-label"] as const),
    ];
    for (const [render, testId] of pages) {
      const note = sourceNote(renderPageMarkup(locale, await render()), testId);
      expect(note).toContain(locale === "en" ? "Geostat" : "საქსტატი");
      expect(note).not.toContain(locale === "en" ? "Ministry of Finance" : "ფინანსთა სამინისტრო");
    }
  });
});

describe("dataset footer attribution", () => {
  // Explorer routes render no footer; their sources sit in each page's own source note.
  it.each([
    ["en", "/en/explorer/deficit"],
    ["ka", "/explorer/deficit"],
    ["en", "/en/explorer/labour"],
    ["ka", "/explorer"],
  ] as const)("renders no footer on the %s explorer route %s", async (locale, pathname) => {
    route.pathname = pathname;
    expect(renderPageMarkup(locale, await renderExplorerLayout(locale, null))).not.toMatch(/<footer[\s>]/);
  });

  // U01-21: the year is the build's.
  it("dates the copyright line by the build, not a literal year", () => {
    // A build some years on: only the clock moves, so the footer must follow it.
    const later = new Date().getFullYear() + 5;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(later, 5, 1));
    try {
      expect(footerText(renderToStaticMarkup(<SiteFooter locale="ka" />))).toContain(`© ${later} Fiscal.ge`);
    } finally {
      vi.useRealTimers();
    }
  });

  it("labels the generic footer date as a site-wide source review", () => {
    const footer = footerText(renderToStaticMarkup(<SiteFooter locale="en" updatedAt="2026-09-13" />));
    expect(footer).toContain("Latest source review across Fiscal.ge:");
    expect(footer).toContain("2026-09-13");
    expect(footer).not.toContain("Ministry of Finance");
  });
});

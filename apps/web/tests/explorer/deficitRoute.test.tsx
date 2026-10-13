import React, { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../lib/i18n/provider";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ServedGeneralGovernmentBalanceFact } from "../../lib/servedRows";

import * as sources from "../../lib/methodology/workbookSources";
import * as servedData from "../../lib/data/servedData";
import { renderPageMarkup } from "../helpers/render-localized";

afterEach(() => vi.restoreAllMocks());

let presentation: Presentation;
beforeAll(async () => { presentation = await getPresentation("ka", ["common", "controls", "format", "main", "deficit"], ["deficit.general_government.balance"], ["deficit.general_government.balance"]); });
function renderGeorgianMarkup(children: ReactNode) { return renderToStaticMarkup(<I18nProvider {...presentation}>{children}</I18nProvider>); }

const facts: ServedGeneralGovernmentBalanceFact[] = [
  { year: 2024, generalGovernmentBalancePctGdp: -2.267, generalGovernmentBalanceGel: -2_109_000_000, status: "actual", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
  { year: 2025, generalGovernmentBalancePctGdp: -1.455, generalGovernmentBalanceGel: -1_526_000_000, status: "actual", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
  { year: 2026, generalGovernmentBalancePctGdp: -2.327, generalGovernmentBalanceGel: -2_672_000_000, status: "projection", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
];

describe("general-government deficit route composition", () => {
  it("marks the first projection year declared by the full facts", async () => {
    const { DeficitExplorer } = await import("../../components/deficit/deficit-explorer");
    const shifted = [
      ...facts.map((fact) => ({ ...fact, status: "actual" as const })),
      { ...facts[2]!, year: 2027 },
    ];
    const markup = renderGeorgianMarkup(createElement(DeficitExplorer, {
      facts: shifted,
      workbookSources: [],
      edition: "2026 წლის აპრილი",
      lastUpdatedAt: "2026-09-04",
    }));
    const marker = /<[^>]*data-testid="range-marker"[\s\S]*?<\/[a-z]+>/.exec(markup)?.[0] ?? "";
    // 2027 is the right endpoint of the 2024–2027 rail.
    expect(marker).toContain('style="left:100.00%"');
  });

  it("names the reviewed IMF edition and actual/projection coverage", async () => {
    const { renderDeficitPage } = await import("../../lib/pages/deficit");
    const html = renderPageMarkup("en", await renderDeficitPage("en"));
    expect(html).toContain("World Economic Outlook, April 2026");
    expect(html).toContain("The IMF projects the figures for 2026–2031");
    expect(html).toContain("This WEO edition identifies 1995–2025 as the actual-data period");
  });

  it.each([
    ["en", "October 2027", "2027–2028 are IMF projections"],
    ["ka", "2027 წლის ოქტომბერი", "2027–2028 IMF-ის პროგნოზია"],
  ] as const)("uses a later edition in the %s page and workbook", async (locale, edition, description) => {
    vi.spyOn(sources, "loadImfWeoManifest").mockResolvedValue({
      publicationDate: "2027-10-12", retrievedAt: "2027-10-20",
      retrievedFileUrl: "https://data.imf.org/WEOOct2027.xlsx", yearMin: 2024, yearMax: 2028,
    });
    vi.spyOn(servedData, "loadServedGeneralGovernmentBalanceData").mockResolvedValue({ facts: [
      ...facts.map(fact => ({ ...fact, status: "actual" as const })),
      { ...facts[2]!, year: 2027 }, { ...facts[2]!, year: 2028 },
    ] });
    const { renderDeficitPage } = await import("../../lib/pages/deficit");
    const page = await renderDeficitPage(locale);
    const html = renderPageMarkup(locale, page);
    expect(html).toContain(edition);
    expect(html).toContain(description);
    expect(html).toContain("2024–2026");
    expect(html).not.toContain("April 2026");
    const explorer = page.props.children[2].props.children;
    expect(explorer.props.workbookSources).toEqual([{
      years: [2024, 2025, 2026, 2027, 2028], title: "IMF World Economic Outlook — " + edition,
      organization: locale === "en" ? "International Monetary Fund (IMF)" : "საერთაშორისო სავალუტო ფონდი (IMF)",
      downloadHref: "https://data.imf.org/WEOOct2027.xlsx", retrievedAt: "2027-10-20",
    }]);
  });

});

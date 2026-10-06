import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MethodologyArticle } from "../../components/methodology/methodology-article";
import { METHODOLOGY_CONTENT } from "../../lib/methodology/catalog";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import common from "../../lib/i18n/messages/ka/common.json";
import methodology from "../../lib/i18n/messages/ka/methodology.json";

// Counting the served loader is the only way to see which articles need debt
// data: every article renders the same component, and the memo hides a second
// call behind the first.
vi.mock("../../lib/data/governmentDebt/importGovernmentDebtFacts", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../lib/data/governmentDebt/importGovernmentDebtFacts")
  >();
  return { ...actual, loadServedGovernmentDebtData: vi.fn(actual.loadServedGovernmentDebtData) };
});

// The archive report is written by `prebuild`, and CI runs the tests before the
// build, so a fresh checkout has no report to read. Nothing here is about the
// archives: every live article gets the same validated summary.
vi.mock("../../lib/methodology/prepareArchives", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/methodology/prepareArchives")>();
  const { LIVE_METHODOLOGY_IDS } = await import("../../lib/methodology/catalog");
  return {
    ...actual,
    loadGeneratedArchiveSummaries: vi.fn(async () =>
      Object.fromEntries(
        LIVE_METHODOLOGY_IDS.map((id) => [
          id,
          { fileCount: 1, totalBytes: 1, latestRetrievedAt: "2026-09-01", validated: true, status: "PASS", minYear: 2004, maxYear: 2025 },
        ]),
      ),
    ),
  };
});

const archiveSummary = {
  fileCount: 1,
  totalBytes: 1,
  latestRetrievedAt: "2026-09-01",
  validated: true,
};

function renderArticle(dataset: "debt" | "expenditure") {
  return renderToStaticMarkup(createElement(MethodologyArticle, {
    locale: "ka",
    messages: { ...common, ...methodology },
    content: METHODOLOGY_CONTENT[dataset],
    coverage: dataset === "debt" ? { firstYear: 2013, lastYear: 2030 } : { firstYear: 2004, lastYear: 2025 },
    rows: [],
    archiveSummary,
    processedDataHref: dataset === "debt"
      ? "/downloads/data/government-debt.csv"
      : "/downloads/data/national-expenditure.csv",
    // Debt has no JSON publication; expenditure has two.
    processedDataJsonLinks:
      dataset === "debt"
        ? []
        : [
            { href: "/downloads/data/national-expenditure.json", label: "სახელმწიფო ხარჯები" },
            { href: "/downloads/data/ministries.json", label: "უწყებები და პროგრამები" },
          ],
    breadcrumbItems: [],
  }));
}

describe("methodology processed-download caption", () => {
  it("describes the Debt CSV with neutral status metadata rather than fact/plan metadata", () => {
    const markup = renderArticle("debt");

    expect(markup).toContain('href="/downloads/data/government-debt.csv"');
    expect(markup).toContain("სტატუსის მეტამონაცემებით");
    expect(markup).not.toContain("ფაქტი/გეგმის მეტამონაცემებით");
  });

  it("preserves the existing category download link and shared format/licence caption", () => {
    const markup = renderArticle("expenditure");

    expect(markup).toContain('href="/downloads/data/national-expenditure.csv"');
    expect(markup).toContain("UTF-8 / Excel თავსებადი · CC BY 4.0");
    expect(markup).toContain("სტატუსის მეტამონაცემებით");
  });
});

describe("methodology article data loading", () => {
  it("loads debt facts only for the debt article", async () => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const { loadServedGovernmentDebtData } = await import(
      "../../lib/data/governmentDebt/importGovernmentDebtFacts"
    );

    await renderMethodologyArticle("ka", { params: Promise.resolve({ dataset: "revenue" }) });
    expect(loadServedGovernmentDebtData).not.toHaveBeenCalled();

    await renderMethodologyArticle("ka", { params: Promise.resolve({ dataset: "debt" }) });
    expect(loadServedGovernmentDebtData).toHaveBeenCalledTimes(1);

    // English articles come from a separate content record, but
    // deriveMethodologyCoverage always reads the Georgian one. The guard has to
    // agree in both locales, or the English debt build throws for want of years.
    await renderMethodologyArticle("en", { params: Promise.resolve({ dataset: "debt" }) });
    expect(loadServedGovernmentDebtData).toHaveBeenCalledTimes(2);

    await renderMethodologyArticle("en", { params: Promise.resolve({ dataset: "revenue" }) });
    expect(loadServedGovernmentDebtData).toHaveBeenCalledTimes(2);
  });
});

describe("methodology footer attribution", () => {
  it.each([
    ["inflation", "Geostat and the National Bank of Georgia"],
    ["gdp", "World Bank and Geostat"],
    ["economic-sectors", "Geostat"],
    ["regional-economies", "Geostat"],
    ["demography", "Geostat"],
  ])("uses %s sources and leaves the review date with the article", async (dataset, source) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle("en", { params: Promise.resolve({ dataset }) }));
    const footer = markup.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
    expect(footer).toContain(source);
    expect(footer).not.toContain("Ministry of Finance");
    expect(footer).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const header = markup.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toContain(`Last methodology review · ${METHODOLOGY_CONTENT[dataset as keyof typeof METHODOLOGY_CONTENT].reviewedAt}`);
  });
});

describe("methodology without bulk files", () => {
  it("renders the demography article with its breadcrumb and archived originals but no download or Dataset markup", async () => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle("en", { params: Promise.resolve({ dataset: "demography" }) }));
    expect(markup).not.toContain("processed-dataset-download");
    expect(markup).not.toContain('data-testid="dataset-json-ld"');
    expect(markup).not.toContain("/downloads/data/");
    expect(markup).toContain('data-testid="breadcrumb-json-ld"');
    expect(markup).toContain("/downloads/methodology/demography/files/");
  });

  it("lists demography on the hub but keeps it out of the data catalog, which names only Dataset nodes", async () => {
    const { renderMethodologyPage } = await import("../../lib/pages/methodology");
    // The hub renders the client-side ComingSoonBadge, which needs the provider the real locale layout supplies.
    const messages = await getMessages("en", ["common", "methodology"]);
    const markup = renderToStaticMarkup(<I18nProvider locale="en" messages={messages}>{await renderMethodologyPage("en")}</I18nProvider>);
    const catalog = markup.match(/<script data-testid="catalog-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]!;
    expect(catalog).toContain('/methodology/inflation"');
    expect(catalog).not.toContain("/methodology/demography");
    expect(markup).toContain('href="/en/methodology/demography"');
  });
});

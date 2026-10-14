import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MethodologyArticle } from "../../components/methodology/methodology-article";
import { SourceArchive, type PublicSourceManifestRow } from "../../components/methodology/source-archive";
import { METHODOLOGY_CONTENT } from "../../lib/methodology/catalog";
import { resolveSiteUrl } from "../../lib/siteUrl";
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

// Rendering a methodology page reads the archive report that only `prebuild` writes; see the helper.
vi.mock("../../lib/methodology/prepareArchives", async (importOriginal) =>
  (await import("../helpers/archive-summaries")).withValidatedArchiveSummaries(importOriginal));

const archiveSummary = {
  fileCount: 1,
  totalBytes: 1,
  latestRetrievedAt: "2026-09-01",
  validated: true,
};

it.each([
  ["ka", "საქსტატის მომსახურებით ვაჭრობის გვერდი"],
  ["en", "Geostat services trade source page"],
] as const)("renders the Services publisher link in the %s Trade methodology", async (locale, label) => {
  const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
  const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "trade" }) }));
  const services = markup.match(/<section[^>]*id="services"[\s\S]*?<\/section>/)?.[0] ?? "";
  expect(services).toContain('href="https://www.geostat.ge/en/modules/categories/766/international-trade-in-services"');
  expect(services).toMatch(new RegExp(`<a[^>]*>${label}</a>`));
});

it("omits processed-data links for an article without a public dataset publication", () => {
  const markup = renderToStaticMarkup(createElement(MethodologyArticle, {
    locale: "ka", messages: { ...common, ...methodology }, content: METHODOLOGY_CONTENT.debt,
    coverage: { firstYear: 2013, lastYear: 2030 }, rows: [], archiveSummary,
    processedDataHref: null, processedDataJsonLinks: [], breadcrumbItems: [],
  }));
  expect(markup).not.toContain('data-testid="processed-dataset-download"');
  expect(markup).not.toContain("CC BY 4.0");
  expect(markup).toContain('id="source-archive"');
});

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
  // Debt describes its CSV with neutral status metadata rather than fact/plan metadata; every category keeps
  // its existing download link and the shared format/licence caption.
  it.each([
    ["debt", "/downloads/data/government-debt.csv"],
    ["expenditure", "/downloads/data/national-expenditure.csv"],
  ] as const)("the %s caption links %s with status metadata and the shared format/licence line", (dataset, href) => {
    const markup = renderArticle(dataset);

    expect(markup).toContain(`href="${href}"`);
    expect(markup).toContain("UTF-8 / Excel თავსებადი · CC BY 4.0");
    expect(markup).toContain("სტატუსის მეტამონაცემებით");
    if (dataset === "debt") expect(markup).not.toContain("ფაქტი/გეგმის მეტამონაცემებით");
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
    ["household-income", "Geostat"],
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

describe("household income and spending methodology", () => {
  it.each([["ka", "შინამეურნეობების შემოსავლები და ხარჯები"], ["en", "Household income and spending"]] as const)("renders the %s article with its 21 archived originals and Dataset markup", async (locale, title) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "household-income" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2002–2025");
    expect(markup).toContain('"@type":"Dataset"');
    expect(markup).toContain("/downloads/methodology/household-income/files/104-income-per-household.xlsx");
    expect(markup).toContain("/downloads/methodology/household-income/files/income-page-2026-10-11.html.txt");
    expect(markup).not.toContain("/official/ka/");
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
    // The hub's coming-next list is empty, so no client-side ComingSoonBadge renders now; the provider stays for the day a
    // future-dataset row returns, because the real locale layout supplies one.
    const messages = await getMessages("en", ["common", "methodology"]);
    const markup = renderToStaticMarkup(<I18nProvider locale="en" messages={messages}>{await renderMethodologyPage("en")}</I18nProvider>);
    const catalog = markup.match(/<script data-testid="catalog-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]!;
    expect(catalog).toContain('/methodology/inflation"');
    expect(catalog).not.toContain("/methodology/demography");
    expect(markup).toContain('href="/en/methodology/demography"');
  });
});

// U29-04: the debt data is government debt, not the wider state debt the page's own caveat rules out.
it.each([
  ["ka", "მთავრობის ვალი"],
  ["en", "Government debt"],
] as const)("names the %s debt JSON download government debt", async (locale, label) => {
  const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
  const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "debt" }) }));
  expect(markup).toMatch(new RegExp(`<a href="/downloads/data/government-debt.json"[^>]*>${label}</a>`));
});

// U29-02: a year filter with more chips than files pushed a short table far down a phone screen.
describe("the source archive's year filter", () => {
  const sourceRow = (index: number): PublicSourceManifestRow => ({
    source_id: `source-${index}`, year: "1960–2025", years: Array.from({ length: 66 }, (_, offset) => 1960 + offset),
    official_filename: `file-${index}.xlsx`, byte_size: 1000, downloadHref: `/downloads/methodology/gdp/files/file-${index}.xlsx`,
    title: `ფაილი ${index}`, publisher: "საქსტატი", searchLabels: [], documentLanguage: "ka",
  });
  const render = (count: number) => renderToStaticMarkup(
    <I18nProvider locale="ka" messages={{ ...common, ...methodology }}>
      <SourceArchive datasetId="gdp" datasetLabel="მშპ" rows={Array.from({ length: count }, (_, index) => sourceRow(index))} summary={archiveSummary} />
    </I18nProvider>,
  );

  it("is hidden for twelve files or fewer, keeping the search box", () => {
    const markup = render(12);
    expect(markup).not.toContain('data-testid="archive-year-filter"');
    expect(markup).toContain('type="search"');
    expect(markup.match(/data-testid="source-archive-row"/g)).toHaveLength(12);
    expect(markup).toContain("1960–2025");
  });

  it("is shown for thirteen files", () => {
    const markup = render(13);
    expect(markup).toContain('data-testid="archive-year-filter"');
    expect(markup).toContain(">1960</button>");
  });

  // U29-16, U29-17: a row's title and publisher are readable at body size, and a year range takes one dash everywhere.
  it("prints a year range with an en dash and the title and publisher at body size", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider locale="ka" messages={{ ...common, ...methodology }}>
        <SourceArchive datasetId="gdp" datasetLabel="მშპ" rows={[{ ...sourceRow(0), year: "2019-2024" }]} summary={archiveSummary} />
      </I18nProvider>,
    );
    expect(markup).toContain(">2019–2024</td>");
    expect(markup).not.toContain("2019-2024");
    expect(markup).toMatch(/<span class="block text-\[0.8125rem\] font-semibold[^"]*">ფაილი 0<\/span>/);
    expect(markup).toMatch(/<span class="mt-1 block text-\[0.75rem\][^"]*">საქსტატი<\/span>/);
  });
});

// Moved from inflation-overview.spec.ts: the methodology Dataset is the node the catalog references.
it("makes the inflation methodology Dataset the node the catalog references, in each language", async () => {
  const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
  const { renderMethodologyPage } = await import("../../lib/pages/methodology");
  const dataset = async (locale: "ka" | "en") => {
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "inflation" }) }));
    return JSON.parse(markup.match(/<script data-testid="dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]!);
  };
  const messages = await getMessages("ka", ["common", "methodology"]);
  const hub = renderToStaticMarkup(<I18nProvider locale="ka" messages={messages}>{await renderMethodologyPage("ka")}</I18nProvider>);
  const catalog = JSON.parse(hub.match(/<script data-testid="catalog-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]!);
  const origin = resolveSiteUrl();
  const id = `${origin}/methodology/inflation`;
  expect(catalog.dataset.map((entry: { "@id": string }) => entry["@id"])).toContain(id);
  const georgian = await dataset("ka");
  expect(georgian["@id"]).toBe(id);
  expect(georgian.includedInDataCatalog["@id"]).toBe(`${origin}/methodology#catalog`);
  expect(georgian.distribution[0].contentUrl).toBe(`${origin}/downloads/data/inflation-cpi-national.csv`);
  // The English page is the English node, in the English catalog.
  const english = await dataset("en");
  expect(english["@id"]).toBe(`${origin}/en/methodology/inflation`);
  expect(english.includedInDataCatalog["@id"]).toBe(`${origin}/en/methodology#catalog`);
});

// U29-13: the unused document-stack figure and the LINEAGE re-export are gone; only the open-document figure is drawn.
it("document visuals export only the figure a page draws", async () => {
  expect(Object.keys(await import("../../components/methodology/document-visuals"))).toEqual(["OpenDocumentVisual"]);
});

// U29-18: the English GDP archive named three World Bank files by their file name twice; they get reviewed titles.
it("titles every English GDP source document, not by its file name", async () => {
  const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
  const messages = await getMessages("en", ["common", "methodology"]);
  const markup = renderToStaticMarkup(<I18nProvider locale="en" messages={messages}>{await renderMethodologyArticle("en", { params: Promise.resolve({ dataset: "gdp" }) })}</I18nProvider>);
  for (const title of ["World Bank · Real GDP", "World Bank · Annual GDP growth", "World Bank · GDP indicator metadata"]) expect(markup).toContain(`>${title}</span>`);
  expect(markup).not.toMatch(/font-semibold[^"]*">[^<]*\.json<\/span>/);
});

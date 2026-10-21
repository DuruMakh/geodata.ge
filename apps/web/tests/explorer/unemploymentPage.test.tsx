import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, expect, test, vi } from "vitest";
import { renderUnemploymentPage, unemploymentPageMetadata } from "../../lib/pages/unemployment";
import { DataSidebar } from "../../components/shell/data-sidebar";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import GeorgianUnemploymentHub from "../../app/(ka)/explorer/unemployment/page";
import EnglishUnemploymentHub from "../../app/(en)/en/explorer/unemployment/page";
import { renderPageMarkup } from "../helpers/render-localized";
import { UnemploymentExplorer } from "../../components/unemployment/unemployment-explorer";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";

const navigation = vi.hoisted(() => ({ pathname: "/en/explorer/unemployment" }));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), usePathname: () => navigation.pathname, useRouter: () => ({ replace: () => {} }) }));

test.each(["ka", "en"] as const)("the %s landing page offers eight cards in the approved order", async locale => {
  const markup = renderToStaticMarkup(await (locale === "ka" ? GeorgianUnemploymentHub() : EnglishUnemploymentHub()));
  expect(markup).toContain('data-testid="unemployment-hub"');
  const hrefs = [...markup.matchAll(/<a\b[^>]*data-testid="hub-card"[^>]*>/g)].map(match => /href="([^"]+)"/.exec(match[0])![1]);
  expect(hrefs).toEqual(["overview", "regions", "age", "gender", "industries", "hours", "informal", "young-people"].map(section => `${locale === "en" ? "/en" : ""}/explorer/unemployment/${section}`));
  const common = await getMessages(locale, ["common"]);
  const titles = [...markup.matchAll(/data-testid="hub-card"[\s\S]*?<\/a>/g)].map(match => match[0]);
  expect(titles).toHaveLength(8);
  ["unemploymentIndustries", "unemploymentHours", "unemploymentInformal", "unemploymentYoungPeople"].forEach((key, offset) => expect(titles[4 + offset]).toContain(common[`common.${key}`]));
  expect(markup.match(/>0[1-8]</g)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"].map(n => `>${n}<`));
  expect(markup).not.toContain('data-testid="unemployment-explorer"');
});

for (const [section, breakdown] of [["overview", "national"], ["age", "age"], ["gender", "sex"]] as const) test.each(["ka", "en"] as const)(`renders a static %s ${section} explorer with its own scope and metadata`, async locale => {
  const markup = renderPageMarkup(locale, await renderUnemploymentPage(locale, section));
  expect(markup).toContain('data-testid="unemployment-explorer"');
  expect(markup).toContain(`data-breakdown="${breakdown}"`);
  expect(markup).not.toContain('data-testid="unemployment-breakdown"');
  expect(markup.includes('data-testid="unemployment-composition"')).toBe(section === "overview");
  expect(markup.includes('data-testid="unemployment-tab-education"')).toBe(section === "overview");
  expect(markup).toContain(section === "age" ? "2020–2025" : "2010–2025"); expect(markup).toContain("2026-10-03");
  const json = JSON.parse(/data-testid="explorer-dataset-json-ld"[^>]*>(.*?)<\/script>/.exec(markup)![1]);
  expect(json.temporalCoverage).toBe(section === "age" ? "2020/2025" : "2010/2025");
  // No bulk file, so no distribution; the shared builder files the page in the catalog of its own language.
  expect(json.distribution).toBeUndefined(); expect(json.includedInDataCatalog["@id"]).toBe(`${new URL(json.url).origin}${locale === "en" ? "/en" : ""}/methodology#catalog`);
  expect(markup).not.toContain("/downloads/data/unemployment");
  const metadata = await unemploymentPageMetadata(locale, section);
  expect(metadata.alternates?.canonical).toEqual(expect.stringContaining(`${locale === "en" ? "/en" : ""}/explorer/unemployment/${section}`));
  expect(metadata.alternates?.languages).toMatchObject({ ka: expect.stringContaining(`/explorer/unemployment/${section}`), en: expect.stringContaining(`/en/explorer/unemployment/${section}`) });
});
test("navigation activates unemployment and leaves demography closed", async () => {
  const markup = renderToStaticMarkup(<I18nProvider locale="en" messages={await getMessages("en", ["common", "controls"])}><DataSidebar /></I18nProvider>);
  expect(markup).toMatch(/<a[^>]+data-testid="unemployment-link"[^>]+aria-current="page"/);
  expect(markup).toContain('href="/en/explorer/unemployment"');
  expect(markup).not.toContain('data-testid="demography-population-link"');
  expect(markup).not.toContain('href="/en/explorer/expenditure"');
  const budgetLink = /<a[^>]+href="\/en\/explorer"[^>]*>/.exec(markup)![0];
  expect(budgetLink).not.toContain("border-[var(--accent)]");
  const sectionLinks = [...markup.matchAll(/<a\b[^>]*data-testid="unemployment-(?:overview|regions|age|gender)-link"[^>]*>/g)].map(match => /href="([^"]+)"/.exec(match[0])![1]);
  expect(sectionLinks).toEqual(["overview", "regions", "age", "gender"].map(section => `/en/explorer/unemployment/${section}`));
});

test.each(["/explorer/unemployment/regions", "/en/explorer/unemployment/regions", "/explorer/unemployment/regions/tbilisi", "/en/explorer/unemployment/regions/tbilisi"])("%s keeps the unemployment menu active and marks Regions", async pathname => {
  const locale = pathname.startsWith("/en/") ? "en" : "ka";
  navigation.pathname = pathname;
  try {
    const markup = renderToStaticMarkup(<I18nProvider locale={locale} messages={await getMessages(locale, ["common", "controls"])}><DataSidebar /></I18nProvider>);
    const currentLink = /<a\b[^>]*data-testid="unemployment-regions-link"[^>]*>/.exec(markup)![0];
    expect(currentLink).toContain(`href="${locale === "en" ? "/en" : ""}/explorer/unemployment/regions"`);
    expect(currentLink).toContain('aria-current="page"');
    expect(markup).not.toContain('href="/en/explorer/expenditure"');
    expect(markup).not.toMatch(/data-testid="unemployment-link"[^>]+aria-current="page"/);
  } finally { navigation.pathname = "/en/explorer/unemployment"; }
});

// Moved from unemploymentPresentation.test.tsx.
let facts: ClientUnemploymentObservation[];
beforeAll(async () => { facts = (await loadServedUnemploymentData()).facts; });
test.each(["ka", "en"] as const)("renders the existing workspace, two chart types and national-only default in %s", async locale => {
  const messages = await getMessages(locale, ["unemployment", "common", "controls", "main", "format", "workbook"]);
  const markup = renderToStaticMarkup(<I18nProvider locale={locale} messages={messages}><UnemploymentExplorer section="overview" facts={facts} registry={UNEMPLOYMENT_GROUPS} sources={[]} lastReviewedAt="2026-10-03" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  expect(markup).toContain('data-testid="explorer-workspace"');
  expect(markup).toContain('data-testid="chart-mode-table"');
  expect(markup).not.toContain('data-testid="unemployment-indicator"');
  expect(markup).toContain('data-series-id="georgia:unemployment_rate"');
  expect(markup).toContain('data-series-id="georgia:employed"');
  expect(markup).not.toContain('data-series-id="georgia"');
  expect(markup).toContain('data-testid="unemployment-national-tabs"');
  expect(markup).not.toContain('data-testid="unemployment-headline"');
  const heading = markup.slice(0, markup.indexOf('data-testid="unemployment-national-tabs"'));
  expect(heading).toContain(messages["unemployment.page.overview.title"]);
  // Only the latest-value line sits under the heading; the summary stays the meta description (DESIGN §17).
  expect(heading).not.toContain(messages["unemployment.page.overview.summary"]);
  expect(heading).not.toContain(messages["unemployment.surveyEstimate"]);
  // Before the browser measures, each chart renders its desktop and its phone drawing (D1).
  expect(markup.match(/<svg[^>]*data-geometry="desktop"[^>]*role="img"/g)).toHaveLength(2);
  expect(markup.match(/<svg[^>]*data-geometry="mobile"[^>]*role="img"/g)).toHaveLength(2);
  expect(markup.match(/role="img"/g)).toHaveLength(4);
  expect(markup).toContain("13.9%");
  expect(markup).toContain("2010–2025");
  expect(markup).toContain('data-testid="unemployment-excel-download"');
  expect(markup).not.toMatch(/Amount \(GEL\)|თანხა \(₾\)/);
  expect(markup).toContain(locale === "en" ? "Survey estimates" : "კვლევის შეფასებები");
});

// U16-16: English age bands are number ranges with an en dash, as the Georgian labels and every year range print them.
test("the English age page prints its age bands with an en dash", async () => {
  const markup = renderPageMarkup("en", await renderUnemploymentPage("en", "age"));
  expect(markup).toContain(">15–19<");
  expect(markup).not.toMatch(/>\d+-\d+</);
});

// U17-11: the split-region note names five regions; the other regions' pages do not carry it.
test("a region page states the split-region note only where it applies", async () => {
  const note = "Separate Imereti and Racha-Lechkhumi";
  expect(renderPageMarkup("en", await renderUnemploymentPage("en", "regions", "region.imereti"))).toContain(note);
  expect(renderPageMarkup("en", await renderUnemploymentPage("en", "regions", "region.tbilisi"))).not.toContain(note);
});

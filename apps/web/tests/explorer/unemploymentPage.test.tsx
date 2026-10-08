import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { renderUnemploymentPage, unemploymentPageMetadata } from "../../lib/pages/unemployment";
import { DataSidebar } from "../../components/shell/data-sidebar";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import sitemap from "../../lib/seo/sitemap";
import GeorgianUnemploymentHub from "../../app/(ka)/explorer/unemployment/page";
import EnglishUnemploymentHub from "../../app/(en)/en/explorer/unemployment/page";

const navigation = vi.hoisted(() => ({ pathname: "/en/explorer/unemployment" }));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), usePathname: () => navigation.pathname, useRouter: () => ({ replace: () => {} }) }));

test.each(["ka", "en"] as const)("the %s landing page offers four cards in the approved order", async locale => {
  const markup = renderToStaticMarkup(await (locale === "ka" ? GeorgianUnemploymentHub() : EnglishUnemploymentHub()));
  expect(markup).toContain('data-testid="unemployment-hub"');
  const hrefs = [...markup.matchAll(/<a\b[^>]*data-testid="hub-card"[^>]*>/g)].map(match => /href="([^"]+)"/.exec(match[0])![1]);
  expect(hrefs).toEqual(["overview", "regions", "age", "gender"].map(section => `${locale === "en" ? "/en" : ""}/explorer/unemployment/${section}`));
  expect(markup).not.toContain('data-testid="unemployment-explorer"');
});

for (const [section, breakdown] of [["overview", "national"], ["age", "age"], ["gender", "sex"]] as const) test.each(["ka", "en"] as const)(`renders a static %s ${section} explorer with its own scope and metadata`, async locale => {
  const markup = renderToStaticMarkup(await renderUnemploymentPage(locale, section));
  expect(markup).toContain('data-testid="unemployment-explorer"');
  expect(markup).toContain(`data-breakdown="${breakdown}"`);
  expect(markup).not.toContain('data-testid="unemployment-breakdown"');
  expect(markup.includes('data-testid="unemployment-composition"')).toBe(section === "overview");
  expect(markup.includes('data-testid="unemployment-tab-education"')).toBe(section === "overview");
  expect(markup).toContain(section === "age" ? "2020–2025" : "2010–2025"); expect(markup).toContain("2026-10-03");
  const json = JSON.parse(/data-testid="explorer-dataset-json-ld"[^>]*>(.*?)<\/script>/.exec(markup)![1]);
  expect(json.temporalCoverage).toBe(section === "age" ? "2020/2025" : "2010/2025");
  expect(json.distribution).toBeUndefined(); expect(json.includedInDataCatalog).toBeUndefined();
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
test("localization and sitemap discover the explorer and its methodology in both languages", async () => {
  const paths = await listPublicPagePaths(); expect(paths).toContain("/explorer/unemployment"); expect(paths).toContain("/methodology/unemployment");
  const entries = await sitemap();
  for (const path of ["/explorer/unemployment", "/en/explorer/unemployment", "/methodology/unemployment", "/en/methodology/unemployment"]) expect(entries.some(entry => entry.url.endsWith(path))).toBe(true);
  for (const section of ["overview", "regions", "age", "gender"]) {
    expect(paths).toContain(`/explorer/unemployment/${section}`);
    for (const prefix of ["", "/en"]) expect(entries.some(entry => entry.url.endsWith(`${prefix}/explorer/unemployment/${section}`))).toBe(true);
  }
});

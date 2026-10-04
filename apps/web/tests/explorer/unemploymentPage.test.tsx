import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { renderUnemploymentPage, unemploymentPageMetadata } from "../../lib/pages/unemployment";
import { DataSidebar } from "../../components/shell/data-sidebar";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import sitemap from "../../lib/seo/sitemap";

vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), usePathname: () => "/en/explorer/unemployment" }));
test.each(["ka", "en"] as const)("renders a static %s explorer with real coverage and no unsupported dataset-download claim", async locale => {
  const markup = renderToStaticMarkup(await renderUnemploymentPage(locale));
  expect(markup).toContain('data-testid="unemployment-explorer"');
  expect(markup).toContain("2010–2025"); expect(markup).toContain("2026-10-03");
  const json = JSON.parse(/data-testid="explorer-dataset-json-ld"[^>]*>(.*?)<\/script>/.exec(markup)![1]);
  expect(json.temporalCoverage).toBe("2010/2025");
  expect(json.distribution).toBeUndefined(); expect(json.includedInDataCatalog).toBeUndefined();
  expect(markup).not.toContain("/downloads/data/unemployment");
  const metadata = await unemploymentPageMetadata(locale);
  expect(metadata.alternates?.canonical).toEqual(expect.stringContaining(locale === "en" ? "/en/explorer/unemployment" : "/explorer/unemployment"));
  expect(metadata.alternates?.languages).toMatchObject({ ka: expect.stringContaining("/explorer/unemployment"), en: expect.stringContaining("/en/explorer/unemployment") });
});
test("navigation activates unemployment and leaves demography as a marker", async () => {
  const markup = renderToStaticMarkup(<I18nProvider locale="en" messages={await getMessages("en", ["common", "controls"])}><DataSidebar /></I18nProvider>);
  expect(markup).toMatch(/<a[^>]+data-testid="unemployment-link"[^>]+aria-current="page"/);
  expect(markup).toContain('href="/en/explorer/unemployment"');
  expect(markup).not.toContain('href="/en/explorer/demography"');
  expect(markup).not.toContain('href="/en/explorer/expenditure"');
  const budgetLink = /<a[^>]+href="\/en\/explorer"[^>]*>/.exec(markup)![0];
  expect(budgetLink).not.toContain("border-[var(--accent)]");
});
test("localization and sitemap discover the explorer and its methodology in both languages", async () => {
  const paths = await listPublicPagePaths(); expect(paths).toContain("/explorer/unemployment"); expect(paths).toContain("/methodology/unemployment");
  const entries = await sitemap();
  for (const path of ["/explorer/unemployment", "/en/explorer/unemployment", "/methodology/unemployment", "/en/methodology/unemployment"]) expect(entries.some(entry => entry.url.endsWith(path))).toBe(true);
});

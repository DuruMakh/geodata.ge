import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { renderConnectPage } from "../../lib/pages/connect";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import * as packagedSnapshot from "../../lib/mcp/snapshot";

vi.mock("next/navigation", () => ({ usePathname: () => "/connect" }));
afterEach(() => vi.restoreAllMocks());

async function connectHtml(locale: "ka" | "en") {
  const messages = await getMessages(locale, ["common", "connect"]);
  return renderToStaticMarkup(<I18nProvider locale={locale} messages={messages}>{await renderConnectPage(locale)}</I18nProvider>);
}

test.each(["ka", "en"] as const)("Connect advertises national sector coverage and public files in %s", async locale => {
  const messages = await getMessages(locale, ["common", "connect"]);
  const html = renderToStaticMarkup(<I18nProvider locale={locale} messages={messages}>{await renderConnectPage(locale)}</I18nProvider>);
  const coverage = html.match(/data-testid="connect-sector-coverage">(.*?)<\/li>/)?.[1];
  expect(coverage).toContain("20");
  expect(coverage).toContain("2010–2025");
  expect(coverage).toContain("2011–2025");
  expect(html).toContain("query_economic_sectors");
  expect(html).toContain('href="/downloads/data/economic-sectors.json"');
  expect(html).toContain('href="/downloads/data/economic-sectors.csv"');
  expect(html).toContain(`href="${locale === "en" ? "/en" : ""}/methodology/economic-sectors"`);
  expect(coverage).not.toContain("{count}");
  if (locale === "en") expect(coverage).not.toMatch(/\p{Script=Georgian}/u);

  const regionalCoverage = html.match(/data-testid="connect-regional-coverage">(.*?)<\/li>/)?.[1];
  expect(regionalCoverage).toContain("11");
  expect(regionalCoverage).toContain("2010–2024");
  expect(html).toContain("query_regional_economies");
  expect(html).toContain('href="/downloads/data/regional-economies.json"');
  expect(html).toContain('href="/downloads/data/regional-economies.csv"');
  expect(html).toContain(`href="${locale === "en" ? "/en" : ""}/methodology/regional-economies"`);
  if (locale === "en") expect(regionalCoverage).not.toMatch(/\p{Script=Georgian}/u);
});

test.each(["ka", "en"] as const)("Connect advertises monthly inflation coverage and files in %s", async locale => {
  const messages = await getMessages(locale, ["common", "connect"]);
  const html = renderToStaticMarkup(<I18nProvider locale={locale} messages={messages}>{await renderConnectPage(locale)}</I18nProvider>);
  const coverage = html.match(/data-testid="connect-inflation-coverage">(.*?)<\/li>/)?.[1];
  expect(coverage).toContain("2013-01");
  expect(coverage).not.toContain("{");
  expect(html).toContain("query_inflation");
  for (const name of ["inflation-national.json", "inflation-categories.csv", "inflation-categories.json"]) {
    expect(html).toContain(`href="/downloads/data/${name}"`);
  }
  expect(html).toContain(`href="${locale === "en" ? "/en" : ""}/methodology/inflation"`);
  if (locale === "en") expect(coverage).not.toMatch(/\p{Script=Georgian}/u);
});

test.each(["ka", "en"] as const)("Connect includes real national, city and product examples with calculation limits in %s", async locale => {
  const html = await connectHtml(locale);
  const item = (id: string) => html.match(new RegExp(`data-testid="connect-example-${id}">(.*?)</li>`))?.[1] ?? "";
  expect(item("inflation-national")).toContain("2026-08");
  expect(item("inflation-cities")).toContain("2026-08");
  expect(item("inflation-cities")).toContain("6");
  expect(item("inflation-batumi")).toContain("2026-07");
  expect(item("inflation-batumi")).toContain("2026-08");
  expect(item("inflation-batumi")).toMatch(/percentage points|პროცენტული პუნქტ/);
  expect(item("products-annual")).toContain("2026-08");
  expect(item("products-cumulative")).toContain("2015-01");
  expect(item("products-cumulative")).toContain("2026-08");
  expect(item("products-cumulative")).toContain("2014-12");
  const products = html.match(/data-testid="connect-product-coverage">(.*?)<\/li>/)?.[1];
  expect(products).toContain("305");
  expect(products).toContain("2015-01–2026-08");
  expect(html).toContain("query_inflation_products");
  for (const name of ["inflation-products.csv", "inflation-products.json"]) expect(html).toContain(`href="/downloads/data/${name}"`);
  expect(item("products-cumulative")).toMatch(/December|დეკემბ/);
  expect(html).toContain("1.5.0");
  expect(html).toContain("2026-07-28");
  expect(html).toContain("2025-11-25");
  expect(html).not.toContain("Codex / ChatGPT");
  expect(html).toContain('href="https://learn.chatgpt.com/docs/extend/mcp?surface=cli"');
  expect(html).toContain('href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp"');
  expect(html).toContain('data-testid="connect-copy-prompt"');
  if (locale === "en") expect(products).not.toMatch(/\p{Script=Georgian}/u);
});

test("Connect examples move with the loaded facts rather than retaining the release month", async () => {
  const snapshot = packagedSnapshot.loadPackagedSnapshot();
  vi.spyOn(packagedSnapshot, "loadPackagedSnapshot").mockReturnValue({
    ...snapshot,
    inflation: { ...snapshot.inflation,
      facts: snapshot.inflation.facts.filter(fact => fact.period <= "2025-12"),
      categories: snapshot.inflation.categories.filter(fact => fact.period <= "2025-12"),
      cities: snapshot.inflation.cities.filter(fact => fact.period <= "2025-12"),
    },
    inflationProducts: { ...snapshot.inflationProducts, facts: snapshot.inflationProducts.facts.filter(fact => fact.period <= "2025-12") },
  });
  const html = await connectHtml("en");
  const examples = (html.match(/data-testid="connect-example-[^"]+">(.*?)<\/li>/g) ?? []).join(" ");
  expect(examples).toContain("2025-12");
  expect(examples).toContain("2025-11");
  expect(examples).not.toContain("2026-08");
  expect(examples).toContain("2014-12");
});

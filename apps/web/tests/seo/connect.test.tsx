import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { renderConnectPage } from "../../lib/pages/connect";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";

vi.mock("next/navigation", () => ({ usePathname: () => "/connect" }));

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

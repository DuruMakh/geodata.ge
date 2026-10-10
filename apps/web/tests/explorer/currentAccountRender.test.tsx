import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { loadCurrentAccountFacts, toClientCurrentAccountFacts } from "../../lib/data/externalFlows/importCurrentAccount";

const gdpRows = parse(readFileSync(path.resolve(process.cwd(), "../../data/imports/gdp-overview-annual.csv")), { columns: true, bom: true }) as Record<string, string>[];
const gdp = gdpRows.filter(row => row.series_id === "nominal_usd").map(row => ({ year: Number(row.year), valueUsd: Number(row.value), preliminary: row.status === "preliminary" }));
async function p(locale: "en" | "ka") { return { locale, englishLabels: {}, messages: await getMessages(locale, ["external", "controls", "main", "format", "common"]) }; }

test.each(["en", "ka"] as const)("renders %s defaults: the Balance tab, a stacked chart with a five-row key, one intro line and one source line", async locale => {
  const { CurrentAccount } = await import("../../components/external/current-account");
  const presentation = await p(locale), facts = toClientCurrentAccountFacts(await loadCurrentAccountFacts());
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><CurrentAccount facts={facts} gdp={gdp} sources={[]} lastReviewedAt="2026-10-10" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  expect(html).toContain('data-tab="balance"');
  for (const tab of ["balance", "in", "out"]) expect(html).toContain(`data-testid="current-account-tab-${tab}"`);
  expect(html).toContain(`aria-label="${presentation.messages["external.account.balanceAria"]}"`);
  const key = html.slice(html.indexOf('data-testid="current-account-key"'), html.indexOf('data-testid="current-account-excel-download"'));
  expect(key.match(/data-series-id=/g)).toHaveLength(5);
  expect(key).not.toContain("aria-pressed");
  expect(html.replaceAll("&#x27;", "'")).toContain(presentation.messages["external.account.intro"]);
  expect(html.match(/data-testid="source-label"/g)).toHaveLength(1);
  expect(html).toContain('data-testid="measure-share-toggle"');
  expect(html).not.toMatch(/GEL|₾/);
});

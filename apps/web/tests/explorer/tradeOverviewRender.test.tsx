import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { TradeOverview } from "../../components/trade/trade-overview";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import { tradeFixtureFacts } from "../data/tradeOverview/fixtures";
test.each(["en", "ka"] as const)("renders %s four ordered checkboxes with one checked total and independent context", async locale => {
  const html = renderToStaticMarkup(<I18nProvider locale={locale} englishLabels={{}} messages={await getMessages(locale, ["trade", "controls", "format", "main"])}><TradeOverview facts={tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) }))} sources={[]} lastReviewedAt="2026-10-08" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  const ids = ["trade.turnover", "trade.exports", "trade.imports", "trade.balance"];
  const positions = ids.map(id => html.indexOf(`data-series-id="${id}"`));
  expect(positions.every(position => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  const selection = html.slice(html.indexOf('data-testid="series-list"'), html.indexOf('data-testid="trade-excel-download"'));
  expect(selection.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(html).toContain('data-testid="trade-summary"');
  expect(html).toContain('data-testid="trade-balance-context"');
  expect(html).toContain('data-end-year="2025"');
  expect(html).not.toMatch(/GEL|₾|GDP/);
});

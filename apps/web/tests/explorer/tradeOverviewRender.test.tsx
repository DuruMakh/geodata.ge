import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { TradeOverview } from "../../components/trade/trade-overview";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import { tradeFixtureFacts } from "../data/tradeOverview/fixtures";
test.each(["en", "ka"] as const)("renders %s four ordered checkboxes without lari or GDP wording", async locale => {
  const html = renderToStaticMarkup(<I18nProvider locale={locale} englishLabels={{}} messages={await getMessages(locale, ["trade", "controls", "format", "main"])}><TradeOverview facts={tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) }))} sources={[]} lastReviewedAt="2026-10-08" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  const ids = ["trade.turnover", "trade.exports", "trade.imports", "trade.balance"];
  const positions = ids.map(id => html.indexOf(`data-series-id="${id}"`));
  expect(positions.every(position => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(html).not.toMatch(/GEL|₾|GDP/);
});

// U21-08: line-chart amount ticks show numbers only (DESIGN.md §28.1), as on Partners; the unit is said once above.
test("the overview line chart's ticks print numbers only", async () => {
  const html = renderToStaticMarkup(<I18nProvider locale="en" englishLabels={{}} messages={await getMessages("en", ["trade", "controls", "format", "main"])}><TradeOverview facts={tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) }))} sources={[]} lastReviewedAt="2026-10-08" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  expect(html).toContain('data-geometry="desktop"');
  // The phone chart keeps its one axis caption naming the unit.
  expect(html).not.toMatch(/<text(?![^>]*data-unit-caption)[^>]*>[^<]*USD<\/text>/);
});

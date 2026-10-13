import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { loadTradeServicesData, toClientTradeServicesData } from "../../lib/data/tradeServices/importTradeServices";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { TradeServices } from "../../components/trade/trade-services";
import { TradePartners } from "../../components/trade/trade-partners";
import { TradePartnersRanking } from "../../components/trade/trade-partners-ranking";
import { buildTradePartnersModel } from "../../lib/explorer/tradePartners";
import { parseTradePartnersHash } from "../../lib/explorer/tradePartnersState";

test.each(["en", "ka"] as const)("services %s has one heading, overview and four measure tabs, and a twelve-type ranking", async locale => {
  const data = toClientTradeServicesData(await loadTradeServicesData()), presentation = { locale, englishLabels: data.englishLabels, messages: await getMessages(locale, ["trade", "controls", "main", "format", "common"]) };
  const props = { sources: [], lastReviewedAt: "2026-10-11", siteOrigin: "https://fiscal.ge" };
  const page = renderToStaticMarkup(<I18nProvider {...presentation}><TradeServices data={data} {...props} /></I18nProvider>);
  expect(page.match(/<h1/g)).toHaveLength(1);
  expect(page).toContain('data-testid="trade-services-section-overview"');
  for (const measure of ["trade.turnover", "trade.exports", "trade.imports", "trade.balance"]) {
    expect(page).toContain(`data-testid="trade-services-section-${measure}"`);
  }
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><TradePartners data={data.types} {...props} /></I18nProvider>);
  expect(html.match(/data-testid="trade-partners-ranking-row"/g)).toHaveLength(12);
  expect(html).toContain('data-series-id="services.total"');
  expect(html).not.toMatch(/goods.total|FOB|CIF|data-testid="trade-partners-tab-|data-testid="trade-partners-show-all"/);
  expect(page).not.toMatch(/FOB|CIF|goods.total/);
  const selection = html.slice(html.indexOf('data-testid="series-list"'), html.indexOf('data-testid="trade-partners-excel-download"'));
  expect(selection.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(selection.match(/data-series-id=/g)).toHaveLength(13);
  const state = parseTradePartnersHash("#measure=trade.exports&start=2020&end=2020", data.types), model = buildTradePartnersModel(data.types, state, presentation);
  const ranking = renderToStaticMarkup(<I18nProvider {...presentation}><TradePartnersRanking model={model} tab="types" measure="trade.exports" /></I18nProvider>);
  expect(ranking.match(/data-testid="trade-partners-ranking-row"/g)).toHaveLength(11);
  expect(ranking.match(/data-testid="trade-partners-unavailable-row"/g)).toHaveLength(1);
  expect(ranking).toContain("—");
});

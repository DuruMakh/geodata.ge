import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { I18nProvider } from "../../lib/i18n/provider";
import { TradePartners } from "../../components/trade/trade-partners";
import { TradePartnersRanking } from "../../components/trade/trade-partners-ranking";
import { buildTradePartnersModel } from "../../lib/explorer/tradePartners";
import { parseTradePartnersHash } from "../../lib/explorer/tradePartnersState";
import { compositionFixture, compositionPresentation } from "./tradeCompositionFixtures";

test.each(["en", "ka"] as const)("%s composition embeds flow controls below search with one removable total and complete ranking", async locale => {
  for (const classification of ["sitc", "bec"] as const) {
    const data = compositionFixture(classification), p = await compositionPresentation(locale, data);
    const html = renderToStaticMarkup(<I18nProvider {...p}><TradePartners data={data} sources={[]} lastReviewedAt="2026-10-14" siteOrigin="https://fiscal.ge" /></I18nProvider>);
    expect(html).not.toMatch(/<h1|trade-partners-tab-|trade-partners-group-note|trade-partners-off-tab|trade-partners-show-all/);
    expect(html.indexOf('data-testid="series-search"')).toBeLessThan(html.indexOf('data-testid="trade-partners-measure-trade.exports"'));
    expect(html).not.toMatch(/trade-partners-measure-trade.(balance|turnover)/);
    const list = html.slice(html.indexOf('data-testid="series-list"'), html.indexOf('data-testid="trade-partners-excel-download"'));
    expect(list.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(list.match(/data-series-id=/g)).toHaveLength(data.entities.length + 1);
    expect(html.match(/data-testid="trade-partners-ranking-row"/g)).toHaveLength(data.entities.length);
    for (const measure of ["trade.exports", "trade.imports"] as const) {
      data.facts = data.facts.map(([entity, year, flow, value]) => [entity, year, flow, entity === 0 ? -2 : entity === 1 ? null : value]);
      const model = buildTradePartnersModel(data, parseTradePartnersHash(`#sel=&measure=${measure}`, data), p);
      const ranking = renderToStaticMarkup(<I18nProvider {...p}><TradePartnersRanking model={model} tab="categories" measure={measure} /></I18nProvider>);
      expect(ranking.match(/data-testid="trade-partners-ranking-row"/g)).toHaveLength(data.entities.length - 1);
      expect(ranking.match(/data-testid="trade-partners-unavailable-row"/g)).toHaveLength(1);
      expect(ranking).toContain('data-has-share="true"');
      expect(ranking).toContain('data-testid="trade-partners-zero-axis"');
      expect(ranking).not.toContain("Country");
    }
  }
});

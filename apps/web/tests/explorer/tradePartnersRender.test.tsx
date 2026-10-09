import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { toClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { buildTradePartnersModel } from "../../lib/explorer/tradePartners";
import { DEFAULT_TRADE_PARTNERS_STATE } from "../../lib/explorer/tradePartnersState";
import { tradePartnerEntities, tradePartnerFacts, tradePartnerNationalFacts } from "../data/tradePartners/fixtures";
const data = toClientTradePartnersData({ entities: tradePartnerEntities(), facts: tradePartnerFacts() }, tradePartnerNationalFacts());
const englishLabels = { "partner.1995-2025.643": "Russia", "partner.1995-2025.530": "Netherlands Antilles", "group.eu": "European Union (EU)", "group.oecd": "OECD" };
async function p(locale: "en" | "ka") { return { locale, englishLabels, messages: await getMessages(locale, ["trade", "controls", "main", "format", "common"]) }; }

test.each(["en", "ka"] as const)("renders %s total-only defaults and independent end-year ranking", async locale => {
  const { TradePartners } = await import("../../components/trade/trade-partners");
  const presentation = await p(locale);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><TradePartners data={data} sources={[]} lastReviewedAt="2026-10-08" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  const selection = html.slice(html.indexOf('data-testid="series-list"'), html.indexOf('data-testid="trade-partners-excel-download"'));
  expect(selection.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(selection.indexOf('data-series-id="goods.total"')).toBeLessThan(selection.indexOf('data-series-id="partner.1995-2025.643"'));
  expect(html).toContain('data-testid="trade-partners-ranking"');
  expect(html).toContain('data-end-year="2025"');
  expect(html).not.toMatch(/GEL|₾/);
});
test.each(["countries", "groups"] as const)("selected opposite-tab rows remain visible and removable while browsing %s", async tab => {
  const { TradePartnersSeriesPanel } = await import("../../components/trade/trade-partners-series-panel");
  const presentation = await p("en"), state = { ...DEFAULT_TRADE_PARTNERS_STATE, tab, selectedIds: ["partner.1995-2025.643", "group.eu"] };
  const model = buildTradePartnersModel(data, state, presentation);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><TradePartnersSeriesPanel data={data} state={state} model={model} onTabChange={() => {}} onSelectionChange={() => {}} downloadAction={<span />} /></I18nProvider>);
  expect(html).toContain('data-testid="trade-partners-off-tab"');
  expect(html).toContain('data-series-id="group.eu"'); expect(html).toContain('data-series-id="partner.1995-2025.643"');
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(3);
});
test("signed balance ranking has a neutral zero axis, values and no share column", async () => {
  const { TradePartnersRanking } = await import("../../components/trade/trade-partners-ranking");
  const presentation = await p("en"), state = { ...DEFAULT_TRADE_PARTNERS_STATE, measure: "trade.balance" as const };
  const model = buildTradePartnersModel(data, state, presentation);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><TradePartnersRanking model={model} tab="countries" measure="trade.balance" /></I18nProvider>);
  expect(html).toContain('data-has-share="false"');
  expect(html).toContain('data-testid="trade-partners-zero-axis"');
  expect(html).toContain("Trade balance"); expect(html).toContain("2025");
});

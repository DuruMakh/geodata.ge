import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { loadTradeServicesData, toClientTradeServicesData } from "../../lib/data/tradeServices/importTradeServices";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { TradeServices } from "../../components/trade/trade-services";
import { TradePartners } from "../../components/trade/trade-partners";

test.each(["en", "ka"] as const)("services %s names no goods total, FOB or CIF", async locale => {
  const data = toClientTradeServicesData(await loadTradeServicesData()), presentation = { locale, englishLabels: data.englishLabels, messages: await getMessages(locale, ["trade", "controls", "main", "format", "common"]) };
  const props = { sources: [], lastReviewedAt: "2026-10-11", siteOrigin: "https://fiscal.ge" };
  const page = renderToStaticMarkup(<I18nProvider {...presentation}><TradeServices data={data} {...props} /></I18nProvider>);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><TradePartners data={data.types} {...props} /></I18nProvider>);
  expect(html).not.toMatch(/goods.total|FOB|CIF/);
  expect(page).not.toMatch(/FOB|CIF|goods.total/);
});

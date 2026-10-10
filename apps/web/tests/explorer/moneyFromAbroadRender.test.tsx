import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { buildMoneyTransfersModel } from "../../lib/explorer/moneyTransfers";
import { DEFAULT_MONEY_TRANSFERS_STATE } from "../../lib/explorer/moneyTransfersState";
import { moneyTransferEntities, moneyTransferFacts } from "../data/externalFlows/fixtures";
const data = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() }, { 2019: 10_000 });
const englishLabels = { "transfer.total": "Money transfers, all countries", "bop.personal_transfers": "Personal transfers (official estimate)", "transfer.italy": "Italy", "transfer.sudan": "Sudan", "transfer.other_countries": "Other Countries" };
async function p(locale: "en" | "ka") { return { locale, englishLabels, messages: await getMessages(locale, ["external", "controls", "main", "format", "common"]) }; }

test.each(["en", "ka"] as const)("renders %s defaults: Received, the all-country total only, four figures and the ranking", async locale => {
  const { MoneyFromAbroad } = await import("../../components/external/money-from-abroad");
  const presentation = await p(locale);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><MoneyFromAbroad data={data} sources={[]} lastReviewedAt="2026-10-10" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  const selection = html.slice(html.indexOf('data-testid="series-list"'), html.indexOf('data-testid="money-from-abroad-excel-download"'));
  expect(selection.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(selection).toContain('data-series-id="transfer.total"');
  expect(html).toContain('data-measure="received"');
  expect(html.match(/data-testid="money-from-abroad-figure"/g)).toHaveLength(4);
  expect(html).toContain('data-testid="money-from-abroad-ranking"');
  expect(html).not.toMatch(/GEL|₾/);
});

test("figures show the end year, a dash for a missing value and the share of GDP", async () => {
  const { MoneyFromAbroadFigures } = await import("../../components/external/money-from-abroad");
  const presentation = await p("en"), model = buildMoneyTransfersModel(data, DEFAULT_MONEY_TRANSFERS_STATE, presentation);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><MoneyFromAbroadFigures figures={model.figures} /></I18nProvider>);
  expect(html).toContain("2019");
  expect(html).toContain("10.0%");
  expect(html).toContain("Personal transfers received (official estimate)");
  const sentHtml = renderToStaticMarkup(<I18nProvider {...presentation}><MoneyFromAbroadFigures figures={{ ...model.figures, sent: null }} /></I18nProvider>);
  expect(sentHtml).toContain("—");
});

test("the ranking marks partial months, lists remainders unranked and hides unavailable countries until expanded", async () => {
  const { MoneyFromAbroadRanking } = await import("../../components/external/money-from-abroad-ranking");
  const presentation = await p("en");
  const received = buildMoneyTransfersModel(data, DEFAULT_MONEY_TRANSFERS_STATE, presentation);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><MoneyFromAbroadRanking model={received} measure="received" /></I18nProvider>);
  expect(html.indexOf('data-entity-id="transfer.italy"')).toBeLessThan(html.indexOf('data-entity-id="transfer.sudan"'));
  expect(html).toContain("11 months");
  expect(html).toContain("60.0%");
  const sent = buildMoneyTransfersModel(data, { ...DEFAULT_MONEY_TRANSFERS_STATE, measure: "sent" }, presentation);
  const sentHtml = renderToStaticMarkup(<I18nProvider {...presentation}><MoneyFromAbroadRanking model={sent} measure="sent" /></I18nProvider>);
  expect(sentHtml).not.toContain('data-entity-id="transfer.sudan"');
  expect(sentHtml).toContain('data-testid="money-from-abroad-show-all"');
});

test("a 2008 range lists the 2007 remainder only when it has a value", async () => {
  const { MoneyFromAbroadRanking } = await import("../../components/external/money-from-abroad-ranking");
  const presentation = await p("en");
  const model = buildMoneyTransfersModel(data, { ...DEFAULT_MONEY_TRANSFERS_STATE, range: { kind: "manual", start: 2007, end: 2007 } }, presentation);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><MoneyFromAbroadRanking model={model} measure="received" /></I18nProvider>);
  expect(html).toContain('data-testid="money-from-abroad-remainder-row"');
  expect(html).toContain("Other Countries");
});

test.each(["georgia", "countries"] as const)("selected off-tab rows stay visible and removable while browsing %s", async tab => {
  const { MoneyFromAbroadSeriesPanel } = await import("../../components/external/money-from-abroad-series-panel");
  const presentation = await p("en"), state = { ...DEFAULT_MONEY_TRANSFERS_STATE, tab, selectedIds: ["transfer.total", "transfer.italy"] };
  const model = buildMoneyTransfersModel(data, state, presentation);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><MoneyFromAbroadSeriesPanel data={data} state={state} model={model} onTabChange={() => {}} onSelectionChange={() => {}} downloadAction={<span />} /></I18nProvider>);
  expect(html).toContain('data-testid="money-from-abroad-off-tab"');
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(3); // two selected rows and the active tab
});

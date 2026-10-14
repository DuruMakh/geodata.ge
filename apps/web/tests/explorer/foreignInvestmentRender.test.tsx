import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { toClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
import { buildForeignInvestmentModel } from "../../lib/explorer/foreignInvestment";
import { DEFAULT_FOREIGN_INVESTMENT_STATE } from "../../lib/explorer/foreignInvestmentState";
import { foreignInvestmentEntities, foreignInvestmentFacts } from "../data/externalFlows/fixtures";
const data = toClientForeignInvestmentData({ entities: foreignInvestmentEntities(), facts: foreignInvestmentFacts() });
const englishLabels = { "fdi.total": "Foreign direct investment, total", "fdi.country.m49_826": "United Kingdom", "fdi.country.unknown": "Unknown", "fdi.sector.k": "Financial and insurance activities", "fdi.region.guria": "Guria", "fdi.region.tbilisi": "Tbilisi" };
async function p(locale: "en" | "ka") { return { locale, englishLabels, messages: await getMessages(locale, ["external", "controls", "main", "format", "common"]) }; }

test.each(["en", "ka"] as const)("renders %s defaults: the country tab, the total only, no intro line and the ranking", async locale => {
  const { ForeignInvestment } = await import("../../components/external/foreign-investment");
  const presentation = await p(locale);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><ForeignInvestment data={data} sources={[]} lastReviewedAt="2026-10-10" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  const selection = html.slice(html.indexOf('data-testid="series-list"'), html.indexOf('data-testid="foreign-investment-excel-download"'));
  expect(selection.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(selection).toContain('data-series-id="fdi.total"');
  expect(html).toContain('data-dimension="country"');
  for (const tab of ["country", "sector", "region"]) expect(html).toContain(`data-testid="foreign-investment-tab-${tab}"`);
  // DESIGN §17: nothing but the heading above the controls.
  expect(html).not.toMatch(/<\/h1><p/);
  expect(html).toContain(presentation.messages["external.investment.sourceNote"]);
  expect(html).toContain('data-testid="foreign-investment-ranking"');
  expect(html).not.toMatch(/GEL|₾/);
});

// U23-04: the external series panels search with the site's one placeholder word (DESIGN.md §7.7).
test.each(["en", "ka"] as const)("the %s external series panel's search placeholder is the site's", async locale => {
  const { MoneyFromAbroadSeriesPanel } = await import("../../components/external/money-from-abroad-series-panel");
  const presentation = await p(locale);
  const series = Array.from({ length: 12 }, (_, index) => ({ id: `fdi.s${index}`, label: `S${index}`, color: "#1E1B16" }));
  const model = { series, selectedIds: [], valuesByEntity: Object.fromEntries(series.map(item => [item.id, { 2025: 1 }])), range: { start: 2025, end: 2025 }, unit: { divisor: 1, label: "USD", decimals: 0 }, selectedCount: 0, totalCount: 12 };
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><MoneyFromAbroadSeriesPanel model={model as never} totalId="fdi.s0" onSelectionChange={() => {}} downloadAction={null} /></I18nProvider>);
  expect(html).toMatch(new RegExp(`data-testid="series-search"[^>]*placeholder="${presentation.messages["controls.search"]}"`));
});

test("a negative value is ranked last with its sign and an empty bar; Other countries ends the country ranking", async () => {
  const { ExternalRanking } = await import("../../components/external/external-ranking");
  const presentation = await p("en");
  const model = buildForeignInvestmentModel(data, { ...DEFAULT_FOREIGN_INVESTMENT_STATE, range: { kind: "manual", start: 2015, end: 2015 } }, presentation);
  const html = renderToStaticMarkup(<I18nProvider {...presentation}><ExternalRanking testId="foreign-investment" title="Ranking" itemLabel="Country" shareLabel="Share" note="note" empty="none" rows={model.ranking} other={model.other} /></I18nProvider>);
  expect(html).toContain('data-entity-id="fdi.country.m49_826"');
  expect(html).toContain("−0.1");
  expect(html).toMatch(/data-testid="foreign-investment-bar"[^>]*width:0%/);
  expect(html.indexOf('data-entity-id="fdi.country.m49_826"')).toBeLessThan(html.indexOf('data-testid="foreign-investment-other-row"'));
});

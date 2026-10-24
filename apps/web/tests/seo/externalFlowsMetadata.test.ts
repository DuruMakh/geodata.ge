import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadServedCurrentAccountFacts, toClientCurrentAccountFacts } from "../../lib/data/externalFlows/importCurrentAccount";
import { loadServedForeignInvestmentData, toClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { currentAccountCoverage } from "../../lib/explorer/currentAccountState";
import { loadServedExternalPositionData, toClientExternalPositionFact } from "../../lib/data/externalPosition/importExternalPosition";
import { externalPositionCoverage, type ExternalPositionSectionId } from "../../lib/explorer/externalPosition";
import { foreignInvestmentCoverage } from "../../lib/explorer/foreignInvestmentState";
import { moneyTransfersCoverage } from "../../lib/explorer/moneyTransfersState";
import { message } from "../../lib/i18n/messages";
import { getMessages } from "../../lib/i18n/messages.server";
import {
  currentAccountMetadata, externalPositionMetadata, foreignInvestmentMetadata, moneyFromAbroadMetadata,
  renderCurrentAccountPage, renderExternalPositionPage, renderForeignInvestmentPage, renderMoneyFromAbroadPage,
} from "../../lib/pages/external";
import { groupPageMetadata } from "../../lib/pages/group";
import { renderPageMarkup } from "../helpers/render-localized";

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge"));
afterAll(() => vi.unstubAllEnvs());

// U23-16: the External flows pages' own metadata and Dataset record, in both languages, with the years each
// page covers (read through the same loaders and coverage rules as the page). The payload side (no withheld ids)
// is in tests/explorer/pagePayloadPrivacy.test.tsx; the sitemap-wide Dataset contract in tests/seo/structuredData.test.ts.
/** Foreign debt and Reserves share one page function; the section picks the page. */
const positionPage = (section: ExternalPositionSectionId, key: "debt" | "reserves") => ({
  path: `/explorer/external/${section}`, key, titleKey: "metaTitle",
  metadata: (locale: "ka" | "en") => externalPositionMetadata(locale, section), render: (locale: "ka" | "en") => renderExternalPositionPage(locale, section),
  coverage: async () => externalPositionCoverage(section, "amount", (await loadServedExternalPositionData()).facts.map(toClientExternalPositionFact).filter(f => f.indicatorId.startsWith(key === "debt" ? "ext_debt." : "reserves.")), []),
});
const PAGES = [
  {
    path: "/explorer/external/money-from-abroad", key: "money", metadata: moneyFromAbroadMetadata, render: renderMoneyFromAbroadPage,
    coverage: async () => moneyTransfersCoverage(toClientMoneyTransfersData(await loadServedMoneyTransfersData())),
  },
  {
    path: "/explorer/external/foreign-investment", key: "investment", metadata: foreignInvestmentMetadata, render: renderForeignInvestmentPage,
    coverage: async () => foreignInvestmentCoverage(toClientForeignInvestmentData(await loadServedForeignInvestmentData()), "country"),
  },
  {
    path: "/explorer/external/current-account", key: "account", metadata: currentAccountMetadata, render: renderCurrentAccountPage,
    coverage: async () => currentAccountCoverage(toClientCurrentAccountFacts(await loadServedCurrentAccountFacts())),
  },
  positionPage("foreign-debt", "debt"),
  positionPage("reserves", "reserves"),
] as const;

describe.each(["ka", "en"] as const)("External flows pages name themselves and their years: %s", (locale) => {
  it.each(PAGES)("$path", async (page) => {
    const { path, key, metadata: pageMetadata, render, coverage } = page, titleKey = "titleKey" in page ? page.titleKey : "title";
    const [messages, metadata, { min, max }] = await Promise.all([getMessages(locale, ["external"]), pageMetadata(locale), coverage()]);
    const url = `https://fiscal.ge${locale === "en" ? "/en" : ""}${path}`;
    expect(metadata.title).toContain(message(messages, `external.${key}.${titleKey}`));
    expect(metadata.description).toBe(`${message(messages, `external.${key}.summary`)} ${min}–${max}.`);
    expect(metadata.alternates?.canonical).toBe(url);

    const html = renderPageMarkup(locale, await render(locale));
    const dataset = JSON.parse(html.match(/<script[^>]*data-testid="explorer-dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]);
    expect(dataset).toMatchObject({ name: message(messages, `external.${key}.title`), url, temporalCoverage: `${min}/${max}` });
    expect(dataset.variableMeasured.length).toBeGreaterThan(0);
  });
});

// U23-10: the hub's search description named its pages. The hub is the External sector group page now (spec
// 2026-10-24-explorer-regroup §5), and its description names trade beside the external flows.
it.each(["ka", "en"] as const)("the External sector page's description names trade and the external flows: %s", (locale) => {
  const { description } = groupPageMetadata("external", locale);
  for (const term of locale === "en" ? ["trade", "remittances", "foreign investment", "foreign debt", "reserves"] : ["საგარეო ვაჭრობა", "ფულადი გზავნილები", "უცხოური ინვესტიციები", "საგარეო ვალი", "რეზერვები"]) {
    expect(description).toContain(term);
  }
});

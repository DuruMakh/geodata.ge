import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadServedCurrentAccountFacts, toClientCurrentAccountFacts } from "../../lib/data/externalFlows/importCurrentAccount";
import { loadServedForeignInvestmentData, toClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { currentAccountCoverage } from "../../lib/explorer/currentAccountState";
import { foreignInvestmentCoverage } from "../../lib/explorer/foreignInvestmentState";
import { moneyTransfersCoverage } from "../../lib/explorer/moneyTransfersState";
import { message } from "../../lib/i18n/messages";
import { getMessages } from "../../lib/i18n/messages.server";
import {
  currentAccountMetadata, foreignInvestmentMetadata, moneyFromAbroadMetadata,
  renderCurrentAccountPage, renderForeignInvestmentPage, renderMoneyFromAbroadPage,
} from "../../lib/pages/external";
import { renderPageMarkup } from "../helpers/render-localized";

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge"));
afterAll(() => vi.unstubAllEnvs());

// U23-16: the three External flows pages' own metadata and Dataset record, in both languages, with the years each
// page covers (read through the same loaders and coverage rules as the page). The payload side (no withheld ids)
// is in tests/explorer/pagePayloadPrivacy.test.tsx; the sitemap-wide Dataset contract in tests/seo/structuredData.test.ts.
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
] as const;

describe.each(["ka", "en"] as const)("External flows pages name themselves and their years: %s", (locale) => {
  it.each(PAGES)("$path", async ({ path, key, metadata: pageMetadata, render, coverage }) => {
    const [messages, metadata, { min, max }] = await Promise.all([getMessages(locale, ["external"]), pageMetadata(locale), coverage()]);
    const url = `https://fiscal.ge${locale === "en" ? "/en" : ""}${path}`;
    expect(metadata.title).toContain(message(messages, `external.${key}.title`));
    expect(metadata.description).toBe(`${message(messages, `external.${key}.summary`)} ${min}–${max}.`);
    expect(metadata.alternates?.canonical).toBe(url);

    const html = renderPageMarkup(locale, await render(locale));
    const dataset = JSON.parse(html.match(/<script[^>]*data-testid="explorer-dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]);
    expect(dataset).toMatchObject({ name: message(messages, `external.${key}.title`), url, temporalCoverage: `${min}/${max}` });
    expect(dataset.variableMeasured.length).toBeGreaterThan(0);
  });
});

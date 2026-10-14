import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData } from "../../lib/data/servedData";
import { message } from "../../lib/i18n/messages";
import { getMessages } from "../../lib/i18n/messages.server";
import { debtPageMetadata } from "../../lib/pages/debt";
import { deficitPageMetadata } from "../../lib/pages/deficit";
import { coverageFromYears, generalGovernmentDeficitMetadata, governmentDebtMetadata } from "../../lib/seo/metadata";

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge"));
afterAll(() => vi.unstubAllEnvs());

// The Georgian title and description used to be a second, hand-written copy of
// the debt.* and deficit.* messages; both languages now read the message files.
describe.each(["ka", "en"] as const)("debt and deficit metadata come from the message files: %s", (locale) => {
  it("debt quotes actual stock coverage through debt.metaTitle and debt.description", async () => {
    const { facts } = await loadServedGovernmentDebtData();
    const { firstYear, lastYear } = coverageFromYears(facts.filter((fact) => fact.family === "stock" && fact.status === "actual"));
    const messages = await getMessages(locale, ["debt"]);
    const metadata = await debtPageMetadata(locale);
    expect(metadata.title).toBe(message(messages, "debt.metaTitle", { first: firstYear, last: lastYear }));
    expect(metadata.description).toBe(message(messages, "debt.description", { first: firstYear, last: lastYear }));
    expect(metadata.alternates?.canonical).toBe(`https://fiscal.ge${locale === "en" ? "/en" : ""}/explorer/debt`);
  });

  it("deficit quotes actual coverage through deficit.metaTitle and deficit.description", async () => {
    const { facts } = await loadServedGeneralGovernmentBalanceData();
    const { firstYear, lastYear } = coverageFromYears(facts.filter((fact) => fact.status === "actual"));
    const messages = await getMessages(locale, ["deficit"]);
    const metadata = await deficitPageMetadata(locale);
    expect(metadata.title).toBe(message(messages, "deficit.metaTitle", { first: firstYear, last: lastYear }));
    expect(metadata.description).toBe(message(messages, "deficit.description", { first: firstYear, last: lastYear }));
    expect(metadata.alternates?.canonical).toBe(`https://fiscal.ge${locale === "en" ? "/en" : ""}/explorer/deficit`);
  });
});

describe("one metadata builder per page for both languages", () => {
  it("builds the English debt and deficit metadata through the same coverage rule", () => {
    const debt = governmentDebtMetadata([
      { year: 2013, family: "stock", status: "actual" },
      { year: 2025, family: "stock", status: "actual" },
      { year: 2030, family: "service", status: "projection_existing_portfolio" },
    ], "en");
    expect(debt.title).toBe("Georgia government debt 2013–2025 | Fiscal.ge");
    expect(debt.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/debt");
    const deficit = generalGovernmentDeficitMetadata([
      { year: 1995, status: "actual" },
      { year: 2025, status: "actual" },
      { year: 2031, status: "projection" },
    ], "en");
    expect(deficit.title).toBe("Georgia general government deficit 1995–2025 | Fiscal.ge");
    expect(deficit.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/deficit");
  });
});

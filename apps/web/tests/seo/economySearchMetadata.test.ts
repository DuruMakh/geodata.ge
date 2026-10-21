import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { gdpPageMetadata, renderGdpPage } from "../../lib/pages/gdp";
import { economicSectorsPageMetadata, renderEconomicSectorsPage } from "../../lib/pages/economic-sectors";
import { economyPageMetadata } from "../../lib/pages/economy";
import { getMethodologyContent } from "../../lib/methodology/catalog";
import { message } from "../../lib/i18n/messages";
import { getMessages } from "../../lib/i18n/messages.server";
import { renderPageMarkup } from "../helpers/render-localized";

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge"));
afterAll(() => vi.unstubAllEnvs());

test.each(["ka", "en"] as const)("GDP search metadata identifies the country and measures independently of methodology: %s", async (locale) => {
  const metadata = await gdpPageMetadata(locale);
  const title = String(metadata.title);
  for (const term of locale === "en" ? ["Georgia", "GDP", "growth", "per capita"] : ["საქართველოს", "მშპ", "ზრდა", "ერთ სულ მოსახლეზე"]) {
    expect(title).toContain(term);
  }
  expect(metadata.description).toContain(locale === "en" ? "Compare" : "შეადარე");
  expect(metadata.description).toContain("Excel");
  expect(metadata.description).not.toBe(getMethodologyContent("gdp", locale).summary);
});

test.each(["ka", "en"] as const)("sector search metadata describes Georgia's sector comparison and download: %s", async (locale) => {
  const metadata = await economicSectorsPageMetadata(locale);
  const title = String(metadata.title);
  for (const term of locale === "en" ? ["Georgia", "GDP", "sector"] : ["საქართველოს", "მშპ", "სექტორ"]) {
    expect(title).toContain(term);
  }
  expect(metadata.description).toContain(locale === "en" ? "Compare" : "შეადარე");
  expect(metadata.description).toContain(locale === "en" ? "real growth" : "რეალური ზრდა");
  expect(metadata.description).toContain("Excel");
});

// U10-15, U11-08: each page's Dataset is named as its search result is, and the sectors Dataset is described by the
// page's meta description rather than a fragment of the measure note.
test.each(["ka", "en"] as const)("GDP and sector Datasets carry the page's search title: %s", async (locale) => {
  for (const [pageMetadata, render] of [[gdpPageMetadata, renderGdpPage], [economicSectorsPageMetadata, renderEconomicSectorsPage]] as const) {
    const metadata = await pageMetadata(locale);
    const html = renderPageMarkup(locale, await render(locale));
    const dataset = JSON.parse(html.match(/<script[^>]*data-testid="explorer-dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]);
    expect(`${dataset.name} | Fiscal.ge`).toBe(metadata.title);
    if (render === renderEconomicSectorsPage) expect(dataset.description).toBe(metadata.description);
  }
});

// U28-12: the Economy hub's snippet names its three sections, not only the one-line lead under its heading.
test.each(["ka", "en"] as const)("the Economy hub's search description names GDP, sectors and regions: %s", async (locale) => {
  const metadata = await economyPageMetadata(locale);
  const lead = message(await getMessages(locale, ["gdp"]), "gdp.hubDescription");
  expect(metadata.description).not.toBe(lead);
  for (const term of locale === "en" ? ["GDP", "sector", "regional"] : ["მშპ", "სექტორ", "რეგიონ"]) expect(metadata.description).toContain(term);
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TopicHub } from "../../lib/pages/hub";
import type { HubCardModel } from "../../lib/explorer/hubCards";

const presentation = { locale: "en" as const, messages: { "common.home": "Home", "common.data": "Data", "common.breadcrumb": "Breadcrumb" }, englishLabels: {} };
const card = (index: string): HubCardModel => ({ index, title: `Card ${index}`, description: "About it", href: `/explorer/example/${index}`, comingSoon: false, series: null, seriesColor: null, footer: null });

function render(props: Partial<Parameters<typeof TopicHub>[0]> = {}) {
  return renderToStaticMarkup(
    <TopicHub locale="en" presentation={presentation} title="Example topic" summary="What this hub covers." path="/explorer/example" coverage="" cards={[card("01"), card("02")]} testId="example-hub" {...props} />,
  );
}

describe("TopicHub", () => {
  it("renders the hub cards under the heading and summary", () => {
    const html = render();
    expect(html.match(/data-testid="hub-card"/g) ?? []).toHaveLength(2);
    expect(html).toContain('data-testid="example-hub"');
    expect(html).toContain("What this hub covers.");
    expect(html).toMatch(/<h1[^>]*>Example topic<\/h1>/);
  });

  it("emits one breadcrumb JSON-LD block ending at the hub", () => {
    const html = render();
    const scripts = html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/g) ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain("Example topic");
  });

  it("omits the breadcrumb JSON-LD when asked", () => {
    expect(render({ breadcrumb: false })).not.toContain("application/ld+json");
  });

  it("labels the breadcrumb with crumbLabel while the heading keeps the title", () => {
    const html = render({ crumbLabel: "Example" });
    expect(html).toMatch(/<h1[^>]*>Example topic<\/h1>/);
    expect(html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/)![0]).toContain('"Example"');
  });
});

// U28-06: every hub's header names its coverage and update date; trade, external and demography printed nothing there.
it.each([
  ["trade", async () => (await import("../../lib/pages/hubs/trade")).renderTradeHub("en")],
  ["external", async () => (await import("../../lib/pages/hubs/external")).renderExternalHub("en")],
  ["demography", async () => (await import("../../lib/pages/demography")).renderDemographyPage("en")],
] as const)("the %s hub's header states its coverage", async (_name, render) => {
  const { renderPageMarkup } = await import("../helpers/render-localized");
  const html = renderPageMarkup("en", (await render()) as never);
  expect(html).toMatch(/\d{4}–\d{4} · Updated \d{1,2} [A-Z][a-z]+ \d{4}/);
});

// U28-10: one wording for the hub cards' "annual" suffix, and the typographic apostrophe in the hub texts.
it.each(["ka", "en"] as const)("the %s hub cards say \"annual data\" one way", async (locale) => {
  const { getMessages } = await import("../../lib/i18n/messages.server");
  const messages = await getMessages(locale, ["trade", "external", "wages", "unemployment", "inflation", "demography"]);
  for (const key of ["trade.annual", "external.annual", "unemployment.annual"]) expect(messages[key], key).toBe(messages["wages.annual"]);
  if (locale === "en") for (const key of ["trade.services.summary", "external.account.summary", "inflation.cardCitiesDescription", "demography.hubDescription"]) expect(messages[key], key).not.toContain("'");
});

// U28-19: the English trade heading names what the Georgian one does, and English says "sex" as demography does.
it("English names trade and sex as the Georgian does", async () => {
  const { getMessages } = await import("../../lib/i18n/messages.server");
  const messages = await getMessages("en", ["trade", "unemployment", "wages", "common"]);
  expect(messages["trade.hubTitle"]).toBe("External trade");
  for (const key of ["common.unemploymentGender", "unemployment.hubSummary", "unemployment.page.gender.title", "wages.metaDescription"]) expect(messages[key], key).not.toMatch(/gender/i);
});

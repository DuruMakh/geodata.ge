import { describe, expect, it, vi } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { buildLandingDatasetLinks, landingGdpFigure } from "../../lib/landing/landingDatasets";

const input = {
  expenditure: { latestYear: 2025, totalGel: 27_700_000_000 },
  gdpFacts: [
    { seriesId: "nominal_gel" as const, year: 2024, value: 91_900_000_000 },
    { seriesId: "nominal_gel" as const, year: 2025, value: 104_600_000_000 },
    { seriesId: "real_usd_2015" as const, year: 2026, value: 27_100_000_000 },
  ],
  cpiFacts: [
    { seriesId: "cpi.headline", measure: "yoy_pct" as const, period: "2026-07", value: 4.1 },
    { seriesId: "cpi.headline", measure: "yoy_pct" as const, period: "2026-08", value: 5.6 },
    { seriesId: "cpi.headline", measure: "mom_pct" as const, period: "2026-09", value: 0.4 },
    { seriesId: "cpi.core", measure: "yoy_pct" as const, period: "2026-09", value: 3 },
  ],
  unemploymentFacts: [
    { dimension: "national" as const, indicatorId: "unemployment_rate", year: 2024, value: 13.9 },
    { dimension: "national" as const, indicatorId: "unemployment_rate", year: 2025, value: 13.2 },
    { dimension: "region" as const, indicatorId: "unemployment_rate", year: 2026, value: 20 },
    { dimension: "national" as const, indicatorId: "employment_rate", year: 2026, value: 50 },
  ],
  tradeFacts: [
    { indicatorId: "trade.turnover" as const, year: 2024, valueUsd: 21_100_000_000 },
    { indicatorId: "trade.turnover" as const, year: 2025, valueUsd: 22_400_000_000 },
    { indicatorId: "trade.exports" as const, year: 2026, valueUsd: 7_000_000_000 },
  ],
};

describe("buildLandingDatasetLinks", () => {
  it("links the five hubs with each one's latest served figure", async () => {
    const messages = await getMessages("ka", ["common", "landing", "inflation", "trade"]);
    const links = buildLandingDatasetLinks(input as Parameters<typeof buildLandingDatasetLinks>[0], { locale: "ka", messages });
    expect(links.map(({ href, title }) => [href, title])).toEqual([
      ["/explorer", "ბიუჯეტი"],
      ["/explorer/economy", "ეკონომიკა"],
      ["/explorer/inflation", "ინფლაცია"],
      ["/explorer/unemployment", "უმუშევრობა"],
      ["/explorer/trade", "საგარეო ვაჭრობა"],
    ]);
    expect(links.map(({ measure, period, value }) => `${measure} · ${period}: ${value}`)).toEqual([
      "ხარჯები · 2025: 27.7 მლრდ ₾",
      "ნომინალური მშპ · 2025: 104.6 მლრდ ₾",
      expect.stringMatching(/^წლიური ინფლაცია · \S+ 2026: 5\.6%$/),
      "უმუშევრობის დონე · 2025: 13.2%",
      "საგარეო სავაჭრო ბრუნვა · 2025: 22.4 მლრდ აშშ დოლარი",
    ]);
  });

  it("speaks English on /en", async () => {
    const messages = await getMessages("en", ["common", "landing", "inflation", "trade"]);
    const links = buildLandingDatasetLinks(input as Parameters<typeof buildLandingDatasetLinks>[0], { locale: "en", messages });
    expect(links.map(({ title }) => title)).toEqual(["Budget", "Economy", "Inflation", "Unemployment", "Trade"]);
    expect(links[2]).toMatchObject({ measure: "Annual inflation", period: "Aug 2026", value: "5.6%" });
  });

  it("refuses to render a row without served data rather than invent a figure", async () => {
    const messages = await getMessages("ka", ["common", "landing", "inflation", "trade"]);
    expect(() => buildLandingDatasetLinks({ ...input, cpiFacts: [] } as Parameters<typeof buildLandingDatasetLinks>[0], { locale: "ka", messages })).toThrow();
  });
});

describe("landingGdpFigure", () => {
  const gdpFacts = [
    { seriesId: "nominal_gel" as const, year: 2024, value: 93_022_275_315, status: "published" as const },
    { seriesId: "nominal_gel" as const, year: 2025, value: 104_598_139_883, status: "preliminary" as const },
    { seriesId: "real_usd_2015" as const, year: 2026, value: 27_100_000_000, status: "preliminary" as const },
  ];

  it("reads the key figure, its year and its status from the latest nominal GDP fact", async () => {
    const ka = await getMessages("ka", ["landing"]);
    const en = await getMessages("en", ["landing"]);
    expect(landingGdpFigure(gdpFacts, ka)).toEqual({ value: "104.6", caption: "ნომინალური მშპ · 2025, წინასწარი", mobileCaption: "მშპ · 2025" });
    expect(landingGdpFigure(gdpFacts, en)).toEqual({ value: "104.6", caption: "Nominal GDP · 2025, preliminary", mobileCaption: "GDP · 2025" });
  });

  it("follows the next release instead of a maintained snapshot", async () => {
    const en = await getMessages("en", ["landing"]);
    const next = [...gdpFacts.slice(0, 1), { ...gdpFacts[1], value: 112_349_000_000, status: "published" as const }];
    expect(landingGdpFigure(next, en)).toEqual({ value: "112.3", caption: "Nominal GDP · 2025", mobileCaption: "GDP · 2025" });
  });

  it("refuses to render without a served nominal GDP fact", async () => {
    const en = await getMessages("en", ["landing"]);
    expect(() => landingGdpFigure(gdpFacts.slice(2), en)).toThrow();
  });
});

// U01-05, U01-07: small tablet layout fixes on the landing page (U01-06, the client-only hero, is in landing.spec.ts).
// The page's language switch reads the current path.
vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), usePathname: () => "/" }));
describe("landing page layout", () => {
  it("keeps a key number's unit on one line and tops the dataset titles", async () => {
    const { renderPageMarkup } = await import("../helpers/render-localized");
    const { renderHomePage } = await import("../../lib/pages/home");
    const markup = renderPageMarkup("ka", await renderHomePage("ka"));
    // U01-05: "მლრდ ₾" never splits into a stranded currency sign.
    expect(markup).toMatch(/<span data-testid="[^"]+" class="[^"]*whitespace-nowrap[^"]*">[^<]*₾<\/span>/);
    // U01-07: titles share a top line whether or not their measure wraps.
    expect(markup).toMatch(/class="group flex min-h-11 min-w-0 flex-col justify-start/);
    expect(markup).not.toContain("flex-col justify-center gap-1 border-b");
  });
});

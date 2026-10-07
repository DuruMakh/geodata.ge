import { describe, expect, it } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { buildLandingDatasetLinks } from "../../lib/landing/landingDatasets";

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
};

describe("buildLandingDatasetLinks", () => {
  it("links the four hubs with each one's latest served figure", async () => {
    const messages = await getMessages("ka", ["common", "landing", "inflation"]);
    const links = buildLandingDatasetLinks(input as Parameters<typeof buildLandingDatasetLinks>[0], { locale: "ka", messages });
    expect(links.map(({ href, title }) => [href, title])).toEqual([
      ["/explorer", "ბიუჯეტი"],
      ["/explorer/economy", "ეკონომიკა"],
      ["/explorer/inflation", "ინფლაცია"],
      ["/explorer/unemployment", "უმუშევრობა"],
    ]);
    expect(links.map(({ measure, period, value }) => `${measure} · ${period}: ${value}`)).toEqual([
      "ხარჯები · 2025: 27.7 მლრდ ₾",
      "ნომინალური მშპ · 2025: 104.6 მლრდ ₾",
      expect.stringMatching(/^წლიური ინფლაცია · \S+ 2026: 5\.6%$/),
      "უმუშევრობის დონე · 2025: 13.2%",
    ]);
  });

  it("speaks English on /en", async () => {
    const messages = await getMessages("en", ["common", "landing", "inflation"]);
    const links = buildLandingDatasetLinks(input as Parameters<typeof buildLandingDatasetLinks>[0], { locale: "en", messages });
    expect(links.map(({ title }) => title)).toEqual(["Budget", "Economy", "Inflation", "Unemployment"]);
    expect(links[2]).toMatchObject({ measure: "Annual inflation", period: "Aug 2026", value: "5.6%" });
  });

  it("refuses to render a row without served data rather than invent a figure", async () => {
    const messages = await getMessages("ka", ["common", "landing", "inflation"]);
    expect(() => buildLandingDatasetLinks({ ...input, cpiFacts: [] } as Parameters<typeof buildLandingDatasetLinks>[0], { locale: "ka", messages })).toThrow();
  });
});

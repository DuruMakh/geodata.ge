import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { renderEnvironmentAirQualityIndex } from "../../lib/pages/environment-air-quality";
import { renderPageMarkup } from "../helpers/render-localized";

describe("City air quality index every-year tables", () => {
  it("carries every station's yearly PM10 average, and Zestaponi's dust apart", async () => {
    const html = renderPageMarkup("en", await renderEnvironmentAirQualityIndex("en"));
    const inner = [...html.matchAll(/<div hidden="" data-testid="crawl-tables">(.*?)<\/div>/g)].map((match) => match[1]!).find((text) => text.includes("Varketili"))!;
    const captions = [...inner.matchAll(/<caption>([^<]*)<\/caption>/g)].map((match) => match[1]);
    expect(captions).toHaveLength(2);
    expect(captions[0]).toMatch(/^City air quality · Fine dust PM10, yearly average · µg\/m³ · \d{4}–\d{4}$/);
    expect(captions[1]).toMatch(/^City air quality · All dust \(TSP\), yearly average · µg\/m³ · /);
    expect(inner.match(/<tr><th>[^<]+ — [^<]+<\/th>/g)).toHaveLength(16);
    expect(inner).toMatch(/<tr><th>Tbilisi — Varketili<\/th><td>/);
  });
});

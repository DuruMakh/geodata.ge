import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { renderBusinessRegionsPage } from "../../lib/pages/business-regions";
import { renderPageMarkup } from "../helpers/render-localized";

describe("Business regions index every-year tables", () => {
  it("BusinessIndex renders tables for sales and jobs", async () => {
    const html = renderPageMarkup("en", await renderBusinessRegionsPage("en"));
    const inner = [...html.matchAll(/<div hidden="" data-testid="crawl-tables">(.*?)<\/div>/g)].map((match) => match[1]!).find((text) => text.includes("Sales ·"))!;
    const captions = [...inner.matchAll(/<caption>([^<]*)<\/caption>/g)].map((match) => match[1]);
    expect(captions).toHaveLength(2);
    expect(captions[0]).toMatch(/^Regions · Sales · million GEL · \d{4}–\d{4} · Published$/);
    expect(captions[1]).toMatch(/· Jobs · persons · \d{4}–\d{4} · Published$/);
    expect(inner).toMatch(/<tbody><tr><th>Georgia<\/th><td>[\d,.]+<\/td>/);
    expect(inner).toMatch(/<tr><th>Tbilisi<\/th><td>[\d,.]+<\/td>/);
  });
});

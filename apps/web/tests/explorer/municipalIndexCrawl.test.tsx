import { describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { renderMunicipalIndex } from "../../lib/pages/municipal-index";
import { renderPageMarkup } from "../helpers/render-localized";

describe("Municipal budgets index every-year tables", () => {
  it("carries every year's total and the per-resident year for every place", async () => {
    const html = renderPageMarkup("en", await renderMunicipalIndex("en"));
    const inner = [...html.matchAll(/<div hidden="" data-testid="crawl-tables">(.*?)<\/div>/g)].map((match) => match[1]!).find((text) => text.includes("Municipalities ·"))!;
    const captions = [...inner.matchAll(/<caption>([^<]*)<\/caption>/g)].map((match) => match[1]);
    expect(captions).toHaveLength(4);
    expect(captions[0]).toMatch(/^How Georgia’s municipalities spend their budgets · Total budget · mln GEL · Municipalities · \d{4}–2025 · Actual$/);
    expect(captions[2]).toBe("How Georgia’s municipalities spend their budgets · ₾ per resident · Municipalities · 2025 · Actual");
    expect(inner).toMatch(/<tr><th>Georgia<\/th><td>/);
    expect(inner).toMatch(/<tr><th>Khulo<\/th><td>[\d,.]+<\/td>/);
  });
});

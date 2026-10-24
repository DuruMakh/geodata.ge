import { describe, expect, it, vi } from "vitest";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { getMessages } from "../../lib/i18n/messages.server";
import { buildLandingContext, landingGdpFigure } from "../../lib/landing/landingData";
import type { ServedBudgetFact } from "../../lib/servedRows";

const sourceDocuments: SourceDocumentRow[] = [
  { sourceId: "source.a", sourceName: "A", sourceUrlOrFile: "docs/a", lastReviewedAt: "2026-05-10" },
  { sourceId: "source.b", sourceName: "B", sourceUrlOrFile: "docs/b", lastReviewedAt: "2026-06-01" },
];

const facts: ServedBudgetFact[] = [
  { year: 2025, side: "expenditure", itemId: "spending.alpha", amountGel: 400, basis: "planned", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.alpha", amountGel: 40, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.beta", amountGel: 40, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.gamma", amountGel: 30, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.delta", amountGel: 20, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.epsilon", amountGel: 10, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "expenditure.total", amountGel: 999, basis: "planned", sourceId: "source.a" },
  { year: 2026, side: "expenditure", itemId: "expenditure.total", amountGel: 1_100, basis: "actual", sourceId: "source.a" },
  { year: 2004, side: "revenue", itemId: "revenue.alpha", amountGel: 1, basis: "actual", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.alpha", amountGel: 50, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.beta", amountGel: 20, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.gamma", amountGel: 15, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.delta", amountGel: 10, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.epsilon", amountGel: 5, basis: "planned", sourceId: "source.a" },
  { year: 2026, side: "revenue", itemId: "revenue.total", amountGel: 120, basis: "actual", sourceId: "source.a" },
];

describe("landing context", () => {
  it("keeps shared page metadata available without municipal facts", () => {
    expect(buildLandingContext({ facts, sourceDocuments })).toEqual({
      yearsLabel: "2004–2024",
      updatedAt: "2026-06-01",
    });
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

// U01-05: a small tablet layout fix on the landing page (U01-06, the client-only hero, is in landing.spec.ts).
// The page's language switch reads the current path.
vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), usePathname: () => "/" }));
// The sources chapter reads the archive report that only `prebuild` writes; see the helper.
vi.mock("../../lib/methodology/prepareArchives", async (importOriginal) =>
  (await import("../helpers/archive-summaries")).withValidatedArchiveSummaries(importOriginal));
describe("landing page layout", () => {
  it("keeps a key number's unit on one line and renders the chapters in order, chart text included", async () => {
    const { renderPageMarkup } = await import("../helpers/render-localized");
    const { renderHomePage } = await import("../../lib/pages/home");
    const markup = renderPageMarkup("ka", await renderHomePage("ka"));
    // U01-05: "მლრდ ₾" never splits into a stranded currency sign.
    expect(markup).toMatch(/<span data-testid="[^"]+" class="[^"]*whitespace-nowrap[^"]*">[^<]*₾<\/span>/);
    const anchors = [...markup.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
    expect(anchors).toEqual(["ch-01", "ch-02", "ch-03", "ch-04", "ch-05", "sources", "ai"]);
    // The charts render on the server; only their canvas engines load in the browser.
    const chapter = (id: string) => {
      const start = markup.indexOf(`<section id="${id}"`);
      return markup.slice(start, markup.indexOf("</section>", start));
    };
    expect(chapter("ch-01").match(/<button type="button" aria-pressed="(true|false)"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(chapter("ch-01")).toContain('aria-pressed="true"');
    expect(chapter("ch-02").match(/<button[^>]* data-field="[^"]+"/g)?.length).toBeGreaterThanOrEqual(10);
    expect(chapter("ch-03").match(/<li data-band="[a-zA-Z]+"/g)?.length).toBeGreaterThanOrEqual(6);
    // The site footer, with the mission sentence.
    expect(markup).toContain("ჩვენი მიზანია");
  });
});

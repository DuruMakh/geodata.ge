import { describe, expect, it, vi } from "vitest";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { getMessages } from "../../lib/i18n/messages.server";
import { buildLandingContext, landingGdpFigure } from "../../lib/landing/landingData";
import type { HomeChapters } from "../../lib/landing/chapters/types";
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
// Keeps the chapters model the page builds, so the tests can check it against the served facts.
const built = vi.hoisted(() => ({ chapters: [] as HomeChapters[] }));
vi.mock("../../lib/landing/chapters", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/landing/chapters")>();
  return {
    ...original,
    buildHomeChapters: (...args: Parameters<typeof original.buildHomeChapters>) => {
      const chapters = original.buildHomeChapters(...args);
      built.chapters.push(chapters);
      return chapters;
    },
  };
});
describe("landing page layout", () => {
  it("keeps a key number's unit on one line and renders the chapters in order, chart text included", async () => {
    const { renderPageMarkup } = await import("../helpers/render-localized");
    const { renderHomePage } = await import("../../lib/pages/home");
    const markup = renderPageMarkup("ka", await renderHomePage("ka"));
    // U01-05: "მლრდ ₾" never splits into a stranded currency sign.
    expect(markup).toMatch(/<span data-testid="[^"]+" class="[^"]*whitespace-nowrap[^"]*">[^<]*₾<\/span>/);
    const anchors = [...markup.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
    expect(anchors).toEqual(["ch-01", "ch-02", "ch-03", "ch-04", "ch-05", "ch-06", "ch-07", "ch-08", "ch-09", "ch-10", "sources", "ai"]);
    // The charts render on the server; only their canvas engines load in the browser.
    const chapter = (id: string) => {
      const start = markup.indexOf(`<section id="${id}"`);
      return markup.slice(start, markup.indexOf("</section>", start));
    };
    expect(chapter("ch-01").match(/<button type="button" aria-pressed="(true|false)"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(chapter("ch-01")).toContain('aria-pressed="true"');
    expect(chapter("ch-02").match(/<button[^>]* data-field="[^"]+"/g)?.length).toBeGreaterThanOrEqual(10);
    expect(chapter("ch-03").match(/<li data-band="[a-zA-Z]+"/g)?.length).toBeGreaterThanOrEqual(6);
    expect(chapter("ch-06").match(/<div data-stat=""/g)?.length).toBe(4);
    // Chapter 07: two labour grids with three key rows each, and the regions chart.
    expect(chapter("ch-07").match(/<li[^>]*data-key="(employed|unemployed|outside)"/g)?.length).toBe(6);
    expect(chapter("ch-07").match(/<canvas/g)?.length).toBe(3);
    // Chapter 08: the wages-by-sector chart beside four number cards, the first with its sparkline.
    expect(chapter("ch-08").match(/<canvas/g)?.length).toBe(1);
    expect(chapter("ch-08").match(/<div data-stat=""/g)?.length).toBe(4);
    expect(chapter("ch-08").match(/<polyline/g)?.length).toBe(1);
    // Chapter 09: the partners chart and the exports and imports lines, then three number cards.
    expect(chapter("ch-09").match(/<canvas/g)?.length).toBe(2);
    expect(chapter("ch-09").match(/<div data-stat=""/g)?.length).toBe(3);
    // Chapter 10: the causes-of-death chart of squares, with its two-part key.
    expect(chapter("ch-10").match(/<canvas/g)?.length).toBe(1);
    expect(chapter("ch-10")).toContain("გარდაცვალების მიზეზები, 2025");
    expect(chapter("ch-10")).toContain("= 100 გარდაცვლილი");
    // The site footer, with the mission sentence.
    expect(markup).toContain("ჩვენი მიზანია");
  });
  it("links the chapter headings to the English explorer pages on /en", async () => {
    const { renderPageMarkup } = await import("../helpers/render-localized");
    const { renderHomePage } = await import("../../lib/pages/home");
    const markup = renderPageMarkup("en", await renderHomePage("en"));
    const headingLinks = [...markup.matchAll(/<h2[^>]*>[\s\S]*?<\/h2>/g)].flatMap((match) => [...match[0].matchAll(/href="([^"]+)"/g)].map((link) => link[1]));
    expect(headingLinks).toEqual(["/en/explorer/analysis", "/en/explorer/expenditure", "/en/explorer/revenue", "/en/explorer/municipalities", "/en/explorer/deficit", "/en/explorer/demography", "/en/explorer/labour#t-unemployment", "/en/explorer/labour#t-wages", "/en/explorer/external#t-trade", "/en/explorer/health/causes-of-death"]);
  });

  // Two municipal totals by design: chapter 01 compares the official all-local-budgets country aggregate with GDP;
  // chapter 04 adds up the 64 mapped places it draws (its sentence says "64 მუნიციპალიტეტის").
  it("pins the two municipal totals: ch-01 is the country aggregate fact, ch-04 the sum of its places", async () => {
    const { renderHomePage } = await import("../../lib/pages/home");
    const { loadServedMunicipalData } = await import("../../lib/data/servedData");
    const { MUNICIPAL_COUNTRY_ID } = await import("../../lib/data/municipal/types");
    built.chapters.length = 0;
    await renderHomePage("ka");
    const { scale, municipal } = built.chapters[0];
    const aggregate = (await loadServedMunicipalData()).countryTotalFacts.find(
      (fact) => fact.municipalityCode === MUNICIPAL_COUNTRY_ID && fact.year === scale.year,
    );
    expect(aggregate).toBeDefined();
    expect(scale.measures.find((measure) => measure.id === "municipal")?.valueGel).toBe(aggregate?.publicTotalGel);
    expect(municipal.places).toHaveLength(64);
    expect(municipal.totalGel).toBe(municipal.places.reduce((sum, place) => sum + place.totalGel, 0));
  });

  // Georgian and English read the same facts: only labels and sentences may differ between the two models.
  it("builds the same chapter models in Georgian and English, apart from their words", async () => {
    const { renderHomePage } = await import("../../lib/pages/home");
    built.chapters.length = 0;
    await renderHomePage("ka");
    await renderHomePage("en");
    const [ka, en] = built.chapters;
    const numbersOnly = (value: unknown): unknown =>
      typeof value === "string"
        ? ""
        : Array.isArray(value)
          ? value.map(numbersOnly)
          : value !== null && typeof value === "object"
            ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, numbersOnly(entry)]))
            : value;
    expect(numbersOnly(en)).toEqual(numbersOnly(ka));
    // Ids are identifiers, not words: they match exactly.
    expect(en.spending.fields.map((field) => field.id)).toEqual(ka.spending.fields.map((field) => field.id));
    expect(en.revenue.bands.map((band) => band.id)).toEqual(ka.revenue.bands.map((band) => band.id));
    expect(en.scale.measures.map((measure) => measure.id)).toEqual(ka.scale.measures.map((measure) => measure.id));
    expect(en.municipal.places.map((place) => place.code)).toEqual(ka.municipal.places.map((place) => place.code));
    expect(en.sentences.spending).not.toBe(ka.sentences.spending);
  });
});

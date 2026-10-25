import { beforeAll, describe, expect, it } from "vitest";
import { loadServedTradeOverviewData } from "../../../lib/data/tradeOverview/importTradeOverview";
import type { TradeOverviewFact, TradeOverviewIndicator } from "../../../lib/data/tradeOverview/types";
import { loadServedTradePartnersData } from "../../../lib/data/tradePartners/importTradePartners";
import type { TradePartnerFact, TradePartnersData } from "../../../lib/data/tradePartners/types";
import { loadServedTradeProductsData } from "../../../lib/data/tradeProducts/importTradeProducts";
import type { TradeProductsData } from "../../../lib/data/tradeProducts/types";
import type { Presentation } from "../../../lib/i18n/types";
import { buildTradeChapter } from "../../../lib/landing/chapters/trade";
import type { TradeChapter } from "../../../lib/landing/chapters/types";

const presentation: Presentation = { locale: "ka", englishLabels: {}, messages: {} };

let overview: TradeOverviewFact[];
let partners: TradePartnersData;
let products: TradeProductsData;
let chapter: TradeChapter;

beforeAll(async () => {
  overview = (await loadServedTradeOverviewData()).facts;
  partners = await loadServedTradePartnersData();
  products = await loadServedTradeProductsData();
  chapter = buildTradeChapter({ overview, partners, products }, presentation);
}, 60_000);

const total = (year: number, indicatorId: TradeOverviewIndicator, value: number): TradeOverviewFact => ({
  year, indicatorId, valueUsd: String(value), unit: "usd", basis: "actual", valueStatus: "numeric", publicationStatus: "unspecified", role: "total",
  sourceId: "source.test", sourceRefs: "[]", sourceValue: null, sourceUnit: null, sourceLabel: null, sourceNumberFormat: null, lastReviewedAt: "2026-10-01",
});

const partnerFact = (entityId: string, year: number, indicatorId: TradeOverviewIndicator, valueUsd: string | null): TradePartnerFact => ({
  entityId, year, indicatorId, valueUsd, unit: "usd", basis: "actual", valueStatus: valueUsd === null ? "blank" : "numeric", publicationStatus: "unspecified", role: "derived",
  sourceId: "source.test", sourceRefs: "[]", sourceValue: null, sourceUnit: null, sourceLabel: null, sourceNumberFormat: null, sourceBlock: "1995-2025", lastReviewedAt: "2026-10-01",
});

describe("buildTradeChapter", () => {
  it("2025 totals", () => {
    expect(chapter.year).toBe(2025);
    expect(chapter.exportsUsd).toBeCloseTo(7.288e9, -6);
    expect(chapter.importsUsd).toBeCloseTo(18.649e9, -6);
    expect(chapter.turnoverUsd).toBeCloseTo(25.936e9, -6);
    expect(chapter.balanceUsd).toBeCloseTo(-11.361e9, -6);
    expect(chapter.years[0]).toBe(1995);
    expect(chapter.years.at(-1)).toBe(2025);
    expect(chapter.exports).toHaveLength(chapter.years.length);
    expect(chapter.imports).toHaveLength(chapter.years.length);
    expect(chapter.exports.at(-1)).toBeCloseTo(chapter.exportsUsd, 0);
  });

  it("top 10 partners are countries by turnover", () => {
    expect(chapter.partners).toHaveLength(10);
    expect(chapter.partners.some((partner) => partner.id.startsWith("group."))).toBe(false);
    expect(chapter.partners[0].label).toBe(partners.entities.find((entity) => entity.sourceCode === "792")!.labelKa);
    const turnovers = chapter.partners.map((partner) => partner.turnoverUsd);
    expect(turnovers).toEqual([...turnovers].sort((a, b) => b - a));
    const kyrgyzstan = chapter.partners.find((partner) => partner.id === "partner.1995-2025.417");
    expect(kyrgyzstan?.exportsUsd).toBeCloseTo(1.499e9, -6);
  });

  it("largest product is passenger cars (8703) with share ≈ 0.386; second is 2616 at ≈ 0.379e9", () => {
    const code = (label: string) => products.entities.find((entity) => entity.labelKa === label)?.code;
    expect(code(chapter.topProduct.label)).toBe("8703");
    expect(chapter.topProduct.share).toBeCloseTo(0.386, 3);
    expect(chapter.topProduct.usd / chapter.exportsUsd).toBeCloseTo(chapter.topProduct.share, 10);
    expect(code(chapter.secondProduct!.label)).toBe("2616");
    expect(chapter.secondProduct!.usd).toBeCloseTo(0.379e9, -6);
  });

  it("a partner with a null turnover is skipped; fewer than 10 countries returns what exists", () => {
    const small = buildTradeChapter(
      {
        overview: [
          total(2024, "trade.exports", 100), total(2024, "trade.imports", 300), total(2024, "trade.turnover", 400), total(2024, "trade.balance", -200),
          total(2023, "trade.exports", 80), total(2023, "trade.imports", 200), total(2023, "trade.turnover", 280), total(2023, "trade.balance", -120),
        ],
        partners: {
          entities: [
            { id: "p.a", kind: "country", sourceCode: "1", labelKa: "ა" },
            { id: "p.b", kind: "country", sourceCode: "2", labelKa: "ბ" },
            { id: "p.c", kind: "country", sourceCode: "3", labelKa: "გ" },
            { id: "group.x", kind: "group", sourceCode: null, labelKa: "ჯგუფი" },
          ],
          facts: [
            partnerFact("p.a", 2024, "trade.turnover", "50"), partnerFact("p.a", 2024, "trade.exports", "20"), partnerFact("p.a", 2024, "trade.imports", "30"),
            partnerFact("p.b", 2024, "trade.turnover", "90"), partnerFact("p.b", 2024, "trade.exports", "60"), partnerFact("p.b", 2024, "trade.imports", "30"),
            partnerFact("p.c", 2024, "trade.turnover", null), partnerFact("p.c", 2024, "trade.exports", null), partnerFact("p.c", 2024, "trade.imports", null),
            partnerFact("group.x", 2024, "trade.turnover", "999"),
          ],
        },
        products: {
          entities: [{ id: "g.1", sourceBlock: "2020-2025", code: "0101", labelKa: "ცხენი", sourceLabelEn: "Horses", categoryId: "food_agriculture", aliasesKa: [], aliasesEn: [] }],
          facts: [{ entityId: "g.1", year: 2024, indicatorId: "trade.exports", valueUsd: "40", unit: "usd", basis: "actual", valueStatus: "numeric", publicationStatus: "unspecified", role: "detail", sourceId: "s", sourceRefs: "[]", sourceValue: null, sourceUnit: "usd", sourceLabel: "x", sourceNumberFormat: "0", sourceBlock: "2020-2025", lastReviewedAt: "2026-10-01" }],
        },
      },
      presentation,
    );
    expect(small.year).toBe(2024);
    expect(small.years).toEqual([2023, 2024]);
    expect(small.exports).toEqual([80, 100]);
    expect(small.imports).toEqual([200, 300]);
    expect(small.balanceUsd).toBe(-200);
    expect(small.turnoverUsd).toBe(400);
    expect(small.partners.map((partner) => partner.id)).toEqual(["p.b", "p.a"]);
    expect(small.partners[0]).toEqual({ id: "p.b", label: "ბ", exportsUsd: 60, importsUsd: 30, turnoverUsd: 90 });
    expect(small.topProduct).toEqual({ label: "ცხენი", usd: 40, share: 0.4 });
    expect(small.secondProduct).toBeNull();
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TradeChapter, tradeNotes, type TradeLabels } from "../../../components/landing/chapters/trade-chapter";
import { yearRange } from "../../../components/landing/chapters/chart-layout";
import { message } from "../../../lib/i18n/messages";
import enLanding from "../../../lib/i18n/messages/en/landing.json";
import kaLanding from "../../../lib/i18n/messages/ka/landing.json";
import type { TradeChapter as TradeChapterModel } from "../../../lib/landing/chapters/types";

const ka = (key: string, values?: Record<string, string | number>) => message(kaLanding, key, values);
const unavailable = ka("landing.heroUnavailable");

const partner = (label: string, exportsUsd: number, importsUsd: number) => ({ id: `partner.${label}`, label, exportsUsd, importsUsd, turnoverUsd: exportsUsd + importsUsd });
const data: TradeChapterModel = {
  year: 2025,
  exportsUsd: 7.288e9,
  importsUsd: 18.649e9,
  turnoverUsd: 25.937e9,
  balanceUsd: -11.361e9,
  years: [1995, 2005, 2015, 2025],
  exports: [0.2e9, 0.9e9, 2.2e9, 7.288e9],
  imports: [0.5e9, 2.5e9, 7.3e9, 18.649e9],
  partners: [
    partner("თურქეთი", 0.33e9, 2.78e9),
    partner("აშშ", 0.12e9, 2.79e9),
    partner("რუსეთი", 0.75e9, 1.94e9),
    partner("ჩინეთი", 0.33e9, 1.99e9),
    partner("ყირგიზეთი", 1.5e9, 0.01e9),
    partner("გერმანია", 0.07e9, 1.31e9),
    partner("აზერბაიჯანი", 0.7e9, 0.66e9),
    partner("ყაზახეთი", 0.91e9, 0.09e9),
    partner("სომხეთი", 0.55e9, 0.24e9),
    partner("ბულგარეთი", 0.2e9, 0.5e9),
  ],
  topProduct: { label: "მსუბუქი ავტომობილები", usd: 2.81e9, share: 0.386 },
  secondProduct: { label: "ძვირფასი ლითონების მადნები", usd: 0.38e9 },
};

// Built as landing-page.tsx builds them, from the same messages.
const labelsFor = (model: TradeChapterModel, t: (key: string, values?: Record<string, string | number>) => string): TradeLabels => {
  const notes = tradeNotes(model, t);
  const unit = t("landing.trade.unit");
  const range = yearRange(model.years[0], model.years[model.years.length - 1]);
  const names = { exports: t("landing.trade.exports"), imports: t("landing.trade.imports") };
  return {
    butterfly: {
      title: t("landing.trade.partners.title", { count: model.partners.length, year: model.year }),
      ...names,
      balance: t("landing.trade.balanceName"),
      turnover: t("landing.trade.turnoverName"),
      unit,
      exportsHead: t("landing.trade.partners.exportsHead"),
      importsHead: t("landing.trade.partners.importsHead"),
      chartSummary: t("landing.trade.partners.chartSummary", { count: model.partners.length, year: model.year }),
      unavailable,
    },
    lines: {
      title: t("landing.trade.lines.title", { range }),
      ...names,
      balance: t("landing.trade.balanceName"),
      deficit: t("landing.trade.deficit"),
      unit,
      chartSummary: t("landing.trade.lines.chartSummary", {
        range,
        year: model.year,
        exports: "7.3",
        imports: "18.6",
      }),
      unavailable,
    },
    turnover: { label: t("landing.trade.turnover.label"), note: notes.turnover },
    balance: { label: t("landing.trade.balance.label"), note: notes.balance },
    product: { label: t("landing.trade.product.label"), note: notes.product },
  };
};
const labels = labelsFor(data, ka);

const html = renderToStaticMarkup(<TradeChapter data={data} labels={labels} />);
const cards = [...html.matchAll(/<div[^>]*data-stat=""[^>]*>(.*?)<p[^>]*>([^<]*)<\/p><\/div>/g)];
const plain = (card: string) => card.replace(/<(?!\/?small)[^>]+>/g, "");
const value = (card: string) => plain(card.match(/<div[^>]*font-display[^>]*>(.*?)<\/div>/)?.[1] ?? "");
const cardLabel = (card: string) => card.match(/<div[^>]*uppercase[^>]*>([^<]*)<\/div>/)?.[1];

describe("TradeChapter (server render)", () => {
  it("shows the turnover, the balance and the share of the largest export product as three number cards", () => {
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => value(card[1]))).toEqual([
      expect.stringMatching(/^25\.9<small[^>]*>მლრდ \$<\/small>$/),
      expect.stringMatching(/^−11\.4<small[^>]*>მლრდ \$<\/small>$/),
      expect.stringMatching(/^38\.6<small[^>]*>%<\/small>$/),
    ]);
  });

  it("labels the third card as the largest export product, never by a product named in the code", () => {
    expect(cards.map((card) => cardLabel(card[1]))).toEqual(["სავაჭრო ბრუნვა", "სავაჭრო ბალანსი", "უმსხვილესი საექსპორტო საქონელი"]);
    const wine: TradeChapterModel = { ...data, topProduct: { label: "ღვინო", usd: 0.3e9, share: 0.041 } };
    const other = renderToStaticMarkup(<TradeChapter data={wine} labels={labelsFor(wine, ka)} />);
    expect(other).toContain("ღვინო — 0.30 მლრდ $");
    expect(other).not.toContain("ავტომობილ");
  });

  it("gives every card note the year", () => {
    expect(cards[0][2]).toBe("2025: ექსპორტი — 7.3 მლრდ $, იმპორტი — 18.6 მლრდ $.");
    expect(cards[1][2]).toBe("2025: იმპორტი ექსპორტს 2.6-ჯერ აღემატება.");
    expect(cards[2][2]).toBe("2025: მსუბუქი ავტომობილები — 2.81 მლრდ $, მთლიანი ექსპორტის წილი. მეორეა ძვირფასი ლითონების მადნები — 0.38 მლრდ $.");
  });

  it("follows the data when exports exceed imports and when there is no second product", () => {
    const surplus: TradeChapterModel = { ...data, exportsUsd: 20e9, importsUsd: 10e9, balanceUsd: 10e9, secondProduct: null };
    const notes = tradeNotes(surplus, ka);
    expect(notes.balance).toBe("2025: ექსპორტი იმპორტს 2.0-ჯერ აღემატება.");
    expect(notes.product).toBe("2025: მსუბუქი ავტომობილები — 2.81 მლრდ $, მთლიანი ექსპორტის წილი.");
    expect(tradeNotes(surplus, (key, values) => message(enLanding, key, values)).balance).toBe("2025: exports are 2.0 times imports.");
  });

  it("titles the partners chart with the year and keys it with exports and imports", () => {
    expect(html).toContain("10 უმსხვილესი სავაჭრო პარტნიორი, 2025, მლრდ $");
    const captions = [...html.matchAll(/<figcaption[^>]*>(.*?)<\/figcaption>/g)].map((m) => m[1]);
    expect(captions).toHaveLength(2);
    const keys = (caption: string) => [...caption.matchAll(/<li[^>]*><i[^>]*><\/i>([^<]*)<\/li>/g)].map((m) => m[1]);
    expect(keys(captions[0])).toEqual(["ექსპორტი", "იმპორტი"]);
    expect(keys(captions[1])).toEqual(["ექსპორტი", "იმპორტი", "დეფიციტი"]);
    expect(captions[0]).toContain("#1f6e56");
    expect(captions[0]).toContain("#3a332a");
  });

  it("lists the ten partners in order with their turnover in the butterfly's accessible name", () => {
    const aria = [...html.matchAll(/<canvas[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(aria).toHaveLength(2);
    expect(aria[0]).toBe("ექსპორტი და იმპორტი 10 უმსხვილეს პარტნიორთან 2025 წელს: თურქეთი 3.11, აშშ 2.91, რუსეთი 2.69, ჩინეთი 2.32, ყირგიზეთი 1.51, გერმანია 1.38, აზერბაიჯანი 1.36, ყაზახეთი 1.00, სომხეთი 0.79, ბულგარეთი 0.70 (ბრუნვა, მლრდ $)");
  });

  it("gives the lines chart's accessible name its range and the latest year's values", () => {
    const aria = [...html.matchAll(/<canvas[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(aria[1]).toBe("ექსპორტი და იმპორტი 1995–2025: 2025 წელს ექსპორტი 7.3, იმპორტი 18.6 მილიარდი დოლარი");
    expect(html).toContain("ექსპორტი და იმპორტი, 1995–2025, მლრდ $");
  });

  it("starts the charts at their desktop heights so the page does not jump", () => {
    expect(html).toContain("min-[768px]:h-[400px]");
    expect(html).toContain("h-[340px]");
  });

  it("fails the render without partners or without a yearly series", () => {
    expect(() => renderToStaticMarkup(<TradeChapter data={{ ...data, partners: [] }} labels={labels} />)).toThrow("Trade chapter: no partners");
    expect(() => renderToStaticMarkup(<TradeChapter data={{ ...data, years: [], exports: [], imports: [] }} labels={labels} />)).toThrow("Trade chapter: no yearly series");
  });
});

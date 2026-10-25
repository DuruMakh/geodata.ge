import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WagesChapter, wagesNotes, type WagesLabels } from "../../../components/landing/chapters/wages-chapter";
import { message } from "../../../lib/i18n/messages";
import kaLanding from "../../../lib/i18n/messages/ka/landing.json";
import type { WageGapChapter } from "../../../lib/landing/chapters/types";

const t = (key: string, values?: Record<string, string | number>) => message(kaLanding, key, values);
const unavailable = t("landing.heroUnavailable");

const data: WageGapChapter = {
  year: 2025,
  average: 2165.4,
  women: 1743.2,
  men: 2587.3,
  ratio: 1743.2 / 2587.3,
  median: { year: 2024, value: 1531.2 },
  publicSector: 1895.1,
  nonPublic: 2301.4,
  history: { years: [1995, 2005, 2015, 2025], values: [13.5, 40, 900, 2165.4] },
  sectors: [
    { id: "finance", label: "ფინანსები და დაზღვევა", average: 5900, women: 4300, men: 7600 },
    { id: "information", label: "ინფორმაცია და კომუნიკაცია", average: 4800, women: 4500, men: 4950 },
    { id: "education", label: "განათლება", average: 1200, women: 1250, men: 1100 },
  ],
};

// Built as landing-page.tsx builds them, from the same messages.
const notes = wagesNotes(data, t);
const year = data.year;
const labels: WagesLabels = {
  chart: {
    title: t("landing.wages.chart.title", { year }),
    women: t("landing.ageing.women"),
    men: t("landing.ageing.men"),
    average: t("landing.wages.legendAverage"),
    ratioHint: t("landing.wages.ratioHint"),
    tipFoot: t("landing.wages.tipFoot", { pct: "{pct}" }),
    chartSummary: t("landing.wages.chartSummary", { count: data.sectors.length, year }),
    largestGap: t("landing.wages.largestGap"),
    unavailable,
  },
  average: { label: t("landing.wages.average.label"), note: notes.average },
  median: { label: t("landing.wages.median.label"), note: notes.median },
  ratio: { label: t("landing.wages.ratio.label"), note: notes.ratio },
  publicSector: { label: t("landing.wages.public.label"), note: notes.publicSector },
};

const html = renderToStaticMarkup(<WagesChapter data={data} labels={labels} />);
const cards = [...html.matchAll(/<div[^>]*data-stat=""[^>]*>(.*?)<p[^>]*>([^<]*)<\/p><\/div>/g)];
const value = (card: string) => card.match(/<div[^>]*font-display[^>]*>(.*?)<\/div>/)?.[1] ?? "";

describe("WagesChapter (server render)", () => {
  it("shows four stat cards: the average, the median, women's share of men's pay and the public sector", () => {
    expect(cards).toHaveLength(4);
    expect(cards.map((card) => value(card[1]).replace(/<(?!\/?small)[^>]+>/g, ""))).toEqual([
      expect.stringMatching(/^2,165<small[^>]*>₾<\/small>/),
      expect.stringMatching(/^1,531<small[^>]*>₾<\/small>$/),
      expect.stringMatching(/^67<small[^>]*>%<\/small>$/),
      expect.stringMatching(/^1,895<small[^>]*>₾<\/small>$/),
    ]);
  });

  it("gives every card note the year of its own measure", () => {
    expect(cards.map((card) => card[2])).toEqual([
      "თვიური, ნომინალური, 2025. 1995 წელს — 13.5 ₾.",
      "2024: დასაქმებულთა ნახევარი ამაზე ნაკლებს იღებს, ნახევარი — მეტს.",
      "2025: ქალების საშუალო ხელფასი — 1,743 ₾, კაცებისა — 2,587 ₾.",
      "2025: საშუალო ხელფასი; არასაჯარო სექტორში — 2,301 ₾.",
    ]);
  });

  it("draws the average card's sparkline as an inline svg with one polyline point per history year", () => {
    const card = cards[0][1];
    const svg = card.match(/<svg[^>]*>.*?<\/svg>/)?.[0] ?? "";
    expect(svg).not.toBe("");
    const points = svg.match(/<polyline[^>]*points="([^"]+)"/)?.[1].trim().split(/\s+/) ?? [];
    expect(points).toHaveLength(data.history.years.length);
    // The first value sits at the left and the lowest, the last at the right and the highest.
    const [first, last] = [points[0], points[points.length - 1]].map((p) => p.split(",").map(Number));
    expect(first[0]).toBe(0);
    expect(last[0]).toBe(1000);
    expect(last[1]).toBeLessThan(first[1]);
    // Both ends and both years are printed beside it.
    expect(card).toContain(">13.5<");
    expect(card).toContain(">2,165<");
    expect(card).toContain(">1995<");
    expect(card).toContain(">2025<");
    expect(cards.slice(1).every((c) => !c[1].includes("<svg"))).toBe(true);
  });

  it("titles the dumbbell chart with the year and keys it with women, men and the average", () => {
    expect(html).toContain("საშუალო თვიური ხელფასი დარგების მიხედვით, 2025, ₾");
    const caption = html.match(/<figcaption[^>]*>(.*?)<\/figcaption>/)?.[1] ?? "";
    expect([...caption.matchAll(/<li[^>]*><i[^>]*><\/i>([^<]*)<\/li>/g)].map((m) => m[1])).toEqual(["ქალები", "კაცები", "საშუალო"]);
    expect(html).toContain("მარჯვნივ — ქალების ხელფასი კაცებისის %-ად");
  });

  it("names the sector with the largest gap between women and men in the dumbbell's accessible name", () => {
    const aria = html.match(/<canvas[^>]*aria-label="([^"]*)"/)?.[1];
    expect(aria).toBe("ქალებისა და კაცების საშუალო ხელფასი 3 დარგში, 2025; ყველაზე დიდი სხვაობა: ფინანსები და დაზღვევა, 3,300 ₾");
  });

  it("starts the dumbbell at its desktop height so the page does not jump when the engine sizes it", () => {
    expect(html).toContain("height:121px");
  });

  it("fails the render when there are no sectors", () => {
    expect(() => renderToStaticMarkup(<WagesChapter data={{ ...data, sectors: [] }} labels={labels} />)).toThrow("Wages chapter: no sectors");
  });
});

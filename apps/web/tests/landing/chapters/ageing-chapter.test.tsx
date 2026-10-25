import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgeingChapter, ageingNotes, type AgeingLabels } from "../../../components/landing/chapters/ageing-chapter";
import { message } from "../../../lib/i18n/messages";
import kaLanding from "../../../lib/i18n/messages/ka/landing.json";
import type { AgeingChapter as AgeingData, MunicipalChapter, ReliefPlace } from "../../../lib/landing/chapters/types";

const t = (key: string, values?: Record<string, string | number>) => message(kaLanding, key, values);
const unavailable = t("landing.heroUnavailable");

const data: AgeingData = {
  pyramid: {
    year: 2026,
    baseYear: 2004,
    ages: ["0–4", "65–69", "85+"],
    men: [106170, 107268, 19083],
    women: [97930, 138816, 49131],
    baseMen: [116228, 86171, 7809],
    baseWomen: [102534, 115914, 21710],
  },
  oldShare: { year: 2026, share: 0.18078974337894746 },
  oldShareBase: { year: 2004, share: 0.14070313857068412 },
  ageing: true,
  womenPer100Men: 108.78400928987745,
  oldestWomenPerMan: 2.574595189435623,
  lifeExpectancy: { year: 2025, total: 76, women: 80.6, men: 71.4 },
  fertility: { year: 2025, rate: 1.53 },
  migration: {
    years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    net: [-21521, -2606, -6543, -3408, -8060, -2212, -10783, -8243, 15732, -25966, 54509, -39207, 14386, 17127],
  },
  births: {
    year: 2025,
    births: 37867,
    deaths: 44319,
    places: [
      { births: 14334, deaths: 12743 },
      { births: 2630, deaths: 1779 },
      { births: 31, deaths: 109 },
      { births: 1401, deaths: 978 },
      null,
    ],
  },
};

const place = (code: string, name: string, rank: number): ReliefPlace => ({ code, name, totalGel: 1e6, perResidentGel: 1, rank, city: false });
const municipal: MunicipalChapter = {
  year: 2025,
  totalGel: 5e6,
  places: [place("04", "თბილისი", 1), place("06", "ბათუმი", 2), place("71", "ონი", 3), place("53", "მარნეული", 4), place("99", "უცნობი", 5)],
  grid: { cols: 3, rows: 2, cells: [0, 1, 2, 3, 4, -2] },
};

// Built as landing-page.tsx builds them, from the same messages.
const notes = ageingNotes(data, t);
const labels: AgeingLabels = {
  pyramid: {
    title: t("landing.ageing.pyramid.title", { year: 2026 }),
    men: t("landing.ageing.men"),
    women: t("landing.ageing.women"),
    base: t("landing.ageing.pyramid.base", { year: 2004 }),
    years: t("landing.ageing.years"),
    bothSexes: t("landing.ageing.pyramid.bothSexes"),
    then: t("landing.ageing.pyramid.then", { year: 2004 }),
    oldShare: t("landing.ageing.pyramid.oldShare"),
    chartSummary: t("landing.ageing.pyramid.chartSummary", { year: 2026, baseYear: 2004 }),
    unavailable,
  },
  migration: {
    net: t("landing.ageing.migration.label"),
    moreArrived: t("landing.ageing.migration.moreArrived"),
    moreLeft: t("landing.ageing.migration.moreLeft"),
    highest: t("landing.ageing.highest"),
    lowest: t("landing.ageing.lowest"),
    unavailable,
  },
  map: {
    title: t("landing.ageing.map.title", { year: 2025 }),
    perHundred: t("landing.ageing.map.perHundred"),
    births: t("landing.ageing.map.births"),
    deaths: t("landing.ageing.map.deaths"),
    increase: t("landing.ageing.map.increase"),
    decrease: t("landing.ageing.map.decrease"),
    balanced: t("landing.ageing.map.balanced"),
    noData: t("landing.ageing.map.noData"),
    occupied: t("landing.municipal.occupied"),
    below: t("landing.ageing.map.below", { value: 50 }),
    highest: t("landing.ageing.highest"),
    lowest: t("landing.ageing.lowest"),
    chartSummary: t("landing.ageing.map.chartSummary", { year: 2025 }),
    unavailable,
  },
  women: { label: t("landing.ageing.women.label"), note: notes.women },
  life: { label: t("landing.ageing.life.label"), unit: t("landing.ageing.years"), note: notes.life },
  fertility: { label: t("landing.ageing.fertility.label"), note: notes.fertility },
  migrationCard: { label: t("landing.ageing.migration.label"), note: notes.migration },
};

const html = renderToStaticMarkup(<AgeingChapter data={data} municipal={municipal} labels={labels} />);
const canvases = [...html.matchAll(/<canvas[^>]*aria-label="([^"]*)"[^>]*>/g)].map((m) => m[1]);
const legendTexts = (figureTitle: string) => {
  const caption = html.match(new RegExp(`<figcaption[^>]*><b[^>]*>${figureTitle}</b>(.*?)</figcaption>`))?.[1] ?? "";
  return [...caption.matchAll(/<li[^>]*><i[^>]*><\/i>([^<]*)<\/li>/g)].map((m) => m[1]);
};

describe("AgeingChapter (server render)", () => {
  it("shows four stat cards: women per 100 men, life expectancy in years, fertility and signed net migration", () => {
    const cards = [...html.matchAll(/<div[^>]*data-stat=""[^>]*>(.*?)<p[^>]*>([^<]*)<\/p><\/div>/g)];
    const value = (card: string) => card.match(/<div[^>]*font-display[^>]*>(.*?)<\/div>/)?.[1] ?? "";
    expect(cards.map((card) => value(card[1]).split("<small")[0])).toEqual(["108.8", "76.0", "1.53", "+17,127"]);
    expect(value(cards[1][1])).toMatch(/^76\.0<small[^>]*>წელი<\/small>$/);
    expect(cards.map((card) => card[2])).toEqual([
      "სხვაობა ასაკთან ერთად იზრდება: 85 წლისა და უფროს ასაკში ქალები კაცებზე 2.6-ჯერ მეტია (2026 წლის 1 იანვარი).",
      "მოსალოდნელი ხანგრძლივობა დაბადებისას, 2025: ქალებისთვის 80.6 წელი, კაცებისთვის — 71.4.",
      "ბავშვების საშუალო რაოდენობა ერთ ქალზე, 2025. თაობების ჩანაცვლებას დაახლოებით 2.1 სჭირდება.",
      "2025 წელს ჩამოსულთა რიცხვმა წასულთა რიცხვს 17,127-ით გადააჭარბა; 2012–2025 წლების ჯამში სალდო უარყოფითია — −26,795.",
    ]);
    expect(html).toContain("ქალი 100 კაცზე");
    expect(html).toContain("მიგრაციის სალდო");
  });

  it("fails the render when the model has no 65–69 group to start the 65+ bracket", () => {
    const noOld = { ...data, pyramid: { ...data.pyramid, ages: ["0–4", "60–64", "85+"] } };
    expect(() => renderToStaticMarkup(<AgeingChapter data={noOld} municipal={municipal} labels={labels} />)).toThrow('Ageing pyramid: no "65–69" age group');
  });

  it("words the migration note from the data: departures in the latest year, a positive total", () => {
    const flipped = ageingNotes({ ...data, migration: { years: [2024, 2025], net: [30000, -1200] } }, t);
    expect(flipped.migration).toBe("2025 წელს წასულთა რიცხვმა ჩამოსულთა რიცხვს 1,200-ით გადააჭარბა; 2024–2025 წლების ჯამში სალდო დადებითია — +28,800.");
  });

  it("puts the migration bars inside the net migration card, between the number and the note", () => {
    const card = html.match(/<div[^>]*data-stat=""[^>]*>((?:(?!data-stat).)*?\+17,127.*?)<p/)?.[1] ?? "";
    expect(card).toMatch(/<div[^>]*class="relative mt-\[14px\] h-\[104px\][^"]*"[^>]*><canvas/);
  });

  it("gives the pyramid an HTML legend of men, women and the first year's outline", () => {
    expect(legendTexts("მოსახლეობა ასაკისა და სქესის მიხედვით, % · 2026 წლის 1 იანვარი")).toEqual(["კაცები", "ქალები", "2004 წლის სტრუქტურა"]);
  });

  it("gives the births map a legend of five classes and a hollow no-data key", () => {
    expect(legendTexts("დაბადება 100 გარდაცვალებაზე, 2025")).toEqual(["50-მდე", "50–75", "75–100", "100–125", "125+", "მონაცემები არ არის"]);
    expect(html).toContain("background:#7d2a1b");
    expect(html).toContain("background:#1e7f86");
  });

  it("names each canvas with its key numbers", () => {
    expect(canvases).toHaveLength(3);
    const [pyramid, migration, map] = canvases;
    expect(pyramid).toBe(
      "მოსახლეობის პირამიდა 2026 წლის 1 იანვრისთვის 2004 წლის სტრუქტურასთან შედარებით; 65 წლისა და უფროსი ასაკის წილი: 2004 — 14.1%, 2026 — 18.1%",
    );
    expect(migration).toBe("მიგრაციის სალდო 2012–2025; ყველაზე მაღალი: +54,509, 2022; ყველაზე დაბალი: −39,207, 2023");
    expect(map).toBe("მუნიციპალიტეტების რუკა: დაბადება 100 გარდაცვალებაზე, 2025; ყველაზე მაღალი: ბათუმი 148; ყველაზე დაბალი: ონი 28");
  });

  it("keeps each chart in a sized wrapper with a tooltip of the board's row count", () => {
    expect(html).toMatch(/<div[^>]*class="relative h-\[470px\] w-full min-\[768px\]:h-\[500px\]"[^>]*><canvas/);
    expect(html).toMatch(/<div[^>]*class="relative aspect-\[138\/71\] w-full"[^>]*><canvas/);
    // Each tooltip's rows end where its foot (the row-border line) begins.
    const tips = html.split('data-chart-tip=""').slice(1).map((tip) => (tip.slice(0, tip.indexOf("row-border")).match(/<b /g) ?? []).length);
    expect(tips).toEqual([3, 1, 3]);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../../lib/data/demography/importDemography";
import { loadServedHealthData } from "../../../lib/data/health/importHealth";
import { loadServedTradeOverviewData } from "../../../lib/data/tradeOverview/importTradeOverview";
import { loadServedTradePartnersData } from "../../../lib/data/tradePartners/importTradePartners";
import { loadServedTradeProductsData } from "../../../lib/data/tradeProducts/importTradeProducts";
import { loadServedUnemploymentData } from "../../../lib/data/unemployment/importUnemployment";
import { loadServedWagesData } from "../../../lib/data/wages/importWages";
import { getMessages } from "../../../lib/i18n/messages.server";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Presentation } from "../../../lib/i18n/types";
import enLanding from "../../../lib/i18n/messages/en/landing.json";
import kaLanding from "../../../lib/i18n/messages/ka/landing.json";
import { TOOLS } from "../../../lib/mcp/tools";
import { buildChapterSentences, buildSocietySentences, societyEnglishLabelIds } from "../../../lib/landing/chapters";
import { buildAgeingChapter } from "../../../lib/landing/chapters/ageing";
import { buildDeathsChapter } from "../../../lib/landing/chapters/deaths";
import { buildTradeChapter } from "../../../lib/landing/chapters/trade";
import { buildWageGapChapter } from "../../../lib/landing/chapters/wageGap";
import { buildYouthJobsChapter } from "../../../lib/landing/chapters/youthJobs";
import { buildSourceRows, toolNames } from "../../../lib/landing/chapters/sourcesAi";
import type { ComparisonId, DeficitChapter, MunicipalChapter, ReliefPlace, RevenueSeries, SpendingSeries } from "../../../lib/landing/chapters/types";
import type { MethodologyHubEntry } from "../../../lib/methodology/types";

const ka = { locale: "ka", englishLabels: {}, messages: kaLanding } as const;
const en = { locale: "en", englishLabels: {}, messages: enLanding } as const;

function entry(id: string, title: string, firstYear: number, lastYear: number, originalFileCount: number): MethodologyHubEntry {
  return {
    id,
    title,
    summary: "s",
    href: `/methodology/${id}`,
    coverage: { firstYear, lastYear },
    originalFileCount,
    reviewedAt: "2026-01-01",
  } as MethodologyHubEntry;
}

const spending: SpendingSeries = {
  years: [2024, 2025],
  planned: [false, false],
  totals: [26_000_000_000, 27_700_000_000],
  fields: [
    { id: "spending.social_protection", label: "Social protection", values: [8_000_000_000, 9_000_000_000] },
    { id: "spending.health", label: "Health", values: [4_000_000_000, 4_500_000_000] },
    { id: "spending.other_unclassified", label: "Other", values: [14_000_000_000, 14_200_000_000] },
  ],
};

function revenueWith(liabilities: number | null, taxShare = 0.79): RevenueSeries {
  return {
    years: [2024, 2025],
    planned: [false, false],
    totals: [30_000_000_000, 32_400_000_000],
    taxShare: [0.8, taxShare],
    bands: [{ id: "liabilities", label: "x", values: [1, liabilities] }],
    peakBorrowing: null,
  };
}

function municipal(totalGel: number, topGel: number): MunicipalChapter {
  const place = (rank: number, valueGel: number) => ({
    code: rank === 1 ? "04" : String(rank),
    name: `p${rank}`,
    totalGel: valueGel,
    perResidentGel: 1,
    rank,
    city: false,
  });
  return {
    year: 2025,
    totalGel,
    places: [place(1, topGel), ...Array.from({ length: 63 }, (_, index) => place(index + 2, 1))],
    grid: { cols: 1, rows: 1, cells: [0] },
  };
}

function deficit(deepestYear: number): DeficitChapter {
  return {
    years: [deepestYear, 2025],
    pctGdp: [-9.158, -1.5],
    gel: [-1, -1],
    projectionFrom: null,
    latestActual: { year: 2025, pct: -1.5 },
    deepest: { year: deepestYear, pct: -9.158 },
    earlier: null,
    surplusRun: null,
  };
}

function sentences(overrides: { municipal?: MunicipalChapter; deficit?: DeficitChapter; presentation?: typeof ka | typeof en } = {}) {
  return buildChapterSentences(
    {
      spending,
      revenue: revenueWith(3_110_400_000),
      municipal: overrides.municipal ?? municipal(6_100_000_000, 2_100_000_000),
      deficit: overrides.deficit ?? deficit(2020),
    },
    overrides.presentation ?? ka,
  );
}

describe("buildSourceRows", () => {
  it("keeps methodology order with title, coverage years and originalFileCount; totalFiles is their sum", () => {
    const result = buildSourceRows(
      [entry("budget", "ბიუჯეტი", 2004, 2025, 31), entry("debt", "ვალი", 2010, 2025, 4)],
      "2026-10-01",
    );
    expect(result.rows).toEqual([
      { name: "ბიუჯეტი", firstYear: 2004, lastYear: 2025, files: 31 },
      { name: "ვალი", firstYear: 2010, lastYear: 2025, files: 4 },
    ]);
    expect(result.totalFiles).toBe(35);
    expect(result.reviewedAt).toBe("2026-10-01");
  });
});

describe("toolNames", () => {
  it("returns every TOOLS name in registry order", () => {
    expect(toolNames()).toEqual(TOOLS.map((tool) => tool.name));
    expect(toolNames()).toHaveLength(TOOLS.length);
  });
});

describe("buildChapterSentences", () => {
  it("writes the four Georgian sentences from the models", () => {
    expect(sentences()).toEqual({
      spending: "2025 წელს სახელმწიფო ბიუჯეტიდან 27.7 მილიარდი ლარი დაიხარჯა — ყველაზე მეტი სოციალურ დაცვაზე.",
      revenue:
        "2025 წელს ნაერთი ბიუჯეტის შემოსულობებმა 32.4 მილიარდი ლარი შეადგინა: 79% გადასახადებიდან შემოვიდა, 9.6% — ვალდებულებების ზრდიდან.",
      municipal: "64 მუნიციპალიტეტის 2025 წლის ბიუჯეტი 6.1 მილიარდი ლარია — მესამედზე მეტი, 2.1 მილიარდი, თბილისზე მოდის.",
      deficit: "ზოგადი მთავრობის დეფიციტი 2025 წელს მშპ-ის 1.5% იყო; ყველაზე ღრმა — 9.2% — 2020 წელს, პანდემიის დროს.",
    });
  });

  it("writes the English sentences with the plain field label", () => {
    const result = sentences({ presentation: en });
    expect(result.spending).toBe("In 2025 the state budget spent GEL 27.7 billion — most of it on social protection.");
    expect(result.municipal).toContain("more than a third");
    expect(result.deficit).toContain("during the pandemic");
  });

  it("the pandemic clause appears only when the deepest year is 2020", () => {
    expect(sentences({ deficit: deficit(2020) }).deficit).toContain("პანდემიის დროს");
    const other = sentences({ deficit: deficit(2009) }).deficit;
    expect(other).toBe("ზოგადი მთავრობის დეფიციტი 2025 წელს მშპ-ის 1.5% იყო; ყველაზე ღრმა — 9.2% — 2009 წელს.");
    expect(other).not.toContain("პანდემიის");
  });

  it("uses the last actual year and its pct when the series ends in projection years", () => {
    const projected: DeficitChapter = {
      years: [2020, 2024, 2025, 2026, 2027],
      pctGdp: [-9.158, -2.1, -1.5, -2.4, -2.3],
      gel: [-1, -1, -1, -1, -1],
      projectionFrom: 2026,
      latestActual: { year: 2025, pct: -1.5 },
      deepest: { year: 2020, pct: -9.158 },
      earlier: null,
      surplusRun: null,
    };
    expect(sentences({ deficit: projected }).deficit).toBe(
      "ზოგადი მთავრობის დეფიციტი 2025 წელს მშპ-ის 1.5% იყო; ყველაზე ღრმა — 9.2% — 2020 წელს, პანდემიის დროს.",
    );
  });

  it("names the latest actual balance a surplus when it is zero or more, keeping the deepest-deficit clause", () => {
    const withLatest = (pct: number, deepestYear = 2020): DeficitChapter => ({ ...deficit(deepestYear), pctGdp: [-9.158, pct], latestActual: { year: 2025, pct } });
    expect(sentences({ deficit: withLatest(0.4) }).deficit).toBe(
      "ზოგადი მთავრობის ბალანსი 2025 წელს პროფიციტით დასრულდა — მშპ-ის 0.4%; ყველაზე ღრმა დეფიციტი — 9.2% — 2020 წელს იყო, პანდემიის დროს.",
    );
    expect(sentences({ deficit: withLatest(0.4, 2009), presentation: en }).deficit).toBe(
      "The general-government balance was a surplus of 0.4% of GDP in 2025; the deepest deficit, 9.2%, was in 2009.",
    );
    // Zero is a surplus, as in the chart and its tooltip.
    expect(sentences({ deficit: withLatest(0), presentation: en }).deficit).toBe(
      "The general-government balance was a surplus of 0.0% of GDP in 2025; the deepest deficit, 9.2%, was in 2020, during the pandemic.",
    );
    expect(sentences({ deficit: withLatest(-0.4), presentation: en }).deficit).toContain("The general-government deficit was 0.4% of GDP in 2025");
  });

  it("uses the latest actual year when the first year is already a projection", () => {
    const projectedFirst: DeficitChapter = {
      years: [2019, 2020, 2025],
      pctGdp: [-2, -9.158, -1.5],
      gel: [-1, -1, -1],
      projectionFrom: 2019,
      latestActual: { year: 2025, pct: -1.5 },
      deepest: { year: 2020, pct: -9.158 },
      earlier: null,
      surplusRun: null,
    };
    expect(sentences({ deficit: projectedFirst }).deficit).toBe(
      "ზოგადი მთავრობის დეფიციტი 2025 წელს მშპ-ის 1.5% იყო; ყველაზე ღრმა — 9.2% — 2020 წელს, პანდემიის დროს.",
    );
  });

  it("takes Tbilisi's amount by its code, wherever it sits in the list", () => {
    const base = municipal(6_000_000_000, 3_000_000_000);
    const [largest, ...rest] = base.places;
    const reordered: MunicipalChapter = {
      ...base,
      // A larger place first; Tbilisi (04) third with 2.1 billion.
      places: [{ ...rest[0]!, totalGel: 3_000_000_000 }, rest[1]!, { ...largest!, totalGel: 2_100_000_000 }, ...rest.slice(2)],
    };
    expect(sentences({ municipal: reordered }).municipal).toBe(
      "64 მუნიციპალიტეტის 2025 წლის ბიუჯეტი 6.0 მილიარდი ლარია — მესამედზე მეტი, 2.1 მილიარდი, თბილისზე მოდის.",
    );
    expect(() => sentences({ municipal: { ...base, places: rest } })).toThrow(/Tbilisi/);
  });

  it("the Tbilisi share phrase picks by share", () => {
    const phrase = (share: number, presentation: typeof ka | typeof en) =>
      sentences({ municipal: municipal(1_000, share * 1_000), presentation }).municipal;
    const cases: [number, string, string][] = [
      [0.2, "მეოთხედზე ნაკლები", "less than a quarter"],
      [0.3, "მეოთხედზე მეტი", "more than a quarter"],
      [0.4, "მესამედზე მეტი", "more than a third"],
      [0.6, "ნახევარზე მეტი", "more than half"],
    ];
    for (const [share, kaPhrase, enPhrase] of cases) {
      expect(phrase(share, ka)).toContain(kaPhrase);
      expect(phrase(share, en)).toContain(enPhrase);
    }
  });

  it("tells a planned latest year as the budget's plan, in both languages", () => {
    const plannedSpending: SpendingSeries = { ...spending, planned: [false, true] };
    const plannedRevenue: RevenueSeries = { ...revenueWith(3_110_400_000), planned: [false, true] };
    const planned = (presentation: typeof ka | typeof en) =>
      buildChapterSentences(
        { spending: plannedSpending, revenue: plannedRevenue, municipal: municipal(6_100_000_000, 2_100_000_000), deficit: deficit(2020) },
        presentation,
      );
    expect(planned(ka).spending).toBe("2025 წლის სახელმწიფო ბიუჯეტით 27.7 მილიარდი ლარის ხარჯია დაგეგმილი — ყველაზე მეტი სოციალურ დაცვაზე.");
    expect(planned(en).spending).toBe("Georgia’s 2025 state budget plans 27.7 billion lari of spending — most of it on social protection.");
    expect(planned(ka).revenue).toBe(
      "2025 წლის ნაერთი ბიუჯეტით 32.4 მილიარდი ლარის შემოსულობაა დაგეგმილი: 79% გადასახადებიდან, 9.6% — ვალდებულებების ზრდიდან.",
    );
    expect(planned(en).revenue).toBe("Georgia’s 2025 consolidated budget plans 32.4 billion lari of receipts: 79% from taxes and 9.6% from new liabilities.");
    // An actual latest year keeps the past-tense sentence, even when earlier years were planned.
    const actual = buildChapterSentences(
      {
        spending: { ...spending, planned: [true, false] },
        revenue: { ...revenueWith(3_110_400_000), planned: [true, false] },
        municipal: municipal(6_100_000_000, 2_100_000_000),
        deficit: deficit(2020),
      },
      en,
    );
    expect(actual.spending).toBe("In 2025 the state budget spent GEL 27.7 billion — most of it on social protection.");
    expect(actual.revenue).toBe("In 2025 consolidated budget receipts came to GEL 32.4 billion: 79% came from taxes and 9.6% from new liabilities.");
  });

  it("treats a missing liabilities value as zero", () => {
    const result = buildChapterSentences(
      { spending, revenue: revenueWith(null), municipal: municipal(6_100_000_000, 2_100_000_000), deficit: deficit(2020) },
      ka,
    );
    expect(result.revenue).toContain("0.0% — ვალდებულებების ზრდიდან");
  });
});

const COMPARISONS: ComparisonId[] = ["notHigher", "littleHigher", "oneAndHalf", "almostTwice", "twice", "moreThanTwice"];
const CAUSES = [
  "infectious", "cancer", "blood", "endocrine", "mental", "nervous", "eye", "ear", "circulatory", "respiratory", "digestive", "skin", "musculoskeletal",
  "urogenital", "pregnancy", "perinatal", "congenital", "ill_defined", "external", "covid19",
];

describe("society chapter sentences and headings", () => {
  let society: Awaited<ReturnType<typeof buildSociety>>;

  async function buildSociety(presentation: Presentation) {
    const [demography, unemployment, wages, overview, partners, products, health] = await Promise.all([
      loadServedDemographyData(), loadServedUnemploymentData(), loadServedWagesData(), loadServedTradeOverviewData(),
      loadServedTradePartnersData(), loadServedTradeProductsData(), loadServedHealthData(),
    ]);
    return { demography, unemployment, wages, trade: { overview: overview.facts, partners, products }, health, presentation };
  }

  async function sentencesFor(locale: "ka" | "en") {
    const data = society;
    const ids = societyEnglishLabelIds(data.trade);
    const presentation = await getPresentation(locale, ["landing", "health"], ids);
    const places: ReliefPlace[] = [];
    return buildSocietySentences({
      ageing: buildAgeingChapter(data.demography.facts, places),
      youthJobs: buildYouthJobsChapter(data.unemployment.facts, presentation),
      wageGap: buildWageGapChapter(data.wages.facts, presentation),
      trade: buildTradeChapter(data.trade, presentation),
      deaths: buildDeathsChapter(data.health.facts, presentation.messages),
    }, presentation);
  }

  beforeAll(async () => {
    society = await buildSociety({ locale: "ka", englishLabels: {}, messages: {} });
  }, 120_000);

  it("writes the Georgian ledes of the board from the real data", async () => {
    const result = await sentencesFor("ka");
    expect(result.ageing).toBe("65 წლისა და უფროსი ასაკის მოსახლეობის წილი 18.1%-ია — 2004 წელს 14.1% იყო; 2025 წელს ყოველ 100 გარდაცვლილზე 85 ახალშობილი მოდიოდა.");
    expect(result.youthJobs).toBe("2025 წელს უმუშევრობის დონე 13.9% იყო, 15–29 წლის ახალგაზრდებში — 25.4%.");
    expect(result.wageGap).toBe("საშუალო თვიური ხელფასი 2025 წელს 2 165 ლარი იყო; ქალები კაცების საშუალო ხელფასის 67%-ს იღებენ.");
    expect(result.trade).toBe("2025 წელს საგარეო სავაჭრო ბრუნვამ 25.9 მილიარდი დოლარი შეადგინა: ექსპორტი 7.3 მილიარდი იყო, იმპორტი — 18.6.");
    expect(result.deaths).toBe("2025 წელს 44 319 ადამიანი გარდაიცვალა, 38% — სისხლის მიმოქცევის სისტემის დაავადებებით; ყოველი მეხუთე შემთხვევის მიზეზი დადგენილი არ არის.");
  }, 120_000);

  it("writes the headings the chapter claim switches on", async () => {
    const { headings } = await sentencesFor("ka");
    expect(headings).toEqual({ ageing: "საქართველო ბერდება", youthJobs: "ახალგაზრდებში უმუშევრობა თითქმის ორჯერ მაღალია" });
  }, 120_000);

  it("writes the English ledes with the same numbers", async () => {
    const result = await sentencesFor("en");
    expect(result.ageing).toContain("18.1%");
    expect(result.ageing).toContain("14.1%");
    expect(result.ageing).toContain("2004");
    expect(result.ageing).toContain("85");
    expect(result.youthJobs).toContain("13.9%");
    expect(result.youthJobs).toContain("25.4%");
    expect(result.wageGap).toContain("2,165");
    expect(result.wageGap).toContain("67%");
    expect(result.trade).toContain("25.9");
    expect(result.trade).toContain("7.3");
    expect(result.trade).toContain("18.6");
    expect(result.deaths).toContain("44,319");
    expect(result.deaths).toContain("38%");
    expect(result.deaths).toContain("circulatory diseases");
    expect(result.deaths).toContain("one in five");
    expect(result.headings).toEqual({ ageing: "Georgia is getting older", youthJobs: "Youth unemployment is almost twice as high" });
  }, 120_000);

  it("has a heading for every comparison, the ageing fallback, and a cause form for every cause, in both languages", () => {
    for (const messages of [kaLanding, enLanding] as Record<string, string>[]) {
      for (const id of COMPARISONS) expect(messages[`landing.jobs.heading.${id}`], id).toBeTruthy();
      expect(messages["landing.ageing.heading.ageing"]).toBeTruthy();
      expect(messages["landing.ageing.heading.changing"]).toBeTruthy();
      for (const id of CAUSES) expect(messages[`landing.deaths.cause.${id}`], id).toBeTruthy();
      for (let n = 2; n <= 10; n += 1) expect(messages[`landing.deaths.oneIn.${n}`], String(n)).toBeTruthy();
      expect(messages["landing.deaths.share"]).toContain("{pct}");
    }
  });

  it("switches the headings and the unknown-cause phrase with the data", async () => {
    const real = await sentencesFor("ka");
    const base = real.headings;
    expect(base.ageing).toBe("საქართველო ბერდება");

    const models = {
      ageing: { ...buildAgeingChapter(society.demography.facts, []), ageing: false },
      youthJobs: { ...buildYouthJobsChapter(society.unemployment.facts, { locale: "ka", englishLabels: {}, messages: {} }), comparison: "moreThanTwice" as const },
      wageGap: buildWageGapChapter(society.wages.facts, { locale: "ka", englishLabels: {}, messages: {} }),
      trade: buildTradeChapter(society.trade, { locale: "ka", englishLabels: {}, messages: {} }),
      deaths: { ...buildDeathsChapter(society.health.facts, await getMessages("ka", ["landing", "health"])), unknownShare: 0.03 },
    };
    const result = buildSocietySentences(models, { locale: "ka", englishLabels: {}, messages: await getMessages("ka", ["landing", "health"]) });
    expect(result.headings).toEqual({ ageing: "როგორ იცვლება საქართველოს მოსახლეობა", youthJobs: "ახალგაზრდებში უმუშევრობა ორჯერზე მეტად მაღალია" });
    expect(result.deaths).toContain("; 3% შემთხვევის მიზეზი დადგენილი არ არის.");
  }, 120_000);
});

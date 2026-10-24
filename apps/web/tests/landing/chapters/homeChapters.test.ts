import { describe, expect, it } from "vitest";
import enLanding from "../../../lib/i18n/messages/en/landing.json";
import kaLanding from "../../../lib/i18n/messages/ka/landing.json";
import { TOOLS } from "../../../lib/mcp/tools";
import { buildChapterSentences } from "../../../lib/landing/chapters";
import { buildSourceRows, toolNames } from "../../../lib/landing/chapters/sourcesAi";
import type { DeficitChapter, MunicipalChapter, RevenueSeries, SpendingSeries } from "../../../lib/landing/chapters/types";
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
    code: String(rank),
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
      deepest: { year: 2020, pct: -9.158 },
      earlier: null,
      surplusRun: null,
    };
    expect(sentences({ deficit: projected }).deficit).toBe(
      "ზოგადი მთავრობის დეფიციტი 2025 წელს მშპ-ის 1.5% იყო; ყველაზე ღრმა — 9.2% — 2020 წელს, პანდემიის დროს.",
    );
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
    expect(planned(en).revenue).toBe("Georgia’s 2025 consolidated budget plans 32.4 billion lari of revenue: 79% from taxes and 9.6% from new liabilities.");
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
    expect(actual.revenue).toBe("In 2025 consolidated budget revenue came to GEL 32.4 billion: 79% came from taxes and 9.6% from new liabilities.");
  });

  it("treats a missing liabilities value as zero", () => {
    const result = buildChapterSentences(
      { spending, revenue: revenueWith(null), municipal: municipal(6_100_000_000, 2_100_000_000), deficit: deficit(2020) },
      ka,
    );
    expect(result.revenue).toContain("0.0% — ვალდებულებების ზრდიდან");
  });
});

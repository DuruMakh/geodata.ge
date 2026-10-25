import { describe, expect, it } from "vitest";
import { birthsTip, deficitTip, migrationTip, plannedYearText, pyramidTip, regionTip, reliefTip, revenueTip, tradeLineTip, tradePartnerTip, waffleTip, wageTip } from "../../../components/landing/chapters/chart-tips";
import type { AgeingChapter, DeficitChapter, LabourSplit, MunicipalChapter, RevenueSeries, TradeChapter, WageGapChapter, YouthJobsChapter } from "../../../lib/landing/chapters/types";

const labels = {
  locale: "ka" as const,
  planned: "გეგმა",
  total: "სულ",
  taxes: "გადასახადები",
  imf: "IMF",
  vsGdp: "მშპ-სთან",
  inGel: "ლარში",
  deficit: "დეფიციტი",
  surplus: "პროფიციტი",
};

const revenue: RevenueSeries = {
  years: [2024, 2025],
  planned: [false, true],
  totals: [12e9, 14e9],
  taxShare: [1, 0.8571],
  bands: [
    { id: "vat", label: "დღგ", values: [8e9, 9e9] },
    { id: "income", label: "საშემოსავლო", values: [4e9, 3e9] },
    { id: "liabilities", label: "ვალდებულებების ზრდა", values: [null, 2e9] },
  ],
  peakBorrowing: null,
};
const colors = ["#28568e", "#50aed5", "var(--accent)"];

describe("revenueTip", () => {
  it("lists the top band first and shows a dash for a band without a value", () => {
    const tip = revenueTip(revenue, labels, colors, 0);
    expect(tip.rows.map((row) => row.name)).toEqual(["ვალდებულებების ზრდა", "საშემოსავლო", "დღგ"]);
    expect(tip.rows.map((row) => row.key)).toEqual(["var(--accent)", "#50aed5", "#28568e"]);
    expect(tip.rows[0].val).toBe("—");
    expect(tip.rows[2].val).toBe("8.00 მლრდ ₾");
  });

  it("puts the planned suffix in the title of a planned year only", () => {
    expect(revenueTip(revenue, labels, colors, 1).title).toBe("2025 (გეგმა)");
    expect(revenueTip(revenue, labels, colors, 0).title).toBe("2024");
    expect(plannedYearText(revenue, 1, "გეგმა")).toBe("2025 (გეგმა)");
  });

  it("closes with the total and the tax share", () => {
    expect(revenueTip(revenue, labels, colors, 1).foot).toBe("სულ 14.0 მლრდ ₾ · გადასახადები 86%");
  });
});

const deficit: DeficitChapter = {
  years: [2004, 2020, 2026],
  pctGdp: [1.234, -9.16, -2.5],
  gel: [0.3e9, -4.6e9, -2.9e9],
  projectionFrom: 2026,
  latestActual: { year: 2020, pct: -9.16 },
  deepest: { year: 2020, pct: -9.16 },
  earlier: null,
  surplusRun: null,
};

describe("deficitTip", () => {
  it("titles a projected year with the forecast label", () => {
    expect(deficitTip(deficit, labels, 2).title).toBe("2026 · IMF");
    expect(deficitTip(deficit, labels, 1).title).toBe("2020");
    expect(deficitTip({ ...deficit, projectionFrom: null }, labels, 2).title).toBe("2026");
  });

  it("reads deficit for a negative balance and surplus for a positive one, with matching key colour", () => {
    const negative = deficitTip(deficit, labels, 1);
    expect(negative.foot).toBe("დეფიციტი");
    expect(negative.rows[0]).toEqual({ key: "var(--ink)", val: "−9.16%", name: "მშპ-სთან" });
    expect(negative.rows[1]).toEqual({ val: "−4.60 მლრდ ₾", name: "ლარში" });
    const positive = deficitTip(deficit, labels, 0);
    expect(positive.foot).toBe("პროფიციტი");
    expect(positive.rows[0].key).toBe("var(--positive)");
    expect(positive.rows[0].val).toBe("1.23%");
  });
});

const reliefLabels = {
  locale: "ka" as const,
  budget: "ბიუჯეტი",
  perResident: "ერთ მოსახლეზე",
  rank: "რანგი ბიუჯეტით",
  occupied: "ოკუპირებული ტერიტორია",
  occupiedNote: "მუნიციპალური ბიუჯეტის მონაცემები არ არსებობს",
};
const relief: MunicipalChapter = {
  year: 2025,
  totalGel: 2.6e9,
  places: [
    { code: "04", name: "თბილისი", totalGel: 2.1084e9, perResidentGel: 1702.4, rank: 1, city: false },
    { code: "06", name: "ბათუმი", totalGel: 486.2e6, perResidentGel: 2861.6, rank: 2, city: true },
  ],
  grid: { cols: 1, rows: 1, cells: [0] },
};

describe("reliefTip", () => {
  it("shows a place's name, budget for the year, budget per resident and rank among all places", () => {
    expect(reliefTip(relief, reliefLabels, 1)).toEqual({
      title: "ბათუმი",
      rows: [
        { key: "var(--ink)", val: "486\u00a0მლნ ₾", name: "ბიუჯეტი, 2025" },
        { val: "2,862 ₾", name: "ერთ მოსახლეზე" },
      ],
      foot: "რანგი ბიუჯეტით: 2 / 2",
    });
    expect(reliefTip(relief, reliefLabels, 0).rows[0].val).toBe("2.11\u00a0მლრდ ₾");
  });

  it("says an occupied area has no municipal budget data", () => {
    expect(reliefTip(relief, reliefLabels, -2)).toEqual({ title: "ოკუპირებული ტერიტორია", rows: [], foot: "მუნიციპალური ბიუჯეტის მონაცემები არ არსებობს" });
  });
});

const pyramid: AgeingChapter["pyramid"] = {
  year: 2026,
  baseYear: 2004,
  ages: ["0–4", "85+"],
  men: [106170, 19083],
  women: [97930, 49131],
  baseMen: [116228, 7809],
  baseWomen: [102534, 21710],
};

describe("pyramidTip", () => {
  it("shows the age group's men and women as shares of everyone, with counts, and both sexes in the first year", () => {
    // 2026 total 272,314; 2004 total 248,281.
    expect(pyramidTip(pyramid, { men: "კაცები", women: "ქალები", years: "წელი", bothSexes: "ორივე სქესი" }, 1)).toEqual({
      title: "85+ წელი",
      rows: [
        { key: "#3D5A98", val: "7.01%", name: "კაცები · 19,083" },
        { key: "#C26E4C", val: "18.04%", name: "ქალები · 49,131" },
        { key: "var(--ink)", val: "11.89%", name: "ორივე სქესი, 2004" },
      ],
      foot: "ორივე სქესი, 2026: 25.05%",
    });
  });
});

const migration: AgeingChapter["migration"] = { years: [2022, 2023], net: [54509, -39207] };
const migrationLabels = { net: "მიგრაციის სალდო", moreArrived: "ჩამოვიდა მეტი, ვიდრე წავიდა", moreLeft: "წავიდა მეტი, ვიდრე ჩამოვიდა" };

describe("migrationTip", () => {
  it("shows the signed balance of the year and says which way people moved", () => {
    expect(migrationTip(migration, migrationLabels, 0)).toEqual({
      title: "2022",
      rows: [{ key: "#1e7f86", val: "+54,509", name: "მიგრაციის სალდო" }],
      foot: "ჩამოვიდა მეტი, ვიდრე წავიდა",
    });
    expect(migrationTip(migration, migrationLabels, 1)).toEqual({
      title: "2023",
      rows: [{ key: "var(--accent)", val: "−39,207", name: "მიგრაციის სალდო" }],
      foot: "წავიდა მეტი, ვიდრე ჩამოვიდა",
    });
  });
});

const births: AgeingChapter["births"] = {
  year: 2025,
  births: 37867,
  deaths: 44319,
  places: [{ births: 2630, deaths: 1779 }, { births: 31, deaths: 109 }, { births: 50, deaths: 50 }, null],
};
const birthPlaces = [
  { code: "06", name: "ბათუმი", totalGel: 1, perResidentGel: 1, rank: 1, city: true },
  { code: "71", name: "ონი", totalGel: 1, perResidentGel: 1, rank: 2, city: false },
  { code: "01", name: "თანაბარი", totalGel: 1, perResidentGel: 1, rank: 3, city: false },
  { code: "02", name: "უცნობი", totalGel: 1, perResidentGel: 1, rank: 4, city: false },
];
const birthsLabels = {
  perHundred: "დაბადება 100 გარდაცვალებაზე",
  births: "დაბადება",
  deaths: "გარდაცვალება",
  increase: "ბუნებრივი მატება",
  decrease: "ბუნებრივი კლება",
  balanced: "დაბადება და გარდაცვალება თანაბარია",
  noData: "მონაცემები არ არის",
  occupied: "ოკუპირებული ტერიტორია",
};

describe("birthsTip", () => {
  it("shows births per 100 deaths in the place's class colour, the two counts and the natural increase", () => {
    expect(birthsTip(births, birthPlaces, birthsLabels, 0)).toEqual({
      title: "ბათუმი",
      rows: [
        { key: "#1e7f86", val: "148", name: "დაბადება 100 გარდაცვალებაზე" },
        { val: "2,630", name: "დაბადება" },
        { val: "1,779", name: "გარდაცვალება" },
      ],
      foot: "ბუნებრივი მატება: +851",
    });
  });

  it("states a natural decrease without a sign, and an even balance in words", () => {
    const oni = birthsTip(births, birthPlaces, birthsLabels, 1);
    expect(oni.rows[0]).toEqual({ key: "#7d2a1b", val: "28", name: "დაბადება 100 გარდაცვალებაზე" });
    expect(oni.foot).toBe("ბუნებრივი კლება: 78");
    expect(birthsTip(births, birthPlaces, birthsLabels, 2).foot).toBe("დაბადება და გარდაცვალება თანაბარია");
  });

  it("says there is no data for a place without figures and for an occupied area (-2)", () => {
    expect(birthsTip(births, birthPlaces, birthsLabels, 3)).toEqual({ title: "უცნობი", rows: [{ val: "მონაცემები არ არის" }] });
    expect(birthsTip(births, birthPlaces, birthsLabels, -2)).toEqual({ title: "ოკუპირებული ტერიტორია", rows: [{ val: "მონაცემები არ არის" }] });
  });
});

const labourAll: LabourSplit = { employed: 1389.7, unemployed: 224, outside: 1349.4, rate: 13.88, per100: [47, 8, 45] };
const waffleLabels = {
  employed: "დასაქმებული",
  unemployed: "უმუშევარი",
  outside: "შრომის ძალის გარეთ",
  who: "15+ ასაკის მოსახლეობის",
  people: "ადამიანი",
  thousand: "ათასი",
  unemploymentRate: "უმუშევრობის დონე",
  ofLabourForce: "შრომის ძალიდან",
  labourForce: "შრომის ძალა",
  neither: "არც მუშაობს და არც სამსახურს ეძებს",
};

describe("waffleTip", () => {
  it("shows each group's share of the whole and its count in thousands, with the labour-force size as the employed foot", () => {
    expect(waffleTip(labourAll, waffleLabels, 0)).toEqual({
      title: "დასაქმებული",
      rows: [
        { key: "var(--ink)", val: "46.9%", name: "15+ ასაკის მოსახლეობის" },
        { val: "1,389.7 ათასი", name: "ადამიანი" },
      ],
      foot: "შრომის ძალა — 1,613.7 ათასი",
    });
  });

  it("gives the unemployed the unemployment rate of the labour force and the outsiders the neither-nor text", () => {
    const unemployed = waffleTip(labourAll, waffleLabels, 1);
    expect(unemployed.rows[0]).toEqual({ key: "var(--accent)", val: "7.6%", name: "15+ ასაკის მოსახლეობის" });
    expect(unemployed.foot).toBe("უმუშევრობის დონე — 13.9% შრომის ძალიდან");
    const outside = waffleTip(labourAll, waffleLabels, 2);
    expect(outside.rows[0]).toEqual({ key: "var(--control)", val: "45.5%", name: "15+ ასაკის მოსახლეობის" });
    expect(outside.foot).toBe("არც მუშაობს და არც სამსახურს ეძებს");
  });
});

const regions: YouthJobsChapter["regions"] = [
  { id: "tbilisi", label: "თბილისი", rate: 17.5 },
  { id: "imereti", label: "იმერეთი", rate: 13.9 },
  { id: "samtskhe_javakheti", label: "სამცხე-ჯავახეთი", rate: 7 },
];
const regionLabels = {
  rate: "უმუშევრობის დონე, 2025",
  equal: "საქართველოს საშუალოს ტოლი",
  higher: "საქართველოს საშუალოზე {diff} პ.პ.-ით მაღალი",
  lower: "საქართველოს საშუალოზე {diff} პ.პ.-ით დაბალი",
};

describe("regionTip", () => {
  it("shows the region's rate and how many points it is above or below the Georgia rate", () => {
    expect(regionTip(regions, 13.88, regionLabels, 0)).toEqual({
      title: "თბილისი",
      rows: [{ key: "var(--ink)", val: "17.5%", name: "უმუშევრობის დონე, 2025" }],
      foot: "საქართველოს საშუალოზე 3.6 პ.პ.-ით მაღალი",
    });
    expect(regionTip(regions, 13.88, regionLabels, 2).foot).toBe("საქართველოს საშუალოზე 6.9 პ.პ.-ით დაბალი");
  });

  it("says a region equals the Georgia rate when they differ by less than 0.05 points", () => {
    expect(regionTip(regions, 13.88, regionLabels, 1).foot).toBe("საქართველოს საშუალოს ტოლი");
  });
});

describe("wageTip", () => {
  const sectors: WageGapChapter["sectors"] = [
    { id: "finance", label: "ფინანსები და დაზღვევა", average: 5900.46, women: 4300.04, men: 7600.5 },
    { id: "education", label: "განათლება", average: 1200, women: 1250, men: 1100 },
  ];
  const wageLabels = { men: "კაცები", women: "ქალები", average: "საშუალო", foot: "ქალების ხელფასი კაცებისის {pct}%-ია" };

  it("lists men, women and the average of the sector with the year in the title, and women's pay as a share of men's in the foot", () => {
    expect(wageTip(sectors, 2025, wageLabels, 0)).toEqual({
      title: "ფინანსები და დაზღვევა, 2025",
      rows: [
        { key: "#3D5A98", val: "7,600.5 ₾", name: "კაცები" },
        { key: "#C26E4C", val: "4,300.0 ₾", name: "ქალები" },
        { key: "var(--ink)", val: "5,900.5 ₾", name: "საშუალო" },
      ],
      foot: "ქალების ხელფასი კაცებისის 56.6%-ია",
    });
  });

  it("states a sector where women earn more as a share above 100", () => {
    expect(wageTip(sectors, 2025, wageLabels, 1).foot).toBe("ქალების ხელფასი კაცებისის 113.6%-ია");
  });
});

describe("tradePartnerTip", () => {
  const partners: TradeChapter["partners"] = [
    { id: "p.tr", label: "თურქეთი", exportsUsd: 0.33e9, importsUsd: 2.78e9, turnoverUsd: 3.11e9 },
    { id: "p.kg", label: "ყირგიზეთი", exportsUsd: 1.5e9, importsUsd: 0.01e9, turnoverUsd: 1.51e9 },
  ];
  const tradeLabels = { exports: "ექსპორტი", imports: "იმპორტი", balance: "ბალანსი", turnover: "ბრუნვა", unit: "მლრდ $" };

  it("lists exports, imports and the signed balance with the year in the title, and the turnover in the foot", () => {
    expect(tradePartnerTip(partners, 2025, tradeLabels, 0)).toEqual({
      title: "თურქეთი, 2025",
      rows: [
        { key: "#1f6e56", val: "0.33 მლრდ $", name: "ექსპორტი" },
        { key: "#3a332a", val: "2.78 მლრდ $", name: "იმპორტი" },
        { val: "−2.45 მლრდ $", name: "ბალანსი" },
      ],
      foot: "ბრუნვა — 3.11 მლრდ $",
    });
  });

  it("marks a surplus with a plus sign", () => {
    expect(tradePartnerTip(partners, 2025, tradeLabels, 1).rows[2].val).toBe("+1.49 მლრდ $");
  });
});

describe("tradeLineTip", () => {
  const series = { years: [2024, 2025], exports: [6.6e9, 7.288e9], imports: [16.9e9, 18.649e9] };
  const lineLabels = { exports: "ექსპორტი", imports: "იმპორტი", balance: "ბალანსი", unit: "მლრდ $" };

  it("lists both values of the year, the larger first, and the signed balance in the foot", () => {
    expect(tradeLineTip(series, lineLabels, 1)).toEqual({
      title: "2025",
      rows: [
        { key: "#3a332a", val: "18.6 მლრდ $", name: "იმპორტი" },
        { key: "#1f6e56", val: "7.3 მლრდ $", name: "ექსპორტი" },
      ],
      foot: "ბალანსი: −11.4 მლრდ $",
    });
  });

  it("lists the larger value first also when exports exceed imports", () => {
    const tip = tradeLineTip({ years: [2000], exports: [5e9], imports: [3e9] }, lineLabels, 0);
    expect(tip.rows.map((row) => row.name)).toEqual(["ექსპორტი", "იმპორტი"]);
    expect(tip.foot).toBe("ბალანსი: +2.0 მლრდ $");
  });
});

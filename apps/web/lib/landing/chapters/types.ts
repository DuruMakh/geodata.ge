// Shared model for the homepage chapters. Each chapter builder in this folder
// returns one of these; the chart components only draw what they are handed.

export type ChapterLink = { href: string; hint: string };

export type SpendingSeries = {
  years: number[]; // ascending, first..latest active expenditure year
  planned: boolean[]; // per year: any active fact of that year is planned
  totals: number[]; // GEL per year, sum of fields
  fields: { id: string; label: string; values: number[] }[]; // GEL, sorted by latest-year value desc, other_unclassified last
};

export type RevenueBandId = "vat" | "income" | "profit" | "excise" | "otherTaxes" | "otherIncome" | "liabilities";

export type RevenueSeries = {
  years: number[];
  planned: boolean[]; // per year: any active fact of that year is planned
  totals: number[];
  taxShare: number[]; // fraction 0..1
  bands: { id: RevenueBandId; label: string; values: (number | null)[] }[];
  peakBorrowing: { year: number; share: number } | null;
};

export type ScaleMeasureId = "gdp" | "revenue" | "spending" | "debt" | "balance" | "municipal" | "fdi" | "remittances";

/** One square of chapter 01 is GEL 10 million, so GDP itself is the full grid. */
export const GEL_PER_SQUARE = 10_000_000;

export type ScaleChapter = {
  year: number;
  gdpGel: number;
  squares: number;
  defaultId: "spending";
  // planned: the measure's value for the year is planned (spending and revenue can be; the rest are actual)
  measures: { id: ScaleMeasureId; label: string; valueGel: number; squares: number; share: number; planned: boolean }[];
};

export type DeficitChapter = {
  years: number[];
  pctGdp: number[];
  gel: number[];
  projectionFrom: number | null;
  latestActual: { year: number; pct: number }; // the last year with status actual, whatever comes before it
  deepest: { year: number; pct: number };
  earlier: { year: number; pct: number } | null;
  surplusRun: { first: number; last: number } | null;
};

export type ReliefPlace = { code: string; name: string; totalGel: number; perResidentGel: number; rank: number; city: boolean };

export type MunicipalChapter = {
  year: number;
  totalGel: number;
  places: ReliefPlace[];
  grid: { cols: number; rows: number; cells: number[] }; // cells[r*cols+c]: place index, -1 empty, -2 occupied area
};

export type SourceRow = { name: string; firstYear: number; lastYear: number; files: number };

export type HomeChapters = {
  scale: ScaleChapter;
  spending: SpendingSeries;
  revenue: RevenueSeries;
  municipal: MunicipalChapter;
  deficit: DeficitChapter;
  sources: { rows: SourceRow[]; totalFiles: number; reviewedAt: string };
  tools: string[];
  sentences: Record<"spending" | "revenue" | "municipal" | "deficit", string>;
};

export type AgeingChapter = {
  pyramid: { year: number; baseYear: number; ages: string[]; men: number[]; women: number[]; baseMen: number[]; baseWomen: number[] }; // ages youngest first: "0–4" … "85+"; persons
  oldShare: { year: number; share: number }; oldShareBase: { year: number; share: number }; // 65+ share, fraction
  ageing: boolean; // oldShare.share > oldShareBase.share
  womenPer100Men: number; oldestWomenPerMan: number; // latest pyramid year; 85+ women / men
  lifeExpectancy: { year: number; total: number; women: number; men: number };
  fertility: { year: number; rate: number };
  migration: { years: number[]; net: number[] }; // consecutive years with a net value, ascending
  births: { year: number; births: number; deaths: number; places: ({ births: number; deaths: number } | null)[] }; // places aligned with MunicipalChapter.places
};

export type LabourSplit = { employed: number; unemployed: number; outside: number; rate: number; per100: [number, number, number] }; // thousand persons; rate percent
export type ComparisonId = "notHigher" | "littleHigher" | "oneAndHalf" | "almostTwice" | "twice" | "moreThanTwice";
export type YouthJobsChapter = { year: number; all: LabourSplit; youth: LabourSplit; ratio: number; comparison: ComparisonId; regions: { id: string; label: string; rate: number }[] }; // regions rate desc

export type WageGapChapter = {
  year: number; average: number; women: number; men: number; ratio: number; // ratio = women / men
  median: { year: number; value: number };
  publicSector: number; nonPublic: number;
  history: { years: number[]; values: number[] }; // national average, first..latest
  sectors: { id: string; label: string; average: number; women: number; men: number }[]; // average desc
};

export type TradeChapter = {
  year: number; exportsUsd: number; importsUsd: number; turnoverUsd: number; balanceUsd: number;
  years: number[]; exports: number[]; imports: number[]; // USD, one per year, first..latest
  partners: { id: string; label: string; exportsUsd: number; importsUsd: number; turnoverUsd: number }[]; // countries only, at most 10, turnover desc
  topProduct: { label: string; usd: number; share: number }; secondProduct: { label: string; usd: number } | null; // share of national exports
};

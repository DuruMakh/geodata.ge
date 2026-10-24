import type { GlossaryEntry } from "../../data/glossary";
import type { MunicipalListRow } from "../../explorer/municipalData";
import { UNIT_BN, formatInUnit, formatShare } from "../../explorer/format";
import { message } from "../../i18n/messages";
import type { Presentation } from "../../i18n/types";
import type { MethodologyHubEntry } from "../../methodology/types";
import type { ServedBudgetFact } from "../../servedRows";
import { OTHER_UNCLASSIFIED_ID, buildRevenueSeries, buildSpendingSeries } from "./budgetSeries";
import { buildDeficitChapter } from "./deficit";
import { buildMunicipalChapter } from "./municipalRelief";
import { buildScaleChapter, type ScaleInput } from "./scale";
import { buildSourceRows, toolNames } from "./sourcesAi";
import type { DeficitChapter, HomeChapters, MunicipalChapter, RevenueSeries, SpendingSeries } from "./types";

// Assembles the five chapter models for the homepage. Every number comes from
// the served inputs; the one-line ledes are sentences over those same models.

const PANDEMIC_YEAR = 2020;

export type HomeChaptersInput = Omit<ScaleInput, "spending" | "revenue"> & {
  budgetFacts: ServedBudgetFact[];
  glossary: Map<string, GlossaryEntry>;
  municipalRows: MunicipalListRow[];
  municipalYear: number;
  methodologyEntries: MethodologyHubEntry[];
  updatedAt: string;
};

type SentenceModels = {
  spending: SpendingSeries;
  revenue: RevenueSeries;
  municipal: MunicipalChapter;
  deficit: DeficitChapter;
};

const billions = (valueGel: number) => formatInUnit(valueGel, UNIT_BN);

function tbilisiSharePhrase(share: number): string {
  if (share < 0.25) return "quarterLess";
  if (share < 1 / 3) return "quarterMore";
  if (share < 0.5) return "thirdMore";
  return "halfMore";
}

export function buildChapterSentences({ spending, revenue, municipal, deficit }: SentenceModels, presentation: Presentation): HomeChapters["sentences"] {
  const { messages } = presentation;

  const spendingIndex = spending.years.length - 1;
  // Fields sort biggest first with the unclassified remainder last, so "most on X" never names it.
  const largest = spending.fields.find((field) => field.id !== OTHER_UNCLASSIFIED_ID)!;

  const revenueIndex = revenue.years.length - 1;
  const liabilities = revenue.bands.find((band) => band.id === "liabilities")?.values[revenueIndex] ?? 0;

  const largestPlace = municipal.places[0]!;

  // The latest actual year: the one before the projections start, else the last.
  const deficitIndex = deficit.projectionFrom === null ? deficit.years.length - 1 : deficit.years.indexOf(deficit.projectionFrom) - 1;
  const deficitKey = deficit.deepest.year === PANDEMIC_YEAR ? "landing.sentence.deficitPandemic" : "landing.sentence.deficit";

  return {
    spending: message(messages, "landing.sentence.spending", {
      year: spending.years[spendingIndex]!,
      total: billions(spending.totals[spendingIndex]!),
      field: message(messages, `landing.spendingField.${largest.id.replace(/^spending\./, "")}`),
    }),
    revenue: message(messages, "landing.sentence.revenue", {
      year: revenue.years[revenueIndex]!,
      total: billions(revenue.totals[revenueIndex]!),
      tax: formatShare(revenue.taxShare[revenueIndex]!, false, 0),
      liabilities: formatShare(liabilities / revenue.totals[revenueIndex]!, false, 1),
    }),
    municipal: message(messages, "landing.sentence.municipal", {
      count: municipal.places.length,
      year: municipal.year,
      total: billions(municipal.totalGel),
      share: message(messages, `landing.sentence.share.${tbilisiSharePhrase(largestPlace.totalGel / municipal.totalGel)}`),
      top: billions(largestPlace.totalGel),
    }),
    deficit: message(messages, deficitKey, {
      year: deficit.years[deficitIndex]!,
      pct: formatShare(Math.abs(deficit.pctGdp[deficitIndex]!) / 100),
      deepest: formatShare(Math.abs(deficit.deepest.pct) / 100),
      deepestYear: deficit.deepest.year,
    }),
  };
}

export function buildHomeChapters(input: HomeChaptersInput, presentation: Presentation): HomeChapters {
  const spending = buildSpendingSeries(input.budgetFacts, input.glossary, presentation);
  const revenue = buildRevenueSeries(input.budgetFacts, input.glossary, presentation);
  const municipal = buildMunicipalChapter(input.municipalRows, input.municipalYear, presentation);
  const deficit = buildDeficitChapter(input.balanceFacts);

  return {
    scale: buildScaleChapter({ ...input, spending, revenue }, presentation.messages),
    spending,
    revenue,
    municipal,
    deficit,
    sources: buildSourceRows(input.methodologyEntries, input.updatedAt),
    tools: toolNames(),
    sentences: buildChapterSentences({ spending, revenue, municipal, deficit }, presentation),
  };
}

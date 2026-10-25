import type { GlossaryEntry } from "../../data/glossary";
import type { ServedDemographyObservation } from "../../data/demography/types";
import type { HealthFact } from "../../data/health/types";
import type { TradeOverviewFact } from "../../data/tradeOverview/types";
import type { TradePartnersData } from "../../data/tradePartners/types";
import type { TradeProductsData } from "../../data/tradeProducts/types";
import type { ServedUnemploymentObservation } from "../../data/unemployment/types";
import type { WagesFact } from "../../data/wages/types";
import type { MunicipalListRow } from "../../explorer/municipalData";
import { REGIONAL_ECONOMY_REGIONS } from "../../data/regionalEconomies/importRegionalEconomies";
import { WAGES_SECTORS } from "../../data/wages/types";
import { UNIT_BN, UNIT_PERSONS, formatInUnit, formatShare } from "../../explorer/format";
import { message } from "../../i18n/messages";
import type { Presentation } from "../../i18n/types";
import type { MethodologyHubEntry } from "../../methodology/types";
import type { ServedBudgetFact } from "../../servedRows";
import { OTHER_UNCLASSIFIED_ID, buildRevenueSeries, buildSpendingSeries } from "./budgetSeries";
import { buildAgeingChapter } from "./ageing";
import { buildDeathsChapter, oneInN } from "./deaths";
import { buildDeficitChapter } from "./deficit";
import { buildMunicipalChapter } from "./municipalRelief";
import { buildScaleChapter, type ScaleInput } from "./scale";
import { buildSourceRows, toolNames } from "./sourcesAi";
import { buildTradeChapter } from "./trade";
import type {
  AgeingChapter, BudgetSentenceKey, DeathsChapter, DeficitChapter, HomeChapters, MunicipalChapter, RevenueSeries, SocietySentences, SpendingSeries,
  TradeChapter, WageGapChapter, YouthJobsChapter,
} from "./types";
import { buildWageGapChapter } from "./wageGap";
import { buildYouthJobsChapter } from "./youthJobs";

// Assembles the five chapter models for the homepage. Every number comes from
// the served inputs; the one-line ledes are sentences over those same models.

const PANDEMIC_YEAR = 2020;
const TBILISI_CODE = "04";

export type HomeChaptersInput = Omit<ScaleInput, "spending" | "revenue"> & {
  budgetFacts: ServedBudgetFact[];
  glossary: Map<string, GlossaryEntry>;
  municipalRows: MunicipalListRow[];
  municipalYear: number;
  demographyFacts: ServedDemographyObservation[];
  unemploymentFacts: ServedUnemploymentObservation[];
  wagesFacts: WagesFact[];
  trade: { overview: TradeOverviewFact[]; partners: TradePartnersData; products: TradeProductsData };
  healthFacts: HealthFact[];
  methodologyEntries: MethodologyHubEntry[];
  updatedAt: string;
};

type SentenceModels = {
  spending: SpendingSeries;
  revenue: RevenueSeries;
  municipal: MunicipalChapter;
  deficit: DeficitChapter;
};

type SocietyModels = { ageing: AgeingChapter; youthJobs: YouthJobsChapter; wageGap: WageGapChapter; trade: TradeChapter; deaths: DeathsChapter };

const billions = (valueGel: number) => formatInUnit(valueGel, UNIT_BN);

function tbilisiSharePhrase(share: number): string {
  if (share < 0.25) return "quarterLess";
  if (share < 1 / 3) return "quarterMore";
  if (share < 0.5) return "thirdMore";
  return "halfMore";
}

export function buildChapterSentences({ spending, revenue, municipal, deficit }: SentenceModels, presentation: Presentation): Record<BudgetSentenceKey, string> {
  const { messages } = presentation;

  const spendingIndex = spending.years.length - 1;
  // Fields sort biggest first with the unclassified remainder last, so "most on X" never names it.
  const largest = spending.fields.find((field) => field.id !== OTHER_UNCLASSIFIED_ID)!;

  const revenueIndex = revenue.years.length - 1;
  const liabilities = revenue.bands.find((band) => band.id === "liabilities")?.values[revenueIndex] ?? 0;

  // The sentence names Tbilisi in its fixed text, so its amount is Tbilisi's, looked up by code.
  const tbilisi = municipal.places.find((place) => place.code === TBILISI_CODE);
  if (!tbilisi) throw new Error(`Municipal chapter has no Tbilisi (code ${TBILISI_CODE})`);

  // A latest actual balance of zero or more is a surplus, as in the chart and its tooltip.
  const { latestActual } = deficit;
  const surplus = latestActual.pct >= 0;
  const deficitKey =
    deficit.deepest.year === PANDEMIC_YEAR
      ? surplus ? "landing.sentence.surplusPandemic" : "landing.sentence.deficitPandemic"
      : surplus ? "landing.sentence.surplus" : "landing.sentence.deficit";

  // A latest year whose active facts are planned is told as the budget's plan, not as money already spent or received.
  return {
    spending: message(messages, spending.planned[spendingIndex] ? "landing.sentence.spendingPlanned" : "landing.sentence.spending", {
      year: spending.years[spendingIndex]!,
      total: billions(spending.totals[spendingIndex]!),
      field: message(messages, `landing.spendingField.${largest.id.replace(/^spending\./, "")}`),
    }),
    revenue: message(messages, revenue.planned[revenueIndex] ? "landing.sentence.revenuePlanned" : "landing.sentence.revenue", {
      year: revenue.years[revenueIndex]!,
      total: billions(revenue.totals[revenueIndex]!),
      tax: formatShare(revenue.taxShare[revenueIndex]!, false, 0),
      liabilities: formatShare(liabilities / revenue.totals[revenueIndex]!, false, 1),
    }),
    municipal: message(messages, "landing.sentence.municipal", {
      count: municipal.places.length,
      year: municipal.year,
      total: billions(municipal.totalGel),
      share: message(messages, `landing.sentence.share.${tbilisiSharePhrase(tbilisi.totalGel / municipal.totalGel)}`),
      top: billions(tbilisi.totalGel),
    }),
    deficit: message(messages, deficitKey, {
      year: latestActual.year,
      pct: formatShare(Math.abs(latestActual.pct) / 100),
      deepest: formatShare(Math.abs(deficit.deepest.pct) / 100),
      deepestYear: deficit.deepest.year,
    }),
  };
}

export function buildSocietySentences({ ageing, youthJobs, wageGap, trade, deaths }: SocietyModels, presentation: Presentation): SocietySentences {
  const { messages } = presentation;
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);

  const unknownIn = oneInN(deaths.unknownShare);
  return {
    ageing: text("landing.sentence.ageing", {
      share: formatShare(ageing.oldShare.share),
      firstYear: ageing.oldShareBase.year,
      firstShare: formatShare(ageing.oldShareBase.share),
      vitalYear: ageing.births.year,
      births: Math.round((ageing.births.births / ageing.births.deaths) * 100),
    }),
    youthJobs: text("landing.sentence.youthJobs", {
      year: youthJobs.year,
      all: formatShare(youthJobs.all.rate / 100),
      youth: formatShare(youthJobs.youth.rate / 100),
    }),
    wageGap: text("landing.sentence.wageGap", {
      year: wageGap.year,
      average: formatInUnit(wageGap.average, UNIT_PERSONS),
      ratio: formatShare(wageGap.ratio, false, 0),
    }),
    trade: text("landing.sentence.trade", {
      year: trade.year,
      turnover: formatInUnit(trade.turnoverUsd, UNIT_BN),
      exports: formatInUnit(trade.exportsUsd, UNIT_BN),
      imports: formatInUnit(trade.importsUsd, UNIT_BN),
    }),
    deaths: text("landing.sentence.deaths", {
      year: deaths.year,
      total: formatInUnit(deaths.total, UNIT_PERSONS),
      pct: formatShare(deaths.top.share, false, 0),
      cause: text(`landing.deaths.cause.${deaths.top.id}`),
      unknown: unknownIn === null ? text("landing.deaths.share", { pct: formatShare(deaths.unknownShare, false, 0) }) : text(`landing.deaths.oneIn.${unknownIn}`),
    }),
    headings: {
      ageing: text(ageing.ageing ? "landing.ageing.heading.ageing" : "landing.ageing.heading.changing"),
      youthJobs: text(`landing.jobs.heading.${youthJobs.comparison}`),
    },
  };
}

/** English names the society chapters read: sectors, regions, country partners and the products of the trade year. */
export function societyEnglishLabelIds({ overview, partners, products }: HomeChaptersInput["trade"]): string[] {
  const exportYears = overview.filter((fact) => fact.indicatorId === "trade.exports").map((fact) => fact.year);
  const year = Math.max(...exportYears);
  return [
    ...WAGES_SECTORS,
    ...REGIONAL_ECONOMY_REGIONS.map((region) => region.id),
    ...partners.entities.filter((entity) => entity.kind === "country").map((entity) => entity.id),
    ...new Set(products.facts.filter((fact) => fact.year === year).map((fact) => fact.entityId)),
  ];
}

export function buildHomeChapters(input: HomeChaptersInput, presentation: Presentation): HomeChapters {
  const spending = buildSpendingSeries(input.budgetFacts, input.glossary, presentation);
  const revenue = buildRevenueSeries(input.budgetFacts, input.glossary, presentation);
  const municipal = buildMunicipalChapter(input.municipalRows, input.municipalYear, presentation);
  const deficit = buildDeficitChapter(input.balanceFacts);
  const ageing = buildAgeingChapter(input.demographyFacts, municipal.places);
  const youthJobs = buildYouthJobsChapter(input.unemploymentFacts, presentation);
  const wageGap = buildWageGapChapter(input.wagesFacts, presentation);
  const trade = buildTradeChapter(input.trade, presentation);
  const deaths = buildDeathsChapter(input.healthFacts, presentation.messages);

  return {
    scale: buildScaleChapter({ ...input, spending, revenue }, presentation.messages),
    spending,
    revenue,
    municipal,
    deficit,
    ageing,
    youthJobs,
    wageGap,
    trade,
    deaths,
    sources: buildSourceRows(input.methodologyEntries, input.updatedAt),
    tools: toolNames(),
    sentences: {
      ...buildChapterSentences({ spending, revenue, municipal, deficit }, presentation),
      ...buildSocietySentences({ ageing, youthJobs, wageGap, trade, deaths }, presentation),
    },
  };
}

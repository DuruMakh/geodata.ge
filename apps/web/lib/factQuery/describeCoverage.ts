// apps/web/lib/factQuery/describeCoverage.ts
//
// The orientation function. A client — usually a language model — calls this
// first to learn which datasets, series and entities exist before asking for
// any number. It returns no amounts, only capability: this is what makes it
// safe to call with zero prior knowledge of the catalogue.
import { GDP_QUERY_SERIES } from "./gdpSeries";
import { SECTOR_QUERY_MEASURES } from "./economicSectorsSeries";
import { REGIONAL_ECONOMY_QUERY_MEASURES } from "./regionalEconomySeries";
import { inflationCatalogueSeries, inflationDatasetPeriods, inflationEntityPeriods } from "./inflationData";
import { INFLATION_MEASURES } from "./inflationSeries";
import { PRODUCT_QUERY_MEASURES } from "./inflationProductSeries";
import { inflationProductCatalogue } from "./inflationProductData";
import { serviceLabelEn, serviceMessage } from "./localization";
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import { stem } from "../explorer/search/georgian";
import { searchExplorer } from "../explorer/search/searchExplorer";
import { fold } from "../i18n/search";
import { CAVEAT_RULES, TOPIC_CAVEAT_RULES, evaluateCaveats, type CaveatContext } from "./caveats";
import { buildResponseMeta } from "./meta";
import { bulkUrlFor } from "../mcp/result";
import { debtMeasure, deficitMeasure, describeCoverageInput, municipalMeasure, nationalMeasure } from "./schemas";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "./types";
import { DEBT_SERIES_LABELS_KA, DEFICIT_SERIES_ID } from "./types";
import type { DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot, Measure, WebsitePage } from "./types";
import type { AnyDatasetId, TopicBreak, TopicDataset } from "./topics/types";

// Typed as DatasetId[] rather than derived from the union, so widening
// DatasetId does NOT force an entry here - unlike DATASET_META below, which is
// a Record and does. Adding a dataset means adding it in both places.
const DATASET_IDS: readonly DatasetId[] = [
  "national-revenue",
  "national-expenditure",
  "ministries",
  "municipal-expenditure",
  "government-debt",
  "general-government-balance",
  "gdp-overview",
  "economic-sectors",
  "regional-economies",
  "inflation",
  "inflation-products",
];

const isCoreDataset = (datasetId: string): datasetId is DatasetId => (DATASET_IDS as readonly string[]).includes(datasetId);

type EntityType = "country" | "municipality" | "region" | "city";
type Availability = "served" | "calculated_total" | "taxonomy_only";

// Reuses the exact vocabulary lib/explorer/explorerData.ts already assigns to
// this same concept (ModelFact.level / ExplorerItemLevel: "total",
// "public_field", "admin_category", "major_program"; municipalData.ts adds
// "municipal_function" for the ten functional categories) rather than
// inventing a second naming scheme for the same distinction. Not imported
// from lib/explorer/types.ts: CoverageData.series[].level is plain `string`
// by contract (§ brief), and this query layer does not otherwise depend on
// the presentation layer's types.
const LEVEL_TOTAL = "total";
const LEVEL_PUBLIC_FIELD = "public_field";
const LEVEL_ADMIN_CATEGORY = "admin_category";
const LEVEL_MAJOR_PROGRAM = "major_program";
const LEVEL_MUNICIPAL_FUNCTION = "municipal_function";

type BaseSeriesEntry = {
  seriesId: string;
  labelKa: string;
  level: string;
  parentSeriesId: string | null;
  availability: Availability;
  years: number[];
  yearsByMeasure?: Record<string, number[]>;
  periods?: [string, string];
  periodsByMeasure?: Record<string, [string, string]>;
  labelEn?: string;
  coicopCode?: string;
  firstPeriod?: string;
  measures?: Measure[];
  historyNotes?: { boundaryYear: number; noteKa: string; noteEn: string }[];
  /** Topic series only: the page's heading the series sits under, and its unit token. */
  headingKa?: string;
  headingEn?: string;
  unit?: string;
};

type SeriesEntry = BaseSeriesEntry & { labelEn: string };

type BaseEntityEntry = {
  entityId: string;
  entityType: EntityType;
  labelKa: string;
  entitySlug: string | null;
  periods?: [string, string];
};

type EntityEntry = BaseEntityEntry & { labelEn: string };

type DatasetSummary = {
  datasetId: AnyDatasetId;
  budgetScope: string;
  labelKa: string;
  years: [number, number];
  entityTypes: EntityType[];
  measures: Measure[];
  periods?: [string, string];
  labelEn: string;
  measureNotes?: Record<string, string>;
  measureNotesEn?: Record<string, string>;
  measureNotesKa?: Record<string, string>;
  /** Topic datasets only: the chart page, the kind of period its years are, and what it lists. */
  pageUrlKa?: string;
  pageUrlEn?: string;
  periodKind?: "year" | "school_year";
  seriesCount?: number;
  entityCount?: number;
  /** A search without `datasetId` only: this topic dataset's matches left out of `series` (SEARCH_TOPIC_SERIES_LIMIT). */
  seriesOmitted?: number;
};

export type CoverageData = {
  datasets: DatasetSummary[];
  series?: SeriesEntry[];
  entities?: EntityEntry[];
  exclusions: { entityId: string; reason: string; reasonEn: string }[];
  /** Present whenever `search` was given: whether every word of it matched an entry, or only some words did. */
  searchMatch?: "all_words" | "some_words";
  /** Only with `searchMatch: "some_words"`: these entries may be about another subject, and when none fits the data is not served here. */
  searchMatchNoteKa?: string;
  searchMatchNoteEn?: string;
  /** Only on a search without `datasetId`: Fiscal.ge pages that show the topic but are not datasets (their figures come from served datasets), best first, at most five. */
  websitePages?: {
    topicId: string; labelKa: string; labelEn: string; topicLabelKa: string; topicLabelEn: string; urlKa: string; urlEn: string;
  }[];
  websitePagesNoteKa?: string;
  websitePagesNoteEn?: string;
  /** Only with a topic `datasetId`: the reviewed breaks in its series, the dataset's CSV, and a series list cut to its totals. */
  breaks?: TopicBreak[];
  bulkUrl?: string;
  headings?: { headingKa: string | null; headingEn: string | null; seriesCount: number }[];
  seriesOmitted?: number;
  seriesOmittedNoteKa?: string;
  seriesOmittedNoteEn?: string;
};

/** A topic series list longer than this returns its totals and headings only; `search` narrows it. */
const TOPIC_SERIES_LIMIT = 300;

/**
 * A search without `datasetId` lists at most this many series of one topic dataset, the first in the search's order;
 * the dataset's entry counts the rest. "exports" meets 1,937 series, most of them trade products, and one answer
 * holds about 500 series.
 */
const SEARCH_TOPIC_SERIES_LIMIT = 20;

/** How many website pages one search points to: a topic's name matches every one of its pages, so the list is capped. */
const WEBSITE_PAGES_LIMIT = 5;

// Same wording as the municipality_not_territorial caveat rule
// (caveats/rules.municipal.ts) — reused here as the reason string for these
// codes' permanent, dataset-independent exclusion metadata, so the catalogue
// and the caveat that fires if a client names one of these codes anyway
// describe the same fact in the same words.

const NATIONAL_MEASURES = nationalMeasure.options as Measure[];
const MUNICIPAL_MEASURES = municipalMeasure.options as Measure[];
const DEBT_MEASURES = debtMeasure.options as Measure[];
const DEFICIT_MEASURES = deficitMeasure.options as Measure[];

// Structural facts about each of the four fixed datasets — not "coverage"
// (years, series, entities) in the sense the standing no-hardcoding rule
// covers, but the dataset's own identity: which accounting boundary it uses,
// its display names, which entity kinds and measures apply to it at all. None
// of this changes as new years of data are added. budgetScope is a stable
// slug distinguishing accounting boundaries that share a dataset "shape" —
// national-revenue and national-expenditure are both nation-scoped, but
// budget_scopes_differ (caveats/rules.national.ts) exists precisely because
// their totals are not the same concept.
const DATASET_META: Record<
  DatasetId,
  Pick<DatasetSummary, "budgetScope" | "labelKa" | "entityTypes" | "measures">
> = {
  "national-revenue": {
    budgetScope: "consolidated_budget_receipts",
    labelKa: "შემოსავლები",
    entityTypes: ["country"],
    measures: NATIONAL_MEASURES,
  },
  "national-expenditure": {
    budgetScope: "state_budget_expenditure",
    labelKa: "ხარჯები",
    entityTypes: ["country"],
    measures: NATIONAL_MEASURES,
  },
  ministries: {
    budgetScope: "state_budget_administrative",
    labelKa: "სამინისტროები",
    entityTypes: ["country"],
    measures: NATIONAL_MEASURES,
  },
  "municipal-expenditure": {
    // Must equal queryMunicipal's BUDGET_SCOPE: an observation and the
    // catalogue entry describing it are the two halves of one join, and these
    // were the only two occurrences of either string, so nothing caught the
    // drift until both landed in one published file.
    budgetScope: "municipal_budget_expenditure",
    labelKa: "მუნიციპალიტეტები",
    entityTypes: ["country", "municipality", "region"],
    measures: MUNICIPAL_MEASURES,
  },
  "government-debt": {
    // Deliberately not any budget scope. Debt is a stock of obligations, and
    // debt_not_budget_scope (caveats/rules.debt.ts) exists because adding it to
    // expenditure or subtracting it from receipts is the predictable error.
    budgetScope: "central_government_liabilities",
    labelKa: "სახელმწიფო ვალი",
    entityTypes: ["country"],
    measures: DEBT_MEASURES,
  },
  "gdp-overview": {
    budgetScope: "national_accounts",
    labelKa: "მშპ-ის მიმოხილვა",
    entityTypes: ["country"],
    measures: ["value"],
  },
  "economic-sectors": {
    budgetScope: "national_accounts",
    labelKa: "ეკონომიკის სექტორები",
    entityTypes: ["country"],
    measures: ["amount_gel", "share_of_gdp_pct", "real_growth_pct"],
  },
  "regional-economies": {
    budgetScope: "regional_accounts",
    labelKa: "რეგიონული ეკონომიკები",
    entityTypes: ["region"],
    measures: ["amount_gel", "share_of_region_gdp_pct"],
  },
  inflation: {
    budgetScope: "consumer_prices",
    labelKa: "ინფლაცია",
    entityTypes: ["country", "city"],
    measures: [...INFLATION_MEASURES],
  },
  "inflation-products": {
    budgetScope: "consumer_prices",
    labelKa: "ინფლაცია პროდუქტების მიხედვით",
    entityTypes: ["country"],
    measures: [...PRODUCT_QUERY_MEASURES],
  },
  "general-government-balance": {
    // General government per the IMF: wider than either national series here,
    // and NOT their difference.
    budgetScope: "general_government_imf",
    labelKa: "ზოგადი მთავრობის ბალანსი",
    entityTypes: ["country"],
    measures: DEFICIT_MEASURES,
  },
};

function sortedUniqueYears(years: Iterable<number>): number[] {
  return Array.from(new Set(years)).sort((a, b) => a - b);
}

/** The dataset's whole coverage span. Unlike a series' `years`, this is a plain [first, last] pair — §"Response shape" only requires the exact-list guarantee per series, where raggedness actually hides gaps. */
function yearRange(years: Iterable<number>, datasetId: DatasetId): [number, number] {
  const sorted = sortedUniqueYears(years);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error(`describeCoverage: dataset "${datasetId}" has no facts to derive a year range from`);
  }
  return [first, last];
}

function buildExclusions(snapshot: FactQuerySnapshot): CoverageData["exclusions"] {
  return AGGREGATE_ONLY_MUNICIPAL_CODES.map((entityId) => ({ entityId, reason: serviceMessage(snapshot, "ka", "exclusions.catalogueMunicipality"), reasonEn: serviceMessage(snapshot, "en", "exclusions.catalogueMunicipality") }));
}

function topicDatasetOf(snapshot: FactQuerySnapshot, datasetId: string): TopicDataset | undefined {
  return snapshot.topics.datasets.find((dataset) => dataset.page.datasetId === datasetId);
}

/** The core datasets, then the topic datasets the snapshot holds. */
export function allDatasetIds(snapshot: FactQuerySnapshot): AnyDatasetId[] {
  return [...DATASET_IDS, ...snapshot.topics.datasets.map((dataset) => dataset.page.datasetId as AnyDatasetId)];
}

const topicEntityTypes = (dataset: TopicDataset): EntityType[] => [...new Set(dataset.entities.map((entity) => entity.entityType))];

function entityTypesOf(snapshot: FactQuerySnapshot, datasetId: AnyDatasetId): readonly EntityType[] {
  return isCoreDataset(datasetId) ? DATASET_META[datasetId].entityTypes : topicEntityTypes(topicDatasetOf(snapshot, datasetId)!);
}

/** Datasets of one scope count as one where a search word meets their labels; each topic dataset is its own scope. */
const scopeOf = (datasetId: AnyDatasetId): string => (isCoreDataset(datasetId) ? DATASET_META[datasetId].budgetScope : datasetId);

/**
 * A dataset's names for search. A topic dataset's is its search name, "<topic> — <page title>" (R26), not the published
 * title: "Spending" alone would meet "health spending" in full. With `page`, a topic dataset's page title alone: the
 * topic's name ("Education", "Health and social protection") is a budget function's too.
 */
function datasetLabelsOf(snapshot: FactQuerySnapshot, datasetId: AnyDatasetId, page = false): string[] {
  if (isCoreDataset(datasetId)) return [DATASET_META[datasetId].labelKa, serviceLabelEn(snapshot, datasetId)];
  const topic = topicDatasetOf(snapshot, datasetId)!;
  return page ? [topic.titleKa, topic.titleEn] : [topic.searchKa, topic.searchEn];
}

/** The topic's name a topic dataset's search name starts with: "Living standards" of "Living standards — Spending". */
function topicNamesOf(snapshot: FactQuerySnapshot, datasetId: AnyDatasetId): string[] {
  const topic = topicDatasetOf(snapshot, datasetId)!;
  return [topic.searchKa.slice(0, -` — ${topic.titleKa}`.length), topic.searchEn.slice(0, -` — ${topic.titleEn}`.length)];
}

function topicSummary(dataset: TopicDataset, cityScope: boolean): DatasetSummary {
  return {
    datasetId: dataset.page.datasetId as AnyDatasetId,
    budgetScope: "topic",
    labelKa: dataset.titleKa,
    labelEn: dataset.titleEn,
    years: [dataset.firstYear, dataset.lastYear],
    entityTypes: cityScope ? ["city"] : topicEntityTypes(dataset),
    measures: ["value"],
    pageUrlKa: dataset.urlKa,
    pageUrlEn: dataset.urlEn,
    periodKind: dataset.page.periodKind,
    seriesCount: dataset.series.length,
    entityCount: dataset.entities.length,
  };
}

const topicSeriesCache = new WeakMap<TopicDataset, SeriesEntry[]>();

/** A topic dataset's series as catalogue entries; `years` are the years the series has a value in. Built once per dataset. */
function topicSeriesFor(dataset: TopicDataset): SeriesEntry[] {
  let entries = topicSeriesCache.get(dataset);
  if (entries === undefined) {
    const { columns } = dataset;
    const yearsOf = new Map<number, Set<number>>();
    columns.series.forEach((seriesIndex, row) => {
      if (columns.value[row] === null) return;
      const years = yearsOf.get(seriesIndex) ?? new Set<number>();
      years.add(columns.year[row]!);
      yearsOf.set(seriesIndex, years);
    });
    entries = dataset.series.map((series, index) => ({
      seriesId: series.seriesId,
      labelKa: series.labelKa,
      labelEn: series.labelEn,
      level: series.isTotal ? LEVEL_TOTAL : "series",
      parentSeriesId: series.parentSeriesId,
      availability: "served",
      years: sortedUniqueYears(yearsOf.get(index) ?? []),
      unit: series.unit,
      ...(series.headingKa !== null ? { headingKa: series.headingKa } : {}),
      ...(series.headingEn !== null ? { headingEn: series.headingEn } : {}),
    }));
    topicSeriesCache.set(dataset, entries);
  }
  return entries;
}

function topicEntitiesFor(dataset: TopicDataset): EntityEntry[] {
  return dataset.entities.map((entity) => ({ entityId: entity.entityId, entityType: entity.entityType, labelKa: entity.labelKa, labelEn: entity.labelEn, entitySlug: null }));
}

function buildDatasetSummary(snapshot: FactQuerySnapshot, datasetId: AnyDatasetId, cityScope = false): DatasetSummary {
  if (!isCoreDataset(datasetId)) return topicSummary(topicDatasetOf(snapshot, datasetId)!, cityScope);
  const citySeries = cityScope ? inflationCatalogueSeries(snapshot, true) : undefined;
  let years: [number, number];

  switch (datasetId) {
    case "national-revenue":
      years = yearRange(
        snapshot.national.facts.filter((f) => f.side === "revenue").map((f) => f.year),
        datasetId,
      );
      break;
    case "national-expenditure":
      years = yearRange(
        snapshot.national.facts.filter((f) => f.side === "expenditure").map((f) => f.year),
        datasetId,
      );
      break;
    case "ministries":
      years = yearRange(
        snapshot.ministries.facts.map((f) => f.year),
        datasetId,
      );
      break;
    case "municipal-expenditure":
      years = yearRange(
        [
          ...snapshot.municipal.functionFacts.map((f) => f.year),
          ...snapshot.municipal.totalFacts.map((f) => f.year),
          ...snapshot.municipal.countryFunctionFacts.map((f) => f.year),
          ...snapshot.municipal.countryTotalFacts.map((f) => f.year),
        ],
        datasetId,
      );
      break;
    case "government-debt":
      years = yearRange(
        snapshot.debt.facts.map((f) => f.year),
        datasetId,
      );
      break;
    case "gdp-overview":
      years = yearRange(snapshot.gdpOverview.facts.map(f=>f.year), datasetId);
      break;
    case "economic-sectors":
      years = yearRange(snapshot.economicSectors.facts.map(f=>f.year), datasetId);
      break;
    case "regional-economies":
      years = yearRange(snapshot.regionalEconomies.facts.map(f=>f.year), datasetId);
      break;
    case "inflation":
      years = yearRange((citySeries ?? inflationCatalogueSeries(snapshot)).flatMap((series) => series.years), datasetId);
      break;
    case "inflation-products":
      years = yearRange(snapshot.inflationProducts.facts.map(row => Number(row.period.slice(0, 4))), datasetId);
      break;
    case "general-government-balance":
      years = yearRange(
        snapshot.deficit.facts.map((f) => f.year),
        datasetId,
      );
      break;
  }

  const meta = DATASET_META[datasetId];
  const productPeriods = datasetId === "inflation-products" ? snapshot.inflationProducts.facts.map(fact => fact.period).sort() : [];
  // entityTypes/measures are copied out of DATASET_META rather than spread by
  // reference: describeCoverage is called repeatedly against the same
  // long-lived snapshot (§4.2 "reuse calculations without rebuilding the
  // website"), so handing back the module-level array itself would let one
  // caller's in-place mutation of a response corrupt every later call.
  return {
    datasetId,
    ...meta,
    labelEn: serviceLabelEn(snapshot, datasetId),
    entityTypes: cityScope ? ["city"] : [...meta.entityTypes],
    measures: citySeries ? INFLATION_MEASURES.filter(measure => citySeries.some(series => series.periodsByMeasure[measure] !== undefined)) : [...meta.measures],
    years,
    ...(datasetId === "economic-sectors"
      ? {
          measureNotesKa: Object.fromEntries(
            Object.entries(SECTOR_QUERY_MEASURES).map(([query, measure]) => [
              query,
              `${snapshot.economicSectors.definitions[measure].ka} ${snapshot.economicSectors.definitions.reference[measure].ka}`,
            ]),
          ),
          measureNotesEn: Object.fromEntries(
            Object.entries(SECTOR_QUERY_MEASURES).map(([query, measure]) => [
              query,
              `${snapshot.economicSectors.definitions[measure].en} ${snapshot.economicSectors.definitions.reference[measure].en}`,
            ]),
          ),
        }
      : {}),
    ...(datasetId === "regional-economies"
      ? {
          measureNotesKa: Object.fromEntries(
            Object.entries(REGIONAL_ECONOMY_QUERY_MEASURES).map(([query, measure]) => [
              query,
              snapshot.regionalEconomies.definitions[measure].ka,
            ]),
          ),
          measureNotesEn: Object.fromEntries(
            Object.entries(REGIONAL_ECONOMY_QUERY_MEASURES).map(([query, measure]) => [
              query,
              snapshot.regionalEconomies.definitions[measure].en,
            ]),
          ),
        }
      : {}),
    ...(datasetId === "inflation" ? { periods: inflationDatasetPeriods(snapshot, cityScope) } : {}),
    ...(datasetId === "inflation-products" ? {
      periods: [productPeriods[0]!, productPeriods.at(-1)!] as [string, string],
      measureNotesKa: { yoy_pct: serviceMessage(snapshot, "ka", "definitions.inflationProductAnnual"), cumulative_pct: serviceMessage(snapshot, "ka", "coverage.inflationProductCumulative") },
      measureNotesEn: { yoy_pct: serviceMessage(snapshot, "en", "definitions.inflationProductAnnual"), cumulative_pct: serviceMessage(snapshot, "en", "coverage.inflationProductCumulative") },
    } : {}),
    ...(datasetId === "municipal-expenditure"
      ? {
          measureNotesKa: {
            gel_per_resident: serviceMessage(snapshot, "ka", "coverage.perResident"),
          },
          measureNotesEn: {
            gel_per_resident: serviceMessage(snapshot, "en", "coverage.perResident"),
          },
          measureNotes: {
            gel_per_resident: "Available only for 2025 municipality and region totals (municipal.total); not for the country aggregate or individual functions.",
          },
        }
      : {}),
    ...(datasetId === "government-debt"
      ? {
          measureNotesKa: {
            amount_gel: serviceMessage(snapshot, "ka", "coverage.debtAmount"),
            share_of_gdp_pct: serviceMessage(snapshot, "ka", "coverage.debtGdp"),
            rate_percent: serviceMessage(snapshot, "ka", "coverage.debtRate"),
          },
          measureNotesEn: {
            amount_gel: serviceMessage(snapshot, "en", "coverage.debtAmount"),
            share_of_gdp_pct: serviceMessage(snapshot, "en", "coverage.debtGdp"),
            rate_percent: serviceMessage(snapshot, "en", "coverage.debtRate"),
          },
          measureNotes: {
            amount_gel: "Stock and service only.",
            share_of_gdp_pct: "Stock and service, where reviewed GDP is available.",
            rate_percent: "Interest-rate series only; unpublished rates are missing, not zero.",
          },
        }
      : {}),
  };
}

/**
 * revenue.* or expenditure.* series: every taxonomy/glossary item on that
 * side (served if it has fact rows, taxonomy_only if not — revenue.taxes_total
 * is the live case, data/glossary/category-glossary.csv:15) plus the
 * calculated total, which has no CSV row on either side (verified: neither
 * "revenue.total" nor "expenditure.total" appears as an item_id in
 * data/imports/revenue-facts-2004-2025.csv, expenditure-facts-2004-2025.csv or
 * expenditure-facts-2026-planned.csv).
 */
function nationalSeriesFor(snapshot: FactQuerySnapshot, side: "revenue" | "expenditure"): BaseSeriesEntry[] {
  const yearsByItem = new Map<string, Set<number>>();
  const sideYears = new Set<number>();

  for (const fact of snapshot.national.facts) {
    if (fact.side !== side) continue;
    sideYears.add(fact.year);
    const years = yearsByItem.get(fact.itemId) ?? new Set<number>();
    years.add(fact.year);
    yearsByItem.set(fact.itemId, years);
  }

  const items = snapshot.national.items
    .filter((item) => item.side === side)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const itemSeries: BaseSeriesEntry[] = items.map((item) => {
    const years = sortedUniqueYears(yearsByItem.get(item.id) ?? []);
    return {
      seriesId: item.id,
      labelKa: item.kaLabel,
      level: LEVEL_PUBLIC_FIELD,
      parentSeriesId: null,
      availability: years.length > 0 ? "served" : "taxonomy_only",
      years,
    };
  });

  const totalSeries: BaseSeriesEntry = {
    seriesId: side === "revenue" ? "revenue.total" : "expenditure.total",
    labelKa: side === "revenue" ? "მთლიანი შემოსავლები" : "მთლიანი ხარჯი",
    level: LEVEL_TOTAL,
    parentSeriesId: null,
    availability: "calculated_total",
    years: sortedUniqueYears(sideYears),
  };

  return [totalSeries, ...itemSeries];
}

/**
 * admin_category series come from the static ADMIN_SPENDING_CATEGORIES list
 * (data/adminSpending/categories.ts, exposed here as
 * snapshot.ministries.categories) and are served/taxonomy_only exactly like a
 * revenue/expenditure item — classified by whether any fact actually landed
 * in that category, never assumed. major_program series have no separate
 * taxonomy: the facts ARE the catalogue, so every program itemId that occurs
 * is, by construction, served. admin_spending.total has no CSV row (verified:
 * 0 "admin_spending.total" rows in data/imports/admin-spending-facts-2004-2025.csv
 * or admin-spending-facts-2026-planned.csv)
 * and is calculated only from admin_category facts — mirroring
 * lib/explorer/explorerData.ts's own total (detailFactsForTotals filters to
 * level === "admin_category" precisely to avoid double-counting programs
 * under their parent category).
 */
function ministriesSeriesFor(snapshot: FactQuerySnapshot): BaseSeriesEntry[] {
  const categoryYears = new Map<string, Set<number>>();
  const programYears = new Map<string, Set<number>>();
  const programLabel = new Map<string, string>();
  const programParent = new Map<string, string | null>();
  const totalYears = new Set<number>();

  // ministries.facts is sorted year-ascending (buildSnapshot.ts), so the last
  // write per program itemId below carries its most recent official name and
  // parent — the same "most recent official name" rule explorerData.ts
  // documents (a pre-2012 legacy-join point would otherwise title the series
  // by an old organizational line).
  for (const fact of snapshot.ministries.facts) {
    if (fact.level === "admin_category") {
      totalYears.add(fact.year);
      const years = categoryYears.get(fact.itemId) ?? new Set<number>();
      years.add(fact.year);
      categoryYears.set(fact.itemId, years);
    } else {
      const years = programYears.get(fact.itemId) ?? new Set<number>();
      years.add(fact.year);
      programYears.set(fact.itemId, years);
      programLabel.set(fact.itemId, fact.officialLabelKa ?? fact.itemId);
      programParent.set(fact.itemId, fact.parentItemId);
    }
  }

  const categorySeries: BaseSeriesEntry[] = snapshot.ministries.categories.map((category) => {
    const years = sortedUniqueYears(categoryYears.get(category.id) ?? []);
    return {
      seriesId: category.id,
      labelKa: category.kaLabel,
      level: LEVEL_ADMIN_CATEGORY,
      parentSeriesId: null,
      availability: years.length > 0 ? "served" : "taxonomy_only",
      years,
    };
  });

  const programSeries: BaseSeriesEntry[] = Array.from(programYears.keys())
    .sort()
    .map((itemId) => ({
      seriesId: itemId,
      labelKa: programLabel.get(itemId) ?? itemId,
      level: LEVEL_MAJOR_PROGRAM,
      parentSeriesId: programParent.get(itemId) ?? null,
      availability: "served",
      years: sortedUniqueYears(programYears.get(itemId) ?? []),
    }));

  const totalSeries: BaseSeriesEntry = {
    seriesId: "admin_spending.total",
    labelKa: "მთლიანი ხარჯი",
    level: LEVEL_TOTAL,
    parentSeriesId: null,
    availability: "calculated_total",
    years: sortedUniqueYears(totalYears),
  };

  return [totalSeries, ...categorySeries, ...programSeries];
}

/**
 * The ten functional categories (data/taxonomy/municipal-functions.json,
 * served here as snapshot.municipal.functions) plus municipal.total.
 * functionFacts (per-municipality) and countryFunctionFacts (Georgia and
 * region aggregates) are both scanned for years served, since a series'
 * catalogue-level coverage is "does ANY entity have this year", not scoped to
 * one entity. municipal.total has no functionFacts categoryId of its own
 * (verified: 0 "municipal.total" rows in either municipal function-facts
 * import) — its figure comes from the separate MunicipalTotalFact rows
 * (totalFacts/countryTotalFacts), not from summing the ten functions.
 */
function municipalSeriesFor(snapshot: FactQuerySnapshot): BaseSeriesEntry[] {
  const yearsByFunction = new Map<string, Set<number>>();

  for (const fact of [...snapshot.municipal.functionFacts, ...snapshot.municipal.countryFunctionFacts]) {
    const years = yearsByFunction.get(fact.categoryId) ?? new Set<number>();
    years.add(fact.year);
    yearsByFunction.set(fact.categoryId, years);
  }

  const functionSeries: BaseSeriesEntry[] = snapshot.municipal.functions.map((fn) => {
    const years = sortedUniqueYears(yearsByFunction.get(fn.id) ?? []);
    return {
      seriesId: fn.id,
      labelKa: fn.kaLabel,
      level: LEVEL_MUNICIPAL_FUNCTION,
      parentSeriesId: null,
      availability: years.length > 0 ? "served" : "taxonomy_only",
      years,
    };
  });

  const totalYears = sortedUniqueYears([
    ...snapshot.municipal.totalFacts.map((f) => f.year),
    ...snapshot.municipal.countryTotalFacts.map((f) => f.year),
  ]);

  const totalSeries: BaseSeriesEntry = {
    seriesId: "municipal.total",
    labelKa: "მთლიანი ბიუჯეტი",
    level: LEVEL_TOTAL,
    parentSeriesId: null,
    availability: "calculated_total",
    years: totalYears,
  };

  return [totalSeries, ...functionSeries];
}

/**
 * The nine debt series, each with the exact years it actually carries. Ragged
 * on purpose: debt.rate.domestic and .external have years no reviewed source
 * published a rate for, and those years are absent here rather than listed
 * with a null - the exact-list guarantee is what stops a client assuming a
 * rate exists for every year the family spans.
 */
function debtSeriesFor(snapshot: FactQuerySnapshot): BaseSeriesEntry[] {
  const byId = new Map<string, number[]>();
  for (const fact of snapshot.debt.facts) {
    if (fact.value === null) continue;
    byId.set(fact.seriesId, [...(byId.get(fact.seriesId) ?? []), fact.year]);
  }

  // Driven by the facts as well as the label map, so a tenth reviewed series is
  // visible here rather than only through query_debt, which derives its known
  // ids from the facts. An id with no label falls back to the id itself, which
  // is ugly and therefore gets noticed.
  const seriesIds = [
    ...Object.keys(DEBT_SERIES_LABELS_KA),
    ...snapshot.debt.facts.map((fact) => fact.seriesId).filter((id) => !(id in DEBT_SERIES_LABELS_KA)),
  ];

  return [...new Set(seriesIds)].map((seriesId) => ({
    seriesId,
    labelKa: DEBT_SERIES_LABELS_KA[seriesId] ?? seriesId,
    level: seriesId.split(".")[1],
    parentSeriesId: null,
    availability: byId.has(seriesId) ? ("served" as const) : ("taxonomy_only" as const),
    years: sortedUniqueYears(byId.get(seriesId) ?? []),
  }));
}

/** One series. Both measures come from the reviewed row, so neither is derived. */
function deficitSeriesFor(snapshot: FactQuerySnapshot): BaseSeriesEntry[] {
  return [
    {
      seriesId: DEFICIT_SERIES_ID,
      labelKa: "ზოგადი მთავრობის ბალანსი",
      level: "total",
      parentSeriesId: null,
      availability: "served",
      years: sortedUniqueYears(snapshot.deficit.facts.map((f) => f.year)),
    },
  ];
}

function baseSeriesForDataset(snapshot: FactQuerySnapshot, datasetId: DatasetId, cityScope = false): BaseSeriesEntry[] {
  switch (datasetId) {
    case "national-revenue":
      return nationalSeriesFor(snapshot, "revenue");
    case "national-expenditure":
      return nationalSeriesFor(snapshot, "expenditure");
    case "ministries":
      return ministriesSeriesFor(snapshot);
    case "municipal-expenditure":
      return municipalSeriesFor(snapshot);
    case "government-debt":
      return debtSeriesFor(snapshot);
    case "general-government-balance":
      return deficitSeriesFor(snapshot);
    case "gdp-overview":
      return Object.entries(GDP_QUERY_SERIES).map(([seriesId, s]) => ({
        seriesId,
        labelKa: s.labelKa,
        level: LEVEL_TOTAL,
        parentSeriesId: null,
        availability: "served",
        years: sortedUniqueYears(
          snapshot.gdpOverview.facts.filter(f => f.seriesId === seriesId).map(f => f.year),
        ),
      }));
    case "economic-sectors":
      return snapshot.economicSectors.registry.map(r => ({
        seriesId: r.id,
        labelKa: r.labelKa,
        level: r.id === "economy.gdp_total" ? LEVEL_TOTAL : "economic_activity",
        parentSeriesId: null,
        availability: "served",
        years: sortedUniqueYears(
          snapshot.economicSectors.facts.filter(f => f.seriesId === r.id).map(f => f.year),
        ),
        yearsByMeasure: Object.fromEntries(
          Object.entries(SECTOR_QUERY_MEASURES).map(([query, measure]) => [
            query,
            sortedUniqueYears(
              snapshot.economicSectors.facts
                .filter(f => f.seriesId === r.id && f.measure === measure)
                .map(f => f.year),
            ),
          ]),
        ),
      }));
    case "regional-economies":
      return snapshot.regionalEconomies.registry.map(r => ({
        seriesId: r.id,
        labelKa: r.labelKa,
        level: r.id === "economy.regional_gdp_total" ? LEVEL_TOTAL : "economic_activity",
        parentSeriesId: null,
        availability: "served",
        years: sortedUniqueYears(
          snapshot.regionalEconomies.facts.filter(f => f.seriesId === r.id).map(f => f.year),
        ),
        yearsByMeasure: Object.fromEntries(
          Object.entries(REGIONAL_ECONOMY_QUERY_MEASURES).map(([query, measure]) => [
            query,
            sortedUniqueYears(
              snapshot.regionalEconomies.facts
                .filter(f => f.seriesId === r.id && f.measure === measure)
                .map(f => f.year),
            ),
          ]),
        ),
      }));
    case "inflation":
      return inflationCatalogueSeries(snapshot, cityScope);
    case "inflation-products":
      return inflationProductCatalogue(snapshot).map(withoutRepeatedMeasureSpans);
  }
}

/**
 * A product states its span once as `years`/`periods` and again per measure.
 * Where every legal measure has exactly that span, the per-measure copies say
 * nothing new and were about 35% of this catalogue's bytes, so they are left out:
 * absent means the same as `years`/`periods`. They stay whenever any measure
 * differs, or has no span at all, because there absent would misstate it.
 */
function withoutRepeatedMeasureSpans<T extends BaseSeriesEntry>(entry: T): T {
  const measures: readonly string[] = entry.measures ?? [];
  const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
  const { yearsByMeasure, periodsByMeasure, ...rest } = entry;
  const repeatsYears = yearsByMeasure !== undefined && measures.length > 0 && measures.every((measure) => same(yearsByMeasure[measure], entry.years));
  const repeatsPeriods = periodsByMeasure !== undefined && entry.periods !== undefined && measures.length > 0 && measures.every((measure) => same(periodsByMeasure[measure], entry.periods));
  return {
    ...rest,
    ...(yearsByMeasure !== undefined && !repeatsYears ? { yearsByMeasure } : {}),
    ...(periodsByMeasure !== undefined && !repeatsPeriods ? { periodsByMeasure } : {}),
  } as T;
}

/**
 * Only municipal-expenditure has an entity dimension: queryNationalInput and
 * queryMinistriesInput (schemas.ts) take no entityIds at all — those two
 * datasets are implicitly scoped to country.georgia as a whole, with nothing
 * to enumerate. The five aggregate-only codes never appear here because
 * snapshot.municipal.municipalities already excludes them (they are absent
 * from every served registry — caveats/rules.municipal.ts); they surface only
 * through buildExclusions.
 */
function municipalEntitiesFor(snapshot: FactQuerySnapshot): BaseEntityEntry[] {
  const country: BaseEntityEntry = {
    entityId: MUNICIPAL_COUNTRY_ID,
    entityType: "country",
    labelKa: "საქართველო",
    entitySlug: null,
  };

  const regions: BaseEntityEntry[] = snapshot.municipal.regions.map((region) => ({
    entityId: region.id,
    entityType: "region",
    labelKa: region.kaLabel,
    entitySlug: null,
  }));

  const municipalities: BaseEntityEntry[] = snapshot.municipal.municipalities.map((municipality) => ({
    entityId: municipality.code,
    entityType: "municipality",
    // The short display form ("ხულო"), matching the label the rest of the
    // site already shows for a municipality — municipalData.ts's own list
    // rows read municipality.displayNameKa the same way. nameKa is the longer
    // official form ("ხულოს მუნიციპალიტეტი").
    labelKa: municipality.displayNameKa,
    entitySlug: snapshot.municipal.slugByCode[municipality.code] ?? null,
  }));

  return [country, ...regions, ...municipalities];
}

function seriesForDataset(snapshot: FactQuerySnapshot, datasetId: AnyDatasetId, cityScope = false): SeriesEntry[] {
  if (!isCoreDataset(datasetId)) return topicSeriesFor(topicDatasetOf(snapshot, datasetId)!).map((entry) => ({ ...entry }));
  return baseSeriesForDataset(snapshot, datasetId, cityScope).map(series => ({ ...series, labelEn: series.labelEn ?? serviceLabelEn(snapshot, series.seriesId) }));
}

function entitiesForDataset(snapshot: FactQuerySnapshot, datasetId: AnyDatasetId): EntityEntry[] | undefined {
  if (!isCoreDataset(datasetId)) return topicEntitiesFor(topicDatasetOf(snapshot, datasetId)!);
  if (datasetId === "inflation-products") return [{ entityId: "country.georgia", entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", entitySlug: null }];
  if (datasetId === "municipal-expenditure") return municipalEntitiesFor(snapshot).map(entity => ({ ...entity, labelEn: serviceLabelEn(snapshot, entity.entityId) }));
  if (datasetId === "regional-economies")
    return snapshot.regionalEconomies.regions.map(region => ({
      entityId: region.id,
      entityType: "region",
      labelKa: region.kaLabel,
      labelEn: serviceLabelEn(snapshot, region.id),
      entitySlug: null,
    }));
  if (datasetId === "inflation") {
    const periods = inflationEntityPeriods(snapshot);
    return [
      { entityId: "country.georgia", entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", entitySlug: null, periods: inflationDatasetPeriods(snapshot) },
      ...snapshot.inflation.cityEntities.map((city) => ({ entityId: city.id, entityType: "city" as const, labelKa: city.labelKa, labelEn: city.labelEn, entitySlug: null, periods: periods.get(city.id)! })),
    ];
  }
  return undefined;
}

/**
 * `level` narrows the catalogue to what a client can ASK FOR at that request
 * level, which is not the same as matching each series' structural `level`.
 *
 * admin_spending.total is structurally a total, but queryMinistries accepts it
 * only at admin_category and rejects it at major_program (its
 * queryableSeriesIds). A plain `entry.level === input.level` comparison
 * therefore hid the state budget's headline number from BOTH ministries
 * filters: a client following spec section 6.1 ("use identifiers returned by
 * the catalogue") and narrowing by level could never discover it, and only an
 * unknown_series error's validChoices revealed it existed.
 *
 * Scoped to the ministries dataset deliberately. The other datasets' totals
 * (revenue.total, expenditure.total, municipal.total) also carry LEVEL_TOTAL,
 * and admin_category/major_program are not their request levels — widening for
 * them would leak a national total into a ministries-shaped filter.
 */
function matchesLevel(entry: BaseSeriesEntry, level: string | undefined, datasetId: AnyDatasetId): boolean {
  if (level === undefined) return true;
  if (datasetId === "ministries" && entry.level === LEVEL_TOTAL) return level === LEVEL_ADMIN_CATEGORY;
  return entry.level === level;
}

/**
 * Words that only join others ("budget of the state"): the explorer's set
 * (searchExplorer.ts) plus "on", "to", "by", "from", "with", "or", "და" and
 * "მიხედვით" (by), dropped while another word remains. "from" met a
 * programme's name and so linked "Money from abroad" for "imports from China";
 * "მიხედვით" linked "Jobs by industry" for "ხარჯები სექტორების მიხედვით";
 * "on" made "spending on culture" Science and culture's "Spending on research and development".
 */
const JOINING_WORDS = new Set(["in", "of", "the", "for", "and", "at", "on", "to", "by", "from", "with", "or", "და", "მიხედვით"]);

/** Words that end a label without naming the entry: "Total taxes" is "გადასახადები სულ". */
const TOTAL_WORDS = new Set(["total", "სულ", "ჯამი"]);

/**
 * The reviewed one-way aliases, applied when one is the whole query. Not a
 * synonym catalogue: extending it needs the owner's say-so (spec section 33).
 * "ბიზნესი" is the Business pages' topic, which no page title holds; "bank
 * loans" and "საბანკო სესხები" are all loans on Loans and deposits.
 */
const SEARCH_ALIASES: Record<string, string> = {
  "დღგ": "revenue.vat", pension: "საპენსიო", "ბიზნესი": "business", "bank loans": "loans.total", "საბანკო სესხები": "loans.total",
};

/** The letters and digits of a text, folded: "მშპ-ის" gives ["მშპ", "ის"], an id splits at "." and "_". */
const searchWords = (text: string): string[] => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** "taxes" and "tax", "pensions" and "pension" - English words of five letters or more, without a plural -s/-es. */
function singular(word: string): string {
  if (word.length < 5 || !/^[a-z]+$/.test(word)) return word;
  if (/(x|s|ch|sh)es$/.test(word)) return word.slice(0, -2);
  return word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/**
 * Two Georgian words share a stem (`stem`, three letters or more) when the
 * stems are equal, or when one is the other plus a final vowel or "ს"
 * (ვალ + ი: "ვალის" and "ვალი"; ონი + ს: "ონის" and "ონი", where a word under
 * five letters keeps its ending), or plus "ებ" of a noun in -ება (განათლ +
 * ებ + ა: "განათლების" and "განათლება"). Any other difference is another
 * word: საგარეო (foreign) is not საგარეჯო (Sagarejo), ფარში is not ფარდა.
 */
function sharesStem(queryWord: string, fieldWord: string): boolean {
  return stemsShared(queryWord, stem(queryWord), fieldWord, stem(fieldWord));
}

/** `sharesStem` on stems already read. */
function stemsShared(queryWord: string, queryStem: string, fieldWord: string, fieldStem: string): boolean {
  const [shorter, longer, longerWord] = queryStem.length <= fieldStem.length ? [queryStem, fieldStem, fieldWord] : [fieldStem, queryStem, queryWord];
  if (shorter.length < 3 || !longer.startsWith(shorter)) return false;
  const rest = longer.slice(shorter.length);
  return rest === "" || /^[იაეოუს]$/.test(rest) || (rest === "ებ" && longerWord === `${shorter}ება`);
}

/**
 * A query word meets a label word when they are the same word, when the query
 * word of four letters or more begins it ("education" finds "educational"; the
 * three letters of "oil" do not find "toilet"), when they share a Georgian stem,
 * or when they differ only by an English plural. Never "somewhere inside the
 * word": that found `port` in "Import" and `VAT` in "innovation".
 */
function wordMatches(queryWord: string, fieldWord: string): boolean {
  if (queryWord === fieldWord) return true;
  if (queryWord.length >= 4 && fieldWord.startsWith(queryWord)) return true;
  if (/\p{Script=Georgian}/u.test(queryWord)) return sharesStem(queryWord, fieldWord);
  return singular(queryWord) === singular(fieldWord);
}

/**
 * What a search reads once per snapshot (RS-1 of the full review): the words of a catalogue text and the stem and
 * singular of a catalogue word, kept as searches meet them. Only the snapshot's own texts go in, never a query, so
 * the memo is bounded by the catalogue.
 */
type WordMemo = { words: Map<string, string[]>; folded: Map<string, string>; stems: Map<string, string>; singulars: Map<string, string> };
const wordMemos = new WeakMap<FactQuerySnapshot, WordMemo>();

function wordMemoOf(snapshot: FactQuerySnapshot): WordMemo {
  let memo = wordMemos.get(snapshot);
  if (memo === undefined) {
    memo = { words: new Map(), folded: new Map(), stems: new Map(), singulars: new Map() };
    wordMemos.set(snapshot, memo);
  }
  return memo;
}

const remembered = <V>(cache: Map<string, V> | undefined, key: string, make: (key: string) => V): V => {
  if (cache === undefined) return make(key);
  let value = cache.get(key);
  if (value === undefined) {
    value = make(key);
    cache.set(key, value);
  }
  return value;
};

/** `wordMatches(queryWord, …)` for one query word against many catalogue words: the query word is read once. */
function wordMatcher(queryWord: string, memo: WordMemo | undefined): (fieldWord: string) => boolean {
  const georgian = /\p{Script=Georgian}/u.test(queryWord);
  const queryStem = georgian ? stem(queryWord) : "";
  const querySingular = georgian ? "" : singular(queryWord);
  return (fieldWord) => queryWord === fieldWord || (queryWord.length >= 4 && fieldWord.startsWith(queryWord))
    || (georgian
      ? stemsShared(queryWord, queryStem, fieldWord, remembered(memo?.stems, fieldWord, stem))
      : querySingular === remembered(memo?.singulars, fieldWord, singular));
}

/**
 * The most different words a search reads, in the order typed. A schema-valid search of 120 characters can hold 60
 * one-letter words, and each word is matched against every catalogue word; the longest real questions run to 16.
 */
const SEARCH_WORD_LIMIT = 16;

/** A search's words without repeats, at most `SEARCH_WORD_LIMIT` of them. */
const distinctWords = (words: string[]) => [...new Set(words)].slice(0, SEARCH_WORD_LIMIT);

/**
 * A folded query looks like an id when it is words joined by "." or "_" and nothing else ("revenue.vat", "57_11"):
 * "wages." and "U.S. dollar" are words with punctuation.
 */
const looksLikeId = (folded: string) => /^[\p{L}\p{N}]+(?:[._][\p{L}\p{N}]+)+$/u.test(folded);

/** A query that looks like an id ("revenue.vat", "57_11") also names it: the whole id, its beginning, or a segment after a ".". */
function idMatches(query: string, field: string, memo?: WordMemo): boolean {
  const id = remembered(memo?.folded, field, fold);
  return id === query || id.startsWith(query) || id.includes(`.${query}`);
}

/**
 * Searches a catalogue by whole words, not by letters. Every word of the query
 * has to meet a word of the entry's fields (`wordMatches`); entries that meet
 * all of them answer as `all_words`. When none does, the entries that meet any
 * word of three letters or more answer as `some_words`, so a phrase such as
 * "annual inflation" still finds its keyword rather than nothing. `null` fields
 * (e.g. a region's entitySlug) are skipped, which is what makes "for
 * municipalities" (the brief's search contract) fall out of the data instead of
 * needing a special case. Pass every entry the response may hold at once: the
 * all/some choice is made once, not per dataset. `aliases: false` reads a
 * whole-query alias as the word it is, for entries that are not series (website
 * pages). The answer also gives the query's own `words` and, for each, the
 * entries that meet it (`wordMatches`) and whether it names one of the `places`
 * (`placeWords`), for a caller to reuse instead of searching again word by word.
 *
 * A word weighs by its rarity: one that few entries meet says more than one that most do. The answer comes in this
 * order (ties keep catalogue order):
 * 1. by the weight of the words the entry's dataset's name meets (`firm` and `ahead` names; an `ahead` name not by the
 *    commonest of two or more words: "rate" of "tax rate", which every rate and tax shares, does not put the Interest
 *    rates page first), so the subject comes first: "food prices" lists Consumer price inflation's series first;
 * 2. in an all-words answer, the entries that meet every word before those `joins` lets join: an entry the query, a
 *    phrase without joining words, names in full with its last word ("personal income tax" holds Income tax,
 *    "government debt" Total debt);
 * 3. by the weight of the words the entry or its dataset's name meets, so "food inflation" lists Food before Headline
 *    inflation; an all-words answer stops here. A some-words answer without `firm` or `ahead` names (one dataset's
 *    entries, whose fields alone say what they are) instead puts the entries that meet more of the query's words first
 *    ("ministry of health programmes": a health programme before Solid waste management programme), then orders them by
 *    that weight times step 6's share, so "red wine bottles" lists Wine before Lead oxides; red lead;
 * 4. by `prefer`, lower first;
 * 5. the entries the query names in full ("Hospitals" for "hospitals in Kutaisi"), then the `total` ones ("crime rate"
 *    lists All recorded crimes before Drug crimes);
 * 6. by the share of the entry's best field that the query covers ("Income tax" is half tax), halved when the query
 *    meets no field's last word (a closing "total" aside).
 */
export function searchCatalogue<T>(
  query: string,
  entries: T[],
  fields: (entry: T) => (string | null)[],
  { aliases = true, places, firm, ahead, joins, prefer, total, memo }: {
    aliases?: boolean;
    places?: (entry: T) => string[] | undefined;
    firm?: (entry: T) => (string | null)[];
    ahead?: (entry: T) => (string | null)[];
    joins?: (entry: T) => boolean;
    prefer?: (entry: T) => number;
    total?: (entry: T) => boolean;
    /** The snapshot's `wordMemoOf`, when `fields` give its own texts. */
    memo?: WordMemo;
  } = {},
): { matches: T[]; searchMatch: "all_words" | "some_words"; words: string[]; wordMatches: T[][]; placeWords: boolean[]; wordsLeftOut: number } {
  const folded = fold(query.trim());
  const needle = aliases && Object.hasOwn(SEARCH_ALIASES, folded) ? SEARCH_ALIASES[folded]! : folded;
  const allWords = searchWords(needle);
  const contentWords = allWords.some((word) => !JOINING_WORDS.has(word)) ? allWords.filter((word) => !JOINING_WORDS.has(word)) : allWords;
  // A repeated word is one word; past `SEARCH_WORD_LIMIT` different words the rest are left out, and the answer says so.
  const queryWords = distinctWords(contentWords);
  const wordsLeftOut = new Set(contentWords).size - queryWords.length;
  const idQuery = looksLikeId(needle);
  const fieldWordsOf = (text: string) => remembered(memo?.words, text, searchWords);
  // Which query words each catalogue word meets, read once per word in this search.
  const matchers = queryWords.map((queryWord) => wordMatcher(queryWord, memo));
  const metByWord = new Map<string, boolean[]>();
  const metBy = (word: string) => remembered(metByWord, word, () => matchers.map((matches) => matches(word)));
  const meetsWord = (words: string[]) => {
    const met = queryWords.map(() => false);
    for (const word of words) metBy(word).forEach((meets, index) => {
      if (meets) met[index] = true;
    });
    return met;
  };

  const rows = entries.map((entry) => {
    const present = fields(entry).filter((field): field is string => field !== null);
    const fieldWords = present.map(fieldWordsOf);
    return {
      entry,
      fieldWords,
      meets: meetsWord(fieldWords.flat()),
      isId: idQuery && present.some((field) => idMatches(needle, field, memo)),
    };
  });
  type Row = (typeof rows)[number];
  const byWord = queryWords.map((_, index) => rows.filter((row) => row.meets[index]).map((row) => row.entry));
  const counts = byWord.map((found) => found.length);
  // The words that name a place the catalogue holds ("Tbilisi", "შიდა ქართლის") are where, not what: they count for
  // the place itself, not for a series whose label holds the name, and are never the commonest word.
  const placeWords = places === undefined ? queryWords.map(() => false) : placeWordsIn(queryWords, entries.flatMap((entry) => places(entry) ?? []), { metBy, wordsOf: fieldWordsOf });
  const answer = (matches: T[], searchMatch: "all_words" | "some_words") => ({ matches, searchMatch, words: queryWords, wordMatches: byWord, placeWords, wordsLeftOut });

  const counted = queryWords.map((word, index) => (word.length >= 3 ? counts[index]! : -1));
  const weights = counted.map((count) => (count > 0 ? Math.log(1 + rows.length / count) : 0));
  const weigh = (met: boolean[]) => weights.reduce((sum, weight, index) => sum + (met[index] ? weight : 0), 0);
  const known = weights.filter((weight, index) => weight > 0 && !placeWords[index]);
  // Of words tied as the commonest, only the first is left out, so a query of two equally common words still lets either count.
  const lightest = Math.min(...known);
  const commonest = known.length < 2 ? -1 : weights.findIndex((weight, index) => weight === lightest && !placeWords[index]);
  // A name shared by many entries (a dataset's) is read once: the query words it meets.
  const namesMet = new Map<string, boolean[]>();
  const nameMeets = (entry: T) => {
    const names = (pick: ((entry: T) => (string | null)[]) | undefined) => (pick?.(entry) ?? []).filter((field): field is string => field !== null);
    const [firmNames, aheadNames] = [names(firm), names(ahead)];
    const key = `${firmNames.join("\n")}\n\n${aheadNames.join("\n")}`;
    if (!namesMet.has(key)) {
      const [byFirm, byAhead] = [firmNames, aheadNames].map((labels) => meetsWord(labels.flatMap(searchWords)));
      namesMet.set(key, queryWords.map((_, index) => byFirm![index]! || (byAhead![index]! && index !== commonest)));
    }
    return namesMet.get(key)!;
  };
  // A word that only a dataset's name holds ("quality" of City air quality) is as rare as a word can be.
  const nameWeights = counted.map((count, index) => (count === 0 ? Math.log(1 + rows.length) : weights[index]!));
  const weighNamed = (met: boolean[]) => nameWeights.reduce((sum, weight, index) => sum + (met[index] ? weight : 0), 0);
  const ranked = (row: Row) => {
    const byName = nameMeets(row.entry);
    const place = places?.(row.entry) !== undefined;
    const covered = row.meets.map((met, index) => ((met && (place || !placeWords[index]!)) || byName[index]!) && nameWeights[index]! > 0);
    return { row, name: weighNamed(byName), words: covered.filter(Boolean).length, cover: weighNamed(covered) };
  };
  // A field the query names in full: each of its words (joining and closing "total" words aside) meets a query word.
  const namesField = (words: string[]) => {
    const naming = words.filter((word) => !JOINING_WORDS.has(word) && !TOTAL_WORDS.has(word));
    return naming.length > 0 && naming.every((word) => metBy(word).some(Boolean));
  };

  const all = rows.filter((row) => row.isId || (queryWords.length > 0 && row.meets.every(Boolean)));
  if (all.length > 0 || queryWords.length === 0) {
    const full = new Set(all);
    const joined = joins === undefined || queryWords.length === 0 || contentWords.length < allWords.length ? [] : rows.filter((row) =>
      !full.has(row) && row.meets.at(-1) === true && joins(row.entry) && row.fieldWords.some(namesField));
    // Array.prototype.sort is stable.
    const order = [...all, ...joined].map(ranked).sort((left, right) =>
      right.name - left.name || Number(!full.has(left.row)) - Number(!full.has(right.row)) || right.cover - left.cover);
    return answer(order.map(({ row }) => row.entry), "all_words");
  }

  // A phrase that is mostly words the catalogue has never met ("unreviewed-retired-product",
  // where only "product" is known) is another subject, not a partial match: the known
  // words must be at least half of the words that can count.
  const candidates = counted.filter((count) => count >= 0);
  if (candidates.filter((count) => count > 0).length * 2 < candidates.length) return answer([], "all_words");
  // The share of a field's words that the query's counted words meet: "Income tax" is half tax.
  const share = (words: string[]) => words.filter((word) => metBy(word).some((meets, index) => meets && weights[index]! > 0)).length / words.length;
  const scored = rows
    .filter((row) => weigh(row.meets) > 0)
    .map((row) => {
      const present = row.fieldWords.filter((words) => words.length > 0);
      return {
        ...ranked(row),
        prefer: prefer?.(row.entry) ?? 0,
        exact: present.some(namesField) ? 0 : 1,
        total: total?.(row.entry) ? 0 : 1,
        // A label's last word, before a closing "total", names what the entry is: "Annual real GDP growth" is a growth,
        // "Economic affairs" are affairs, so "economic growth" lists real growth first.
        precision: Math.max(0, ...present.map(share)) * (present.some((words) => share([words.findLast((word) => !TOTAL_WORDS.has(word)) ?? words.at(-1)!]) > 0) ? 1 : 0.5),
      };
    });
  // Without dataset names to read (one dataset's entries), an entry speaks only by its own fields.
  const named = firm !== undefined || ahead !== undefined;
  // Array.prototype.sort is stable.
  scored.sort((left, right) => right.name - left.name
    || (named ? right.cover - left.cover : right.words - left.words || right.cover * right.precision - left.cover * left.precision)
    || left.prefer - right.prefer || left.exact - right.exact || left.total - right.total || right.precision - left.precision);
  return answer(scored.map(({ row }) => row.entry), scored.length > 0 ? "some_words" : "all_words");
}

/**
 * One `searchCatalogue` over a response's series and entities together, so the all/some choice is made once for both.
 * `order`, given for entries from several datasets, orders the answer (`searchCatalogue`'s `firm`, `ahead`, `joins`,
 * `prefer` and `total`). `titleFields` adds words to a series' fields: a topic dataset's search name for its total series, so a
 * search for the dataset's name finds the dataset and its headline series. `matches` keeps series and entities in one
 * order, which a caller ranks the datasets by.
 */
function searchSeriesAndEntities<S extends SeriesEntry, E extends EntityEntry>(
  search: string,
  series: S[],
  entities: E[],
  order?: Pick<Parameters<typeof searchCatalogue<S | E>>[3] & object, "places" | "firm" | "ahead" | "joins" | "prefer" | "total" | "memo">,
  titleFields?: (entry: S) => string[],
) {
  const { matches, searchMatch, words, wordMatches, placeWords, wordsLeftOut } = searchCatalogue<S | E>(
    search,
    [...series, ...entities],
    (entry) => ("seriesId" in entry ? [entry.seriesId, entry.labelKa, entry.labelEn, entry.headingKa ?? null, entry.headingEn ?? null, ...(titleFields?.(entry as S) ?? [])] : [entry.entityId, entry.labelKa, entry.labelEn, entry.entitySlug]),
    order,
  );
  return {
    matches,
    series: matches.filter((entry): entry is S => "seriesId" in entry),
    entities: matches.filter((entry): entry is E => !("seriesId" in entry)),
    searchMatch,
    words,
    wordMatches,
    placeWords,
    wordsLeftOut,
  };
}

/**
 * The pages, best first by the website's own search, that show `search`'s subject. The website's search matches
 * inside a word from three letters and retries a Latin query on the Georgian keyboard, which linked "ICT" to
 * convictions and "port" to transport, so a page is kept only when the catalogue's own matcher finds every word of
 * the search in its names, topic or extra words. A search that looks like an id names a series, not a page.
 */
function websitePagesFor(snapshot: FactQuerySnapshot, search: string): WebsitePage[] {
  if (looksLikeId(fold(search.trim()))) return [];
  return (searchExplorer(search, "en", snapshot.website.pages, [], null)?.groups ?? [])
    .flatMap((group) => group.rows.map(({ page }) => page as WebsitePage))
    .filter((page) => {
      const found = searchCatalogue(search, [page], (entry) => [entry.name.ka, entry.name.en, entry.topicName.ka, entry.topicName.en, entry.words], { aliases: false, memo: wordMemoOf(snapshot) });
      return found.searchMatch === "all_words" && found.matches.length > 0;
    });
}

/**
 * What a search word is to the page search: a place's (`place`), a word that meets a dataset's own label
 * (`dataset`: "prices" meets Consumer price inflation; `datasetPage` when it may still name a page), one that no
 * served entry meets (`unserved`), one that only
 * budget programmes' names hold (`programme`: "pension" meets "Co-financing the funded pension scheme"), or one the
 * served data holds otherwise (`served`).
 */
type PageWord = "place" | "dataset" | "datasetPage" | "unserved" | "programme" | "served";

/**
 * The words that together name a served place: every word of one of its names. "შიდა ქართლის" names Shida Kartli,
 * while "შიდა" (domestic) alone names nothing, so "შიდა ვალი" stays domestic debt.
 */
function placeWordsIn(
  words: string[],
  names: Iterable<string>,
  { metBy, wordsOf }: { metBy: (nameWord: string) => boolean[]; wordsOf: (name: string) => string[] },
): boolean[] {
  const place = words.map(() => false);
  for (const name of new Set(names)) {
    const nameWords = wordsOf(name).filter((word) => !JOINING_WORDS.has(word));
    const meeting = nameWords.map((nameWord) => words.flatMap((_, index) => (metBy(nameWord)[index] ? [index] : [])));
    if (nameWords.length > 0 && meeting.every((found) => found.length > 0)) for (const index of meeting.flat()) place[index] = true;
  }
  return place;
}

/**
 * Whether `word` meets every word of a page's own name in either language ("pension" names Pensions, not Funded
 * pension), or with `some`, any word of it ("road" meets Road accidents).
 */
function namesPage(word: string, page: WebsitePage, some = false): boolean {
  return [page.name.ka, page.name.en].some((name) => {
    const nameWords = searchWords(name).filter((nameWord) => !JOINING_WORDS.has(nameWord));
    const meets = (nameWord: string) => wordMatches(word, nameWord);
    return nameWords.length > 0 && (some ? nameWords.some(meets) : nameWords.every(meets));
  });
}

/**
 * The website pages a search without a datasetId links, best first (owner review of F01):
 * 1. the pages of the whole search (`websitePagesFor`);
 * 2. failing that, when the answer is empty or only some words matched (`partial`), the pages of the search without
 *    its place words, which no page names; the website's own search sets a place apart the same way (`runWords`), so
 *    "year in review Tbilisi" links the Year in review page;
 * 3. failing that too, the pages of each word, best first by how many of the words they meet: all the pages of an
 *    `unserved` word (a word no served entry meets), and the page a `programme` word names in full. A search a served
 *    topic dataset answers ("hospitals in Kutaisi", "average pension", "unemployment among women", "home prices
 *    Tbilisi") links no page of that topic: its dataset is the answer. A `served` word looks for no page, as it is the
 *    served data's own word ("spending", "city", "food"), but still counts in the order; a `datasetPage` word links only
 *    pages of one topic whose names hold it; a `dataset` word neither looks nor counts.
 * A phrase answered in full, with every word, links only the pages of the whole search. `kinds` is aligned with `words`,
 * the search's words as `searchCatalogue` reads them.
 */
function websitePagesForSearch(
  snapshot: FactQuerySnapshot,
  search: string,
  { words, kinds, partial }: { words: string[]; kinds: PageWord[]; partial: boolean },
): WebsitePage[] {
  const whole = websitePagesFor(snapshot, search);
  if (whole.length > 0 || !partial || looksLikeId(fold(search.trim()))) return whole;
  const indexes = words.map((_, index) => index);
  const content = indexes.some((index) => kinds[index] !== "place") ? indexes.filter((index) => kinds[index] !== "place") : indexes;
  if (content.length < words.length) {
    const withoutPlaces = websitePagesFor(snapshot, content.map((index) => words[index]).join(" "));
    if (withoutPlaces.length > 0) return withoutPlaces;
  }
  if (content.length < 2) return [];
  const looking = content.filter((index) => words[index]!.length >= 3 && kinds[index] !== "dataset");
  const pagesOf = new Map(looking.map((index) => [index, websitePagesFor(snapshot, words[index]!)]));
  // A `datasetPage` word links the pages its word is in the name of, when those are all one topic's: a word in two
  // topics' page names, or "consumer" (no page's name), links none.
  const ownPages = (index: number) => {
    const named = pagesOf.get(index)!.filter((page) => namesPage(words[index]!, page, true));
    return new Set(named.map((page) => page.topic)).size === 1 ? named : [];
  };
  const sources = looking.flatMap((index) =>
    kinds[index] === "unserved" ? pagesOf.get(index)!
      : kinds[index] === "programme" ? pagesOf.get(index)!.filter((page) => namesPage(words[index]!, page))
      : kinds[index] === "datasetPage" ? ownPages(index)
      : [],
  );
  const wordsMet = (page: WebsitePage) => looking.filter((index) => pagesOf.get(index)!.some((other) => other.urlKa === page.urlKa)).length;
  // Array.prototype.sort is stable: pages that meet as many words keep the order of the words, then the website's own.
  return [...new Map(sources.map((page) => [page.urlKa, page])).values()]
    .map((page) => ({ page, met: wordsMet(page) }))
    .sort((left, right) => right.met - left.met)
    .map(({ page }) => page);
}

/**
 * The note every some-words answer carries: its entries may be about something else. A search whose words past
 * `SEARCH_WORD_LIMIT` were left out says so too.
 */
function someWordsNote(snapshot: FactQuerySnapshot, searchMatch: "all_words" | "some_words", wordsLeftOut = 0) {
  const notes = (language: "ka" | "en") => [
    ...(searchMatch === "some_words" ? [serviceMessage(snapshot, language, "catalogue.someWords")] : []),
    ...(wordsLeftOut > 0 ? [serviceMessage(snapshot, language, "catalogue.searchWordsLeftOut", { limit: SEARCH_WORD_LIMIT, omitted: wordsLeftOut })] : []),
  ].join(" ");
  return searchMatch === "some_words" || wordsLeftOut > 0 ? { searchMatchNoteKa: notes("ka"), searchMatchNoteEn: notes("en") } : {};
}

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

export function describeCoverage(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const parsed = describeCoverageInput.safeParse(rawInput);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: serviceMessage(snapshot, "ka", "errors.invalidParameters"),
      messageEn: serviceMessage(snapshot, "en", "errors.invalidParameters", { issues: issues }),
      // Retrying the identical request will fail identically; the client
      // must change the request first, so this is not "retryable" in the
      // transient sense rate_limited/service_unavailable use.
      retryable: false,
      validChoices: allDatasetIds(snapshot),
    });
  }

  const input = parsed.data;
  if (input.datasetId !== undefined && !allDatasetIds(snapshot).includes(input.datasetId as AnyDatasetId)) {
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: serviceMessage(snapshot, "ka", "errors.unknownDataset", { datasetId: input.datasetId }),
      messageEn: serviceMessage(snapshot, "en", "errors.unknownDataset", { datasetId: input.datasetId }),
      retryable: false,
      validChoices: allDatasetIds(snapshot),
    });
  }
  // A search with no letters or digits ("", "   ", "-") names nothing to look for: it is no search.
  const search = input.search !== undefined && searchWords(input.search).length > 0 ? input.search : undefined;

  if (input.expectedDataVersion !== undefined && input.expectedDataVersion !== snapshot.dataVersion) {
    return errorResponse(snapshot, {
      code: "data_version_changed",
      messageKa: serviceMessage(snapshot, "ka", "errors.dataVersionChanged"),
      messageEn: serviceMessage(snapshot, "en", "errors.dataVersionChanged"),
      retryable: false,
    });
  }

  // A catalogue request carries no observations, entities, series selection
  // or comparison — describeCoverage never returns a figure, so this context
  // is fixed and empty regardless of which dataset (if any) was requested.
  // Every data-shaped rule (caveats/rules.*.ts) needs a non-empty
  // seriesIds/entityIds/observations/comparison, or a measure other than
  // amount_gel, to fire, as the "fires no data-shaped caveat" test below
  // asserts. Only the scope disclosures that hold for a whole dataset
  // (deficit_general_government_scope, topic_general_government_scope) fire
  // here, when the request names their dataset; a search that lists
  // Spending by type carries its scope too (below). datasetId falls back to
  // an arbitrary fixed member of DatasetId when the request did not name one.
  const catalogueContext = (datasetId: AnyDatasetId): CaveatContext => ({
      datasetId: datasetId as CaveatContext["datasetId"],
      measure: "amount_gel",
      years: [],
      seriesIds: [],
      entityIds: [],
      observations: [],
      municipalTotalInputs: [],
    municipalInputServedBy: {},
      gdpInputs: [],
      comparison: null,
      historicalJoinSeriesYears: snapshot.ministries.historicalJoinSeriesYears,
      adminCategoryYears: [],
  });
  const caveats = evaluateCaveats(snapshot, catalogueContext((input.datasetId ?? "national-revenue") as AnyDatasetId), CAVEAT_RULES);
  const meta = buildResponseMeta(snapshot, { caveats });

  const exclusions = buildExclusions(snapshot);
  // datasets narrows to the single requested entry once datasetId is given,
  // rather than always returning all four: the brief only says series/
  // entities are absent without a datasetId, but spec §6.2 ("with one,
  // return its entity and series catalogue") reads as the whole response
  // becoming about that one dataset. This is a real contract decision, not
  // just an implementation detail — asserted below by the
  // "narrows datasets to the requested one" test.
  const cityScope = input.entityType === "city";
  const eligibleDatasets = allDatasetIds(snapshot).filter(id => !cityScope || entityTypesOf(snapshot, id).includes("city"));
  const datasets = eligibleDatasets.filter((id) => input.datasetId === undefined || id === input.datasetId).map((id) =>
    buildDatasetSummary(snapshot, id, cityScope),
  );

  if (input.datasetId === undefined) {
    // With no search the dataset catalogue IS the answer (spec §6.2). With one,
    // the instruction this tool gives - "ask this FIRST when you do not already
    // know an id" - has to hold before the dataset is known too, which is
    // exactly the moment a caller cannot name one. Searching within nothing and
    // returning nothing looked like "no such thing" instead of "wrong call".
    if (search === undefined) {
      return { kind: "catalogue", status: "ok", data: { datasets, exclusions }, meta };
    }

    const taggedSeries: (SeriesEntry & { datasetId: AnyDatasetId })[] = [];
    const taggedEntities: (EntityEntry & { datasetId: AnyDatasetId })[] = [];

    for (const id of eligibleDatasets) {
      for (const entry of seriesForDataset(snapshot, id, cityScope)) {
        // Tagged, because a match found without a dataset is useless until the
        // caller knows which dataset to ask.
        if (matchesLevel(entry, input.level, id)) taggedSeries.push({ ...entry, datasetId: id });
      }
      for (const entry of entitiesForDataset(snapshot, id) ?? []) {
        if (input.entityType === undefined || entry.entityType === input.entityType) taggedEntities.push({ ...entry, datasetId: id });
      }
    }

    const datasetLabels = new Map(eligibleDatasets.map((id) => [id, datasetLabelsOf(snapshot, id)]));
    const pageLabels = new Map(eligibleDatasets.map((id) => [id, datasetLabelsOf(snapshot, id, true)]));
    const titleFields = (entry: SeriesEntry & { datasetId: AnyDatasetId }) => (entry.level === LEVEL_TOTAL && !isCoreDataset(entry.datasetId) ? datasetLabels.get(entry.datasetId)! : []);
    // A topic page the search names: every word of its title (joining words aside), in Georgian or English, meets a word
    // of the search. "tax" and "GDP" share a word with Tax breaks and refunds and GDP by expenditure; they do not name them.
    const memo = wordMemoOf(snapshot);
    const queryWords = distinctWords(searchWords(search).filter((word) => !JOINING_WORDS.has(word)));
    const namesTitle = (title: string) => searchWords(title).filter((word) => !JOINING_WORDS.has(word)).every((word) => queryWords.some((queryWord) => wordMatches(queryWord, word)));
    const namesPage = (id: AnyDatasetId) => pageLabels.get(id)!.some(namesTitle);
    // A word a core entry is named by: the last word of its label or id, a closing "total" aside ("tax" of Income tax,
    // "spending" of admin_spending.total), not a word inside it ("air" of Electricity, gas, steam and air conditioning supply).
    const coreHeads = new Set([...taggedSeries, ...taggedEntities].filter((entry) => isCoreDataset(entry.datasetId)).flatMap((entry) =>
      ("seriesId" in entry ? [entry.seriesId, entry.labelKa, entry.labelEn] : [entry.entityId, entry.labelKa, entry.labelEn]).flatMap((name) => {
        const nameWords = remembered(memo.words, name, searchWords);
        return nameWords.findLast((word) => !TOTAL_WORDS.has(word)) ?? [];
      })));
    const coreHeld = queryWords.filter((queryWord) => [...coreHeads].some((word) => wordMatches(queryWord, word)));
    // Fiscal first. A core dataset's own name puts its entries first on any word ("debt" lists Government debt before
    // debt service, "budget balance" General government balance); a topic page's title (not its topic's name, which
    // budget functions share: "education", "health") puts its entries next, but not by a word a core entry is named by
    // ("tax rate" does not put Tax breaks and refunds ahead of the taxes). Of the entries that meet the same words, the
    // core's come first, then totals ("import duties" lists Import tax before the Imports of GDP by expenditure, "crime
    // rate" All recorded crimes before Drug crimes); and a core series the search names in full joins an all-words answer.
    const topicAhead = new Map<AnyDatasetId, string[]>(eligibleDatasets.filter((id) => !isCoreDataset(id)).map((id) => [id, pageLabels.get(id)!.map((title) => searchWords(title).filter((word) => !coreHeld.some((queryWord) => wordMatches(queryWord, word))).join(" "))]));
    const found = searchSeriesAndEntities(search, taggedSeries, taggedEntities, {
      firm: (entry) => (isCoreDataset(entry.datasetId) ? datasetLabels.get(entry.datasetId)! : []),
      ahead: (entry) => topicAhead.get(entry.datasetId) ?? [],
      joins: (entry) => "seriesId" in entry && isCoreDataset(entry.datasetId),
      places: (entry) => ("entityId" in entry ? [entry.labelKa, entry.labelEn] : undefined),
      prefer: (entry) => (isCoreDataset(entry.datasetId) ? 0 : 1),
      total: (entry) => "seriesId" in entry && entry.level === LEVEL_TOTAL,
      memo,
    }, titleFields);
    const { searchMatch, words, wordMatches: matchesByWord, placeWords, wordsLeftOut } = found;
    // A topic page the search is aimed at comes first and is listed: its series are what was asked for. The search is
    // aimed at the page when the dataset's search name meets every word of the search, as typed (a whole-query alias
    // names budget programmes, not a page: "pension" is still Pensions), and the page's title is needed for it: neither
    // the topic's name alone ("education" and "social protection" name budget functions too) nor the page title alone,
    // unless the search names the title in full ("tax" and "GDP" are not Tax breaks and refunds or GDP by expenditure;
    // "external debt" needs External flows — Foreign debt whole).
    const topicIds = eligibleDatasets.filter((id) => !isCoreDataset(id));
    const titled = searchMatch === "all_words" ? searchCatalogue(search, topicIds, (id) => datasetLabels.get(id)!, { aliases: false, memo }) : undefined;
    const allOf = (names: (id: AnyDatasetId) => string[]) => {
      const met = titled?.searchMatch === "all_words" ? searchCatalogue(search, titled.matches, names, { aliases: false, memo }) : undefined;
      return new Set<AnyDatasetId>(met?.searchMatch === "all_words" ? met.matches : []);
    };
    const [topicOnly, pageOnly] = [allOf((id) => topicNamesOf(snapshot, id)), allOf((id) => pageLabels.get(id)!)];
    const titledIds = new Set<AnyDatasetId>(titled?.searchMatch === "all_words" ? titled.matches.filter((id) => !topicOnly.has(id) && (!pageOnly.has(id) || namesPage(id))) : []);
    // In an all-words answer, the pages the search is aimed at come first, then the core datasets, then the other topics,
    // each in the search's own order (a topic whose page title meets a word before another: "wages" lists the Wages
    // pages before Spending by type's wages and salaries).
    const tier = (entry: { datasetId: AnyDatasetId }) => (titledIds.has(entry.datasetId) ? 0 : isCoreDataset(entry.datasetId) ? 1 : 2);
    // A page the search names whose rows hold none of its words, because it has no total to carry its title (Interest
    // rates lists "National Bank rate" and six more side by side), answers with its top-level rows.
    const untitledRows = taggedSeries.filter((entry) => titledIds.has(entry.datasetId) && entry.parentSeriesId === null
      && !snapshot.topics.datasets.some((dataset) => dataset.page.datasetId === entry.datasetId && dataset.series.some((series) => series.isTotal))
      && !found.matches.some((match) => match.datasetId === entry.datasetId));
    const ranked = searchMatch === "all_words" ? [...found.matches, ...untitledRows].toSorted((left, right) => tier(left) - tier(right)) : found.matches;
    const matchedSeries = ranked.filter((entry): entry is SeriesEntry & { datasetId: AnyDatasetId } => "seriesId" in entry);
    // Bounded: a topic dataset lists its first matches, and its entry says how many more a search within it lists.
    const perTopic = new Map<AnyDatasetId, number>();
    const foundSeries = matchedSeries.filter((entry) => {
      if (isCoreDataset(entry.datasetId)) return true;
      const count = (perTopic.get(entry.datasetId) ?? 0) + 1;
      perTopic.set(entry.datasetId, count);
      return count <= SEARCH_TOPIC_SERIES_LIMIT;
    });
    const omittedBy = new Map([...perTopic].filter(([, count]) => count > SEARCH_TOPIC_SERIES_LIMIT).map(([id, count]) => [id, count - SEARCH_TOPIC_SERIES_LIMIT]));
    const omittedValues = { omitted: matchedSeries.length - foundSeries.length, total: matchedSeries.length, limit: SEARCH_TOPIC_SERIES_LIMIT };
    const foundEntities = ranked.filter((entry): entry is EntityEntry & { datasetId: AnyDatasetId } => !("seriesId" in entry));

    // A search is a lookup, so it answers with what matched: the datasets the
    // matches belong to and any excluded code it names, not the whole
    // catalogue, which the no-argument call already returns. The datasets come
    // in the order of their first entry, after the pages the search is aimed at.
    const datasetRank = new Map<AnyDatasetId, number>();
    for (const id of [...titledIds, ...ranked.map((entry) => entry.datasetId)]) if (!datasetRank.has(id)) datasetRank.set(id, datasetRank.size);
    // The website's pages that are not datasets (Year in review, whose figures come from the served budget datasets): a
    // topic the site shows with no dataset of its own gets a link to its page instead of a dead end. Links only; the status stays the series' own. What each word is to
    // the page search comes from the search above, the entities' names and one small search of the datasets' labels
    // over the same words (the same query gives `searchCatalogue` the same words), not from a search per word.
    const labelled = searchCatalogue(search, eligibleDatasets, (id) => datasetLabels.get(id)!, { memo }).wordMatches;
    const kinds = words.map((_, index): PageWord => {
      const served = matchesByWord[index]!;
      if (placeWords[index]) return "place";
      if (labelled[index]!.length > 0) {
        // A word that only a dataset's label holds ("prices") is that dataset's word beside one of its own entries
        // ("bread prices", "fuel prices"), but may name a page beside a word the served data holds elsewhere too.
        // Datasets of one scope (consumer prices) count as one.
        const scopes = new Set(labelled[index]!.map(scopeOf));
        const others = words.flatMap((_, other) => (other !== index && !placeWords[other] && matchesByWord[other]!.length > 0 ? [matchesByWord[other]!] : []));
        const besideOwnEntry = others.some((found) => found.every((entry) => scopes.has(scopeOf(entry.datasetId))));
        return served.length === 0 && others.length > 0 && !besideOwnEntry ? "datasetPage" : "dataset";
      }
      if (served.length === 0) return "unserved";
      return served.every((entry) => "seriesId" in entry && entry.level === LEVEL_MAJOR_PROGRAM) ? "programme" : "served";
    });
    const websitePages = websitePagesForSearch(snapshot, search, {
      words,
      kinds,
      partial: searchMatch === "some_words" || foundSeries.length + foundEntities.length === 0,
    })
      .slice(0, WEBSITE_PAGES_LIMIT)
      .map((page) => ({ topicId: page.topic, labelKa: page.name.ka, labelEn: page.name.en, topicLabelKa: page.topicName.ka, topicLabelEn: page.topicName.en, urlKa: page.urlKa, urlEn: page.urlEn }));
    // A listed topic dataset's whole-dataset scope disclosure travels with the search: "government spending" lists
    // Spending by type, which is general government, not the state budget.
    const scopeCaveats = [...datasetRank.keys()].filter((id) => !isCoreDataset(id))
      .flatMap((id) => evaluateCaveats(snapshot, catalogueContext(id), TOPIC_CAVEAT_RULES));
    return {
      kind: "catalogue",
      status: foundSeries.length === 0 && foundEntities.length === 0 ? "empty" : "ok",
      data: {
        datasets: datasets.filter((dataset) => datasetRank.has(dataset.datasetId)).sort((left, right) => datasetRank.get(left.datasetId)! - datasetRank.get(right.datasetId)!)
          .map((dataset) => (omittedBy.has(dataset.datasetId) ? { ...dataset, seriesOmitted: omittedBy.get(dataset.datasetId)! } : dataset)),
        series: foundSeries,
        entities: foundEntities,
        // A code names an exclusion exactly ("05"), never by a letter inside it.
        exclusions: exclusions.filter((exclusion) => exclusion.entityId === fold(search!.trim())),
        searchMatch,
        ...someWordsNote(snapshot, searchMatch, wordsLeftOut),
        ...(omittedBy.size > 0
          ? {
            seriesOmitted: omittedValues.omitted,
            seriesOmittedNoteKa: serviceMessage(snapshot, "ka", "catalogue.searchSeriesOmitted", omittedValues),
            seriesOmittedNoteEn: serviceMessage(snapshot, "en", "catalogue.searchSeriesOmitted", omittedValues),
          }
          : {}),
        ...(websitePages.length > 0
          ? {
            websitePages,
            websitePagesNoteKa: serviceMessage(snapshot, "ka", "catalogue.websitePages"),
            websitePagesNoteEn: serviceMessage(snapshot, "en", "catalogue.websitePages"),
          }
          : {}),
      },
      meta: scopeCaveats.length > 0 ? buildResponseMeta(snapshot, { caveats: [...caveats, ...scopeCaveats] }) : meta,
    };
  }

  const datasetId = input.datasetId as AnyDatasetId;
  const levelled = (eligibleDatasets.includes(datasetId) ? seriesForDataset(snapshot, datasetId, cityScope) : []).filter((entry) =>
    matchesLevel(entry, input.level, datasetId),
  );
  const typed = entitiesForDataset(snapshot, datasetId)?.filter(
    (entry) => input.entityType === undefined || entry.entityType === input.entityType,
  );
  const searched = search === undefined ? undefined : searchSeriesAndEntities(search, levelled, typed ?? [], { memo: wordMemoOf(snapshot) });
  const series = searched?.series ?? levelled;
  const entities = searched === undefined || typed === undefined ? typed : searched.entities;

  const isEmpty = series.length === 0 && (entities === undefined || entities.length === 0);

  // A topic dataset: its reviewed breaks and CSV, and, when its series list is too long for one answer, only the
  // totals with the page's headings and how many series were left out, to be narrowed with `search`.
  const topic = topicDatasetOf(snapshot, datasetId);
  const truncated = topic !== undefined && series.length > TOPIC_SERIES_LIMIT;
  const shown = truncated ? series.filter((entry) => entry.level === LEVEL_TOTAL).slice(0, TOPIC_SERIES_LIMIT) : series;
  const omittedValues = { omitted: series.length - shown.length, total: series.length };
  const headings = truncated ? [...series.reduce((found, entry) => {
    const key = `${entry.headingKa ?? ""}\n${entry.headingEn ?? ""}`;
    const heading = found.get(key) ?? { headingKa: entry.headingKa ?? null, headingEn: entry.headingEn ?? null, seriesCount: 0 };
    heading.seriesCount += 1;
    return found.set(key, heading);
  }, new Map<string, { headingKa: string | null; headingEn: string | null; seriesCount: number }>()).values()] : undefined;

  return {
    kind: "catalogue",
    status: isEmpty ? "empty" : "ok",
    data: {
      datasets,
      series: shown,
      ...(entities !== undefined ? { entities } : {}),
      exclusions,
      ...(searched !== undefined ? { searchMatch: searched.searchMatch, ...someWordsNote(snapshot, searched.searchMatch, searched.wordsLeftOut) } : {}),
      ...(topic !== undefined ? { breaks: topic.breaks, bulkUrl: bulkUrlFor(snapshot, datasetId) } : {}),
      ...(headings !== undefined
        ? {
          headings,
          seriesOmitted: omittedValues.omitted,
          seriesOmittedNoteKa: serviceMessage(snapshot, "ka", "catalogue.seriesOmitted", omittedValues),
          seriesOmittedNoteEn: serviceMessage(snapshot, "en", "catalogue.seriesOmitted", omittedValues),
        }
        : {}),
    },
    meta,
  };
}

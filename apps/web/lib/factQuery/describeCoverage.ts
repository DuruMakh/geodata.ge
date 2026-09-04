// apps/web/lib/factQuery/describeCoverage.ts
//
// The orientation function. A client — usually a language model — calls this
// first to learn which datasets, series and entities exist before asking for
// any number. It returns no amounts, only capability: this is what makes it
// safe to call with zero prior knowledge of the catalogue.
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import { CAVEAT_RULES, evaluateCaveats } from "./caveats";
import { buildResponseMeta } from "./meta";
import { debtMeasure, deficitMeasure, describeCoverageInput, municipalMeasure, nationalMeasure } from "./schemas";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "./types";
import { DEFICIT_SERIES_ID } from "./types";
import type { DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot, Measure } from "./types";

const DATASET_IDS: readonly DatasetId[] = [
  "national-revenue",
  "national-expenditure",
  "ministries",
  "municipal-expenditure",
];

type EntityType = "country" | "municipality" | "region";
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

type SeriesEntry = {
  seriesId: string;
  labelKa: string;
  level: string;
  parentSeriesId: string | null;
  availability: Availability;
  years: number[];
};

type EntityEntry = {
  entityId: string;
  entityType: EntityType;
  labelKa: string;
  entitySlug: string | null;
};

type DatasetSummary = {
  datasetId: DatasetId;
  budgetScope: string;
  labelKa: string;
  years: [number, number];
  entityTypes: EntityType[];
  measures: Measure[];
};

export type CoverageData = {
  datasets: DatasetSummary[];
  series?: SeriesEntry[];
  entities?: EntityEntry[];
  exclusions: { entityId: string; reason: string }[];
};

// Same wording as the municipality_not_territorial caveat rule
// (caveats/rules.municipal.ts) — reused here as the reason string for these
// codes' permanent, dataset-independent exclusion metadata, so the catalogue
// and the caveat that fires if a client names one of these codes anyway
// describe the same fact in the same words.
const EXCLUDED_MUNICIPALITY_REASON =
  "მითითებული კოდის ბიუჯეტი ტერიტორიულად მიკუთვნებადი ხარჯი არ არის და გამორიცხულია.";

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

function buildExclusions(): CoverageData["exclusions"] {
  return AGGREGATE_ONLY_MUNICIPAL_CODES.map((entityId) => ({ entityId, reason: EXCLUDED_MUNICIPALITY_REASON }));
}

function buildDatasetSummary(snapshot: FactQuerySnapshot, datasetId: DatasetId): DatasetSummary {
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
    case "general-government-balance":
      years = yearRange(
        snapshot.deficit.facts.map((f) => f.year),
        datasetId,
      );
      break;
  }

  const meta = DATASET_META[datasetId];
  // entityTypes/measures are copied out of DATASET_META rather than spread by
  // reference: describeCoverage is called repeatedly against the same
  // long-lived snapshot (§4.2 "reuse calculations without rebuilding the
  // website"), so handing back the module-level array itself would let one
  // caller's in-place mutation of a response corrupt every later call.
  return { datasetId, ...meta, entityTypes: [...meta.entityTypes], measures: [...meta.measures], years };
}

/**
 * revenue.* or expenditure.* series: every taxonomy/glossary item on that
 * side (served if it has fact rows, taxonomy_only if not — revenue.taxes_total
 * is the live case, data/glossary/category-glossary.csv:15) plus the
 * calculated total, which has no CSV row on either side (verified: neither
 * "revenue.total" nor "expenditure.total" appears as an item_id in
 * data/imports/revenue-facts-2004-2025.csv or expenditure-facts-2004-2025.csv).
 */
function nationalSeriesFor(snapshot: FactQuerySnapshot, side: "revenue" | "expenditure"): SeriesEntry[] {
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

  const itemSeries: SeriesEntry[] = items.map((item) => {
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

  const totalSeries: SeriesEntry = {
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
 * 0 "admin_spending.total" rows in data/imports/admin-spending-facts-2004-2025.csv)
 * and is calculated only from admin_category facts — mirroring
 * lib/explorer/explorerData.ts's own total (detailFactsForTotals filters to
 * level === "admin_category" precisely to avoid double-counting programs
 * under their parent category).
 */
function ministriesSeriesFor(snapshot: FactQuerySnapshot): SeriesEntry[] {
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

  const categorySeries: SeriesEntry[] = snapshot.ministries.categories.map((category) => {
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

  const programSeries: SeriesEntry[] = Array.from(programYears.keys())
    .sort()
    .map((itemId) => ({
      seriesId: itemId,
      labelKa: programLabel.get(itemId) ?? itemId,
      level: LEVEL_MAJOR_PROGRAM,
      parentSeriesId: programParent.get(itemId) ?? null,
      availability: "served",
      years: sortedUniqueYears(programYears.get(itemId) ?? []),
    }));

  const totalSeries: SeriesEntry = {
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
function municipalSeriesFor(snapshot: FactQuerySnapshot): SeriesEntry[] {
  const yearsByFunction = new Map<string, Set<number>>();

  for (const fact of [...snapshot.municipal.functionFacts, ...snapshot.municipal.countryFunctionFacts]) {
    const years = yearsByFunction.get(fact.categoryId) ?? new Set<number>();
    years.add(fact.year);
    yearsByFunction.set(fact.categoryId, years);
  }

  const functionSeries: SeriesEntry[] = snapshot.municipal.functions.map((fn) => {
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

  const totalSeries: SeriesEntry = {
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
function debtSeriesFor(snapshot: FactQuerySnapshot): SeriesEntry[] {
  const labels: Record<string, string> = {
    "debt.stock.total": "მთლიანი ვალი",
    "debt.stock.domestic": "საშინაო ვალი",
    "debt.stock.external": "საგარეო ვალი",
    "debt.service.total": "ვალის მომსახურება — ჯამი",
    "debt.service.principal": "ძირითადი თანხის გადახდა",
    "debt.service.interest": "პროცენტის გადახდა",
    "debt.rate.total": "საშუალო შეწონილი განაკვეთი — ჯამი",
    "debt.rate.domestic": "საშუალო შეწონილი განაკვეთი — საშინაო",
    "debt.rate.external": "საშუალო შეწონილი განაკვეთი — საგარეო",
  };

  const byId = new Map<string, number[]>();
  for (const fact of snapshot.debt.facts) {
    if (fact.value === null) continue;
    byId.set(fact.seriesId, [...(byId.get(fact.seriesId) ?? []), fact.year]);
  }

  return Object.entries(labels).map(([seriesId, labelKa]) => ({
    seriesId,
    labelKa,
    level: seriesId.split(".")[1],
    parentSeriesId: null,
    availability: byId.has(seriesId) ? ("served" as const) : ("taxonomy_only" as const),
    years: sortedUniqueYears(byId.get(seriesId) ?? []),
  }));
}

/** One series. Both measures come from the reviewed row, so neither is derived. */
function deficitSeriesFor(snapshot: FactQuerySnapshot): SeriesEntry[] {
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

function seriesForDataset(snapshot: FactQuerySnapshot, datasetId: DatasetId): SeriesEntry[] {
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
  }
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
function municipalEntitiesFor(snapshot: FactQuerySnapshot): EntityEntry[] {
  const country: EntityEntry = {
    entityId: MUNICIPAL_COUNTRY_ID,
    entityType: "country",
    labelKa: "საქართველო",
    entitySlug: null,
  };

  const regions: EntityEntry[] = snapshot.municipal.regions.map((region) => ({
    entityId: region.id,
    entityType: "region",
    labelKa: region.kaLabel,
    entitySlug: null,
  }));

  const municipalities: EntityEntry[] = snapshot.municipal.municipalities.map((municipality) => ({
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

function entitiesForDataset(snapshot: FactQuerySnapshot, datasetId: DatasetId): EntityEntry[] | undefined {
  return datasetId === "municipal-expenditure" ? municipalEntitiesFor(snapshot) : undefined;
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
function matchesLevel(entry: SeriesEntry, level: string | undefined, datasetId: DatasetId): boolean {
  if (level === undefined) return true;
  if (datasetId === "ministries" && entry.level === LEVEL_TOTAL) return level === LEVEL_ADMIN_CATEGORY;
  return entry.level === level;
}

/**
 * Georgian case endings, longest first.
 *
 * A real question says "ბათუმის ბიუჯეტი" while the label is "ბათუმი", and
 * "განათლების" against "განათლება" changes the final vowel rather than only
 * appending one - so plain substring matching misses the form a question
 * actually uses, which is the form a model passes through.
 */
const GEORGIAN_CASE_ENDINGS = ["თვის", "ებში", "ში", "ზე", "ის", "ად", "ით", "მა", "ს"] as const;

/** The query with one case ending removed, or null when none applies. Longest ending wins. */
function georgianStem(query: string): string | null {
  for (const ending of GEORGIAN_CASE_ENDINGS) {
    if (query.endsWith(ending) && query.length - ending.length >= 2) return query.slice(0, -ending.length);
  }
  return null;
}

/** Case-insensitive substring match. `null` candidates (e.g. a region's entitySlug) are skipped, which is what makes "for municipalities" (the brief's search contract) fall out of the data instead of needing a special case. */
function matchesSearch(query: string, candidates: (string | null)[]): boolean {
  const needle = query.toLowerCase();
  const stem = georgianStem(needle);

  return candidates.some((candidate) => {
    if (candidate === null) return false;
    const hay = candidate.toLowerCase();
    if (hay.includes(needle)) return true;
    if (stem === null) return false;
    // A two-character stem is ambiguous - "ონ" sits inside plenty of unrelated
    // labels - so it has to begin the label rather than merely appear in it.
    return stem.length >= 3 ? hay.includes(stem) : hay.startsWith(stem);
  });
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
      messageKa: "მოთხოვნის პარამეტრები არასწორია.",
      messageEn: `Invalid parameters: ${issues}`,
      // Retrying the identical request will fail identically; the client
      // must change the request first, so this is not "retryable" in the
      // transient sense rate_limited/service_unavailable use.
      retryable: false,
      validChoices: [...DATASET_IDS],
    });
  }

  const input = parsed.data;

  if (input.expectedDataVersion !== undefined && input.expectedDataVersion !== snapshot.dataVersion) {
    return errorResponse(snapshot, {
      code: "data_version_changed",
      messageKa: "მონაცემთა ვერსია შეიცვალა; გამოიძახეთ თავიდან expectedDataVersion-ის გარეშე ან განახლებული ვერსიით.",
      messageEn: "The data version has changed since expectedDataVersion was captured; call again without it or with the current dataVersion.",
      retryable: false,
    });
  }

  // A catalogue request carries no observations, entities, series selection
  // or comparison — describeCoverage never returns a figure, so this context
  // is fixed and empty regardless of which dataset (if any) was requested.
  // Traced against all 24 rules (caveats/rules.*.ts): every one requires a
  // non-empty seriesIds/entityIds/observations/comparison, or a measure other
  // than amount_gel, to fire — so this call is provably inert, asserted by
  // the "fires no data-shaped caveat" test below rather than left as an
  // unverified claim. datasetId itself is required by CaveatContext but, for
  // the same reason, cannot affect the outcome here: it falls back to an
  // arbitrary fixed member of DatasetId when the request did not name one.
  const caveats = evaluateCaveats(
    {
      datasetId: input.datasetId ?? "national-revenue",
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
    },
    CAVEAT_RULES,
  );
  const meta = buildResponseMeta(snapshot, { caveats });

  const exclusions = buildExclusions();
  // datasets narrows to the single requested entry once datasetId is given,
  // rather than always returning all four: the brief only says series/
  // entities are absent without a datasetId, but spec §6.2 ("with one,
  // return its entity and series catalogue") reads as the whole response
  // becoming about that one dataset. This is a real contract decision, not
  // just an implementation detail — asserted below by the
  // "narrows datasets to the requested one" test.
  const datasets = DATASET_IDS.filter((id) => input.datasetId === undefined || id === input.datasetId).map((id) =>
    buildDatasetSummary(snapshot, id),
  );

  if (input.datasetId === undefined) {
    // With no search the dataset catalogue IS the answer (spec §6.2). With one,
    // the instruction this tool gives - "ask this FIRST when you do not already
    // know an id" - has to hold before the dataset is known too, which is
    // exactly the moment a caller cannot name one. Searching within nothing and
    // returning nothing looked like "no such thing" instead of "wrong call".
    if (input.search === undefined) {
      return { kind: "catalogue", status: "ok", data: { datasets, exclusions }, meta };
    }

    const foundSeries: (SeriesEntry & { datasetId: DatasetId })[] = [];
    const foundEntities: (EntityEntry & { datasetId: DatasetId })[] = [];

    for (const id of DATASET_IDS) {
      for (const entry of seriesForDataset(snapshot, id)) {
        if (matchesLevel(entry, input.level, id) && matchesSearch(input.search, [entry.seriesId, entry.labelKa])) {
          // Tagged, because a match found without a dataset is useless until the
          // caller knows which dataset to ask.
          foundSeries.push({ ...entry, datasetId: id });
        }
      }
      for (const entry of entitiesForDataset(snapshot, id) ?? []) {
        if (
          (input.entityType === undefined || entry.entityType === input.entityType) &&
          matchesSearch(input.search, [entry.entityId, entry.labelKa, entry.entitySlug])
        ) {
          foundEntities.push({ ...entry, datasetId: id });
        }
      }
    }

    return {
      kind: "catalogue",
      status: foundSeries.length === 0 && foundEntities.length === 0 ? "empty" : "ok",
      data: { datasets, series: foundSeries, entities: foundEntities, exclusions },
      meta,
    };
  }

  const datasetId = input.datasetId;
  const series = seriesForDataset(snapshot, datasetId).filter(
    (entry) =>
      matchesLevel(entry, input.level, datasetId) &&
      (input.search === undefined || matchesSearch(input.search, [entry.seriesId, entry.labelKa])),
  );

  const entities = entitiesForDataset(snapshot, input.datasetId)?.filter(
    (entry) =>
      (input.entityType === undefined || entry.entityType === input.entityType) &&
      (input.search === undefined || matchesSearch(input.search, [entry.entityId, entry.labelKa, entry.entitySlug])),
  );

  const isEmpty = series.length === 0 && (entities === undefined || entities.length === 0);

  return {
    kind: "catalogue",
    status: isEmpty ? "empty" : "ok",
    data: { datasets, series, ...(entities !== undefined ? { entities } : {}), exclusions },
    meta,
  };
}

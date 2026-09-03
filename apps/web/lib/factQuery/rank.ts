// apps/web/lib/factQuery/rank.ts
//
// Ordering among PEERS (spec section 6.7). The constraint that shapes this
// file is that a total never competes with its own components: revenue.total
// against revenue.vat, admin_spending.total against a ministry, or the
// Georgia aggregate against a municipality would each produce a "largest"
// answer that is just the sum of the field it is ranked against.
//
// Values and changes both come from the existing functions - queryNational /
// queryMinistries / queryMunicipal for a single year, compare for the change
// metrics - so a ranking can never disagree with the figure a direct query
// returns for the same cell.
import { compare } from "./compare";
import { describeCoverage } from "./describeCoverage";
import { buildResponseMeta } from "./meta";
import { queryMinistries } from "./queryMinistries";
import { queryMunicipal } from "./queryMunicipal";
import { queryNational } from "./queryNational";
import { rankInput } from "./schemas";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "./types";
import type { Comparison } from "./compare";
import type { Observation } from "./observations";
import type { DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot, Measure, Unit } from "./types";

const EXCLUDED = new Set<string>(AGGREGATE_ONLY_MUNICIPAL_CODES);
const TOTAL_LEVEL = "total";
const GEL_METRICS = new Set(["absolute_change", "percentage_change"]);
const PERCENTAGE_MEASURES = new Set<Measure>(["share_of_total_pct", "share_of_gdp_pct"]);

export type RankEntry = {
  position: number;
  tied: boolean;
  entityId: string;
  entityLabelKa: string;
  seriesId: string;
  seriesLabelKa: string;
  value: number | null;
  unit: Unit;
  basis: "actual" | "planned" | null;
  caveatIds: string[];
};

export type RankData = {
  entries: RankEntry[];
  universe: {
    dimension: "series" | "entities";
    description: string;
    candidateCount: number;
    eligibleCount: number;
    returnedCount: number;
    /** True when `limit` splits a group of equal values, so the cutoff is arbitrary. */
    cutoffSplitsTie: boolean;
  };
  exclusions: { id: string; reason: string }[];
  rankingDefinition: string;
};

type Candidate = {
  entityId: string;
  entityLabelKa: string;
  seriesId: string;
  seriesLabelKa: string;
  /** Never null: a row with no value is an exclusion, never a candidate. */
  value: number;
  unit: Unit;
  basis: "actual" | "planned" | null;
  caveatIds: string[];
  /** Stable sort key, used only to break exact ties reproducibly. */
  stableId: string;
};

const REASON_NOT_COMPARABLE = "საზღვრები შედარებადი არ არის, ამიტომ რანჟირებაში არ მონაწილეობს.";
const REASON_NO_VALUE = "მაჩვენებელი მიუწვდომელია, ამიტომ რანჟირებაში არ მონაწილეობს.";

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

type CatalogueSeries = { seriesId: string; labelKa: string; level: string; parentSeriesId: string | null; availability: string };

function catalogueSeries(snapshot: FactQuerySnapshot, datasetId: DatasetId): CatalogueSeries[] {
  const catalogue = describeCoverage(snapshot, { datasetId });
  if (catalogue.kind === "error") return [];
  return ((catalogue.data as { series?: CatalogueSeries[] }).series ?? []).filter(
    (entry) => entry.availability !== "taxonomy_only",
  );
}

export function rank(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const parsed = rankInput.safeParse(rawInput);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: "მოთხოვნის პარამეტრები არასწორია.",
      messageEn: `Invalid parameters: ${issues}`,
      retryable: false,
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

  const isMunicipal = input.datasetId === "municipal-expenditure";
  const isValueMetric = input.metric === "value";

  // rankInput's refine already pairs `value` with one year and change metrics
  // with two; this rejects the other direction (a value ranking handed a
  // range, or a change ranking handed a single year), which the schema allows
  // because both fields are independently optional.
  if (isValueMetric && (input.fromYear !== undefined || input.toYear !== undefined)) {
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: "მნიშვნელობით რანჟირება ერთ წელს მოითხოვს, დიაპაზონს არა.",
      messageEn: "A value ranking takes a single year, not a year range.",
      retryable: false,
    });
  }
  if (!isValueMetric && input.year !== undefined) {
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: "ცვლილებით რანჟირება ორ წელს მოითხოვს (fromYear და toYear).",
      messageEn: "A change ranking takes fromYear and toYear, not a single year.",
      retryable: false,
    });
  }

  if (!isValueMetric) {
    const wantsPercentagePoints = input.metric === "percentage_point_change";
    const measureIsPercentage = PERCENTAGE_MEASURES.has(input.measure);
    if (wantsPercentagePoints && !measureIsPercentage) {
      return errorResponse(snapshot, {
        code: "unsupported_measure",
        messageKa: "პროცენტული პუნქტის ცვლილება მხოლოდ პროცენტულ მაჩვენებელზეა განსაზღვრული.",
        messageEn: "percentage_point_change applies only to a percentage measure.",
        retryable: false,
      });
    }
    if (GEL_METRICS.has(input.metric) && measureIsPercentage) {
      return errorResponse(snapshot, {
        code: "unsupported_measure",
        messageKa: "აბსოლუტური და პროცენტული ცვლილება მხოლოდ ლარის მაჩვენებელზეა განსაზღვრული; პროცენტისთვის გამოიყენეთ percentage_point_change.",
        messageEn: "absolute_change and percentage_change apply to GEL amounts; use percentage_point_change for a percentage measure.",
        retryable: false,
      });
    }
  }

  if (isMunicipal !== (input.dimension === "entities")) {
    return errorResponse(snapshot, {
      code: "invalid_parameters",
      messageKa: "მუნიციპალური მონაცემები ერთეულებით რანჟირდება, დანარჩენი — სერიებით.",
      messageEn: 'Municipal data ranks by "entities"; every other dataset ranks by "series".',
      retryable: false,
    });
  }

  // ---- universe: peers only -------------------------------------------------

  let entityIds: string[] = [];
  let seriesIds: string[] = [];
  let universeDescription: string;

  if (isMunicipal) {
    if (input.seriesId === undefined || input.entityType === undefined) {
      return errorResponse(snapshot, {
        code: "invalid_parameters",
        messageKa: "მუნიციპალური რანჟირება მოითხოვს entityType-ს და ერთ seriesId-ს.",
        messageEn: "A municipal ranking requires entityType and exactly one seriesId.",
        retryable: false,
      });
    }
    seriesIds = [input.seriesId];

    if (input.entityType === "region") {
      entityIds = snapshot.municipal.regions.map((region) => region.id).sort();
      universeDescription = "საქართველოს 11 რეგიონი; ქვეყნის აგრეგატი და ცალკეული მუნიციპალიტეტები არ მონაწილეობს.";
    } else {
      entityIds = snapshot.municipal.municipalities
        .filter((row) => input.withinRegionId === undefined || row.regionId === input.withinRegionId)
        // Belt and braces: the roster never contains an aggregate-only code,
        // but a ranking is exactly where one appearing would be worst.
        .filter((row) => !EXCLUDED.has(row.code))
        .map((row) => row.code)
        .sort();
      universeDescription = input.withinRegionId
        ? `რეგიონის (${input.withinRegionId}) წევრი მუნიციპალიტეტები; აგრეგირებული კოდები არ მონაწილეობს.`
        : "64 გადამოწმებული მუნიციპალიტეტი; ქვეყნის აგრეგატი, რეგიონები და აგრეგირებული კოდები არ მონაწილეობს.";
    }
  } else {
    const series = catalogueSeries(snapshot, input.datasetId);
    if (input.datasetId === "ministries") {
      const level = input.level ?? "admin_category";
      seriesIds = series
        // admin_spending.total needs no separate exclusion: its catalogue
        // level is "total", so it can never equal a request level of
        // admin_category or major_program.
        .filter((entry) => entry.level === level)
        .filter((entry) => input.parentSeriesId === undefined || entry.parentSeriesId === input.parentSeriesId)
        .map((entry) => entry.seriesId)
        .sort();
      universeDescription =
        level === "major_program"
          ? `გადამოწმებული ძირითადი პროგრამების სერიები${input.parentSeriesId ? ` კატეგორიაში ${input.parentSeriesId}` : ""}; ეს მთავრობის ყველა პროგრამა არ არის, არამედ მხოლოდ გადამოწმებული და მოწოდებული სერიები. ადმინისტრაციული ჯამი არ მონაწილეობს.`
          : "ადმინისტრაციული კატეგორიები; ადმინისტრაციული ჯამი არ მონაწილეობს.";
    } else {
      seriesIds = series
        .filter((entry) => entry.level !== TOTAL_LEVEL)
        .map((entry) => entry.seriesId)
        .sort();
      universeDescription = "საჯარო ხარჯვის/შემოსავლის კატეგორიები; შესაბამისი ჯამი არ მონაწილეობს.";
    }
    entityIds = ["country.georgia"];
  }

  const candidateCount = isMunicipal ? entityIds.length : seriesIds.length;

  if (candidateCount === 0) {
    return errorResponse(snapshot, {
      code: "unknown_series",
      messageKa: "მოთხოვნილ პარამეტრებზე რანჟირებადი სერია ან ერთეული არ მოიძებნა.",
      messageEn: "No rankable series or entity matches these parameters.",
      retryable: false,
    });
  }

  // ---- gather candidate values ---------------------------------------------

  const exclusions: { id: string; reason: string }[] = [];
  const candidates: Candidate[] = [];
  let sources: FactQueryResponse["meta"]["sources"] = [];
  let caveats: FactQueryResponse["meta"]["caveats"] = [];

  const runObservations = (years: number[]): FactQueryResponse => {
    if (input.datasetId === "ministries") {
      return queryMinistries(snapshot, { level: input.level ?? "admin_category", seriesIds, years, measure: input.measure });
    }
    if (isMunicipal) {
      return queryMunicipal(snapshot, { entityIds, seriesIds, years, measure: input.measure });
    }
    return queryNational(snapshot, {
      side: input.datasetId === "national-revenue" ? "revenue" : "expenditure",
      seriesIds,
      years,
      measure: input.measure,
    });
  };

  if (isValueMetric) {
    const result = runObservations([input.year as number]);
    if (result.kind === "error") return errorResponse(snapshot, result.error);

    const observations = (result.data as { observations: Observation[] }).observations;
    sources = result.meta.sources;
    caveats = result.meta.caveats;


    for (const observation of observations) {
      const stableId = isMunicipal ? observation.entityId : observation.seriesId;
      if (observation.value === null) {
        exclusions.push({ id: stableId, reason: observation.missingReason ?? REASON_NO_VALUE });
        continue;
      }
      candidates.push({
        entityId: observation.entityId,
        entityLabelKa: observation.entityLabelKa,
        seriesId: observation.seriesId,
        seriesLabelKa: observation.seriesLabelKa,
        value: observation.value,
        unit: observation.unit,
        basis: observation.basis,
        caveatIds: observation.caveatIds,
        stableId,
      });
    }
  } else {
    const target = isMunicipal
      ? ({ dataset: "municipal", entityIds, seriesIds } as const)
      : input.datasetId === "ministries"
        ? ({ dataset: "ministries", level: input.level ?? "admin_category", seriesIds } as const)
        : ({ dataset: "national", side: input.datasetId === "national-revenue" ? "revenue" : "expenditure", seriesIds } as const);

    const result = compare(snapshot, {
      target,
      fromYear: input.fromYear as number,
      toYear: input.toYear as number,
      measure: input.measure,
    });
    if (result.kind === "error") return errorResponse(snapshot, result.error);

    const comparisons = (result.data as { comparisons: Comparison[] }).comparisons;
    sources = result.meta.sources;
    caveats = result.meta.caveats;

    for (const comparison of comparisons) {
      const stableId = isMunicipal ? comparison.entityId : comparison.seriesId;

      // Spec section 6.7: omit what is not comparable and report it. A
      // `limited` comparison may remain, carrying its caveat.
      if (comparison.comparability === "not_comparable") {
        exclusions.push({ id: stableId, reason: comparison.reasons[0] ?? REASON_NOT_COMPARABLE });
        continue;
      }

      const value =
        input.metric === "absolute_change"
          ? comparison.absoluteChange
          : input.metric === "percentage_change"
            ? comparison.percentageChange
            : comparison.percentagePointChange;

      if (value === null) {
        // compare() already knows WHY - most often a zero or negative base,
        // which makes percentage change undefined while both endpoint values
        // exist. Reporting "the indicator is unavailable" there was a wrong
        // statement about the data, and exclusions are a ranking honesty
        // mechanism. Mirrors the not_comparable branch just above.
        exclusions.push({ id: stableId, reason: comparison.reasons[0] ?? REASON_NO_VALUE });
        continue;
      }

      candidates.push({
        entityId: comparison.entityId,
        entityLabelKa: comparison.entityLabelKa,
        seriesId: comparison.seriesId,
        seriesLabelKa: comparison.seriesLabelKa,
        value,
        // The unit must describe THIS entry's `value`, and on a change ranking
        // that value is a change, not an endpoint. `comparison.unit` is the
        // MEASURE's unit, so a percentage_change ranking over amount_gel
        // published `{ value: 464.33, unit: "GEL" }` - read plainly, "464 GEL"
        // instead of "+464%". compare() escapes this because its unit describes
        // the two endpoints and its changes sit in separately named fields;
        // rank collapses both into one value/unit pair, so it has to choose.
        //
        // percentage_point_change is reported as "percent" too: the Unit union
        // has no percentage-point member, and adding one changes the shared
        // schema. "percent" is imprecise for points but no longer false about
        // the order of magnitude, and `rankingDefinition` names the exact
        // metric. Adding a distinct unit is an open contract decision.
        unit: input.metric === "absolute_change" ? comparison.unit : "percent",
        basis: comparison.to.basis,
        caveatIds: comparison.caveatIds,
        stableId,
      });
    }
  }

  // Spec section 6.7: one ordering needs one consistent actual/planned basis,
  // or a plan and an outturn are presented as the same kind of number. Checked
  // over the CANDIDATES so it covers change rankings as well as value ones -
  // compare() rejects a mixed basis within a single pair, but nothing stopped
  // one candidate being actual->actual and another planned->planned in the same
  // table. Currently unreachable (every reviewed fact is "actual"), but the
  // rule outlives that, which is the same reason the value branch had it.
  const bases = new Set(candidates.filter((c) => c.basis !== null).map((c) => c.basis));
  if (bases.size > 1) {
    return errorResponse(snapshot, {
      code: "unsupported_comparison",
      messageKa: "რანჟირებადი მწკრივები ფაქტსა და გეგმას ურევს; ერთიანი დალაგება არ ბრუნდება.",
      messageEn: "The eligible rows mix actual and planned bases; a single unqualified ordering is not returned.",
      retryable: false,
    });
  }

  // ---- order, tie-flag, cut -------------------------------------------------

  const direction = input.order === "ascending" ? 1 : -1;
  // Ordering happens on full-precision values; formatting is a presentation
  // concern and never decides position. Exact ties fall back to the stable id
  // so the same request always returns the same order.
  const ordered = [...candidates].sort((left, right) => {
    const byValue = (left.value - right.value) * direction;
    if (byValue !== 0) return byValue;
    return left.stableId < right.stableId ? -1 : left.stableId > right.stableId ? 1 : 0;
  });

  const valueCounts = new Map<number, number>();
  for (const entry of ordered) valueCounts.set(entry.value, (valueCounts.get(entry.value) ?? 0) + 1);
  const tiedValues = new Set(Array.from(valueCounts).filter(([, count]) => count > 1).map(([value]) => value));

  const cut = ordered.slice(0, input.limit);
  const cutoffSplitsTie =
    ordered.length > input.limit && ordered[input.limit - 1]?.value === ordered[input.limit]?.value;

  const entries: RankEntry[] = cut.map((entry, index) => ({
    position: index + 1,
    // An arbitrary tie-break must never read as a meaningful difference.
    tied: tiedValues.has(entry.value),
    entityId: entry.entityId,
    entityLabelKa: entry.entityLabelKa,
    seriesId: entry.seriesId,
    seriesLabelKa: entry.seriesLabelKa,
    value: entry.value,
    unit: entry.unit,
    basis: entry.basis,
    caveatIds: entry.caveatIds,
  }));

  const rankingDefinition = isValueMetric
    ? `დალაგება მაჩვენებლით ${input.measure}, ${input.year} წელი, ${input.order === "ascending" ? "ზრდადობით" : "კლებადობით"}.`
    : `დალაგება ცვლილებით ${input.metric} (${input.measure}), ${input.fromYear}→${input.toYear}, ${input.order === "ascending" ? "ზრდადობით" : "კლებადობით"}.`;

  const status: "ok" | "partial" | "empty" =
    entries.length === 0 ? "empty" : exclusions.length === 0 ? "ok" : "partial";

  // No citedDocumentIds: a RankEntry carries no documentIds to narrow by,
  // and a ranking genuinely draws on every ranked entity's originals, so the
  // full document list is the honest evidence here rather than an oversight.
  const meta = buildResponseMeta(snapshot, { sources, caveats });

  const data: RankData = {
    entries,
    universe: {
      dimension: input.dimension,
      description: universeDescription,
      candidateCount,
      eligibleCount: candidates.length,
      returnedCount: entries.length,
      cutoffSplitsTie,
    },
    exclusions,
    rankingDefinition,
  };

  return { kind: "ranking", status, data, meta };
}

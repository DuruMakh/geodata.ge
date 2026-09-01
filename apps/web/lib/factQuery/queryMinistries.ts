// apps/web/lib/factQuery/queryMinistries.ts
//
// State-budget administrative categories and reviewed major programs
// (spec section 6.4). queryNational's sibling: same envelope, same
// observation shape, same error codes.
//
// Two things this dataset has that the national one does not:
//
//   1. A hierarchy. A major program is a CHILD of an administrative
//      category, not extra spending beside it, so every program
//      observation names its `parentSeriesId` and the calculated total
//      sums admin_category rows only. Adding a category to its own
//      programs double-counts.
//   2. Historical joins. The served facts already have every approved
//      succession and legacy join applied by the generator, so nothing
//      here re-derives, re-maps or re-joins anything;
//      snapshot.ministries.historicalJoinSeriesIds only tells the caveat
//      engine which series carry one.
import { isDerivedTotalItemId } from "../explorer/explorerData";
import { shareOfTotal } from "../explorer/share";
import { CAVEAT_RULES, evaluateCaveats } from "./caveats";
import { buildResponseMeta } from "./meta";
import { buildObservationId, caveatIdsForObservation, resolveDocumentIds, uniqueSorted } from "./observations";
import { queryMinistriesInput } from "./schemas";
import { selectSources, splitSourceIds } from "./sources";
import type { CaveatContext } from "./caveats";
import type { Observation } from "./observations";
import type { Coverage, DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot } from "./types";

const DATASET_ID: DatasetId = "ministries";
const ENTITY_ID = "country.georgia";
const ENTITY_LABEL_KA = "საქართველო";
// Same budgetScope slug describeCoverage.ts's DATASET_META assigns this
// dataset, kept in sync by hand (that map is module-private there) so a
// caller comparing the catalogue against an observation sees one string.
const BUDGET_SCOPE = "state_budget_administrative";
const TOTAL_SERIES_ID = "admin_spending.total";
const TOTAL_LABEL_KA = "მთლიანი ხარჯი";
const LEVEL_TOTAL = "total";

// Deliberately the same wording queryNational.ts uses for the same three
// situations: a client reading one dataset's absent cell and another's
// should see one phrasing. Kept local rather than exported from
// observations.ts, which owns shared structure (id building, document
// resolution, caveat attachment), not display strings.
function missingSeriesReason(year: number): string {
  return `არჩეული სერიისთვის ${year} წელს მონაცემი არ ფიქსირდება — ეს ნულოვან მნიშვნელობას არ ნიშნავს.`;
}

const GDP_DENOMINATOR_MISSING_REASON =
  "ამ წლისთვის მშპ-ის მაჩვენებელი მიუწვდომელია ან დადებითი არ არის, ამიტომ წილის გამოთვლა შეუძლებელია.";
const TOTAL_DENOMINATOR_MISSING_REASON =
  "ამ წლისთვის შესაბამისი ჯამი მიუწვდომელია ან დადებითი არ არის, ამიტომ წილის გამოთვლა შეუძლებელია.";

type SeriesKind = "total" | "admin_category" | "major_program";

function valueDefinitionFor(
  kind: SeriesKind,
  measure: "amount_gel" | "share_of_total_pct" | "share_of_gdp_pct",
  originalLabelKa: string | null,
): string {
  const base = (() => {
    if (measure === "share_of_gdp_pct") {
      return "წილი იმავე წლის მშპ-ში მიმდინარე ფასებში, 0-დან 100-მდე შკალაზე.";
    }
    if (measure === "share_of_total_pct") {
      // Names the denominator explicitly, because the one mistake this
      // measure invites on this dataset is reading a program's share as a
      // share of its own ministry (spec section 5.2: "full administrative
      // expenditure total, not selected rows or parent ministry").
      return "წილი წლის მთლიან ადმინისტრაციულ ხარჯში (და არა მშობელ კატეგორიაში), 0-დან 100-მდე შკალაზე.";
    }
    if (kind === "total") {
      return "გამოთვლილია წლის ადმინისტრაციული კატეგორიების ჯამად; პროგრამები კატეგორიების შვილობილია და ჯამს ცალკე არ ემატება.";
    }
    if (kind === "major_program") {
      return "საწყისი გადამოწმებული მაჩვენებელი ლარში, სრული სიზუსტით; პროგრამა კატეგორიის შვილობილია და მას ცალკე არ ემატება.";
    }
    return "საწყისი გადამოწმებული მაჩვენებელი ლარში, სრული სიზუსტით.";
  })();

  // The series keeps its current reviewed Georgian name (a joined series is
  // titled by its most recent official label); this year's own official
  // label is surfaced here instead of overwriting that name, per spec
  // section 6.4's "original historical labels where relevant".
  return originalLabelKa === null ? base : `${base} ამ წლის ორიგინალი ოფიციალური დასახელება: „${originalLabelKa}“.`;
}

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

export function queryMinistries(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const parsed = queryMinistriesInput.safeParse(rawInput);

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

  const facts = snapshot.ministries.facts;
  // No chooseActivePublicFacts here, unlike queryNational: ServedAdminFact
  // (lib/servedRows.ts) has no `side` field, which that helper's generic
  // constraint requires, and its `basis` is the literal type "actual", so
  // no planned row can exist for actual-over-planned precedence to resolve.
  // lib/explorer/explorerData.ts's own ministries branch (buildExplorerModel,
  // isMinistryGrouping) skips it for exactly the same reason.
  //
  // isDerivedTotalItemId then strips any row that is itself the derived
  // admin total (none exist in the reviewed CSV today - verified: no
  // "admin_spending.total" item_id row in
  // data/imports/admin-spending-facts-2004-2025.csv - but the total below
  // must never double-count one if a future row ever adds it).
  const categoryFacts = facts.filter((f) => f.level === "admin_category" && !isDerivedTotalItemId(f.itemId));
  const programFacts = facts.filter((f) => f.level === "major_program");
  const levelFacts = input.level === "admin_category" ? categoryFacts : programFacts;

  // The dataset's overall coverage, not the requested level's: a program
  // year inside 2004-2025 but outside that program's own coverage is a
  // missing cell, never an out-of-range error (brief, "Coverage is ragged").
  const datasetYears = Array.from(new Set(facts.map((f) => f.year))).sort((a, b) => a - b);
  const minYear = datasetYears[0];
  const maxYear = datasetYears[datasetYears.length - 1];

  if (minYear === undefined || maxYear === undefined) {
    throw new Error(`queryMinistries: dataset "${DATASET_ID}" has no facts to derive a year range from`);
  }

  const categoryById = new Map(snapshot.ministries.categories.map((category) => [category.id, category]));
  // Facts are year-ascending (buildSnapshot.ts sorts by year then itemId), so
  // the last write per program itemId carries its most recent official name
  // and parent - the same "current reviewed name" rule explorerData.ts and
  // describeCoverage.ts already apply, and the reason a joined series is not
  // titled by its oldest pre-2012 organizational line. Built from every
  // program fact, not only the requested years, so a series whose requested
  // years are all missing still reports its parent and name.
  const programMeta = new Map<string, { labelKa: string; parentSeriesId: string | null }>();
  for (const fact of programFacts) {
    programMeta.set(fact.itemId, { labelKa: fact.officialLabelKa ?? fact.itemId, parentSeriesId: fact.parentItemId });
  }

  // "Queryable" at admin_category = the calculated total, or a taxonomy
  // category with at least one served row. At major_program the facts ARE
  // the catalogue. The two levels stay disjoint, and admin_spending.total
  // exists only at admin_category: it is not a program (spec section 6.4).
  const queryableSeriesIds =
    input.level === "admin_category"
      ? new Set<string>([
          TOTAL_SERIES_ID,
          ...snapshot.ministries.categories
            .filter((category) => categoryFacts.some((f) => f.itemId === category.id))
            .map((category) => category.id),
        ])
      : new Set<string>(programFacts.map((f) => f.itemId));

  const unknownSeriesIds = input.seriesIds.filter((id) => !queryableSeriesIds.has(id));
  if (unknownSeriesIds.length > 0) {
    return errorResponse(snapshot, {
      code: "unknown_series",
      messageKa: `უცნობი სერიის იდენტიფიკატორი მოთხოვნილ დონეზე (${input.level}): ${unknownSeriesIds.join(", ")}.`,
      messageEn: `Unknown series id(s) at level "${input.level}": ${unknownSeriesIds.join(", ")}.`,
      retryable: false,
      validChoices: Array.from(queryableSeriesIds).sort(),
    });
  }

  const outOfRangeYears = input.years.filter((year) => year < minYear || year > maxYear);
  if (outOfRangeYears.length > 0) {
    return errorResponse(snapshot, {
      code: "year_out_of_range",
      messageKa: `მოთხოვნილი წელი (${outOfRangeYears.join(", ")}) სცილდება მონაცემთა დაფარვის საზღვრებს (${minYear}–${maxYear}); წელი არ იკვეცება.`,
      messageEn: `Requested year(s) ${outOfRangeYears.join(", ")} fall outside this dataset's coverage (${minYear}-${maxYear}).`,
      retryable: false,
    });
  }

  const factByKey = new Map(levelFacts.map((f) => [`${f.itemId}:${f.year}`, f]));

  // The full administrative expenditure total for the year: admin_category
  // rows only, never programs, mirroring lib/explorer/explorerData.ts's own
  // detailFactsForTotals (`!isMinistryGrouping || fact.level ===
  // "admin_category"`) - the same filter, for the same double-counting
  // reason. Plain floating-point summation, matching that file's totalByYear
  // accumulation exactly rather than a second arithmetic, so this figure is
  // provably the one the website's own ministries chart displays.
  const totalsByYear = new Map<number, { value: number; sourceIds: string[] }>();
  for (const year of input.years) {
    const yearFacts = categoryFacts.filter((f) => f.year === year);
    if (yearFacts.length === 0) continue;
    totalsByYear.set(year, {
      value: yearFacts.reduce((sum, f) => sum + f.amountGel, 0),
      sourceIds: uniqueSorted(yearFacts.flatMap((f) => splitSourceIds(f.sourceId))),
    });
  }

  const gdpByYear = new Map(snapshot.gdpFacts.map((f) => [f.year, f]));
  const usedGdpYears = new Set<number>();

  type ObservationCore = Omit<Observation, "documentIds" | "caveatIds">;
  const cores: ObservationCore[] = [];

  for (const seriesId of input.seriesIds) {
    const isTotal = seriesId === TOTAL_SERIES_ID;
    const kind: SeriesKind = isTotal ? "total" : input.level;
    const program = kind === "major_program" ? programMeta.get(seriesId) : undefined;
    const seriesLabelKa = isTotal
      ? TOTAL_LABEL_KA
      : kind === "admin_category"
        ? (categoryById.get(seriesId)?.kaLabel ?? seriesId)
        : (program?.labelKa ?? seriesId);
    const parentSeriesId = kind === "major_program" ? (program?.parentSeriesId ?? null) : null;

    for (const year of input.years) {
      let numeratorAmount: number | null;
      let numeratorSourceIds: string[];
      let missingReason: string | null;
      let originalLabelKa: string | null = null;

      if (isTotal) {
        const total = totalsByYear.get(year);
        if (total) {
          numeratorAmount = total.value;
          numeratorSourceIds = total.sourceIds;
          missingReason = null;
        } else {
          numeratorAmount = null;
          numeratorSourceIds = [];
          missingReason = missingSeriesReason(year);
        }
      } else {
        const fact = factByKey.get(`${seriesId}:${year}`);
        if (fact) {
          numeratorAmount = fact.amountGel;
          numeratorSourceIds = splitSourceIds(fact.sourceId);
          missingReason = null;
          originalLabelKa = fact.officialLabelKa !== null && fact.officialLabelKa !== seriesLabelKa ? fact.officialLabelKa : null;
        } else {
          // Missing != zero != excluded. Program coverage is genuinely
          // ragged (no major-program rows before 2006, contiguous only from
          // 2017, and documented within-range gaps), so a year a series does
          // not cover yields value: null with a reason - never a 0, never a
          // silently dropped row.
          numeratorAmount = null;
          numeratorSourceIds = [];
          missingReason = missingSeriesReason(year);
        }
      }

      let value: number | null = null;
      let sourceIds: string[] = [];

      if (numeratorAmount !== null) {
        if (input.measure === "amount_gel") {
          value = numeratorAmount;
          sourceIds = numeratorSourceIds;
        } else if (input.measure === "share_of_total_pct") {
          // The full administrative total, never the selected rows and never
          // the parent ministry (spec section 5.2). shareOfTotal
          // (lib/explorer/share.ts) is the same function every percent-of-
          // total column on the site uses; reused here rather than
          // re-deriving its null/zero guards.
          const total = totalsByYear.get(year);
          const share = total ? shareOfTotal(numeratorAmount, total.value) : null;
          if (share === null) {
            missingReason = TOTAL_DENOMINATOR_MISSING_REASON;
          } else {
            value = share * 100;
            sourceIds = uniqueSorted([...numeratorSourceIds, ...(total?.sourceIds ?? [])]);
          }
        } else {
          // share_of_gdp_pct
          usedGdpYears.add(year);
          const gdp = gdpByYear.get(year);
          if (!gdp || gdp.gdpCurrentPricesGel <= 0) {
            missingReason = GDP_DENOMINATOR_MISSING_REASON;
          } else {
            value = (numeratorAmount / gdp.gdpCurrentPricesGel) * 100;
            sourceIds = uniqueSorted([...numeratorSourceIds, ...splitSourceIds(gdp.sourceId)]);
          }
        }
      }

      const availability = value === null ? "missing" : "available";

      cores.push({
        observationId: buildObservationId(DATASET_ID, ENTITY_ID, seriesId, year, input.measure),
        datasetId: DATASET_ID,
        budgetScope: BUDGET_SCOPE,
        entityId: ENTITY_ID,
        entityType: "country",
        entityLabelKa: ENTITY_LABEL_KA,
        entitySlug: null,
        seriesId,
        seriesLabelKa,
        level: isTotal ? LEVEL_TOTAL : input.level,
        parentSeriesId,
        year,
        measure: input.measure,
        unit: input.measure === "amount_gel" ? "GEL" : "percent",
        value,
        availability,
        missingReason: availability === "missing" ? missingReason : null,
        // ServedAdminFact.basis is the literal "actual": the administrative
        // dataset carries no planned rows, so an available cell is always
        // actual and a missing one has no basis at all.
        basis: availability === "missing" ? null : "actual",
        valueDefinition: valueDefinitionFor(kind, input.measure, originalLabelKa),
        sourceIds,
      });
    }
  }

  const allSourceIds = uniqueSorted(cores.flatMap((core) => core.sourceIds));
  const resolvedSources = selectSources(snapshot, allSourceIds);

  const withDocuments: Omit<Observation, "caveatIds">[] = cores.map((core) => ({
    ...core,
    documentIds: resolveDocumentIds(resolvedSources, core.sourceIds),
  }));

  const gdpInputs = snapshot.gdpFacts.filter((f) => usedGdpYears.has(f.year));

  const caveatContext: CaveatContext = {
    datasetId: DATASET_ID,
    measure: input.measure,
    years: input.years,
    seriesIds: input.seriesIds,
    // Administrative data has no entity-selection dimension - every row is
    // country.georgia - and "country.georgia" is also MUNICIPAL_COUNTRY_ID.
    // The municipal rules are dataset-gated, but an empty list stays the
    // correct defence in depth for a non-municipal query, as queryNational
    // and describeCoverage both pass. See the scoping contract on
    // CaveatContext (caveats/engine.ts).
    entityIds: [],
    observations: withDocuments.map((o) => ({ entityId: o.entityId, seriesId: o.seriesId, year: o.year, value: o.value, basis: o.basis })),
    municipalTotalInputs: [],
    gdpInputs,
    comparison: null,
    // Caveat context only: the joins themselves are already applied in the
    // served facts, so this list is never a transformation input here.
    historicalJoinSeriesIds: snapshot.ministries.historicalJoinSeriesIds,
  };
  const caveats = evaluateCaveats(caveatContext, CAVEAT_RULES);

  const observations: Observation[] = withDocuments.map((o) => ({ ...o, caveatIds: caveatIdsForObservation(caveats, o) }));

  const missingCells = observations
    .filter((o) => o.availability === "missing")
    .map((o) => ({ entityId: o.entityId, seriesId: o.seriesId, year: o.year, reason: o.missingReason ?? "" }));
  const returnedYears = Array.from(new Set(observations.filter((o) => o.availability === "available").map((o) => o.year))).sort(
    (a, b) => a - b,
  );
  const returnedCount = observations.filter((o) => o.availability === "available").length;
  const expectedCount = observations.length;

  const coverage: Coverage = {
    requestedYears: input.years,
    // The dataset's years, matching the range the out-of-range check above
    // enforces. A requested series' own ragged coverage is reported per cell
    // in missingCells and returnedYears, and per series by describeCoverage.
    availableYears: datasetYears,
    returnedYears,
    missingCells,
    excludedEntities: [],
    returnedCount,
    expectedCount,
  };

  const status: "ok" | "partial" | "empty" = returnedCount === 0 ? "empty" : returnedCount === expectedCount ? "ok" : "partial";
  const meta = buildResponseMeta(snapshot, { sources: resolvedSources, caveats });

  return { kind: "observations", status, data: { observations, coverage }, meta };
}

// apps/web/lib/factQuery/queryNational.ts
//
// The first function that returns actual money. Every observation traces
// its value to one or more snapshot facts (never a default, a clamp, or a
// silent substitution) and carries the sources that back it.
//
// Revenue and expenditure are different budget concepts (spec section 5.1):
// national-revenue is consolidated budget receipts, national-expenditure is
// state-budget expenditure. Every observation's budgetScope names which, so
// geography alone (both are "country.georgia") can never be read as the two
// sides measuring the same thing.
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId } from "../explorer/explorerData";
import { shareOfTotal } from "../explorer/share";
import { CAVEAT_RULES, evaluateCaveats } from "./caveats";
import { buildResponseMeta } from "./meta";
import { buildObservationId, caveatIdsForObservation, resolveDocumentIds, uniqueSorted } from "./observations";
import { queryNationalInput } from "./schemas";
import { selectSources, splitSourceIds } from "./sources";
import type { CaveatContext } from "./caveats";
import type { Observation } from "./observations";
import type { Coverage, DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot } from "./types";

const ENTITY_ID = "country.georgia";
const ENTITY_LABEL_KA = "საქართველო";
const LEVEL_TOTAL = "total";
const LEVEL_PUBLIC_FIELD = "public_field";

type Side = "revenue" | "expenditure";

function missingSeriesReason(year: number): string {
  return `არჩეული სერიისთვის ${year} წელს მონაცემი არ ფიქსირდება — ეს ნულოვან მნიშვნელობას არ ნიშნავს.`;
}

const GDP_DENOMINATOR_MISSING_REASON =
  "ამ წლისთვის მშპ-ის მაჩვენებელი მიუწვდომელია ან დადებითი არ არის, ამიტომ წილის გამოთვლა შეუძლებელია.";
const TOTAL_DENOMINATOR_MISSING_REASON =
  "ამ წლისთვის შესაბამისი ჯამი მიუწვდომელია ან დადებითი არ არის, ამიტომ წილის გამოთვლა შეუძლებელია.";

function valueDefinitionFor(isTotal: boolean, side: Side, measure: "amount_gel" | "share_of_total_pct" | "share_of_gdp_pct"): string {
  if (measure === "share_of_gdp_pct") {
    return "წილი იმავე წლის მშპ-ში მიმდინარე ფასებში, 0-დან 100-მდე შკალაზე.";
  }
  if (measure === "share_of_total_pct") {
    return side === "revenue"
      ? "წილი წლის მთლიან შემოსავლებში, 0-დან 100-მდე შკალაზე."
      : "წილი წლის მთლიან ხარჯში, 0-დან 100-მდე შკალაზე.";
  }
  if (isTotal) {
    return side === "revenue"
      ? "გამოთვლილია შემოსავლების ყველა კომპონენტის ჯამად შესაბამისი წლისთვის."
      : "გამოთვლილია ხარჯების ყველა კომპონენტის ჯამად შესაბამისი წლისთვის.";
  }
  return "საწყისი გადამოწმებული მაჩვენებელი ლარში, სრული სიზუსტით.";
}

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

export function queryNational(snapshot: FactQuerySnapshot, rawInput: unknown): FactQueryResponse {
  const parsed = queryNationalInput.safeParse(rawInput);

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

  const side = input.side;
  const datasetId: DatasetId = side === "revenue" ? "national-revenue" : "national-expenditure";
  // Same budgetScope slugs describeCoverage.ts's DATASET_META assigns these two
  // datasets, kept in sync by hand (that map is module-private there) so a
  // caller comparing describeCoverage's dataset summary against an observation
  // for the same dataset sees the identical string.
  const budgetScope = side === "revenue" ? "consolidated_budget_receipts" : "state_budget_expenditure";
  const totalSeriesId = side === "revenue" ? "revenue.total" : "expenditure.total";
  const totalLabelKa = side === "revenue" ? "მთლიანი შემოსავლები" : "მთლიანი ხარჯი";

  // Actual-over-planned precedence (spec section 5.3), reused rather than
  // reimplemented. isDerivedTotalItemId then strips any row that is itself a
  // derived total (none exist in the reviewed CSVs today - verified: no
  // "revenue.total"/"expenditure.total" item_id row in data/imports - but the
  // total below must never double-count one if a future row ever adds it).
  const activeSideFacts = chooseActivePublicFacts(snapshot.national.facts).filter((f) => f.side === side);
  const componentFacts = activeSideFacts.filter((f) => !isDerivedTotalItemId(f.itemId));

  const sideYears = Array.from(new Set(componentFacts.map((f) => f.year))).sort((a, b) => a - b);
  const minYear = sideYears[0];
  const maxYear = sideYears[sideYears.length - 1];

  if (minYear === undefined || maxYear === undefined) {
    throw new Error(`queryNational: dataset "${datasetId}" has no facts to derive a year range from`);
  }

  const itemsForSide = snapshot.national.items.filter((item) => item.side === side);
  const itemsById = new Map(itemsForSide.map((item) => [item.id, item]));
  // "Queryable" = the calculated total, or an item with at least one served
  // fact row. A glossary entry with zero rows (revenue.taxes_total is the
  // live case - Task 11's taxonomy_only) is never queryable: summing it
  // alongside its components would double-count.
  const queryableSeriesIds = new Set<string>([
    totalSeriesId,
    ...itemsForSide.filter((item) => componentFacts.some((f) => f.itemId === item.id)).map((item) => item.id),
  ]);

  const unknownSeriesIds = input.seriesIds.filter((id) => !queryableSeriesIds.has(id));
  if (unknownSeriesIds.length > 0) {
    return errorResponse(snapshot, {
      code: "unknown_series",
      messageKa: `უცნობი სერიის იდენტიფიკატორი: ${unknownSeriesIds.join(", ")}.`,
      messageEn: `Unknown series id(s): ${unknownSeriesIds.join(", ")}.`,
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

  const factByKey = new Map(componentFacts.map((f) => [`${f.itemId}:${f.year}`, f]));

  const totalsByYear = new Map<number, { value: number; basis: "actual" | "planned"; sourceIds: string[] }>();
  for (const year of input.years) {
    const yearFacts = componentFacts.filter((f) => f.year === year);
    if (yearFacts.length === 0) continue;
    totalsByYear.set(year, {
      // Plain floating-point summation, matching lib/explorer/explorerData.ts's
      // own totalRow arithmetic (buildExplorerModel's rowFor, the `reduce` at
      // its totalId branch) exactly - not Decimal.js - so this figure is
      // provably identical to what the website's own chart displays for the
      // same year (Task 18's agreement test).
      value: yearFacts.reduce((sum, f) => sum + f.amountGel, 0),
      basis: yearFacts.some((f) => f.basis === "planned") ? "planned" : "actual",
      sourceIds: uniqueSorted(yearFacts.flatMap((f) => splitSourceIds(f.sourceId))),
    });
  }

  const gdpByYear = new Map(snapshot.gdpFacts.map((f) => [f.year, f]));
  const usedGdpYears = new Set<number>();

  type ObservationCore = Omit<Observation, "documentIds" | "caveatIds">;
  const cores: ObservationCore[] = [];

  for (const seriesId of input.seriesIds) {
    const isTotal = seriesId === totalSeriesId;
    const item = isTotal ? undefined : itemsById.get(seriesId);

    for (const year of input.years) {
      let numeratorAmount: number | null;
      let basis: "actual" | "planned" | null;
      let numeratorSourceIds: string[];
      let missingReason: string | null;

      if (isTotal) {
        const total = totalsByYear.get(year);
        if (total) {
          numeratorAmount = total.value;
          basis = total.basis;
          numeratorSourceIds = total.sourceIds;
          missingReason = null;
        } else {
          numeratorAmount = null;
          basis = null;
          numeratorSourceIds = [];
          missingReason = missingSeriesReason(year);
        }
      } else {
        const fact = factByKey.get(`${seriesId}:${year}`);
        if (fact) {
          numeratorAmount = fact.amountGel;
          basis = fact.basis;
          numeratorSourceIds = splitSourceIds(fact.sourceId);
          missingReason = null;
        } else {
          // Missing != zero != excluded (brief). revenue.increase_liabilities
          // has no 2004 row because the category begins in 2005 - it is
          // neither estimated nor treated as zero, so this branch always
          // yields value: null with a reason, never a dropped row or a 0.
          numeratorAmount = null;
          basis = null;
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
          // The applicable side total, never the sum of the selected series
          // (spec section 5.3: "selection does not change a percentage
          // denominator"). shareOfTotal (lib/explorer/share.ts) is the exact
          // function every other percent-of-total column on the site already
          // uses; reused here rather than re-deriving its null/zero guards.
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
        observationId: buildObservationId(datasetId, ENTITY_ID, seriesId, year, input.measure),
        datasetId,
        budgetScope,
        entityId: ENTITY_ID,
        entityType: "country",
        entityLabelKa: ENTITY_LABEL_KA,
        entitySlug: null,
        seriesId,
        seriesLabelKa: isTotal ? totalLabelKa : (item?.kaLabel ?? seriesId),
        level: isTotal ? LEVEL_TOTAL : LEVEL_PUBLIC_FIELD,
        parentSeriesId: null,
        year,
        measure: input.measure,
        unit: input.measure === "amount_gel" ? "GEL" : "percent",
        value,
        availability,
        missingReason: availability === "missing" ? missingReason : null,
        basis: availability === "missing" ? null : basis,
        valueDefinition: valueDefinitionFor(isTotal, side, input.measure),
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
    datasetId,
    measure: input.measure,
    years: input.years,
    seriesIds: input.seriesIds,
    // No entity-selection dimension applies to national data (unlike
    // municipal-expenditure, which selects among municipalities/regions/
    // country) - see the scoping-contract note on CaveatContext
    // (caveats/engine.ts). Populating this with "country.georgia" would
    // spuriously fire municipal_country_scope and
    // municipal_functions_no_republican_crosswalk (rules.municipal.ts),
    // neither of which is gated on datasetId and both of which key on that
    // exact literal id (MUNICIPAL_COUNTRY_ID === "country.georgia").
    entityIds: [],
    observations: withDocuments.map((o) => ({ entityId: o.entityId, seriesId: o.seriesId, year: o.year, value: o.value, basis: o.basis })),
    municipalTotalInputs: [],
    gdpInputs,
    comparison: null,
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
    availableYears: sideYears,
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

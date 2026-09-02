// apps/web/lib/factQuery/queryMunicipal.ts
//
// Municipal expenditure at three entity grains, which do NOT share one
// arithmetic (spec section 5.4):
//
//   country.georgia  the served consolidated total. The Adjara consolidation
//                    is already inside it; re-adding the adjustment here would
//                    double-count.
//   region.*         the sum of its member municipalities, plus - for Adjara
//                    alone - the net republican payments.
//   a municipality   its own reviewed row.
//
// The five aggregate-only codes are never rows. They are also never
// "unknown": they exist, and are excluded because their budgets are not
// territorially attributable spending. Reporting them as unknown would tell a
// consumer the municipality is not real.
import {
  MUNICIPAL_PER_RESIDENT_YEAR,
  MUNICIPAL_TOTAL_ITEM_ID,
  buildCountryTotalByYear,
  buildMunicipalListRows,
} from "../explorer/municipalData";
import { shareOfTotal } from "../explorer/share";
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import { CAVEAT_RULES, evaluateCaveats } from "./caveats";
import { buildResponseMeta } from "./meta";
import { buildObservationId, caveatIdsForObservation, resolveDocumentIds, uniqueSorted } from "./observations";
import { queryMunicipalInput } from "./schemas";
import { selectSources, splitSourceIds } from "./sources";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "./types";
import type { CaveatContext } from "./caveats";
import type { MunicipalFunctionFact, MunicipalTotalFact } from "../data/municipal/types";
import type { Observation } from "./observations";
import type { Coverage, DatasetId, FactQueryError, FactQueryResponse, FactQuerySnapshot } from "./types";

const DATASET_ID: DatasetId = "municipal-expenditure";
// Same budgetScope slug describeCoverage.ts's DATASET_META assigns this
// dataset, kept in sync by hand (that map is module-private there).
const BUDGET_SCOPE = "municipal_budget_expenditure";
const COUNTRY_LABEL_KA = "საქართველო";
const LEVEL_TOTAL = "total";
const LEVEL_FUNCTION = "municipal_function";
const EXCLUDED = new Set<string>(AGGREGATE_ONLY_MUNICIPAL_CODES);

const EXCLUSION_REASON_KA =
  "აგრეგირებული კოდი: ამ ბიუჯეტის ხარჯი ტერიტორიულად ამ ერთეულში მიკუთვნებადი არ არის, ამიტომ ცალკე მწკრივად არ ბრუნდება.";

function missingSeriesReason(year: number): string {
  return `არჩეული სერიისთვის ${year} წელს მონაცემი არ ფიქსირდება — ეს ნულოვან მნიშვნელობას არ ნიშნავს.`;
}

const TOTAL_DENOMINATOR_MISSING_REASON =
  "ამ წლისთვის შესაბამისი ჯამი მიუწვდომელია ან დადებითი არ არის, ამიტომ წილის გამოთვლა შეუძლებელია.";
const PER_RESIDENT_YEAR_REASON =
  `ერთ მცხოვრებზე გაანგარიშება მხოლოდ ${MUNICIPAL_PER_RESIDENT_YEAR} წლისთვისაა დამტკიცებული — მოსახლეობის გადამოწმებული პანელი სხვა წელს არ ფარავს.`;
const PER_RESIDENT_COUNTRY_REASON =
  "საქართველოს აგრეგატს ერთ მცხოვრებზე მაჩვენებელი არ ენიჭება: მისი მრიცხველი მოიცავს ხუთ აგრეგირებულ ბიუჯეტს, რომელთაც ტერიტორიული მოსახლეობა არ აქვს მიკუთვნებული.";
const PER_RESIDENT_SERIES_REASON =
  "ერთ მცხოვრებზე გაანგარიშება მხოლოდ საჯარო ჯამის სერიისთვისაა დამტკიცებული, ცალკეული ფუნქციისთვის არა.";
const PER_RESIDENT_POPULATION_REASON =
  "ამ ერთეულისთვის დადებითი მოსახლეობის მაჩვენებელი მიუწვდომელია, ამიტომ ერთ მცხოვრებზე გაანგარიშება შეუძლებელია.";

type EntityKind = "country" | "region" | "municipality";
type EntityMeta = { entityId: string; entityType: EntityKind; labelKa: string; slug: string | null };

function errorResponse(snapshot: FactQuerySnapshot, error: FactQueryError): FactQueryResponse {
  return { kind: "error", status: "error", error, meta: buildResponseMeta(snapshot) };
}

export function queryMunicipal(
  snapshot: FactQuerySnapshot,
  rawInput: unknown,
  /**
   * Set only by compare(). It makes the comparison-only rules reachable while
   * they read THIS function pre-scoped context - the contributing total rows,
   * the served category years, the real entity ids. compare() used to rebuild
   * a context from scratch instead, and three of its fields disagreed with
   * what the query had built for the identical rows: a severe provenance
   * caveat fired falsely on every program cell, and severe municipal caveats
   * vanished for regions. Passing the window down makes that class impossible.
   */
  comparison: CaveatContext["comparison"] = null,
): FactQueryResponse {
  const parsed = queryMunicipalInput.safeParse(rawInput);

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

  const municipal = snapshot.municipal;
  const regionLabels = new Map(municipal.regions.map((region) => [region.id, region.kaLabel]));

  const entityMeta = new Map<string, EntityMeta>([
    [MUNICIPAL_COUNTRY_ID, { entityId: MUNICIPAL_COUNTRY_ID, entityType: "country", labelKa: COUNTRY_LABEL_KA, slug: null }],
  ]);
  for (const region of municipal.regions) {
    entityMeta.set(region.id, { entityId: region.id, entityType: "region", labelKa: region.kaLabel, slug: null });
  }
  for (const row of municipal.municipalities) {
    entityMeta.set(row.code, {
      entityId: row.code,
      entityType: "municipality",
      labelKa: row.displayNameKa,
      // A URL slug (MUNICIPALITY_ROUTES), never a translation - it is a
      // matching aid for callers holding a fiscal.ge link, nothing more.
      slug: municipal.slugByCode[row.code] ?? null,
    });
  }

  // Excluded first: an aggregate-only code is neither a row nor an error, so
  // it must be taken out of the entity list BEFORE the unknown check, which
  // would otherwise report it as a municipality that does not exist.
  const excludedRequested = input.entityIds.filter((id) => EXCLUDED.has(id));
  const requestedEntityIds = input.entityIds.filter((id) => !EXCLUDED.has(id));

  const unknownEntityIds = requestedEntityIds.filter((id) => !entityMeta.has(id));
  if (unknownEntityIds.length > 0) {
    return errorResponse(snapshot, {
      code: "unknown_entity",
      messageKa: `უცნობი ერთეულის იდენტიფიკატორი: ${unknownEntityIds.join(", ")}.`,
      messageEn: `Unknown entity id(s): ${unknownEntityIds.join(", ")}.`,
      retryable: false,
      // Excluded codes are deliberately absent: offering one as a valid choice
      // would invite a request that can never return a row.
      validChoices: Array.from(entityMeta.keys()).sort(),
    });
  }

  const functionById = new Map(municipal.functions.map((fn) => [fn.id, fn]));
  const queryableSeriesIds = new Set<string>([MUNICIPAL_TOTAL_ITEM_ID, ...functionById.keys()]);

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

  const datasetYears = Array.from(new Set(municipal.totalFacts.map((f) => f.year))).sort((a, b) => a - b);
  const minYear = datasetYears[0];
  const maxYear = datasetYears[datasetYears.length - 1];

  if (minYear === undefined || maxYear === undefined) {
    throw new Error("queryMunicipal: municipal dataset has no total facts to derive a year range from");
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

  const membersOf = new Map<string, string[]>();
  for (const row of municipal.municipalities) {
    membersOf.set(row.regionId, [...(membersOf.get(row.regionId) ?? []), row.code]);
  }

  // Which municipality workbooks stand behind each returned entity. The
  // municipality budget-history source archives one workbook per municipality,
  // so attaching all of them to every row cited 63 other municipalities' books
  // as originals supporting one municipality's figure (spec section 7.2).
  // membersOf is reused rather than re-deriving the region membership.
  const servedCodes = municipal.municipalities.map((row) => row.code);
  // The five aggregate-only codes are absent from municipal.municipalities, so
  // they must be added here: allCodes exists to RECOGNISE a workbook as
  // entity-naming. Without them their workbooks look like cross-municipality
  // files and would be cited on every row of the matching year.
  const allMunicipalityCodes = [...servedCodes, ...AGGREGATE_ONLY_MUNICIPAL_CODES];
  const codesByEntityId = new Map<string, readonly string[]>([
    [MUNICIPAL_COUNTRY_ID, servedCodes],
    ...municipal.regions.map((region) => [region.id, membersOf.get(region.id) ?? []] as const),
    ...servedCodes.map((code) => [code, [code]] as const),
  ]);

  const countryTotalByYear = buildCountryTotalByYear(municipal.countryTotalFacts);
  const countryTotalFactByYear = new Map(municipal.countryTotalFacts.map((f) => [f.year, f]));
  const municipalTotalByKey = new Map(municipal.totalFacts.map((f) => [`${f.municipalityCode}:${f.year}`, f]));
  const populationByCode = new Map(municipal.populationFacts.map((f) => [f.municipalityCode, f.populationPersons]));

  // buildMunicipalListRows owns the region arithmetic, including Adjara's
  // integer-cent addition of the net republican payments. Reused per requested
  // year rather than re-derived: duplicating that rounding is exactly the kind
  // of second formula the plan's Global Constraints forbid. populationFacts is
  // passed ONLY for the approved per-resident year, because the helper throws
  // for any other.
  const listRowsByYear = new Map<number, ReturnType<typeof buildMunicipalListRows>>();
  for (const year of input.years) {
    listRowsByYear.set(
      year,
      buildMunicipalListRows({
        municipalities: municipal.municipalities,
        regionLabels,
        totalFacts: municipal.totalFacts,
        populationFacts: year === MUNICIPAL_PER_RESIDENT_YEAR ? municipal.populationFacts : undefined,
        adjaraBudgetAdjustments: municipal.adjaraBudgetAdjustments,
        year,
      }),
    );
  }

  const functionFactsFor = (entity: EntityMeta, categoryId: string, year: number): MunicipalFunctionFact[] => {
    if (entity.entityType === "country") {
      return municipal.countryFunctionFacts.filter((f) => f.categoryId === categoryId && f.year === year);
    }
    const codes =
      entity.entityType === "region" ? (membersOf.get(entity.entityId) ?? []) : [entity.entityId];
    return municipal.functionFacts.filter(
      (f) => f.categoryId === categoryId && f.year === year && codes.includes(f.municipalityCode),
    );
  };

  /** The entity's own public total for the year — the only legal share denominator. */
  const totalFor = (entity: EntityMeta, year: number): { value: number; sourceIds: string[] } | null => {
    if (entity.entityType === "country") {
      const value = countryTotalByYear[year];
      const fact = countryTotalFactByYear.get(year);
      return value === undefined ? null : { value, sourceIds: fact ? splitSourceIds(fact.sourceId) : [] };
    }
    if (entity.entityType === "region") {
      const codes = membersOf.get(entity.entityId) ?? [];
      // Every member must be present for the sum to BE the region total.
      // buildMunicipalListRows treats an absent member as 0 and still emits a
      // row, so without this a region with one missing member returned a short
      // figure marked "available" - the "missing is never zero" non-negotiable
      // broken at the one grain nothing else checks it.
      if (codes.length === 0 || codes.some((code) => !municipalTotalByKey.has(`${code}:${year}`))) return null;
      const row = listRowsByYear.get(year)?.regions.find((r) => r.id === entity.entityId);
      if (!row) return null;
      const memberSourceIds = codes.flatMap((code) => {
        const fact = municipalTotalByKey.get(`${code}:${year}`);
        return fact ? splitSourceIds(fact.sourceId) : [];
      });
      const adjustment = municipal.adjaraBudgetAdjustments.find(
        (a) => a.year === year && a.scopeId === entity.entityId,
      );
      return {
        value: row.valueGel,
        sourceIds: uniqueSorted([
          ...memberSourceIds,
          ...(adjustment ? [adjustment.republicSourceId, adjustment.transferSourceId] : []),
        ]),
      };
    }
    const fact = municipalTotalByKey.get(`${entity.entityId}:${year}`);
    return fact ? { value: fact.publicTotalGel, sourceIds: splitSourceIds(fact.sourceId) } : null;
  };

  /**
   * The year PANEL regime: 2015 is the portal functional fallback for all 64
   * municipalities, 2016 onward are payment totals. Used for aggregates, where
   * one member substituting a functional total does not redefine the whole.
   */
  const panelRegimeByYear = new Map<number, string>();
  for (const year of input.years) {
    const counts = new Map<string, number>();
    for (const fact of municipal.totalFacts) {
      if (fact.year !== year) continue;
      counts.set(fact.publicTotalMeasure, (counts.get(fact.publicTotalMeasure) ?? 0) + 1);
    }
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    panelRegimeByYear.set(year, ranked[0]?.[0] ?? "unknown");
  }

  const definitionRegimeFor = (entity: EntityMeta, year: number): string => {
    if (entity.entityType === "municipality") {
      // A single municipality own measure IS its definition: Khulo 2024 serves
      // a reviewed functional total in place of a payment actual, so growth
      // from its 2023 payment total is not like-for-like.
      return municipalTotalByKey.get(`${entity.entityId}:${year}`)?.publicTotalMeasure ?? "unknown";
    }
    // Aggregates use the panel regime. Folding one member substitute into a
    // region identity would decline every ordinary Adjara comparison touching
    // 2024, and over-declining is what emptied whole rankings elsewhere.
    return panelRegimeByYear.get(year) ?? "unknown";
  };

  const totalValueDefinition = (entity: EntityMeta, year: number): string => {
    if (entity.entityType === "country") {
      return "საქართველოს კონსოლიდირებული მუნიციპალური ჯამი, რომელშიც აჭარის კონსოლიდაცია უკვე შესულია; ის ცალკე არ ემატება.";
    }
    if (entity.entityType === "region") {
      return entity.entityId === "region.adjara"
        ? "რეგიონის წევრი მუნიციპალიტეტების ჯამს დამატებული აჭარის რესპუბლიკური ბიუჯეტის წმინდა გადახდები."
        : "რეგიონის წევრი მუნიციპალიტეტების ჯამი.";
    }
    const measure = municipalTotalByKey.get(`${entity.entityId}:${year}`)?.publicTotalMeasure;
    // The measure is part of the figure's meaning, not decoration: 2015 is
    // portal_functional_total_fallback for every municipality while later
    // years are total_payments, so two years of "the same" series are not the
    // same concept.
    return measure
      ? `მუნიციპალიტეტის საჯარო ჯამი, გაზომვის საფუძველი: ${measure}.`
      : "მუნიციპალიტეტის საჯარო ჯამი.";
  };

  type ObservationCore = Omit<Observation, "documentIds" | "caveatIds">;
  const cores: ObservationCore[] = [];
  const usedTotalFacts = new Map<string, MunicipalTotalFact>();
  /** `${municipalityCode}:${year}` -> the returned entities whose figure includes that row. */
  const servedBy = new Map<string, Set<string>>();

  for (const entityId of requestedEntityIds) {
    const entity = entityMeta.get(entityId);
    if (!entity) continue;

    for (const seriesId of input.seriesIds) {
      const isTotal = seriesId === MUNICIPAL_TOTAL_ITEM_ID;

      for (const year of input.years) {
        // Record the total rows behind whatever is returned so the five
        // quality-state rules see exactly these and no more (the scoping
        // contract on CaveatContext).
        // The country aggregate used to contribute NO input row, so no
        // warningType or reconciliation rule could fire on it at all - its ten
        // functional shares summed to 91.41% with nothing saying why. Its own
        // served total row carries both fields, so it belongs here like any
        // other contributing row.
        const inputFacts: MunicipalTotalFact[] =
          entity.entityType === "country"
            ? [countryTotalFactByYear.get(year)].filter((f): f is MunicipalTotalFact => f !== undefined)
            : (entity.entityType === "region" ? (membersOf.get(entity.entityId) ?? []) : [entity.entityId])
                .map((code) => municipalTotalByKey.get(`${code}:${year}`))
                .filter((f): f is MunicipalTotalFact => f !== undefined);

        for (const fact of inputFacts) {
          const key = `${fact.municipalityCode}:${fact.year}`;
          usedTotalFacts.set(key, fact);
          servedBy.set(key, (servedBy.get(key) ?? new Set<string>()).add(entity.entityId));
        }

        let numeratorAmount: number | null = null;
        let numeratorSourceIds: string[] = [];
        let missingReason: string | null = null;

        if (isTotal) {
          const total = totalFor(entity, year);
          if (total) {
            numeratorAmount = total.value;
            numeratorSourceIds = total.sourceIds;
          } else {
            missingReason = missingSeriesReason(year);
          }
        } else {
          const facts = functionFactsFor(entity, seriesId, year);
          if (facts.length > 0) {
            // A served 0 is a real figure and must stay available - hence a
            // length check rather than a truthiness test on the sum.
            numeratorAmount = facts.reduce((sum, f) => sum + f.amountGel, 0);
            numeratorSourceIds = uniqueSorted(facts.flatMap((f) => splitSourceIds(f.sourceId)));
          } else {
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
            const total = totalFor(entity, year);
            const share = total ? shareOfTotal(numeratorAmount, total.value) : null;
            if (share === null) {
              missingReason = TOTAL_DENOMINATOR_MISSING_REASON;
            } else {
              value = share * 100;
              sourceIds = uniqueSorted([...numeratorSourceIds, ...(total?.sourceIds ?? [])]);
            }
          } else {
            // gel_per_resident. Approved only for the public total, only at
            // MUNICIPAL_PER_RESIDENT_YEAR, and never for the country
            // aggregate, whose numerator covers five aggregate-only budgets
            // with no territorial population. Each of these is a MISSING CELL,
            // not year_out_of_range: the year is inside coverage and the
            // amount exists - it is the measure that is unavailable.
            if (!isTotal) {
              missingReason = PER_RESIDENT_SERIES_REASON;
            } else if (entity.entityType === "country") {
              missingReason = PER_RESIDENT_COUNTRY_REASON;
            } else if (year !== MUNICIPAL_PER_RESIDENT_YEAR) {
              missingReason = PER_RESIDENT_YEAR_REASON;
            } else {
              const codes =
                entity.entityType === "region" ? (membersOf.get(entity.entityId) ?? []) : [entity.entityId];
              const population = codes.reduce((sum, code) => sum + (populationByCode.get(code) ?? 0), 0);
              // Guarded rather than trusted: canonical.ts throws on a
              // non-finite number and observationSchema is z.number().finite(),
              // so an Infinity here would take down the whole envelope instead
              // of degrading one cell.
              if (!Number.isFinite(population) || population <= 0) {
                missingReason = PER_RESIDENT_POPULATION_REASON;
              } else {
                value = numeratorAmount / population;
                sourceIds = uniqueSorted([
                  ...numeratorSourceIds,
                  ...municipal.populationFacts.filter((f) => codes.includes(f.municipalityCode)).map((f) => f.sourceId),
                ]);
              }
            }
          }
        }

        const availability = value === null ? "missing" : "available";

        cores.push({
          observationId: buildObservationId(DATASET_ID, entity.entityId, seriesId, year, input.measure),
          datasetId: DATASET_ID,
          budgetScope: BUDGET_SCOPE,
          entityId: entity.entityId,
          entityType: entity.entityType,
          entityLabelKa: entity.labelKa,
          entitySlug: entity.slug,
          seriesId,
          seriesLabelKa: isTotal ? "საჯარო ჯამი" : (functionById.get(seriesId)?.kaLabel ?? seriesId),
          level: isTotal ? LEVEL_TOTAL : LEVEL_FUNCTION,
          parentSeriesId: isTotal ? null : MUNICIPAL_TOTAL_ITEM_ID,
          year,
          measure: input.measure,
          unit:
            input.measure === "amount_gel" ? "GEL" : input.measure === "gel_per_resident" ? "GEL_per_resident" : "percent",
          value,
          availability,
          missingReason: availability === "missing" ? missingReason : null,
          // Every municipal fact is basis "actual"; the dataset carries no
          // planned rows, so a missing cell has no basis at all.
          basis: availability === "missing" ? null : "actual",
          // measure FIRST, isTotal last, matching queryNational valueDefinitionFor.
          // The old order tested isTotal first, so every gel_per_resident value -
          // a measure only the total series supports - shipped a definition
          // describing a GEL total, in the wrong unit, every single time.
          valueDefinition:
            input.measure === "share_of_total_pct"
              ? isTotal
                ? "ერთეულის საჯარო ჯამი მისსავე ჯამში, ანუ ყოველთვის 100%."
                : "წილი ერთეულის საკუთარ საჯარო ჯამში, 0-დან 100-მდე შკალაზე."
              : input.measure === "gel_per_resident"
                ? "ერთეულის 2025 წლის საჯარო ჯამი გაყოფილი იმავე წლის მოსახლეობაზე, ლარი ერთ მცხოვრებზე."
                : isTotal
                  ? totalValueDefinition(entity, year)
                  : "ფუნქციური კლასიფიკაციის გადამოწმებული მაჩვენებელი ლარში, სრული სიზუსტით.",
          valueDefinitionId: `municipal:${input.measure}:${isTotal ? "total" : "function"}:${definitionRegimeFor(entity, year)}`,
          sourceIds,
        });
      }
    }
  }

  const allSourceIds = uniqueSorted(cores.flatMap((core) => core.sourceIds));
  const resolvedSources = selectSources(snapshot, allSourceIds);

  const withDocuments: Omit<Observation, "caveatIds">[] = cores.map((core) => ({
    ...core,
    documentIds: resolveDocumentIds(resolvedSources, core.sourceIds, {
      year: core.year,
      entityCodes: codesByEntityId.get(core.entityId) ?? [],
      allCodes: allMunicipalityCodes,
    }),
  }));

  const caveatContext: CaveatContext = {
    datasetId: DATASET_ID,
    measure: input.measure,
    years: input.years,
    seriesIds: input.seriesIds,
    // Unlike queryNational/queryMinistries, entityIds is meaningful here: ten
    // municipal rules key on it. The excluded codes stay in the list on
    // purpose - municipality_not_territorial exists to explain them, and it is
    // the only place they are still visible after being dropped from rows.
    entityIds: input.entityIds,
    observations: withDocuments.map((o) => ({
      entityId: o.entityId,
      seriesId: o.seriesId,
      level: o.level,
      parentSeriesId: o.parentSeriesId,
      year: o.year,
      value: o.value,
      basis: o.basis,
      valueDefinitionId: o.valueDefinitionId,
    })),
    municipalTotalInputs: Array.from(usedTotalFacts.values()),
    municipalInputServedBy: Object.fromEntries(
      Array.from(servedBy, ([key, entities]) => [key, Array.from(entities).sort()]),
    ),
    gdpInputs: [],
    comparison,
    historicalJoinSeriesYears: [],
    adminCategoryYears: [],
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
    availableYears: datasetYears,
    returnedYears,
    missingCells,
    excludedEntities: excludedRequested.map((entityId) => ({ entityId, reason: EXCLUSION_REASON_KA })),
    returnedCount,
    expectedCount,
  };

  const status: "ok" | "partial" | "empty" = returnedCount === 0 ? "empty" : returnedCount === expectedCount ? "ok" : "partial";
  const meta = buildResponseMeta(snapshot, { sources: resolvedSources, caveats });

  return { kind: "observations", status, data: { observations, coverage }, meta };
}

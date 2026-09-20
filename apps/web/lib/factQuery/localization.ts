import type { FactQuerySnapshot } from "./types";

// Authored service sentence keys; their text is supplied by the snapshot.
export const SERVICE_MESSAGE_KEYS = [
  "caveats.adjara_consolidation_applied",
  "caveats.admin_category_not_yet_established",
  "caveats.budget_scopes_differ",
  "caveats.debt_gdp_share_vintage",
  "caveats.debt_not_budget_scope",
  "caveats.debt_rate_not_published",
  "caveats.debt_service_projection",
  "caveats.deficit_general_government_scope",
  "caveats.deficit_projection",
  "caveats.gdp_historical_method",
  "caveats.gdp_preliminary",
  "caveats.gdp_sna_break_2010",
  "caveats.gdp_world_bank_history",
  "caveats.gdp_world_bank_preliminary_basis",
  "caveats.inflation_contribution_derived",
  "caveats.inflation_contribution_residual",
  "caveats.inflation_contribution_weights_differ",
  "caveats.inflation_target_unverified_before_2015",
  "caveats.municipal_country_scope",
  "caveats.municipal_financing_outside_functional",
  "caveats.municipal_functional_total_gap",
  "caveats.municipal_functions_no_republican_crosswalk",
  "caveats.municipal_source_actual_missing",
  "caveats.municipal_source_version_difference",
  "caveats.municipal_total_definition_changed",
  "caveats.municipality_not_territorial",
  "caveats.negative_revenue_correction",
  "caveats.non_positive_comparison_base",
  "caveats.per_resident_coverage_limited",
  "caveats.planned_values",
  "caveats.program_coverage_partial",
  "caveats.program_historical_join",
  "caveats.program_parent_category_modern_grouping",
  "caveats.revenue_2004_component_scope",
  "caveats.revenue_2004_liabilities_unavailable",
  "caveats.revenue_2004_total_scope",
  "caveats.revenue_internal_flows_netted",
  "caveats.sectors_preliminary",
  "comparison.basisDiffers",
  "comparison.basketReweighted",
  "comparison.definitionChanged",
  "comparison.endpointMissing",
  "comparison.gdpStandardBreak",
  "comparison.historicalJoin",
  "comparison.nonPositiveBase",
  "comparison.severeAsymmetry",
  "coverage.debtAmount",
  "coverage.debtGdp",
  "coverage.debtRate",
  "coverage.perResident",
  "definitions.adjaraTotal",
  "definitions.administrativeShare",
  "definitions.administrativeTotal",
  "definitions.balanceAmount",
  "definitions.balanceShare",
  "definitions.debtRate",
  "definitions.debtService",
  "definitions.debtStock",
  "definitions.expenditureShare",
  "definitions.expenditureTotal",
  "definitions.historicalName",
  "definitions.municipalCountry",
  "definitions.municipalFunction",
  "definitions.municipalFunctionShare",
  "definitions.municipalTotalShare",
  "definitions.municipalityTotal",
  "definitions.municipalityTotalBasis",
  "definitions.perResident",
  "definitions.programmeAmount",
  "definitions.receiptsShare",
  "definitions.receiptsTotal",
  "definitions.regionTotal",
  "definitions.reviewedAmount",
  "definitions.shareOfGdp",
  "errors.contributionMixedLevels",
  "errors.dataVersionChanged",
  "errors.invalidParameters",
  "errors.measureSeriesMismatch",
  "errors.periodRangeReversed",
  "errors.periodsOutOfRange",
  "errors.rankAmountChanges",
  "errors.rankChangeYears",
  "errors.rankDimension",
  "errors.rankMixedBasis",
  "errors.rankMunicipalInput",
  "errors.rankNoCandidates",
  "errors.rankPercentagePoints",
  "errors.rankSingleEntity",
  "errors.rankUnknownRegion",
  "errors.rankValueYearOnly",
  "errors.resultTooLargeBytes",
  "errors.resultTooLargeCells",
  "errors.sourceYearsOutOfRange",
  "errors.unknownEntity",
  "errors.unknownSeries",
  "errors.unknownSeriesAtLevel",
  "errors.unknownSource",
  "errors.yearsOutOfRange",
  "exclusions.catalogueMunicipality",
  "exclusions.municipalObservation",
  "missing.balanceYear",
  "missing.gdpDenominator",
  "missing.inflationContribution",
  "missing.inflationContributionStart",
  "missing.inflationMonth",
  "missing.inflationResidualHeadline",
  "missing.inflationTargetUnverified",
  "missing.inflationWeight",
  "missing.perResidentCountry",
  "missing.perResidentFunction",
  "missing.perResidentYear",
  "missing.population",
  "missing.rateNotPublished",
  "missing.seriesYear",
  "missing.totalDenominator",
  "publication.catalogueNotice",
  "publication.inflationCategoriesNotice",
  "publication.sourcesNotice",
  "publication.sumWarning",
  "ranking.ascending",
  "ranking.categories",
  "ranking.changeDefinition",
  "ranking.changeDefinitionPeriod",
  "ranking.descending",
  "ranking.inflationDivisions",
  "ranking.inflationSubgroups",
  "ranking.inflationSubgroupsWithinParent",
  "ranking.municipalities",
  "ranking.noValue",
  "ranking.notComparable",
  "ranking.programmes",
  "ranking.programmesWithinParent",
  "ranking.publicFields",
  "ranking.regions",
  "ranking.valueDefinition",
  "ranking.valueDefinitionPeriod",
  "ranking.withinRegion",
  "supporting.populationTransformation",
  "supporting.populationUnit"
] as const;
export type ServiceMessageKey = (typeof SERVICE_MESSAGE_KEYS)[number];

// Existing Georgian errors intentionally omit the SDK's English validation
// detail. Keep each language's established parameters explicit.
export const SERVICE_MESSAGE_PARAMETERS: Partial<Record<ServiceMessageKey, { ka: readonly string[]; en: readonly string[] }>> = {
  "supporting.populationTransformation": { ka: ["cell", "sheet", "year"], en: ["cell", "sheet", "year"] },
  "errors.periodsOutOfRange": { ka: ["first", "last", "outOfRangePeriods"], en: ["first", "last", "outOfRangePeriods"] },
  "missing.inflationContributionStart": { ka: ["firstYear"], en: ["firstYear"] },
  "ranking.changeDefinitionPeriod": { ka: ["fromPeriod", "measure", "metric", "order", "toPeriod"], en: ["fromPeriod", "measure", "metric", "order", "toPeriod"] },
  "ranking.inflationSubgroupsWithinParent": { ka: ["parentId"], en: ["parentId"] },
  "ranking.valueDefinitionPeriod": { ka: ["measure", "order", "period"], en: ["measure", "order", "period"] },
  "definitions.historicalName": {
    "ka": [
      "base",
      "name"
    ],
    "en": [
      "base",
      "name"
    ]
  },
  "definitions.municipalityTotalBasis": {
    "ka": [
      "measure"
    ],
    "en": [
      "measure"
    ]
  },
  "errors.invalidParameters": {
    "ka": [],
    "en": [
      "issues"
    ]
  },
  "errors.measureSeriesMismatch": {
    "ka": [
      "measure",
      "mismatched"
    ],
    "en": [
      "measure",
      "mismatched"
    ]
  },
  "errors.rankSingleEntity": {
    "ka": [],
    "en": [
      "requestedDataset"
    ]
  },
  "errors.resultTooLargeBytes": {
    "ka": [
      "bulkUrl",
      "cells",
      "kib"
    ],
    "en": [
      "bulkUrl",
      "cells",
      "kib"
    ]
  },
  "errors.resultTooLargeCells": {
    "ka": [
      "bulkUrl",
      "cells"
    ],
    "en": [
      "bulkUrl",
      "cells"
    ]
  },
  "errors.sourceYearsOutOfRange": {
    "ka": [
      "maxYear",
      "minYear",
      "outOfRangeYears"
    ],
    "en": [
      "maxYear",
      "minYear",
      "outOfRangeYears"
    ]
  },
  "errors.unknownEntity": {
    "ka": [
      "unknownEntityIds"
    ],
    "en": [
      "unknownEntityIds"
    ]
  },
  "errors.unknownSeries": {
    "ka": [
      "unknownSeriesIds"
    ],
    "en": [
      "unknownSeriesIds"
    ]
  },
  "errors.unknownSeriesAtLevel": {
    "ka": [
      "level",
      "unknownSeriesIds"
    ],
    "en": [
      "level",
      "unknownSeriesIds"
    ]
  },
  "errors.unknownSource": {
    "ka": [
      "unknownIds"
    ],
    "en": [
      "unknownIds"
    ]
  },
  "errors.yearsOutOfRange": {
    "ka": [
      "maxYear",
      "minYear",
      "outOfRangeYears"
    ],
    "en": [
      "maxYear",
      "minYear",
      "outOfRangeYears"
    ]
  },
  "missing.balanceYear": {
    "ka": [
      "year"
    ],
    "en": [
      "year"
    ]
  },
  "missing.perResidentYear": {
    "ka": [
      "year"
    ],
    "en": [
      "year"
    ]
  },
  "missing.seriesYear": {
    "ka": [
      "year"
    ],
    "en": [
      "year"
    ]
  },
  "ranking.changeDefinition": {
    "ka": [
      "fromYear",
      "measure",
      "metric",
      "order",
      "toYear"
    ],
    "en": [
      "fromYear",
      "measure",
      "metric",
      "order",
      "toYear"
    ]
  },
  "ranking.programmesWithinParent": {
    "ka": [
      "parentId"
    ],
    "en": [
      "parentId"
    ]
  },
  "ranking.valueDefinition": {
    "ka": [
      "measure",
      "order",
      "year"
    ],
    "en": [
      "measure",
      "order",
      "year"
    ]
  },
  "ranking.withinRegion": {
    "ka": [
      "regionId"
    ],
    "en": [
      "regionId"
    ]
  }
};

export function serviceLabelEn(snapshot: FactQuerySnapshot, id: string): string {
  const labels = snapshot.localization.labelsEn;
  const label = Object.hasOwn(labels, id) ? labels[id] : undefined;
  if (!label?.trim()) throw new Error(`Missing snapshot English label: ${id}`);
  return label;
}

export function historicalProgrammeLabelEn(snapshot: FactQuerySnapshot, seriesId: string, year: number): string {
  const history = snapshot.localization.programmeHistoryEn;
  const years = Object.hasOwn(history, seriesId) ? history[seriesId] : undefined;
  const label = years && Object.hasOwn(years, String(year)) ? years[String(year)] : undefined;
  if (!label?.trim()) throw new Error(`Missing snapshot programme history: ${seriesId}:${year}`);
  return label;
}

export function serviceMessage(snapshot: FactQuerySnapshot, locale: "ka" | "en", key: ServiceMessageKey, values: Readonly<Record<string, string | number>> = {}): string {
  const messages = snapshot.localization.messages[locale];
  const template = Object.hasOwn(messages, key) ? messages[key] : undefined;
  if (!template?.trim()) throw new Error(`Missing snapshot translation: ${locale}:${key}`);
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    if (!Object.hasOwn(values, name)) throw new Error(`Missing parameter ${name} for snapshot translation ${key}`);
    return String(values[name]);
  });
}

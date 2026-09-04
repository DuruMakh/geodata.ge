// apps/web/lib/factQuery/schemas.ts
import { z } from "zod";

/**
 * Spec section 11.3's input array bounds.
 *
 * Declared here rather than beside the response limits because this is the one
 * place they can actually be kept: a `.max()` on the array both refuses an
 * over-long request and publishes the bound as `maxItems` in the tool's JSON
 * Schema, so a client can see the limit instead of discovering it by being
 * refused. Stated-but-unenforced limits were the bug.
 */
export const INPUT_LIMITS = { entities: 100, series: 200, years: 100, sourceIds: 100 } as const;

const uniqueSortedYears = z
  .array(z.number().int())
  .min(1, "years must not be empty")
  .max(INPUT_LIMITS.years)
  .transform((years) => Array.from(new Set(years)).sort((a, b) => a - b));

const boundedIds = (max: number) =>
  z.array(z.string().min(1)).min(1).max(max).transform((ids) => Array.from(new Set(ids)));

const seriesIdList = boundedIds(INPUT_LIMITS.series);
const entityIdList = boundedIds(INPUT_LIMITS.entities);
const sourceIdList = boundedIds(INPUT_LIMITS.sourceIds);

export const expectedDataVersion = z.string().regex(/^[0-9a-f]{64}$/).optional().describe("Use the dataVersion from a previous response to keep related calls on the same snapshot; a changed version returns data_version_changed.");

// Exported so describeCoverage.ts can report each dataset's legal `measures`
// straight from the same enum queryNationalInput/queryMinistriesInput/
// queryMunicipalInput already validate against, instead of a second
// hand-maintained copy that could silently drift from what those functions
// actually accept.
export const nationalMeasure = z.enum(["amount_gel", "share_of_total_pct", "share_of_gdp_pct"]);
export const municipalMeasure = z.enum(["amount_gel", "share_of_total_pct", "gel_per_resident"]);
// Stock and service are GEL amounts; a weighted-average interest rate is a
// rate per annum, which is why it needs a measure of its own. queryDebt
// rejects a measure its series family does not carry.
export const debtMeasure = z.enum(["amount_gel", "share_of_gdp_pct", "rate_percent"]);
export const deficitMeasure = z.enum(["share_of_gdp_pct", "amount_gel"]);

export const describeCoverageInput = z.strictObject({
  datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure", "government-debt", "general-government-balance"]).optional(),
  search: z.string().max(120).optional(),
  entityType: z.enum(["country", "municipality", "region"]).optional(),
  level: z.enum(["admin_category", "major_program"]).optional(),
  expectedDataVersion,
});

export const queryNationalInput = z.strictObject({
  side: z.enum(["revenue", "expenditure"]),
  seriesIds: seriesIdList,
  years: uniqueSortedYears,
  measure: nationalMeasure,
  expectedDataVersion,
});

export const queryDebtInput = z.strictObject({
  seriesIds: seriesIdList,
  years: uniqueSortedYears,
  measure: debtMeasure,
  expectedDataVersion,
});

// No seriesIds: there is exactly one series, and a required parameter with a
// single legal value is noise for the caller.
export const queryDeficitInput = z.strictObject({
  years: uniqueSortedYears,
  measure: deficitMeasure,
  expectedDataVersion,
});

export const queryMinistriesInput = z.strictObject({
  level: z.enum(["admin_category", "major_program"]),
  seriesIds: seriesIdList,
  years: uniqueSortedYears,
  measure: nationalMeasure,
  expectedDataVersion,
});

export const queryMunicipalInput = z.strictObject({
  entityIds: entityIdList,
  seriesIds: seriesIdList,
  years: uniqueSortedYears,
  measure: municipalMeasure,
  expectedDataVersion,
});

export const compareInput = z
  .strictObject({
    target: z.discriminatedUnion("dataset", [
      z.strictObject({ dataset: z.literal("national"), side: z.enum(["revenue", "expenditure"]), seriesIds: seriesIdList }),
      z.strictObject({ dataset: z.literal("ministries"), level: z.enum(["admin_category", "major_program"]), seriesIds: seriesIdList }),
      z.strictObject({ dataset: z.literal("municipal"), entityIds: entityIdList, seriesIds: seriesIdList }),
      z.strictObject({ dataset: z.literal("debt"), seriesIds: seriesIdList }),
      // No seriesIds: the balance dataset has exactly one series.
      z.strictObject({ dataset: z.literal("deficit") }),
    ]),
    fromYear: z.number().int(),
    toYear: z.number().int(),
    measure: z.enum(["amount_gel", "share_of_total_pct", "share_of_gdp_pct", "gel_per_resident", "rate_percent"]),
    expectedDataVersion,
  })
  .refine((input) => input.fromYear < input.toYear, { message: "fromYear must be earlier than toYear" });

export const rankInput = z
  .strictObject({
    // Deliberately excludes government-debt and general-government-balance:
    // both are country-level, so there is nothing to rank.
    datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure"]),
    dimension: z.enum(["series", "entities"]),
    level: z.enum(["admin_category", "major_program"]).optional(),
    parentSeriesId: z.string().optional().describe("Only for ministries with level major_program; filters programs to their administrative parent."),
    entityType: z.enum(["municipality", "region"]).optional(),
    seriesId: z.string().optional(),
    withinRegionId: z.string().optional().describe("Only for municipal rankings with entityType municipality; obtain the region id from describe_coverage."),
    year: z.number().int().optional(),
    fromYear: z.number().int().optional(),
    toYear: z.number().int().optional(),
    measure: z.enum(["amount_gel", "share_of_total_pct", "share_of_gdp_pct", "gel_per_resident"]),
    metric: z.enum(["value", "absolute_change", "percentage_change", "percentage_point_change"]),
    order: z.enum(["descending", "ascending"]).default("descending"),
    limit: z.number().int().min(1).max(100).default(10),
    expectedDataVersion,
  })
  .refine((input) => (input.metric === "value" ? input.year !== undefined : input.fromYear !== undefined && input.toYear !== undefined), {
    message: "value ranking needs one year; change rankings need fromYear and toYear",
  })
  .superRefine((input, context) => {
    const municipal = input.datasetId === "municipal-expenditure";
    const ministries = input.datasetId === "ministries";
    const invalid = [
      !municipal && input.entityType !== undefined ? "entityType" : null,
      !municipal && input.seriesId !== undefined ? "seriesId" : null,
      (!municipal || input.entityType !== "municipality") && input.withinRegionId !== undefined ? "withinRegionId" : null,
      !ministries && input.level !== undefined ? "level" : null,
      (!ministries || input.level !== "major_program") && input.parentSeriesId !== undefined ? "parentSeriesId" : null,
    ];
    for (const field of invalid) {
      if (field !== null) context.addIssue({ code: "custom", path: [field], message: `${field} does not apply to this ranking mode; omit it or choose its supported mode.` });
    }
  });

export const getSourcesInput = z.strictObject({
  sourceIds: sourceIdList,
  datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure", "government-debt", "general-government-balance"]).optional(),
  years: uniqueSortedYears.optional(),
  entityIds: entityIdList.optional(),
  expectedDataVersion,
});

export const errorCodeSchema = z.enum([
  "invalid_parameters",
  "unknown_dataset",
  "unknown_series",
  "unknown_entity",
  "unknown_source",
  "year_out_of_range",
  "unsupported_measure",
  "unsupported_comparison",
  "result_too_large",
  "data_version_changed",
  "rate_limited",
  "service_unavailable",
]);

export const caveatSchema = z.object({
  code: z.string(),
  severity: z.enum(["severe", "note"]),
  messageKa: z.string().min(1),
  messageEn: z.string().min(1),
  methodologyRef: z.string(),
  affects: z.array(z.string()),
});

export const observationSchema = z.object({
  observationId: z.string(),
  datasetId: z.string(),
  budgetScope: z.string(),
  entityId: z.string(),
  entityType: z.enum(["country", "municipality", "region"]),
  entityLabelKa: z.string(),
  entitySlug: z.string().nullable(),
  seriesId: z.string(),
  seriesLabelKa: z.string(),
  level: z.string(),
  parentSeriesId: z.string().nullable(),
  year: z.number().int(),
  measure: z.string(),
  unit: z.enum(["GEL", "percent", "GEL_per_resident"]),
  value: z.number().finite().nullable(),
  availability: z.enum(["available", "missing"]),
  missingReason: z.string().nullable(),
  basis: z.enum(["actual", "planned", "projection"]).nullable(),
  valueDefinition: z.string(),
  valueDefinitionId: z.string(),
  sourceIds: z.array(z.string()),
  documentIds: z.array(z.string()),
  caveatIds: z.array(z.string()),
});

export const envelopeSchema = z.discriminatedUnion("status", [
  z.object({
    kind: z.enum(["catalogue", "observations", "comparisons", "ranking", "sources"]),
    status: z.enum(["ok", "partial", "empty"]),
    data: z.unknown(),
    meta: z.object({}).passthrough(),
  }),
  z.object({
    kind: z.literal("error"),
    status: z.literal("error"),
    error: z.object({
      code: errorCodeSchema,
      messageKa: z.string().min(1),
      messageEn: z.string().min(1),
      retryable: z.boolean(),
      validChoices: z.array(z.string()).optional(),
    }),
    meta: z.object({}).passthrough(),
  }),
]);

export type QueryNationalInput = z.infer<typeof queryNationalInput>;
export type QueryMinistriesInput = z.infer<typeof queryMinistriesInput>;
export type QueryMunicipalInput = z.infer<typeof queryMunicipalInput>;
export type CompareInput = z.infer<typeof compareInput>;
export type RankInput = z.infer<typeof rankInput>;
export type GetSourcesInput = z.infer<typeof getSourcesInput>;
export type DescribeCoverageInput = z.infer<typeof describeCoverageInput>;

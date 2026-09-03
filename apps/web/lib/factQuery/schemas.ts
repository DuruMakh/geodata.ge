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

export const expectedDataVersion = z.string().regex(/^[0-9a-f]{64}$/).optional();

// Exported so describeCoverage.ts can report each dataset's legal `measures`
// straight from the same enum queryNationalInput/queryMinistriesInput/
// queryMunicipalInput already validate against, instead of a second
// hand-maintained copy that could silently drift from what those functions
// actually accept.
export const nationalMeasure = z.enum(["amount_gel", "share_of_total_pct", "share_of_gdp_pct"]);
export const municipalMeasure = z.enum(["amount_gel", "share_of_total_pct", "gel_per_resident"]);

export const describeCoverageInput = z.object({
  datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure"]).optional(),
  search: z.string().max(120).optional(),
  entityType: z.enum(["country", "municipality", "region"]).optional(),
  level: z.enum(["admin_category", "major_program"]).optional(),
  expectedDataVersion,
});

export const queryNationalInput = z.object({
  side: z.enum(["revenue", "expenditure"]),
  seriesIds: seriesIdList,
  years: uniqueSortedYears,
  measure: nationalMeasure,
  expectedDataVersion,
});

export const queryMinistriesInput = z.object({
  level: z.enum(["admin_category", "major_program"]),
  seriesIds: seriesIdList,
  years: uniqueSortedYears,
  measure: nationalMeasure,
  expectedDataVersion,
});

export const queryMunicipalInput = z.object({
  entityIds: entityIdList,
  seriesIds: seriesIdList,
  years: uniqueSortedYears,
  measure: municipalMeasure,
  expectedDataVersion,
});

export const compareInput = z
  .object({
    target: z.discriminatedUnion("dataset", [
      z.object({ dataset: z.literal("national"), side: z.enum(["revenue", "expenditure"]), seriesIds: seriesIdList }),
      z.object({ dataset: z.literal("ministries"), level: z.enum(["admin_category", "major_program"]), seriesIds: seriesIdList }),
      z.object({ dataset: z.literal("municipal"), entityIds: entityIdList, seriesIds: seriesIdList }),
    ]),
    fromYear: z.number().int(),
    toYear: z.number().int(),
    measure: z.enum(["amount_gel", "share_of_total_pct", "share_of_gdp_pct", "gel_per_resident"]),
    expectedDataVersion,
  })
  .refine((input) => input.fromYear < input.toYear, { message: "fromYear must be earlier than toYear" });

export const rankInput = z
  .object({
    datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure"]),
    dimension: z.enum(["series", "entities"]),
    level: z.enum(["admin_category", "major_program"]).optional(),
    parentSeriesId: z.string().optional(),
    entityType: z.enum(["municipality", "region"]).optional(),
    seriesId: z.string().optional(),
    withinRegionId: z.string().optional(),
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
  });

export const getSourcesInput = z.object({
  sourceIds: sourceIdList,
  datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure"]).optional(),
  years: z.array(z.number().int()).optional(),
  entityIds: z.array(z.string()).optional(),
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
  basis: z.enum(["actual", "planned"]).nullable(),
  valueDefinition: z.string(),
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

import { z } from "zod";
import { INPUT_LIMITS, expectedDataVersion } from "../factQuery/schemas";

const ids = (max: number) =>
  z.array(z.string().min(1)).min(1).max(max).transform((values) => [...new Set(values)]);
const years = z
  .array(z.number().int())
  .min(1)
  .max(INPUT_LIMITS.years)
  .transform((values) => [...new Set(values)].sort((a, b) => a - b));

export const queryRegionalEconomiesInput = z
  .strictObject({
    regionIds: ids(INPUT_LIMITS.entities).optional(),
    seriesIds: ids(INPUT_LIMITS.series).optional(),
    years: years.optional(),
    fromYear: z.number().int().optional(),
    toYear: z.number().int().optional(),
    measure: z.enum(["amount_gel", "share_of_region_gdp_pct"]),
    expectedDataVersion,
  })
  .superRefine((input, context) => {
    const hasRangeEnd = input.fromYear !== undefined || input.toYear !== undefined;
    if (hasRangeEnd && (input.fromYear === undefined || input.toYear === undefined)) {
      context.addIssue({ code: "custom", message: "fromYear and toYear must be supplied together" });
    }
    if (input.fromYear !== undefined && input.toYear !== undefined && input.fromYear > input.toYear) {
      context.addIssue({ code: "custom", message: "fromYear must not be later than toYear" });
    }
    if (input.years !== undefined && hasRangeEnd) {
      context.addIssue({ code: "custom", message: "Use years or fromYear/toYear, not both" });
    }
  });

export type QueryRegionalEconomiesInput = z.infer<typeof queryRegionalEconomiesInput>;

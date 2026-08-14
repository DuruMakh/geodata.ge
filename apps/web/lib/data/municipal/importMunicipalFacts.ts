import { z } from "zod";
import { readCsvRecords } from "../csv";
import { MUNICIPAL_FUNCTION_CODES } from "./functionMapping";
import { MUNICIPAL_COUNTRY_ID, type MunicipalFunctionFact, type MunicipalTotalFact } from "./types";

const nonnegativeAmountSchema = z.string().transform((value, ctx) => {
  const trimmed = value.trim();

  if (!trimmed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "amount is required" });
    return z.NEVER;
  }

  const amount = Number(trimmed);

  if (!Number.isFinite(amount)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "amount must be finite" });
    return z.NEVER;
  }

  if (amount < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "amount must be nonnegative" });
    return z.NEVER;
  }

  return amount;
});

// Reconciliation differences are genuinely signed, so these allow negatives.
// Empty means "the official source does not publish this value" — null, not 0.
const optionalSignedAmountSchema = z.string().transform((value, ctx) => {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const amount = Number(trimmed);

  if (!Number.isFinite(amount)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "amount must be finite" });
    return z.NEVER;
  }

  return amount;
});

const functionalCodeSchema = z
  .string()
  .refine((code) => MUNICIPAL_FUNCTION_CODES.includes(code), {
    message: `functional_code must be one of ${MUNICIPAL_FUNCTION_CODES.join(", ")}`,
  });

const municipalFunctionFactRowSchema = z.object({
  year: z.coerce.number().int().min(2015).max(2100),
  municipality_code: z.string().min(1),
  category_id: z.string().regex(/^municipal\.[a-z0-9_]+$/),
  functional_code: functionalCodeSchema,
  amount_gel: nonnegativeAmountSchema,
  basis: z.literal("actual"),
  source_id: z.string().min(1),
});

const warningTypeSchema = z.enum([
  "none",
  "source_version_difference",
  "financing_outside_functional",
  "reconciliation_review_required",
  "source_actual_missing",
]);

const municipalTotalFactRowSchema = z.object({
  year: z.coerce.number().int().min(2015).max(2100),
  municipality_code: z.string().min(1),
  public_total_gel: nonnegativeAmountSchema,
  public_total_measure: z.string().min(1),
  total_payments_gel: optionalSignedAmountSchema,
  expenses_gel: optionalSignedAmountSchema,
  nonfinancial_asset_growth_gel: optionalSignedAmountSchema,
  financial_asset_growth_gel: optionalSignedAmountSchema,
  liability_decrease_gel: optionalSignedAmountSchema,
  functional_sum_gel: nonnegativeAmountSchema,
  reconciliation_difference_gel: optionalSignedAmountSchema,
  warning_amount_gel: optionalSignedAmountSchema,
  show_warning: z.enum(["true", "false"]),
  warning_type: warningTypeSchema,
  basis: z.literal("actual"),
  source_id: z.string().min(1),
});

const municipalCountryFunctionFactRowSchema = municipalFunctionFactRowSchema
  .omit({ municipality_code: true })
  .extend({ scope_id: z.literal(MUNICIPAL_COUNTRY_ID) });

const municipalCountryTotalFactRowSchema = municipalTotalFactRowSchema
  .omit({ municipality_code: true })
  .extend({ scope_id: z.literal(MUNICIPAL_COUNTRY_ID) });

export async function loadMunicipalFunctionFacts(
  relativePath: string,
): Promise<MunicipalFunctionFact[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = municipalFunctionFactRowSchema.parse(record);

    return {
      year: row.year,
      municipalityCode: row.municipality_code,
      categoryId: row.category_id,
      functionalCode: row.functional_code,
      amountGel: row.amount_gel,
      basis: row.basis,
      sourceId: row.source_id,
    };
  });
}

export async function loadMunicipalTotalFacts(
  relativePath: string,
): Promise<MunicipalTotalFact[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = municipalTotalFactRowSchema.parse(record);

    return {
      year: row.year,
      municipalityCode: row.municipality_code,
      publicTotalGel: row.public_total_gel,
      publicTotalMeasure: row.public_total_measure,
      totalPaymentsGel: row.total_payments_gel,
      expensesGel: row.expenses_gel,
      nonfinancialAssetGrowthGel: row.nonfinancial_asset_growth_gel,
      financialAssetGrowthGel: row.financial_asset_growth_gel,
      liabilityDecreaseGel: row.liability_decrease_gel,
      functionalSumGel: row.functional_sum_gel,
      reconciliationDifferenceGel: row.reconciliation_difference_gel,
      warningAmountGel: row.warning_amount_gel,
      showWarning: row.show_warning === "true",
      warningType: row.warning_type,
      basis: row.basis,
      sourceId: row.source_id,
    };
  });
}

export async function loadMunicipalCountryFunctionFacts(
  relativePath: string,
): Promise<MunicipalFunctionFact[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = municipalCountryFunctionFactRowSchema.parse(record);

    return {
      year: row.year,
      municipalityCode: row.scope_id,
      categoryId: row.category_id,
      functionalCode: row.functional_code,
      amountGel: row.amount_gel,
      basis: row.basis,
      sourceId: row.source_id,
    };
  });
}

export async function loadMunicipalCountryTotalFacts(
  relativePath: string,
): Promise<MunicipalTotalFact[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = municipalCountryTotalFactRowSchema.parse(record);

    return {
      year: row.year,
      municipalityCode: row.scope_id,
      publicTotalGel: row.public_total_gel,
      publicTotalMeasure: row.public_total_measure,
      totalPaymentsGel: row.total_payments_gel,
      expensesGel: row.expenses_gel,
      nonfinancialAssetGrowthGel: row.nonfinancial_asset_growth_gel,
      financialAssetGrowthGel: row.financial_asset_growth_gel,
      liabilityDecreaseGel: row.liability_decrease_gel,
      functionalSumGel: row.functional_sum_gel,
      reconciliationDifferenceGel: row.reconciliation_difference_gel,
      warningAmountGel: row.warning_amount_gel,
      showWarning: row.show_warning === "true",
      warningType: row.warning_type,
      basis: row.basis,
      sourceId: row.source_id,
    };
  });
}

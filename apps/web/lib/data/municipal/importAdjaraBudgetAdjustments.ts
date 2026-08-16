import { z } from "zod";
import { MUNICIPAL_YEARS } from "../coverage";
import { readCsvRecords } from "../csv";
import { ADJARA_REGION_ID, type AdjaraBudgetAdjustment } from "./types";

const amountSchema = z.string().transform((value, ctx) => {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "amount must be a nonnegative number with at most two decimal places",
    });
    return z.NEVER;
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "amount must be finite and within the exact cent range",
    });
    return z.NEVER;
  }
  return amount;
});

const rowSchema = z.object({
  year: z.coerce.number().int(),
  scope_id: z.literal(ADJARA_REGION_ID),
  republic_payments_gel: amountSchema,
  municipal_transfers_gel: amountSchema,
  net_republic_payments_gel: amountSchema,
  basis: z.literal("actual"),
  republic_source_id: z.string().min(1),
  transfer_source_id: z.string().min(1),
});

function cents(value: number): number {
  return Math.round(value * 100);
}

export async function loadAdjaraBudgetAdjustments(
  relativePath: string,
): Promise<AdjaraBudgetAdjustment[]> {
  const rows = (await readCsvRecords(relativePath)).map((record) => {
    const row = rowSchema.parse(record);
    if (
      cents(row.net_republic_payments_gel) !==
      cents(row.republic_payments_gel) - cents(row.municipal_transfers_gel)
    ) {
      throw new Error(`Adjara budget adjustment ${row.year} arithmetic does not reconcile`);
    }

    return {
      year: row.year,
      scopeId: row.scope_id,
      republicPaymentsGel: row.republic_payments_gel,
      municipalTransfersGel: row.municipal_transfers_gel,
      netRepublicPaymentsGel: row.net_republic_payments_gel,
      basis: row.basis,
      republicSourceId: row.republic_source_id,
      transferSourceId: row.transfer_source_id,
    };
  });

  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.year)) throw new Error(`Adjara budget adjustments contain duplicate year ${row.year}`);
    seen.add(row.year);
  }

  if (
    rows.length !== MUNICIPAL_YEARS.length ||
    MUNICIPAL_YEARS.some((year) => !seen.has(year))
  ) {
    throw new Error("Adjara budget adjustments must contain exactly one row for every year 2015-2025");
  }

  return rows.sort((left, right) => left.year - right.year);
}

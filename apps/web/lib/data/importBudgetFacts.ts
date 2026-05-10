import Decimal from "decimal.js";
import { z } from "zod";
import { readCsvRecords } from "./csv";
import { stableIdSchema } from "./validation";

const basisSchema = z.enum(["actual", "planned"]);
const sideSchema = z.enum(["revenue", "expenditure"]);
const confidenceSchema = z.enum(["high", "medium", "low", "unclassified"]).or(z.literal(""));

const importRowSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  side: sideSchema,
  item_id: stableIdSchema,
  amount_gel: z.string().min(1),
  basis: basisSchema,
  source_id: stableIdSchema,
  official_institution: z.string(),
  official_program: z.string(),
  official_subprogram: z.string(),
  public_spending_field_id: z.string(),
  mapping_confidence: confidenceSchema,
  mapping_notes: z.string(),
});

export type BudgetFactImportRow = {
  year: number;
  side: "revenue" | "expenditure";
  itemId: string;
  amountGel: number;
  basis: "actual" | "planned";
  sourceId: string;
  officialInstitution: string | null;
  officialProgram: string | null;
  officialSubprogram: string | null;
  publicSpendingFieldId: string | null;
  mappingConfidence: "high" | "medium" | "low" | "unclassified" | null;
  mappingNotes: string;
};

function parseAmountGel(value: string): number {
  const amount = new Decimal(value);

  if (amount.isNegative()) {
    throw new Error(`amount_gel must not be negative: ${value}`);
  }

  return amount.toNumber();
}

export async function loadBudgetFactRows(relativePath: string): Promise<BudgetFactImportRow[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = importRowSchema.parse(record);
    const publicSpendingFieldId = row.public_spending_field_id.trim() || null;

    if (row.side === "expenditure" && !publicSpendingFieldId) {
      throw new Error(`Expenditure row ${row.item_id} must have a public_spending_field_id`);
    }

    if (row.side === "revenue" && !row.item_id.startsWith("revenue.")) {
      throw new Error(`Revenue row must use revenue.* item_id: ${row.item_id}`);
    }

    if (row.side === "expenditure" && !row.item_id.startsWith("spending.")) {
      throw new Error(`Expenditure row must use spending.* item_id: ${row.item_id}`);
    }

    return {
      year: row.year,
      side: row.side,
      itemId: row.item_id,
      amountGel: parseAmountGel(row.amount_gel),
      basis: row.basis,
      sourceId: row.source_id,
      officialInstitution: row.official_institution.trim() || null,
      officialProgram: row.official_program.trim() || null,
      officialSubprogram: row.official_subprogram.trim() || null,
      publicSpendingFieldId,
      mappingConfidence: row.mapping_confidence === "" ? null : row.mapping_confidence,
      mappingNotes: row.mapping_notes,
    };
  });
}

import Decimal from "decimal.js";
import { z } from "zod";

import { readCsvRecords } from "../csv";
import { stableIdSchema } from "../validation";
import type { NationalGdpFact } from "./types";

const rowSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  gdp_current_prices_million_gel: z.string().min(1),
  gdp_current_prices_gel: z.string().min(1),
  valuation: z.literal("market_prices"),
  accounting_standard: z.enum(["sna_1993", "sna_2008"]),
  status: z.enum(["final_as_published", "preliminary"]),
  source_id: stableIdSchema,
  source_sheet: z.string().min(1),
  source_cell: z.string().regex(/^[A-Z]+[1-9][0-9]*$/),
  source_unit: z.literal("mil. GEL"),
  transformation: z.string().min(1),
  last_reviewed_at: z.iso.date(),
});

export async function loadNationalGdpFacts(relativePath: string): Promise<NationalGdpFact[]> {
  const records = await readCsvRecords(relativePath);
  const years = new Set<number>();

  return records.map((record) => {
    const row = rowSchema.parse(record);
    if (years.has(row.year)) throw new Error(`Duplicate GDP year: ${row.year}`);
    years.add(row.year);

    const millionGel = new Decimal(row.gdp_current_prices_million_gel);
    const gel = new Decimal(row.gdp_current_prices_gel);
    if (!millionGel.greaterThan(0) || !gel.greaterThan(0)) {
      throw new Error(`GDP at current prices must be positive for ${row.year}`);
    }
    if (!millionGel.times(1_000_000).equals(gel)) {
      throw new Error(`GDP GEL conversion does not match published million GEL for ${row.year}`);
    }
    if (!gel.isInteger() || !Number.isSafeInteger(gel.toNumber())) {
      throw new Error(`GDP GEL value must be a safe integer for ${row.year}`);
    }

    return {
      year: row.year,
      gdpCurrentPricesMillionGel: millionGel.toNumber(),
      gdpCurrentPricesGel: gel.toNumber(),
      accountingStandard: row.accounting_standard,
      status: row.status,
      sourceId: row.source_id,
      sourceSheet: row.source_sheet,
      sourceCell: row.source_cell,
      sourceUnit: row.source_unit,
      transformation: row.transformation,
      lastReviewedAt: row.last_reviewed_at,
    };
  });
}

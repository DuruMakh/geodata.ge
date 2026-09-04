import Decimal from "decimal.js";
import { z } from "zod";

import { readCsvRecords } from "../csv";
import { stableIdSchema } from "../validation";
import type { GeneralGovernmentBalanceFact } from "./types";

const EXPECTED_YEARS = Array.from({ length: 37 }, (_, index) => 1995 + index);

const rowSchema = z.object({
  year: z.coerce.number().int().min(1995).max(2031),
  general_government_balance_pct_gdp: z.string().min(1),
  general_government_balance_gel: z.string().min(1),
  status: z.enum(["actual", "projection"]),
  source_id: stableIdSchema,
  source_dataset: z.literal("IMF.RES:WEO(9.0.0)"),
  source_vintage: z.literal("2026-04"),
  source_sheet: z.literal("Countries"),
  source_country_id: z.literal("GEO"),
  source_percent_series_code: z.literal("GEO.GGXCNL_NGDP.A"),
  source_nominal_series_code: z.literal("GEO.GGXCNL.A"),
  source_unit: z.literal("billion GEL"),
  transformation: z.string().min(1),
  last_reviewed_at: z.literal("2026-09-04"),
});

export async function loadGeneralGovernmentBalanceFacts(
  relativePath: string,
): Promise<GeneralGovernmentBalanceFact[]> {
  const records = await readCsvRecords(relativePath);
  const years = new Set<number>();

  const facts = records.map((record) => {
    const row = rowSchema.parse(record);
    if (years.has(row.year)) {
      throw new Error(`Duplicate general-government balance year: ${row.year}`);
    }
    years.add(row.year);

    const percent = new Decimal(row.general_government_balance_pct_gdp);
    const gel = new Decimal(row.general_government_balance_gel);
    if (!percent.isFinite() || !gel.isFinite()) {
      throw new Error(`Non-finite general-government balance for ${row.year}`);
    }
    if (!gel.isInteger() || !Number.isSafeInteger(gel.toNumber())) {
      throw new Error(`General-government balance GEL value must be a safe integer for ${row.year}`);
    }
    if (!percent.isZero() && !gel.isZero() && percent.isNegative() !== gel.isNegative()) {
      throw new Error(`General-government balance sign mismatch for ${row.year}`);
    }
    const expectedStatus = row.year <= 2025 ? "actual" : "projection";
    if (row.status !== expectedStatus) {
      throw new Error(`General-government balance status is invalid for ${row.year}`);
    }

    return {
      year: row.year,
      generalGovernmentBalancePctGdp: percent.toNumber(),
      generalGovernmentBalanceGel: gel.toNumber(),
      status: row.status,
      sourceId: row.source_id,
      sourceDataset: row.source_dataset,
      sourceVintage: row.source_vintage,
      sourceSheet: row.source_sheet,
      sourceCountryId: row.source_country_id,
      sourcePercentSeriesCode: row.source_percent_series_code,
      sourceNominalSeriesCode: row.source_nominal_series_code,
      sourceUnit: row.source_unit,
      transformation: row.transformation,
      lastReviewedAt: row.last_reviewed_at,
    };
  });

  facts.sort((left, right) => left.year - right.year);
  if (JSON.stringify(facts.map((row) => row.year)) !== JSON.stringify(EXPECTED_YEARS)) {
    throw new Error("Canonical general-government balance coverage must be 1995-2031");
  }

  return facts;
}

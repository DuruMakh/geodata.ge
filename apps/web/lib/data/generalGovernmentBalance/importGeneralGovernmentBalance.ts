import Decimal from "decimal.js";
import { z } from "zod";

import { readCsvRecords } from "../csv";
import {
  assertSameServedRows,
  generalGovernmentBalanceFactParityKey,
} from "../servedDataParity";
import { stableIdSchema } from "../validation";
import type { ServedGeneralGovernmentBalanceFact } from "../../servedRows";
import type { GeneralGovernmentBalanceFact } from "./types";

const rowSchema = z
  .object({
    year: z.coerce.number().int().min(1995).max(2100),
    general_government_balance_pct_gdp: z.string().min(1),
    general_government_balance_gel: z.string().min(1),
    status: z.enum(["actual", "projection"]),
    source_id: stableIdSchema.and(
      z.string().regex(/^source\.imf_weo_[a-z]+_\d{4}_general_government_balance$/),
    ),
    source_dataset: z.string().regex(/^IMF\.RES:WEO\(\d+\.\d+\.\d+\)$/),
    source_vintage: z.string().regex(/^\d{4}-(?:04|10)$/),
    source_sheet: z.literal("Countries"),
    source_country_id: z.literal("GEO"),
    source_percent_series_code: z.literal("GEO.GGXCNL_NGDP.A"),
    source_nominal_series_code: z.literal("GEO.GGXCNL.A"),
    source_unit: z.literal("billion GEL"),
    transformation: z.literal(
      "IMF billion GEL multiplied by 1,000,000,000; signed value preserved.",
    ),
    last_reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

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
  // One edition per file, and the projection horizon follows the actual years.
  // Which year that boundary falls in is the edition's business, not this file's.
  const editions = new Set(
    facts.map((fact) => `${fact.sourceId}|${fact.sourceDataset}|${fact.sourceVintage}|${fact.lastReviewedAt}`),
  );
  if (editions.size !== 1) {
    throw new Error("A balance file must carry exactly one WEO edition");
  }
  for (const fact of facts) {
    const edition = /^source\.imf_weo_(april|october)_(\d{4})_general_government_balance$/.exec(fact.sourceId);
    const expectedVintage = edition ? `${edition[2]}-${edition[1] === "april" ? "04" : "10"}` : null;
    if (expectedVintage !== fact.sourceVintage) {
      throw new Error("The WEO source ID edition must agree with its source vintage");
    }
  }
  const firstProjection = facts.findIndex((fact) => fact.status === "projection");
  if (firstProjection <= 0) {
    throw new Error("General-government balance actual years must come first, then projections");
  }
  if (
    facts.slice(0, firstProjection).some((fact) => fact.status !== "actual") ||
    facts.slice(firstProjection).some((fact) => fact.status !== "projection")
  ) {
    throw new Error("General-government balance actual years must come first, then projections");
  }
  if (facts.some((fact, index) => index > 0 && fact.year !== facts[index - 1]!.year + 1)) {
    throw new Error("General-government balance years must be contiguous");
  }

  return facts;
}

const SERVING_PATH = "../../data/imports/general-government-balance-annual-1995-2031.csv";

export function toServedGeneralGovernmentBalanceFact(
  fact: GeneralGovernmentBalanceFact,
): ServedGeneralGovernmentBalanceFact {
  return {
    year: fact.year,
    generalGovernmentBalancePctGdp: fact.generalGovernmentBalancePctGdp,
    generalGovernmentBalanceGel: fact.generalGovernmentBalanceGel,
    status: fact.status,
    sourceId: fact.sourceId,
    lastReviewedAt: fact.lastReviewedAt,
  };
}

export async function loadServedGeneralGovernmentBalanceData(): Promise<{
  facts: ServedGeneralGovernmentBalanceFact[];
}> {
  const raw = (process.env.GEODATA_DATA_SOURCE ?? "").trim().toLowerCase();
  const csvFacts = async () =>
    (await loadGeneralGovernmentBalanceFacts(SERVING_PATH)).map(
      toServedGeneralGovernmentBalanceFact,
    );
  if (raw !== "db") {
    if (raw !== "" && raw !== "csv") {
      throw new Error(`GEODATA_DATA_SOURCE must be "db" or "csv", got "${raw}"`);
    }
    return { facts: await csvFacts() };
  }

  const { loadGeneralGovernmentBalanceFactsFromDb } = await import("../../db/servedDataDb");
  const [dbFacts, reviewedCsvFacts] = await Promise.all([
    loadGeneralGovernmentBalanceFactsFromDb(),
    csvFacts(),
  ]);
  assertSameServedRows(
    "general-government balance facts",
    reviewedCsvFacts,
    dbFacts,
    generalGovernmentBalanceFactParityKey,
  );
  return { facts: dbFacts };
}

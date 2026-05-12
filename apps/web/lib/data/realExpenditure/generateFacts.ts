import type { CandidateSpendingMapping, MappingConfidence, OfficialExpenditureRow } from "./types";

export type RealExpenditureFactCsvRow = {
  year: number;
  side: "expenditure";
  item_id: string;
  amount_gel: string;
  basis: "actual";
  source_id: string;
  official_institution: string;
  official_program: string;
  official_subprogram: string;
  public_spending_field_id: string;
  mapping_confidence: MappingConfidence;
  mapping_notes: string;
};

function mappingKey(year: number, code: string): string {
  return `${year}:${code}`;
}

const REVIEW_REQUIRED_THRESHOLD_GEL = 100000;

function resolvedFieldId(mapping: CandidateSpendingMapping): string {
  if (mapping.mappingConfidence === "unclassified" && !mapping.reviewedPublicSpendingFieldId) {
    return "spending.other_unclassified";
  }

  if (
    mapping.mappingConfidence !== "high" &&
    mapping.actualGel >= REVIEW_REQUIRED_THRESHOLD_GEL &&
    !mapping.reviewedPublicSpendingFieldId
  ) {
    throw new Error(`${mapping.year} ${mapping.code} requires reviewed_public_spending_field_id`);
  }

  return mapping.reviewedPublicSpendingFieldId || mapping.suggestedPublicSpendingFieldId;
}

function worstConfidence(current: MappingConfidence, next: MappingConfidence): MappingConfidence {
  const order: Record<MappingConfidence, number> = {
    unclassified: 0,
    low: 1,
    medium: 2,
    high: 3,
  };

  return order[next] < order[current] ? next : current;
}

export function generateBudgetFactsFromReviewedMappings(
  officialRows: OfficialExpenditureRow[],
  mappings: CandidateSpendingMapping[],
): RealExpenditureFactCsvRow[] {
  const mappingsByKey = new Map(mappings.map((mapping) => [mappingKey(mapping.year, mapping.code), mapping]));
  const aggregated = new Map<
    string,
    {
      year: number;
      publicSpendingFieldId: string;
      amountGel: number;
      sourceIds: Set<string>;
      codes: string[];
      mappingConfidence: MappingConfidence;
    }
  >();

  for (const row of officialRows.filter((candidate) => candidate.isCodedRow && candidate.isLeafCode && candidate.code && !candidate.isTotal)) {
    const mapping = mappingsByKey.get(mappingKey(row.year, row.code as string));

    if (!mapping) {
      throw new Error(`Missing reviewed mapping for ${row.year} ${row.code}`);
    }

    const publicSpendingFieldId = resolvedFieldId(mapping);
    const key = `${row.year}:${publicSpendingFieldId}`;
    const existing = aggregated.get(key);

    if (!existing) {
      aggregated.set(key, {
        year: row.year,
        publicSpendingFieldId,
        amountGel: row.actualThousandGel * 1000,
        sourceIds: new Set([row.sourceId]),
        codes: [row.code as string],
        mappingConfidence: mapping.mappingConfidence,
      });
      continue;
    }

    existing.amountGel += row.actualThousandGel * 1000;
    existing.sourceIds.add(row.sourceId);
    existing.codes.push(row.code as string);
    existing.mappingConfidence = worstConfidence(existing.mappingConfidence, mapping.mappingConfidence);
  }

  return Array.from(aggregated.values())
    .sort((a, b) => (a.year === b.year ? a.publicSpendingFieldId.localeCompare(b.publicSpendingFieldId) : a.year - b.year))
    .map((row) => ({
      year: row.year,
      side: "expenditure",
      item_id: row.publicSpendingFieldId,
      amount_gel: String(Math.round(row.amountGel)),
      basis: "actual",
      source_id: Array.from(row.sourceIds).sort()[0] ?? "",
      official_institution: "Multiple official rows",
      official_program: "",
      official_subprogram: "",
      public_spending_field_id: row.publicSpendingFieldId,
      mapping_confidence: row.mappingConfidence,
      mapping_notes: `Aggregated ${row.codes.length} reviewed leaf rows; codes: ${row.codes.sort().join(", ")}`,
    }));
}

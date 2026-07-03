import type { ExpenditurePdfOfficialRow } from "./phase1Pilot";

export function expenditurePdfCompactMappingOutputFileForYear(year: number): string {
  return `data/mappings/review/spending-field-mapping-review-${year}-pdf-pilot.csv`;
}

export const expenditurePdfCompactMappingOutputFile = expenditurePdfCompactMappingOutputFileForYear(2025);

type MappingConfidence = "high" | "medium" | "low" | "unclassified";

export type CompactPdfSpendingMappingRow = {
  year: number;
  sourceId: string;
  functionalCode: string;
  hierarchyPath: string;
  labelKa: string;
  amountGel: number;
  publicSpendingFieldId: string;
  mappingConfidence: MappingConfidence;
  mappingReason: string;
  includeInPublicFact: boolean;
  reviewNotes: string;
};

export type CompactPdfSpendingMappingValidation = {
  status: "passed" | "failed";
  grandTotalActualGel: number;
  mappedTotalActualGel: number;
  differenceGel: number;
  missingCodes: string[];
};

type MappingRule = {
  functionalCode: string;
  publicSpendingFieldId: string;
  mappingConfidence: MappingConfidence;
  mappingReason: string;
};

const mappingRules: MappingRule[] = [
  {
    functionalCode: "7.1.1",
    publicSpendingFieldId: "spending.general_public_services",
    mappingConfidence: "medium",
    mappingReason: "7.1 split: administrative government services remain in general public services",
  },
  {
    functionalCode: "7.1.3",
    publicSpendingFieldId: "spending.general_public_services",
    mappingConfidence: "medium",
    mappingReason: "7.1 split: common services remain in general public services",
  },
  {
    functionalCode: "7.1.4",
    publicSpendingFieldId: "spending.general_public_services",
    mappingConfidence: "medium",
    mappingReason: "7.1 split: fundamental research kept under general public services for pilot review",
  },
  {
    functionalCode: "7.1.6",
    publicSpendingFieldId: "spending.debt_service",
    mappingConfidence: "high",
    mappingReason: "Debt-related operations map to debt service",
  },
  {
    functionalCode: "7.1.7",
    publicSpendingFieldId: "spending.infrastructure_regional_development",
    mappingConfidence: "medium",
    mappingReason:
      "Intergovernmental flows include regional development programs and projects; mapped to infrastructure and regional development for the public taxonomy",
  },
  {
    functionalCode: "7.1.8",
    publicSpendingFieldId: "spending.general_public_services",
    mappingConfidence: "medium",
    mappingReason: "7.1 split: other general public services",
  },
  {
    functionalCode: "7.2",
    publicSpendingFieldId: "spending.defence",
    mappingConfidence: "high",
    mappingReason: "Direct functional category match",
  },
  {
    functionalCode: "7.3",
    publicSpendingFieldId: "spending.public_order_safety",
    mappingConfidence: "high",
    mappingReason: "Direct functional category match",
  },
  {
    functionalCode: "7.4.1",
    publicSpendingFieldId: "spending.economic_affairs",
    mappingConfidence: "medium",
    mappingReason: "7.4 split: general economic and labour-resource activity",
  },
  {
    functionalCode: "7.4.2",
    publicSpendingFieldId: "spending.agriculture_environment",
    mappingConfidence: "high",
    mappingReason: "Agriculture, forestry, fishing, and hunting",
  },
  {
    functionalCode: "7.4.3",
    publicSpendingFieldId: "spending.economic_affairs",
    mappingConfidence: "medium",
    mappingReason: "7.4 split: fuel and energy kept under economic affairs for pilot review",
  },
  {
    functionalCode: "7.4.4",
    publicSpendingFieldId: "spending.economic_affairs",
    mappingConfidence: "medium",
    mappingReason:
      "Budget classification treats construction here as sector support and regulation; transport and communal infrastructure are covered by 7.4.5 and 7.6",
  },
  {
    functionalCode: "7.4.5",
    publicSpendingFieldId: "spending.infrastructure_regional_development",
    mappingConfidence: "high",
    mappingReason: "Transport and roads map to infrastructure and regional development",
  },
  {
    functionalCode: "7.4.6",
    publicSpendingFieldId: "spending.economic_affairs",
    mappingConfidence: "medium",
    mappingReason: "Communications remains under economic affairs",
  },
  {
    functionalCode: "7.4.7",
    publicSpendingFieldId: "spending.economic_affairs",
    mappingConfidence: "medium",
    mappingReason: "7.4 split: other economic sectors",
  },
  {
    functionalCode: "7.4.8",
    publicSpendingFieldId: "spending.economic_affairs",
    mappingConfidence: "medium",
    mappingReason: "7.4 split: applied research in economic activity (present through 2015) stays under economic affairs",
  },
  {
    functionalCode: "7.4.9",
    publicSpendingFieldId: "spending.economic_affairs",
    mappingConfidence: "medium",
    mappingReason: "7.4 split: other unclassified economic activity",
  },
  {
    functionalCode: "7.5",
    publicSpendingFieldId: "spending.agriculture_environment",
    mappingConfidence: "high",
    mappingReason: "Environmental protection maps to agriculture and environment",
  },
  {
    functionalCode: "7.6",
    publicSpendingFieldId: "spending.infrastructure_regional_development",
    mappingConfidence: "high",
    mappingReason: "Housing and communal services map to infrastructure and regional development",
  },
  {
    functionalCode: "7.7",
    publicSpendingFieldId: "spending.health",
    mappingConfidence: "high",
    mappingReason: "Direct functional category match",
  },
  {
    functionalCode: "7.8.1",
    publicSpendingFieldId: "spending.sport",
    mappingConfidence: "high",
    mappingReason: "7.8 split: recreation and sport services",
  },
  {
    functionalCode: "7.8.2",
    publicSpendingFieldId: "spending.culture",
    mappingConfidence: "high",
    mappingReason: "7.8 split: culture services",
  },
  {
    functionalCode: "7.8.3",
    publicSpendingFieldId: "spending.culture",
    mappingConfidence: "medium",
    mappingReason: "7.8 split: broadcasting and publishing kept under culture for pilot review",
  },
  {
    functionalCode: "7.8.4",
    publicSpendingFieldId: "spending.culture",
    mappingConfidence: "medium",
    mappingReason: "7.8 split: religious and other public activity kept under culture for pilot review",
  },
  {
    functionalCode: "7.8.6",
    publicSpendingFieldId: "spending.culture",
    mappingConfidence: "medium",
    mappingReason: "7.8 split: other recreation, culture, and religion",
  },
  {
    functionalCode: "7.9",
    publicSpendingFieldId: "spending.education",
    mappingConfidence: "high",
    mappingReason: "Direct functional category match",
  },
  {
    functionalCode: "7.10",
    publicSpendingFieldId: "spending.social_protection",
    mappingConfidence: "high",
    mappingReason: "Direct functional category match",
  },
];

export function generateCompactPdfSpendingMappings(rows: ExpenditurePdfOfficialRow[]): CompactPdfSpendingMappingRow[] {
  const rowsByFunctionalCode = new Map(
    rows
      .filter((row) => row.rowType === "functional_total" && row.functionalCode)
      .map((row) => [row.functionalCode as string, row]),
  );

  return mappingRules.flatMap((rule) => {
    const row = rowsByFunctionalCode.get(rule.functionalCode);
    if (!row) return [];

    return [
      {
        year: row.year,
        sourceId: row.sourceId,
        functionalCode: rule.functionalCode,
        hierarchyPath: row.hierarchyPath,
        labelKa: row.labelKa,
        amountGel: row.actualGel,
        publicSpendingFieldId: rule.publicSpendingFieldId,
        mappingConfidence: rule.mappingConfidence,
        mappingReason: rule.mappingReason,
        includeInPublicFact: true,
        reviewNotes: "",
      },
    ];
  });
}

export function validateCompactPdfSpendingMappings(
  sourceRows: ExpenditurePdfOfficialRow[],
  mappings: CompactPdfSpendingMappingRow[],
): CompactPdfSpendingMappingValidation {
  const grandTotalActualGel = sourceRows.find((row) => row.rowType === "grand_total")?.actualGel ?? 0;
  const mappedTotalActualGel = mappings.reduce((sum, row) => sum + row.amountGel, 0);
  const differenceGel = Math.abs(grandTotalActualGel - mappedTotalActualGel);

  return {
    status: differenceGel <= 1000 ? "passed" : "failed",
    grandTotalActualGel,
    mappedTotalActualGel,
    differenceGel,
    missingCodes: [],
  };
}

function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function pdfSpendingMappingsToCsv(rows: CompactPdfSpendingMappingRow[]): string {
  const headers = [
    "year",
    "source_id",
    "functional_code",
    "hierarchy_path",
    "label_ka",
    "actual_gel",
    "public_spending_field_id",
    "mapping_confidence",
    "mapping_reason",
    "include_in_public_fact",
    "review_notes",
  ];
  const records = rows.map((row) => ({
    year: row.year,
    source_id: row.sourceId,
    functional_code: row.functionalCode,
    hierarchy_path: row.hierarchyPath,
    label_ka: row.labelKa,
    actual_gel: row.amountGel,
    public_spending_field_id: row.publicSpendingFieldId,
    mapping_confidence: row.mappingConfidence,
    mapping_reason: row.mappingReason,
    include_in_public_fact: row.includeInPublicFact,
    review_notes: row.reviewNotes,
  }));

  return `\ufeff${[
    headers.join(","),
    ...records.map((record) => headers.map((header) => csvEscape(record[header as keyof typeof record] ?? null)).join(",")),
  ].join("\n")}`;
}

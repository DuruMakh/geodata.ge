import type { CandidateSpendingMapping, MappingConfidence, OfficialExpenditureRow } from "./types";

type RuleResult = {
  fieldId: string;
  confidence: MappingConfidence;
  reason: string;
};

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function suggestForLabel(labelKa: string): RuleResult {
  const text = labelKa.toLowerCase();
  const hasHealth = includesAny(text, ["ჯანმრთელ", "ჯანდაცვ", "სამედიცინო", "დაავადებ"]);
  const hasSocial = includesAny(text, ["სოციალურ", "პენსი", "დევნილ", "დახმარებ", "ვეტერან"]);

  if (hasHealth && hasSocial) {
    return {
      fieldId: "spending.other_unclassified",
      confidence: "medium",
      reason: "mixed health and social protection label requires review",
    };
  }

  if (includesAny(text, ["თავდაცვის სამინისტრო", "თავდაცვა"])) {
    return { fieldId: "spending.defence", confidence: "high", reason: "defence keyword" };
  }

  if (includesAny(text, ["განათლების", "სკოლ", "უნივერსიტეტ", "მეცნიერებ"])) {
    return { fieldId: "spending.education", confidence: "high", reason: "education keyword" };
  }

  if (hasHealth) {
    return { fieldId: "spending.health", confidence: "medium", reason: "health keyword" };
  }

  if (hasSocial) {
    return { fieldId: "spending.social_protection", confidence: "medium", reason: "social protection keyword" };
  }

  if (
    includesAny(text, [
      "შინაგან საქმეთა",
      "პოლიცი",
      "იუსტიციის",
      "სასამართლ",
      "პროკურატურ",
      "უსაფრთხოებ",
    ])
  ) {
    return { fieldId: "spending.public_order_safety", confidence: "high", reason: "public order or justice keyword" };
  }

  if (includesAny(text, ["ინფრასტრუქტურ", "რეგიონული განვითარ", "გზ", "წყალ", "მუნიციპალ"])) {
    return {
      fieldId: "spending.infrastructure_regional_development",
      confidence: "medium",
      reason: "infrastructure or regional development keyword",
    };
  }

  if (includesAny(text, ["ეკონომიკ", "ბიზნეს", "მეწარმ", "ინოვაცი", "ტურიზმ"])) {
    return { fieldId: "spending.economic_affairs", confidence: "medium", reason: "economic affairs keyword" };
  }

  if (includesAny(text, ["გარემოს", "სოფლის მეურნ", "აგრო", "დაცული ტერიტორი"])) {
    return {
      fieldId: "spending.agriculture_environment",
      confidence: "medium",
      reason: "agriculture or environment keyword",
    };
  }

  if (includesAny(text, ["კულტურ", "მუზეუმ", "ხელოვნებ", "მემკვიდრეობ"])) {
    return { fieldId: "spending.culture", confidence: "medium", reason: "culture keyword" };
  }

  if (includesAny(text, ["სპორტ"])) {
    return { fieldId: "spending.sport", confidence: "medium", reason: "sport keyword" };
  }

  if (includesAny(text, ["ვალდებულებების კლება", "პროცენტი", "ვალის"])) {
    return { fieldId: "spending.debt_service", confidence: "medium", reason: "debt service keyword" };
  }

  if (
    includesAny(text, [
      "პარლამენტ",
      "პრეზიდენტ",
      "მთავრობის ადმინისტრაცია",
      "აუდიტის სამსახური",
      "სახელმწიფო რწმუნებულ",
    ])
  ) {
    return {
      fieldId: "spending.general_public_services",
      confidence: "medium",
      reason: "general public services institution keyword",
    };
  }

  return {
    fieldId: "spending.other_unclassified",
    confidence: "unclassified",
    reason: "no deterministic rule matched",
  };
}

export function generateCandidateMappings(rows: OfficialExpenditureRow[]): CandidateSpendingMapping[] {
  return rows
    .filter((row) => row.isCodedRow && row.isLeafCode && row.code && !row.isTotal)
    .map((row) => {
      const suggestion = suggestForLabel(row.labelKa);

      return {
        year: row.year,
        code: row.code as string,
        parentCode: row.parentCode,
        depth: row.depth ?? 0,
        institutionCode: row.institutionCode,
        institutionLabelKa: row.institutionLabelKa,
        programCode: row.programCode,
        programLabelKa: row.programLabelKa,
        subprogramCode: row.subprogramCode,
        subprogramLabelKa: row.subprogramLabelKa,
        labelKa: row.labelKa,
        actualGel: Math.round(row.actualThousandGel * 1000),
        suggestedPublicSpendingFieldId: suggestion.fieldId,
        mappingConfidence: suggestion.confidence,
        mappingReason: suggestion.reason,
        reviewedPublicSpendingFieldId: "",
        reviewNotes: "",
      };
    })
    .sort((a, b) => {
      const confidenceOrder: Record<MappingConfidence, number> = {
        unclassified: 0,
        low: 1,
        medium: 2,
        high: 3,
      };
      const confidenceDifference = confidenceOrder[a.mappingConfidence] - confidenceOrder[b.mappingConfidence];
      if (confidenceDifference !== 0) return confidenceDifference;
      return b.actualGel - a.actualGel;
    });
}

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
  const hasHealth = includesAny(text, ["ჯანმრთელ", "ჯანდაცვ", "სამედიცინო", "დაავადებ", "ეპიდზედამხედველ"]);
  // NOTE: never use the bare stem "ზრუნვ" here — it is a substring of the
  // ubiquitous "უზრუნველყოფა" (provision) and hijacks unrelated labels.
  const hasSocial = includesAny(text, ["სოციალურ", "პენსი", "დევნილ", "დახმარებ", "ვეტერან", "სახელმწიფო ზრუნვ"]);

  const hasHealthSignal = hasHealth || text.includes("სისხლ");

  if (
    includesAny(text, [
      "სახელმწიფო ვალდებულებების მომსახურება",
      "სახელმწიფო ვალდებულებების დაფარვ",
      "ვალდებულებების მომსახურება და დაფარვა",
      "აღიარებული ვალდებულებების დაფარვ",
      "საფინანსო ორგანიზაციებთან თანამშრომლობიდან გამომდინარე ვალდებულებები",
      "საგადასახადო დავალიანებების დაფარვ",
    ])
  ) {
    return { fieldId: "spending.debt_service", confidence: "high", reason: "state debt or obligation repayment label" };
  }

  if (
    includesAny(text, [
      "ავტობუს",
      "მეტრო",
      "მყარი ნარჩენ",
      "ნარჩენების მართვ",
      "მუნიციპალური ინფრასტრუქტურ",
      "ადგილობრივი თვითმმართველ",
      "ელექტროგადამცემი",
      "ელექტროგადაცემ",
      "ეგხ",
      "კვ ხაზ",
      "220კვ",
      "ჰიდროელექტრო",
      "ენგურ",
      "ვარდნილ",
      "ბუნებრივი აირ",
      "ბუნებრივი გაზ",
      "ელექტროქსელ",
      "ელექტრომომარაგ",
      "ელექტროსადგურ",
      "წყლის პროექტ",
      "აეროპორტ",
      "საჰაერო ხომალდ",
    ])
  ) {
    return {
      fieldId: "spending.infrastructure_regional_development",
      confidence: "medium",
      reason: "transport, municipal, or waste infrastructure label",
    };
  }

  if (includesAny(text, ["ენერგეტიკ"])) {
    return { fieldId: "spending.economic_affairs", confidence: "medium", reason: "energy sector label" };
  }

  if (
    includesAny(text, [
      "სახელმწიფო ქონების მართვა",
      "ანაკლიის ღრმაწყლოვანი პორტ",
      "საინვესტიციო პოლიტიკ",
      "საწარმოთა მართვის სააგენტო",
      "იაფი კრედიტ",
      "სესხები (ფინანსური აქტივების ზრდა)",
      "აქციები და სხვა კაპიტალი",
      "სამშენებლო ინსპექცი",
      "საინვესტიციო რისკ",
      "ენერგომატარებლ",
    ])
  ) {
    return { fieldId: "spending.economic_affairs", confidence: "medium", reason: "reviewed economic affairs label pattern" };
  }

  if (includesAny(text, ["რეგიონთაშორისი პროექტ", "kfw"])) {
    return {
      fieldId: "spending.infrastructure_regional_development",
      confidence: "medium",
      reason: "reviewed donor-financed regional development project label",
    };
  }

  if (
    includesAny(text, [
      "სამელიორაციო",
      "ირიგაცი",
      "დრენაჟ",
      "სოფლის მეურნეობის",
      "სასოფლო-სამეურნეო",
      "სარწყავ",
      "ფერმერ",
      "სოფლის განვითარების პროექტ",
      "მეღვინეობ",
      "ვაზისა და ღვინის",
      "ბუნებრივი რესურს",
    ])
  ) {
    return {
      fieldId: "spending.agriculture_environment",
      confidence: "medium",
      reason: "agriculture, irrigation, or drainage label",
    };
  }

  if (includesAny(text, ["პენიტენც", "პრობაცი", "დანაშაულ", "საზოგადოებრივი წესრიგ", "სამართალდამცავი", "პატიმრობ", "სამართალშემოქმედ", "სასჯელაღსრულებ"])) {
    return { fieldId: "spending.public_order_safety", confidence: "medium", reason: "public order or justice keyword" };
  }

  if (includesAny(text, ["თავდაცვის", "სამხედრო", "შეიარაღებული ძალ"])) {
    return { fieldId: "spending.defence", confidence: "high", reason: "defence keyword" };
  }

  if (includesAny(text, ["აივ", "შიდს", "სამედიცინო", "ექიმი"])) {
    return { fieldId: "spending.health", confidence: "medium", reason: "health keyword" };
  }

  if (includesAny(text, ["იძულებით გადაადგილებულ", "მიგრანტ", "მიგრაციულ", "ლტოლვილ", "ხანდაზმულ"])) {
    return { fieldId: "spending.social_protection", confidence: "medium", reason: "social protection keyword" };
  }

  if (includesAny(text, ["ეპარქი", "რელიგიურ"])) {
    return { fieldId: "spending.culture", confidence: "medium", reason: "religious or cultural activity keyword" };
  }

  if (includesAny(text, ["საზოგადოებრივი მაუწყებელი", "ტელერადიომაუწყებლობა"])) {
    return { fieldId: "spending.culture", confidence: "medium", reason: "broadcasting and public media keyword" };
  }

  if (includesAny(text, ["კონკურენციის სააგენტო", "საინვესტიციო სააგენტო"])) {
    return { fieldId: "spending.economic_affairs", confidence: "medium", reason: "economic affairs agency keyword" };
  }

  if (hasHealthSignal && hasSocial && includesAny(text, ["პოლიტიკის შემუშავება", "სფეროში პოლიტიკის"])) {
    return {
      fieldId: "spending.health",
      confidence: "medium",
      reason: "health and social ministry policy management reviewed as health",
    };
  }

  if (
    hasHealthSignal &&
    hasSocial &&
    includesAny(text, ["პროგრამების მართვა", "პროგრამების სააგენტო", "პროექტების განმახორციელებელ", "ცენტრალური აპარატ"])
  ) {
    return {
      fieldId: "spending.health",
      confidence: "medium",
      reason: "mixed health and social program management reviewed as health",
    };
  }

  if (hasHealthSignal && hasSocial) {
    return {
      fieldId: "spending.other_unclassified",
      confidence: "medium",
      reason: "mixed health and social protection label requires review",
    };
  }

  if (includesAny(text, ["თავდაცვის სამინისტრო", "თავდაცვა"])) {
    return { fieldId: "spending.defence", confidence: "high", reason: "defence keyword" };
  }

  if (
    includesAny(text, [
      "განათლების",
      "სკოლ",
      "უნივერსიტეტ",
      "მეცნიერებ",
      "სასწავლო",
      "საგანმანათლებლო",
      "ახალგაზრდ",
      "ბიოქიმი",
      "ბიოლოგი",
      "პატრიოტ",
    ])
  ) {
    return { fieldId: "spending.education", confidence: "high", reason: "education keyword" };
  }

  if (hasHealthSignal) {
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

  if (text.includes("ტრანსპორტ")) {
    return { fieldId: "spending.economic_affairs", confidence: "medium", reason: "transport keyword" };
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
      "უშიშროების საბჭო",
      "საკანონმდებლო",
      "სახელმწიფო მინისტრის აპარატ",
      "შემოსავლების სამსახური",
      "სახაზინო სამსახური",
      "ფინანსთა სამინისტრო",
      "კონტროლის პალატა",
      "არჩევნ",
      "შესყიდვების სააგენტო",
      "საჯარო სამსახურის ბიურო",
      "სტატისტიკის",
      "საგარეო საქმეთა",
      "სამხრეთ ოსეთის ადმინისტრაცია",
      "მიწის მართვის დეპარტამენტ",
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

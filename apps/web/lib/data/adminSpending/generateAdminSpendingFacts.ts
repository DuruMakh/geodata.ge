import { createHash } from "node:crypto";
import type { OfficialExpenditureRow } from "../realExpenditure/types";
import { classifyAdminSpendingCategory } from "./categories";
import type { AdminSpendingFact, AdminSpendingReport } from "./types";

export const MAJOR_PROGRAM_THRESHOLD_GEL = 100_000_000;
export const ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL = 1_000;

function amountGel(row: OfficialExpenditureRow): number {
  return Math.round(row.actualThousandGel * 1000);
}

function shortHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

const PROGRAM_SEMANTIC_ERAS = [
  {
    code: "06 04",
    parentItemId: "admin_spending.other_costs",
    startYear: 2017,
    endYear: 2018,
    key: "political_and_nonprofit_sector",
  },
  {
    code: "06 04",
    parentItemId: "admin_spending.other_costs",
    startYear: 2019,
    endYear: 2025,
    key: "elections",
  },
  {
    code: "24 17",
    parentItemId: "admin_spending.economy_sustainable_development",
    startYear: 2019,
    endYear: 2020,
    key: "baku_tbilisi_kars_compensation",
  },
  {
    code: "24 17",
    parentItemId: "admin_spending.economy_sustainable_development",
    startYear: 2021,
    endYear: 2025,
    key: "anaklia_port",
  },
  {
    code: "25 06",
    parentItemId: "admin_spending.regional_development_infrastructure",
    startYear: 2017,
    endYear: 2024,
    key: "displaced_person_support",
  },
  {
    code: "25 06",
    parentItemId: "admin_spending.regional_development_infrastructure",
    startYear: 2025,
    endYear: 2025,
    key: "school_infrastructure",
  },
  {
    code: "25 07",
    parentItemId: "admin_spending.regional_development_infrastructure",
    startYear: 2019,
    endYear: 2024,
    key: "school_infrastructure",
  },
  {
    code: "25 07",
    parentItemId: "admin_spending.regional_development_infrastructure",
    startYear: 2025,
    endYear: 2025,
    key: "tourism_infrastructure",
  },
  {
    code: "25 08",
    parentItemId: "admin_spending.regional_development_infrastructure",
    startYear: 2023,
    endYear: 2024,
    key: "tourism_infrastructure",
  },
  {
    code: "25 08",
    parentItemId: "admin_spending.regional_development_infrastructure",
    startYear: 2025,
    endYear: 2025,
    key: "sport_infrastructure",
  },
  {
    code: "26 02",
    parentItemId: "admin_spending.justice",
    startYear: 2017,
    endYear: 2018,
    key: "prosecution",
  },
  {
    code: "26 02",
    parentItemId: "admin_spending.justice",
    startYear: 2019,
    endYear: 2025,
    key: "penitentiary_system",
  },
  {
    code: "29 07",
    parentItemId: "admin_spending.defence",
    startYear: 2017,
    endYear: 2023,
    key: "military_industry",
  },
  {
    code: "29 07",
    parentItemId: "admin_spending.defence",
    startYear: 2024,
    endYear: 2025,
    key: "defence_capabilities",
  },
  {
    code: "29 08",
    parentItemId: "admin_spending.defence",
    startYear: 2017,
    endYear: 2023,
    key: "defence_capabilities",
  },
  {
    code: "29 08",
    parentItemId: "admin_spending.defence",
    startYear: 2024,
    endYear: 2025,
    key: "logistics",
  },
  {
    code: "30 01",
    parentItemId: "admin_spending.internal_affairs",
    startYear: 2017,
    endYear: 2018,
    key: "public_order_and_border",
  },
  {
    code: "30 01",
    parentItemId: "admin_spending.internal_affairs",
    startYear: 2019,
    endYear: 2025,
    key: "public_order",
  },
  {
    code: "30 02",
    parentItemId: "admin_spending.internal_affairs",
    startYear: 2017,
    endYear: 2018,
    key: "protected_assets_and_persons",
  },
  {
    code: "30 02",
    parentItemId: "admin_spending.internal_affairs",
    startYear: 2019,
    endYear: 2025,
    key: "border_protection",
  },
  {
    code: "31 06",
    parentItemId: "admin_spending.environment_agriculture",
    startYear: 2018,
    endYear: 2019,
    key: "agricultural_cooperatives",
  },
  {
    code: "31 06",
    parentItemId: "admin_spending.environment_agriculture",
    startYear: 2020,
    endYear: 2025,
    key: "irrigation_modernization",
  },
  {
    code: "32 08",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2017,
    endYear: 2017,
    key: "millennium_challenge",
  },
  {
    code: "32 08",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2018,
    endYear: 2019,
    key: "youth_support",
  },
  {
    code: "32 08",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2020,
    endYear: 2021,
    key: "arts_and_sport_institutions",
  },
  {
    code: "32 08",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2022,
    endYear: 2023,
    key: "i2q",
  },
  {
    code: "32 08",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2024,
    endYear: 2025,
    key: "youth_support",
  },
  {
    code: "32 09",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2018,
    endYear: 2018,
    key: "millennium_challenge_second_project",
  },
  {
    code: "32 09",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2019,
    endYear: 2019,
    key: "arts_and_sport_institutions",
  },
  {
    code: "32 09",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2020,
    endYear: 2021,
    key: "culture_support",
  },
  {
    code: "32 09",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2022,
    endYear: 2023,
    key: "vocational_education_kfw",
  },
  {
    code: "32 09",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2024,
    endYear: 2025,
    key: "i2q",
  },
  {
    code: "32 11",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2018,
    endYear: 2018,
    key: "hydrotechnical_lab",
  },
  {
    code: "32 11",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2019,
    endYear: 2019,
    key: "cultural_heritage",
  },
  {
    code: "32 11",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2020,
    endYear: 2021,
    key: "sport_development",
  },
  {
    code: "32 11",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2024,
    endYear: 2025,
    key: "skills_for_employment_adb",
  },
  {
    code: "32 12",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2019,
    endYear: 2019,
    key: "sport_development",
  },
  {
    code: "32 12",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2020,
    endYear: 2021,
    key: "culture_and_sport_social_support",
  },
  {
    code: "33 02",
    parentItemId: "admin_spending.culture",
    startYear: 2017,
    endYear: 2018,
    key: "arts_development",
  },
  {
    code: "33 02",
    parentItemId: "admin_spending.culture",
    startYear: 2022,
    endYear: 2024,
    key: "higher_arts_and_sport_education",
  },
  {
    code: "33 02",
    parentItemId: "admin_spending.culture",
    startYear: 2025,
    endYear: 2025,
    key: "culture_development",
  },
  {
    code: "33 05",
    parentItemId: "admin_spending.culture",
    startYear: 2018,
    endYear: 2018,
    key: "sport",
  },
  {
    code: "33 05",
    parentItemId: "admin_spending.culture",
    startYear: 2022,
    endYear: 2024,
    key: "culture_support",
  },
  {
    code: "33 05",
    parentItemId: "admin_spending.culture",
    startYear: 2025,
    endYear: 2025,
    key: "higher_arts_education",
  },
  {
    code: "33 07",
    parentItemId: "admin_spending.culture",
    startYear: 2018,
    endYear: 2018,
    key: "culture_and_sport_investment",
  },
  {
    code: "33 07",
    parentItemId: "admin_spending.culture",
    startYear: 2022,
    endYear: 2024,
    key: "sport_development",
  },
  {
    code: "33 07",
    parentItemId: "admin_spending.culture",
    startYear: 2025,
    endYear: 2025,
    key: "infrastructure_development",
  },
  {
    code: "56 11",
    parentItemId: "admin_spending.other_costs",
    startYear: 2018,
    endYear: 2018,
    key: "international_obligations",
  },
  {
    code: "56 11",
    parentItemId: "admin_spending.other_costs",
    startYear: 2020,
    endYear: 2024,
    key: "funded_pension_cofinancing",
  },
] as const;

function programItemId(row: OfficialExpenditureRow): string {
  const code = row.code as string;
  const parentItemId = classifyAdminSpendingCategory(row);
  const semanticEra = PROGRAM_SEMANTIC_ERAS.find(
    (era) =>
      era.code === code &&
      era.parentItemId === parentItemId &&
      row.year >= era.startYear &&
      row.year <= era.endYear,
  );
  const identityKey = `${code}|${parentItemId}|${semanticEra?.key ?? "default"}`;
  return `admin_program.${code.replaceAll(" ", "_")}.${shortHash(identityKey)}`;
}

function compareFacts(a: AdminSpendingFact, b: AdminSpendingFact): number {
  return (
    a.year - b.year ||
    a.level.localeCompare(b.level) ||
    a.itemId.localeCompare(b.itemId) ||
    (a.officialCode ?? "").localeCompare(b.officialCode ?? "")
  );
}

function addAmount(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function leafRows(rows: OfficialExpenditureRow[]): OfficialExpenditureRow[] {
  return rows.filter((row) => row.code && row.isLeafCode && !row.isTotal && row.actualThousandGel > 0);
}

function programRows(rows: OfficialExpenditureRow[]): OfficialExpenditureRow[] {
  return rows.filter((row) => row.code && row.depth === 2 && row.actualThousandGel > 0);
}

export function generateAdminSpendingFacts(rows: OfficialExpenditureRow[]): AdminSpendingFact[] {
  const facts: AdminSpendingFact[] = [];
  const categoryAmounts = new Map<string, number>();
  const categorySources = new Map<string, Set<string>>();

  for (const row of leafRows(rows)) {
    const itemId = classifyAdminSpendingCategory(row);
    const key = `${row.year}|${itemId}`;
    addAmount(categoryAmounts, key, amountGel(row));

    const sources = categorySources.get(key) ?? new Set<string>();
    sources.add(row.sourceId);
    categorySources.set(key, sources);
  }

  for (const [key, amount] of categoryAmounts) {
    const [yearText, itemId] = key.split("|");
    facts.push({
      year: Number(yearText),
      itemId,
      parentItemId: null,
      level: "admin_category",
      amountGel: amount,
      basis: "actual",
      sourceId: Array.from(categorySources.get(key) ?? []).sort().join(";"),
      officialCode: null,
      officialLabelKa: null,
      officialInstitutionCode: null,
      officialInstitutionLabelKa: null,
      mappingConfidence: itemId === "admin_spending.other_costs" ? "medium" : "high",
      mappingNotes: "Aggregated from official tavi 6 leaf rows by administrative owner.",
    });
  }

  const programs = programRows(rows);
  const qualifyingIds = new Set(
    programs.filter((row) => amountGel(row) >= MAJOR_PROGRAM_THRESHOLD_GEL).map((row) => programItemId(row)),
  );

  for (const row of programs) {
    const itemId = programItemId(row);
    if (!qualifyingIds.has(itemId)) continue;

    facts.push({
      year: row.year,
      itemId,
      parentItemId: classifyAdminSpendingCategory(row),
      level: "major_program",
      amountGel: amountGel(row),
      basis: "actual",
      sourceId: row.sourceId,
      officialCode: row.code,
      officialLabelKa: row.labelKa,
      officialInstitutionCode: row.institutionCode,
      officialInstitutionLabelKa: row.institutionLabelKa,
      mappingConfidence: "medium",
      mappingNotes: `Official depth-2 program. Included because this source-code series reaches at least ${MAJOR_PROGRAM_THRESHOLD_GEL} GEL in one or more years.`,
    });
  }

  return facts.sort(compareFacts);
}

export function buildAdminSpendingReport(
  rows: OfficialExpenditureRow[],
  facts: AdminSpendingFact[],
): AdminSpendingReport {
  const years = Array.from(new Set(rows.map((row) => row.year))).sort((a, b) => a - b);
  const sourceTotalGelByYear: Record<number, number> = {};
  const categoryTotalGelByYear: Record<number, number> = {};
  const reconciliationStatusByYear: Record<number, "passed" | "failed"> = {};

  for (const row of rows.filter((sourceRow) => sourceRow.isTotal)) {
    sourceTotalGelByYear[row.year] = amountGel(row);
  }

  for (const fact of facts.filter((row) => row.level === "admin_category")) {
    categoryTotalGelByYear[fact.year] = (categoryTotalGelByYear[fact.year] ?? 0) + fact.amountGel;
  }

  for (const year of years) {
    const sourceTotal = sourceTotalGelByYear[year] ?? 0;
    const categoryTotal = categoryTotalGelByYear[year] ?? 0;
    reconciliationStatusByYear[year] =
      Math.abs(sourceTotal - categoryTotal) <= ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL ? "passed" : "failed";
  }

  return {
    years,
    sourceRows: rows.length,
    categoryFactRows: facts.filter((row) => row.level === "admin_category").length,
    majorProgramFactRows: facts.filter((row) => row.level === "major_program").length,
    majorProgramThresholdGel: MAJOR_PROGRAM_THRESHOLD_GEL,
    majorProgramUniqueItems: new Set(facts.filter((row) => row.level === "major_program").map((row) => row.itemId)).size,
    reconciliationToleranceGel: ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL,
    sourceTotalGelByYear,
    categoryTotalGelByYear,
    reconciliationStatusByYear,
  };
}

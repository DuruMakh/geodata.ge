import { createHash } from "node:crypto";
import type { OfficialExpenditureRow } from "../realExpenditure/types";
import { classifyAdminSpendingCategory } from "./categories";
import type { AdminSpendingFact, AdminSpendingReport } from "./types";

export const MAJOR_PROGRAM_THRESHOLD_GEL = 100_000_000;
export const ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL = 1_000;
// The program drill-down only shows programs that still exist in the confirmed
// 2017-2025 series. An older-year figure appears only when it belongs to a program
// that survives to 2017+ (same code / slight rename → shared identity); programs
// abolished before 2017 are dropped from the drill-down (their spend remains in the
// administrative-category totals, which aggregate leaf rows independently).
export const MAJOR_PROGRAM_MODERN_MIN_YEAR = 2017;

function amountGel(row: OfficialExpenditureRow): number {
  return Math.round(row.actualThousandGel * 1000);
}

function shortHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

// An era only applies when the row classifies into its parentItemId (see programItemId). Note the
// 2018-2024 program-level Sport/Culture de-merge in classifyAdminSpendingCategory (categories.ts):
// a few codes here list an education/culture parent for years whose programs that split now routes
// to Sport or Culture instead (e.g. 32 11 / 32 12 sport-development in 2019-2021, 33 07 in
// 2022-2024). For those rows the era simply no longer matches and the category split does the
// separating; the entries are kept because their other years (and the synthetic-row era tests) still
// rely on them. Real-data grouping is unaffected — verified in the drill-down.
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
    // Owner decision 2026-07-07: the pre-2019 "public order + state border" program is the SAME
    // program back through 2012 (2013-2016 labels are identical to 2017-2018; 2012 is a slight
    // rename), so the era starts at 2012 and the series runs 2012-2018. From 2019 the border
    // guard split out (see the 2019+ eras of 30 01/30 02).
    code: "30 01",
    parentItemId: "admin_spending.internal_affairs",
    startYear: 2012,
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
  // Pre-2017 code reuses: these program codes were later recycled for a DIFFERENT 2017+ program.
  // Give the pre-2017 program its own identity so its amount does not merge into (and contaminate)
  // the modern program; the drill-down filter below then drops it, because a program that no longer
  // exists under this code in 2017-2025 is not shown. Ranges cover ONLY each code's genuinely-
  // recycled pre-2017 years (the backfill's earliest organizational-coding year is 2012). Where a
  // pre-2017 year is a genuine RENAME of the modern program (same program, evolved name), it is
  // intentionally left OUT so it stays merged into the continuous series — e.g. 30 06 2014/2016
  // (civil-security) and 36 03 2014/2016 (electricity transmission) match their modern program and
  // are NOT listed here, while their earlier truly-different years are.
  {
    code: "24 06",
    parentItemId: "admin_spending.economy_sustainable_development",
    startYear: 2012,
    endYear: 2016,
    key: "aviation_treaty_obligations_legacy",
  },
  {
    code: "24 07",
    parentItemId: "admin_spending.economy_sustainable_development",
    startYear: 2012,
    endYear: 2016,
    key: "france_commodity_assistance_legacy",
  },
  {
    code: "25 05",
    parentItemId: "admin_spending.regional_development_infrastructure",
    startYear: 2012,
    endYear: 2016,
    key: "displaced_person_support_legacy",
  },
  {
    // 2012 archive-fund digitization; 2017+ (and already 2014/2016) code 30 06 is civil-security,
    // so only 2012 is split off and dropped.
    code: "30 06",
    parentItemId: "admin_spending.internal_affairs",
    startYear: 2012,
    endYear: 2012,
    key: "archive_digitization_legacy",
  },
  {
    // 2016 Millennium Challenge Georgia (a one-off); 2017+ code 32 07 is education/science
    // infrastructure development.
    code: "32 07",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2016,
    endYear: 2016,
    key: "millennium_challenge_infra_legacy",
  },
  {
    // 2012 high-mountain municipal support + 2013 general energy-infrastructure construction;
    // 2017+ (and already 2014/2016) code 36 03 is system-critical electricity transmission, left
    // merged, so only 2012-2013 are split off.
    code: "36 03",
    parentItemId: "admin_spending.economy_sustainable_development",
    startYear: 2012,
    endYear: 2013,
    key: "energy_infrastructure_legacy",
  },
  {
    // 2013-2014: defence scientific-research support; 2017+ code 29 05 is defence infrastructure.
    code: "29 05",
    parentItemId: "admin_spending.defence",
    startYear: 2013,
    endYear: 2016,
    key: "defence_scientific_research_legacy",
  },
  {
    // 2013-2014: educational/scientific-institution infrastructure; 2017+ code 32 05 is science
    // and scientific-research support.
    code: "32 05",
    parentItemId: "admin_spending.education_science_youth",
    startYear: 2013,
    endYear: 2016,
    key: "education_institution_infrastructure_legacy",
  },
  {
    // 2013-2014: criminal-justice-system reform (a large one-off, 131M in 2014) under the
    // penitentiary ministry; 2017+ code 27 02 (still penitentiary) is the small probation system.
    code: "27 02",
    parentItemId: "admin_spending.justice",
    startYear: 2013,
    endYear: 2016,
    key: "criminal_justice_reform_legacy",
  },
] as const;

function makeProgramItemId(code: string, parentItemId: string, eraKey: string): string {
  const identityKey = `${code}|${parentItemId}|${eraKey}`;
  return `admin_program.${code.replaceAll(" ", "_")}.${shortHash(identityKey)}`;
}

function programItemId(row: OfficialExpenditureRow): string {
  const code = row.code as string;
  // Owner-approved pre-2012 join rows (injected by extractAnnualReportYears from
  // legacyProgramJoins.ts) resolve straight to their modern series' identity; the row keeps
  // its source-year code/label for provenance. The era key is "default" because no join
  // target code carries a semantic era — the join-completeness guard test fails loudly if
  // that ever changes (an era entry for a target code would shift the modern identity away
  // from this one and orphan the join).
  const join = row.legacyProgramJoin;
  if (join) return makeProgramItemId(join.targetCode, join.targetParentItemId, "default");
  const parentItemId = classifyAdminSpendingCategory(row);
  const semanticEra = PROGRAM_SEMANTIC_ERAS.find(
    (era) =>
      era.code === code &&
      era.parentItemId === parentItemId &&
      row.year >= era.startYear &&
      row.year <= era.endYear,
  );
  return makeProgramItemId(code, parentItemId, semanticEra?.key ?? "default");
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
  // A program identity qualifies for the drill-down only if it reaches the threshold in a
  // MODERN (2017+) year. Measuring the threshold over modern years alone (rather than over all
  // years) is what keeps the confirmed 2017-2025 baseline unchanged: a pre-2017 backfill row
  // whose code is shared with a below-threshold modern program must NOT promote that modern
  // identity into the major-program set. This also subsumes the old "present in 2017+" filter —
  // any qualifying identity necessarily has a modern row — so abolished pre-2017 programs
  // (their identity never reaches the threshold in a modern year) are dropped automatically.
  const qualifyingIds = new Set(
    programs
      .filter((row) => row.year >= MAJOR_PROGRAM_MODERN_MIN_YEAR && amountGel(row) >= MAJOR_PROGRAM_THRESHOLD_GEL)
      .map((row) => programItemId(row)),
  );

  for (const row of programs) {
    const itemId = programItemId(row);
    if (!qualifyingIds.has(itemId)) continue;

    // Joined pre-2012 points belong to their modern series: they carry the series' parent
    // category and a provenance note; officialCode/officialLabel stay source-year truth.
    const join = row.legacyProgramJoin;
    facts.push({
      year: row.year,
      itemId,
      parentItemId: join?.targetParentItemId ?? classifyAdminSpendingCategory(row),
      level: "major_program",
      amountGel: amountGel(row),
      basis: "actual",
      sourceId: row.sourceId,
      officialCode: row.code,
      officialLabelKa: row.labelKa,
      officialInstitutionCode: row.institutionCode,
      officialInstitutionLabelKa: row.institutionLabelKa,
      mappingConfidence: "medium",
      mappingNotes: join
        ? join.note
        : `Official depth-2 program. Included because this source-code series reaches at least ${MAJOR_PROGRAM_THRESHOLD_GEL} GEL in one or more years.`,
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

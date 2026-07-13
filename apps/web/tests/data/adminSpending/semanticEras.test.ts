import { describe, expect, it } from "vitest";
import { generateAdminSpendingFacts } from "../../../lib/data/adminSpending/generateAdminSpendingFacts";
import type { OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

/**
 * PROGRAM_SEMANTIC_ERAS (lib/data/adminSpending/generateAdminSpendingFacts.ts) is not
 * exported, so these tests exercise it through the public generateAdminSpendingFacts
 * function. The era key is folded into the program fact itemId hash
 * (`${code}|${parentItemId}|${era.key ?? "default"}`), so two years share an itemId if
 * and only if they resolve to the same semantic era (or both fall back to "default").
 * Partitioning years by itemId therefore observes every era boundary exactly.
 */

const EDUCATION_LABEL_KA = "საქართველოს განათლების სამინისტრო";
const REGIONAL_LABEL_KA = "საქართველოს რეგიონული განვითარებისა და ინფრასტრუქტურის სამინისტრო";
const DEFENCE_LABEL_KA = "საქართველოს თავდაცვის სამინისტრო";
const INTERNAL_AFFAIRS_LABEL_KA = "საქართველოს შინაგან საქმეთა სამინისტრო";
const ENVIRONMENT_AGRICULTURE_LABEL_KA = "საქართველოს გარემოს დაცვისა და სოფლის მეურნეობის სამინისტრო";
const ECONOMY_LABEL_KA = "საქართველოს ეკონომიკისა და მდგრადი განვითარების სამინისტრო";
const JUSTICE_LABEL_KA = "საქართველოს იუსტიციის სამინისტრო";
const CULTURE_LABEL_KA = "საქართველოს კულტურის სამინისტრო";
// Falls through every keyword in classifyAdminSpendingCategory -> admin_spending.other_costs.
const ELECTION_COMMISSION_LABEL_KA = "საქართველოს ცენტრალური საარჩევნო კომისია";
// State-wide payments institution -> admin_spending.other_costs (program label is not debt service).
const STATE_WIDE_PAYMENTS_LABEL_KA = "საერთო-სახელმწიფოებრივი მნიშვნელობის გადასახდელები";

// Eras mirrored in this spec span 2012..2025 (30 01's public_order_and_border reaches back to
// 2012 since the 2026-07-07 owner decision), so 2011..2026 covers startYear-1 and endYear+1 for
// every era entry.
const TEST_YEARS = [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

type EraSpec = {
  startYear: number;
  endYear: number;
  key: string;
  /**
   * Set when the range is covered by a PROGRAM_SUCCESSIONS entry instead of (or superseding) a
   * semantic era: those years resolve to the canonical identity of TARGET code, so the itemId
   * prefix carries the target code rather than this spec's code. Partitioning is unaffected.
   */
  targetCode?: string;
};

type CodeSpec = {
  code: string;
  institutionLabelKa: string;
  parentItemId: string;
  eras: EraSpec[];
};

/**
 * Mirror of the production identity rules per code: PROGRAM_SEMANTIC_ERAS plus the
 * PROGRAM_SUCCESSIONS ranges that redirect a code's rows to a canonical identity (entries
 * with `targetCode`). This is the expected specification: if either production table (or
 * the lookup precedence) drifts by even one year, the identity partition below changes
 * and the parameterized test fails.
 */
const SEMANTIC_ERA_SPECS: CodeSpec[] = [
  {
    code: "06 04",
    institutionLabelKa: ELECTION_COMMISSION_LABEL_KA,
    parentItemId: "admin_spending.other_costs",
    eras: [
      { startYear: 2017, endYear: 2018, key: "political_and_nonprofit_sector" },
      { startYear: 2019, endYear: 2025, key: "elections" },
    ],
  },
  {
    code: "24 17",
    institutionLabelKa: ECONOMY_LABEL_KA,
    parentItemId: "admin_spending.economy_sustainable_development",
    eras: [
      { startYear: 2019, endYear: 2020, key: "baku_tbilisi_kars_compensation" },
      { startYear: 2021, endYear: 2025, key: "anaklia_port" },
    ],
  },
  {
    code: "25 06",
    institutionLabelKa: REGIONAL_LABEL_KA,
    parentItemId: "admin_spending.regional_development_infrastructure",
    eras: [
      { startYear: 2017, endYear: 2024, key: "displaced_person_support" },
      { startYear: 2025, endYear: 2025, key: "school_infrastructure" },
    ],
  },
  {
    code: "25 07",
    institutionLabelKa: REGIONAL_LABEL_KA,
    parentItemId: "admin_spending.regional_development_infrastructure",
    eras: [
      { startYear: 2019, endYear: 2024, key: "school_infrastructure", targetCode: "25 06" },
      { startYear: 2025, endYear: 2025, key: "tourism_infrastructure" },
    ],
  },
  {
    code: "25 08",
    institutionLabelKa: REGIONAL_LABEL_KA,
    parentItemId: "admin_spending.regional_development_infrastructure",
    eras: [
      { startYear: 2023, endYear: 2024, key: "tourism_infrastructure", targetCode: "25 07" },
      { startYear: 2025, endYear: 2025, key: "sport_infrastructure" },
    ],
  },
  {
    code: "26 02",
    institutionLabelKa: JUSTICE_LABEL_KA,
    parentItemId: "admin_spending.justice",
    eras: [
      { startYear: 2017, endYear: 2018, key: "prosecution" },
      { startYear: 2019, endYear: 2025, key: "penitentiary_system" },
    ],
  },
  {
    code: "29 07",
    institutionLabelKa: DEFENCE_LABEL_KA,
    parentItemId: "admin_spending.defence",
    eras: [
      { startYear: 2017, endYear: 2023, key: "military_industry" },
      { startYear: 2024, endYear: 2025, key: "defence_capabilities" },
    ],
  },
  {
    code: "29 08",
    institutionLabelKa: DEFENCE_LABEL_KA,
    parentItemId: "admin_spending.defence",
    eras: [
      { startYear: 2017, endYear: 2023, key: "defence_capabilities", targetCode: "29 07" },
      { startYear: 2024, endYear: 2025, key: "logistics" },
    ],
  },
  {
    // public_order_and_border reaches back to 2012 (owner decision 2026-07-07): the pre-2017
    // program is the same public-order+border program, so its backfill years join the series.
    code: "30 01",
    institutionLabelKa: INTERNAL_AFFAIRS_LABEL_KA,
    parentItemId: "admin_spending.internal_affairs",
    eras: [
      { startYear: 2012, endYear: 2018, key: "public_order_and_border" },
      { startYear: 2019, endYear: 2025, key: "public_order" },
    ],
  },
  {
    code: "30 02",
    institutionLabelKa: INTERNAL_AFFAIRS_LABEL_KA,
    parentItemId: "admin_spending.internal_affairs",
    eras: [
      { startYear: 2017, endYear: 2018, key: "protected_assets_and_persons" },
      { startYear: 2019, endYear: 2025, key: "border_protection" },
    ],
  },
  {
    code: "31 06",
    institutionLabelKa: ENVIRONMENT_AGRICULTURE_LABEL_KA,
    parentItemId: "admin_spending.environment_agriculture",
    eras: [
      { startYear: 2018, endYear: 2019, key: "agricultural_cooperatives" },
      { startYear: 2020, endYear: 2025, key: "irrigation_modernization" },
    ],
  },
  {
    // Key "youth_support" is intentionally reused by two non-adjacent eras; both
    // resolve to the same identity key, so 2018-2019 and 2024-2025 merge.
    code: "32 08",
    institutionLabelKa: EDUCATION_LABEL_KA,
    parentItemId: "admin_spending.education_science_youth",
    eras: [
      { startYear: 2017, endYear: 2017, key: "millennium_challenge_second_project", targetCode: "32 09" },
      { startYear: 2018, endYear: 2019, key: "youth_support" },
      { startYear: 2020, endYear: 2021, key: "arts_and_sport_institutions" },
      { startYear: 2022, endYear: 2023, key: "i2q" },
      { startYear: 2024, endYear: 2025, key: "youth_support" },
    ],
  },
  {
    code: "32 09",
    institutionLabelKa: EDUCATION_LABEL_KA,
    parentItemId: "admin_spending.education_science_youth",
    eras: [
      { startYear: 2018, endYear: 2018, key: "millennium_challenge_second_project" },
      { startYear: 2019, endYear: 2019, key: "arts_and_sport_institutions" },
      { startYear: 2020, endYear: 2021, key: "culture_support" },
      { startYear: 2022, endYear: 2023, key: "vocational_education_kfw" },
      { startYear: 2024, endYear: 2025, key: "i2q" },
    ],
  },
  {
    // GAP: no era covers 2022-2023 for this code; those years fall back to "default".
    code: "32 11",
    institutionLabelKa: EDUCATION_LABEL_KA,
    parentItemId: "admin_spending.education_science_youth",
    eras: [
      { startYear: 2018, endYear: 2018, key: "hydrotechnical_lab" },
      { startYear: 2019, endYear: 2019, key: "cultural_heritage" },
      { startYear: 2020, endYear: 2021, key: "sport_development" },
      { startYear: 2024, endYear: 2025, key: "skills_for_employment_adb" },
    ],
  },
  {
    // GAP: no era covers 2022 onwards for this code.
    code: "32 12",
    institutionLabelKa: EDUCATION_LABEL_KA,
    parentItemId: "admin_spending.education_science_youth",
    eras: [
      { startYear: 2019, endYear: 2019, key: "sport_development" },
      { startYear: 2020, endYear: 2021, key: "culture_and_sport_social_support" },
    ],
  },
  {
    // GAP: no era covers 2019-2021 for this code.
    code: "33 02",
    institutionLabelKa: CULTURE_LABEL_KA,
    parentItemId: "admin_spending.culture",
    eras: [
      { startYear: 2017, endYear: 2018, key: "arts_development" },
      { startYear: 2022, endYear: 2024, key: "higher_arts_and_sport_education" },
      { startYear: 2025, endYear: 2025, key: "culture_development" },
    ],
  },
  {
    // GAP: no era or succession covers 2017 or 2019-2021 for this code. The 2018 "sport" era
    // applies only to culture-classified rows (like this spec's); REAL 2018 rows de-merge to
    // the sport category and join the 34 02 sport succession chain instead.
    code: "33 05",
    institutionLabelKa: CULTURE_LABEL_KA,
    parentItemId: "admin_spending.culture",
    eras: [
      { startYear: 2018, endYear: 2018, key: "sport" },
      { startYear: 2022, endYear: 2024, key: "culture_support", targetCode: "33 02" },
      { startYear: 2025, endYear: 2025, key: "higher_arts_education" },
    ],
  },
  {
    // GAP: no era covers 2017 or 2019-2021 for this code.
    code: "33 07",
    institutionLabelKa: CULTURE_LABEL_KA,
    parentItemId: "admin_spending.culture",
    eras: [
      { startYear: 2018, endYear: 2018, key: "culture_and_sport_investment" },
      { startYear: 2022, endYear: 2024, key: "sport_development" },
      { startYear: 2025, endYear: 2025, key: "infrastructure_development" },
    ],
  },
  {
    // GAP: no era or succession covers 2017, 2019 or 2025 for this code.
    code: "56 11",
    institutionLabelKa: STATE_WIDE_PAYMENTS_LABEL_KA,
    parentItemId: "admin_spending.other_costs",
    eras: [
      { startYear: 2018, endYear: 2018, key: "international_obligations" },
      { startYear: 2020, endYear: 2024, key: "funded_pension_cofinancing", targetCode: "57 11" },
    ],
  },
];

// 150M GEL: comfortably above the 100M major-program threshold so every year emits a fact.
const QUALIFYING_ACTUAL_THOUSAND_GEL = 150_000;

function programRow(year: number, code: string, institutionLabelKa: string): OfficialExpenditureRow {
  return {
    year,
    sourceId: `source.test_${year}`,
    workbookPath: `docs/Raw Data/Expenditure/mof.ge/${year}.xlsx`,
    sheetName: "tavi 6",
    rowNumber: 1,
    code,
    parentCode: null,
    depth: 2,
    institutionCode: `${code.split(" ")[0]} 00`,
    institutionLabelKa,
    programCode: code,
    programLabelKa: `program ${code} of ${year}`,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: false,
    isCodedRow: true,
    isLeafCode: false,
    labelKa: `program ${code} of ${year}`,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: QUALIFYING_ACTUAL_THOUSAND_GEL,
    executionPercent: null,
  };
}

function itemIdByYear(code: string, institutionLabelKa: string, years: number[]): Map<number, string> {
  const rows = years.map((year) => programRow(year, code, institutionLabelKa));
  const facts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "major_program");

  expect(facts).toHaveLength(years.length);

  return new Map(facts.map((fact) => [fact.year, fact.itemId]));
}

function partitionYears(identityByYear: Map<number, string>): number[][] {
  const groups = new Map<string, number[]>();
  for (const [year, identity] of identityByYear) {
    groups.set(identity, [...(groups.get(identity) ?? []), year]);
  }
  return Array.from(groups.values())
    .map((group) => [...group].sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0]);
}

function expectedPartition(eras: EraSpec[], years: number[]): number[][] {
  const groups = new Map<string, number[]>();
  for (const year of years) {
    // Mirrors the production lookup: first matching era wins, no era means "default".
    const era = eras.find((candidate) => year >= candidate.startYear && year <= candidate.endYear);
    const key = era?.key ?? "default";
    groups.set(key, [...(groups.get(key) ?? []), year]);
  }
  return Array.from(groups.values())
    .map((group) => [...group].sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0]);
}

describe("PROGRAM_SEMANTIC_ERAS business rules", () => {
  it("covers every era-mapped code exactly once in this spec", () => {
    const codes = SEMANTIC_ERA_SPECS.map((spec) => spec.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual([...codes].sort());
  });

  it("has no overlapping era year ranges for any code (structural invariant of the spec)", () => {
    // The production array is not exported, but the parameterized partition test below
    // asserts production behavior equals this spec exactly, so disjointness proven here
    // transfers to the production table: an overlap there would shift a boundary year
    // out of the partition this spec predicts.
    for (const spec of SEMANTIC_ERA_SPECS) {
      const ordered = [...spec.eras].sort((a, b) => a.startYear - b.startYear);
      for (const era of ordered) {
        expect(era.startYear).toBeLessThanOrEqual(era.endYear);
      }
      for (let index = 1; index < ordered.length; index += 1) {
        expect(ordered[index].startYear).toBeGreaterThan(ordered[index - 1].endYear);
      }
    }
  });

  // For every era entry this checks classification at startYear, endYear, startYear-1
  // and endYear+1: the partition over 2016..2026 puts each boundary year either in its
  // own era group, in the adjacent era's group, or in the shared "default" group.
  it.each(SEMANTIC_ERA_SPECS)(
    "assigns code $code to the correct semantic identity at every era boundary",
    (spec) => {
      const identityByYear = itemIdByYear(spec.code, spec.institutionLabelKa, TEST_YEARS);

      expect(partitionYears(identityByYear)).toEqual(expectedPartition(spec.eras, TEST_YEARS));

      for (const [year, identity] of identityByYear) {
        // Succession-redirected years (targetCode) resolve to the canonical identity of the
        // TARGET code; all other years keep this spec's own code.
        const era = spec.eras.find((candidate) => year >= candidate.startYear && year <= candidate.endYear);
        const expectedCode = era?.targetCode ?? spec.code;
        expect(identity.startsWith(`admin_program.${expectedCode.replaceAll(" ", "_")}.`)).toBe(true);
      }
    },
  );

  it("splits code 06 04 into political/nonprofit funding through 2018 and elections from 2019", () => {
    const identityByYear = itemIdByYear("06 04", ELECTION_COMMISSION_LABEL_KA, TEST_YEARS);

    // The intended behavior: 2018 and 2019 are different programs despite sharing a code.
    expect(identityByYear.get(2018)).not.toBe(identityByYear.get(2019));

    // 2017-2018 belong to one stable identity (political_and_nonprofit_sector)...
    expect(identityByYear.get(2017)).toBe(identityByYear.get(2018));
    // ...and 2019-2025 belong to another stable identity (elections).
    const electionYears = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
    const electionIdentities = new Set(electionYears.map((year) => identityByYear.get(year)));
    expect(electionIdentities.size).toBe(1);
    expect(electionIdentities.has(identityByYear.get(2018))).toBe(false);

    // Years outside both eras fall back to the shared default identity.
    expect(identityByYear.get(2016)).toBe(identityByYear.get(2026));
    expect(identityByYear.get(2016)).not.toBe(identityByYear.get(2017));
    expect(identityByYear.get(2026)).not.toBe(identityByYear.get(2025));
  });

  it("keeps a code with no era entry on a single default identity across all years", () => {
    const identityByYear = itemIdByYear("32 02", EDUCATION_LABEL_KA, TEST_YEARS);
    const identities = new Set(identityByYear.values());

    expect(identities.size).toBe(1);
    expect(Array.from(identities)[0]).toMatch(/^admin_program\.32_02\./);

    const rows = TEST_YEARS.map((year) => programRow(year, "32 02", EDUCATION_LABEL_KA));
    const facts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "major_program");
    expect(facts.every((fact) => fact.parentItemId === "admin_spending.education_science_youth")).toBe(true);
  });

  it("applies an era only when the row classifies into the era's parent category", () => {
    // "29 08" eras are declared for admin_spending.defence. The same code under the
    // education ministry never matches an era, so no identity split happens in 2024.
    const identityByYear = itemIdByYear("29 08", EDUCATION_LABEL_KA, TEST_YEARS);

    expect(new Set(identityByYear.values()).size).toBe(1);
    expect(identityByYear.get(2023)).toBe(identityByYear.get(2024));
  });

  it("merges non-adjacent eras of the same code that share a semantic key (32 08 youth_support)", () => {
    const identityByYear = itemIdByYear("32 08", EDUCATION_LABEL_KA, TEST_YEARS);

    // youth_support ran 2018-2019, was replaced, then returned for 2024-2025.
    expect(identityByYear.get(2018)).toBe(identityByYear.get(2019));
    expect(identityByYear.get(2024)).toBe(identityByYear.get(2025));
    expect(identityByYear.get(2018)).toBe(identityByYear.get(2024));

    // The eras in between stay distinct.
    expect(identityByYear.get(2020)).not.toBe(identityByYear.get(2018));
    expect(identityByYear.get(2022)).not.toBe(identityByYear.get(2018));
    expect(identityByYear.get(2020)).not.toBe(identityByYear.get(2022));
  });

  it("keeps the same semantic key separate across different codes unless a succession joins them", () => {
    // sport_development exists for "32 11" (education parent, 2020-2021) and "33 07" (culture
    // parent, 2022-2024); identities include the code and parent, so they must not merge.
    const code3211 = itemIdByYear("32 11", EDUCATION_LABEL_KA, [2020]);
    const code3307 = itemIdByYear("33 07", CULTURE_LABEL_KA, [2022]);
    expect(code3211.get(2020)).not.toBe(code3307.get(2022));

    // Counterpart: school_infrastructure for "25 07" (2019-2024) and "25 06" (2025) is ONE
    // program whose code shifted — the PROGRAM_SUCCESSIONS entry deliberately joins them
    // (owner-approved 2026-07-09).
    const code2506 = itemIdByYear("25 06", REGIONAL_LABEL_KA, [2025]);
    const code2507 = itemIdByYear("25 07", REGIONAL_LABEL_KA, [2019]);
    expect(code2506.get(2025)).toBe(code2507.get(2019));
  });

  it("BEHAVIOR NOTE: era gap years of one code collapse into a single shared default identity", () => {
    // Documents current behavior, not necessarily intent: "56 11" has eras for 2018
    // (international_obligations) and 2020-2024 (funded_pension_cofinancing) but no era
    // for 2019 or 2025. Both uncovered years hash to the same "default" identity, so if
    // both ever crossed the 100M threshold they would be reported as one continuous
    // program even though the surrounding eras suggest they are unrelated. Today this is
    // latent: in the real data those gap years stay below the threshold.
    const identityByYear = itemIdByYear("56 11", STATE_WIDE_PAYMENTS_LABEL_KA, TEST_YEARS);

    expect(identityByYear.get(2019)).toBe(identityByYear.get(2025));
    expect(identityByYear.get(2019)).not.toBe(identityByYear.get(2018));
    expect(identityByYear.get(2019)).not.toBe(identityByYear.get(2020));
    expect(identityByYear.get(2025)).not.toBe(identityByYear.get(2024));

    // Same pattern for "33 02", where 2019-2021 sit between two eras.
    const cultureIdentityByYear = itemIdByYear("33 02", CULTURE_LABEL_KA, TEST_YEARS);
    const gapIdentities = new Set([2019, 2020, 2021].map((year) => cultureIdentityByYear.get(year)));
    expect(gapIdentities.size).toBe(1);
    expect(gapIdentities.has(cultureIdentityByYear.get(2018))).toBe(false);
    expect(gapIdentities.has(cultureIdentityByYear.get(2022))).toBe(false);
    // The gap identity also matches the pre-2017/post-2025 default years.
    expect(cultureIdentityByYear.get(2019)).toBe(cultureIdentityByYear.get(2016));
  });
});

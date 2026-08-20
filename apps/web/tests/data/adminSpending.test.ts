import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAdminSpendingReport,
  generateAdminSpendingFacts,
} from "../../lib/data/adminSpending/generateAdminSpendingFacts";
import { classifyAdminSpendingCategory } from "../../lib/data/adminSpending/categories";
import { extractAdminSpendingOfficialRows } from "../../lib/data/adminSpending/extractWorkbooks";
import { LEGACY_PROGRAM_JOINS } from "../../lib/data/adminSpending/legacyProgramJoins";
import { loadAdminSpendingFacts } from "../../lib/data/adminSpending/importAdminSpendingFacts";
import { ADMIN_SPENDING_YEARS } from "../../lib/data/coverage";
import { readCsvRecords } from "../../lib/data/csv";
import type { OfficialExpenditureRow } from "../../lib/data/realExpenditure/types";
import { loadSourceDocuments } from "../../lib/data/sources";

const EDUCATION_MINISTRY_LABEL_KA = "საქართველოს განათლების სამინისტრო";
const STATE_WIDE_PAYMENTS_LABEL_KA = "საერთო-სახელმწიფოებრივი მნიშვნელობის გადასახდელები";

function officialRow(
  year: number,
  code: string,
  labelKa: string,
  actualThousandGel: number,
  overrides: Partial<OfficialExpenditureRow> = {},
): OfficialExpenditureRow {
  const institutionCode = `${code.split(" ")[0]} 00`;

  return {
    year,
    sourceId: `source.mof_${year}_programmatic_fact_actual`,
    workbookPath: `docs/Raw Data/Expenditure/mof.ge/${year}.xlsx`,
    sheetName: "tavi 6",
    rowNumber: 1,
    code,
    parentCode: null,
    depth: code.split(" ").length,
    institutionCode,
    institutionLabelKa: EDUCATION_MINISTRY_LABEL_KA,
    programCode: null,
    programLabelKa: null,
    subprogramCode: code,
    subprogramLabelKa: labelKa,
    isTotal: false,
    isCodedRow: true,
    isLeafCode: true,
    labelKa,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel,
    executionPercent: null,
    ...overrides,
  };
}

function programRow(
  year: number,
  code: string,
  labelKa: string,
  actualThousandGel: number,
  overrides: Partial<OfficialExpenditureRow> = {},
): OfficialExpenditureRow {
  return officialRow(year, code, labelKa, actualThousandGel, {
    depth: 2,
    isLeafCode: false,
    programCode: code,
    programLabelKa: labelKa,
    subprogramCode: null,
    subprogramLabelKa: null,
    ...overrides,
  });
}

describe("admin spending facts", () => {
  it("extracts admin spending rows from the 2004-2025 Excel fact folder", () => {
    const rows = extractAdminSpendingOfficialRows();
    const years = Array.from(new Set(rows.map((row) => row.year))).sort((a, b) => a - b);

    expect(years).toEqual(ADMIN_SPENDING_YEARS);
  }, 30_000);

  it("resolves every extracted admin-spending source ID to a registered source document", async () => {
    const rows = extractAdminSpendingOfficialRows();
    const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const registeredSourceIds = new Set(sources.map((source) => source.sourceId));
    const unresolvedSourceIds = Array.from(
      new Set(rows.map((row) => row.sourceId).filter((sourceId) => !registeredSourceIds.has(sourceId))),
    ).sort();

    expect(unresolvedSourceIds).toEqual([]);
  }, 30_000);

  it("adds 2004 as an institution-total year without creating major programs", () => {
    const rows = extractAdminSpendingOfficialRows();
    const facts = generateAdminSpendingFacts(rows);
    const report = buildAdminSpendingReport(rows, facts);
    const facts2004 = facts.filter((fact) => fact.year === 2004);

    expect(facts2004.filter((fact) => fact.level === "admin_category").length).toBeGreaterThan(0);
    expect(facts2004.filter((fact) => fact.level === "major_program")).toHaveLength(0);
    expect(report.sourceTotalGelByYear[2004]).toBe(1_930_210_300);
    expect(report.categoryTotalGelByYear[2004]).toBe(1_930_210_400);
    expect(report.reconciliationStatusByYear[2004]).toBe("passed");
  }, 30_000);

  it("resolves every generated admin-spending fact source ID to a registered source document", async () => {
    const facts = await loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2004-2025.csv");
    const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const registeredSourceIds = new Set(sources.map((source) => source.sourceId));
    const unresolvedSourceIds = Array.from(
      new Set(
        facts
          .flatMap((fact) => fact.sourceId.split(";"))
          .filter((sourceId) => !registeredSourceIds.has(sourceId)),
      ),
    ).sort();

    expect(unresolvedSourceIds).toEqual([]);
  });

  it("rejects missing non-finite or negative amount_gel values", async () => {
    const invalidAmounts = ["", "   ", "Infinity", "-1"];
    const tempDir = await mkdtemp(path.join(tmpdir(), "admin-spending-facts-"));

    try {
      for (const [index, amountGel] of invalidAmounts.entries()) {
        const fixturePath = path.join(tempDir, `invalid-amount-${index}.csv`);
        await writeFile(
          fixturePath,
          [
            "year,item_id,parent_item_id,level,amount_gel,basis,source_id,official_code,official_label_ka,official_institution_code,official_institution_label_ka,mapping_confidence,mapping_notes",
            `2025,admin_spending.education_science_youth,,admin_category,${amountGel},actual,source.test,32,Education,32 00,Education Ministry,high,`,
          ].join("\n"),
          "utf8",
        );

        await expect(loadAdminSpendingFacts(path.relative(process.cwd(), fixturePath))).rejects.toThrow();
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("loads generated admin spending facts from CSV", async () => {
    const facts = await loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2004-2025.csv");
    const categoryFacts = facts.filter((fact) => fact.level === "admin_category");
    const majorProgramFacts = facts.filter((fact) => fact.level === "major_program");

    expect(categoryFacts.length).toBeGreaterThan(0);
    expect(majorProgramFacts.length).toBeGreaterThan(0);
    expect(majorProgramFacts.every((fact) => fact.parentItemId?.startsWith("admin_spending."))).toBe(true);
    expect(Math.max(...majorProgramFacts.map((fact) => fact.amountGel))).toBeGreaterThanOrEqual(100_000_000);
  });

  it("marks generated program identities as reviewed in the internal review CSV", async () => {
    const rows = await readCsvRecords("../../data/mappings/review/admin-spending-major-program-review-2004-2025.csv");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.reviewed_stable_item_id === row.item_id)).toBe(true);
    expect(rows.every((row) => row.review_notes.includes("Reviewed semantic identity"))).toBe(true);
  });

  it("keeps every year of a major program series once any year reaches 100M GEL", () => {
    const rows = [programRow(2024, "32 02", "ზოგადი განათლება", 99_000), programRow(2025, "32 02", "ზოგადი განათლება", 101_000)];

    const facts = generateAdminSpendingFacts(rows);
    const programFacts = facts.filter((fact) => fact.level === "major_program");

    expect(programFacts).toHaveLength(2);
    expect(programFacts.map((fact) => fact.year)).toEqual([2024, 2025]);
    expect(programFacts[0]).toMatchObject({
      parentItemId: "admin_spending.education_science_youth",
      amountGel: 99_000_000,
    });
    expect(programFacts[0].itemId).toMatch(/^admin_program\.32_02\./);
  });

  it("keeps code 32 02 continuous across program and institution renames", () => {
    const rows = [
      programRow(2017, "32 02", "general education", 99_000),
      programRow(2019, "32 02", "preschool and general education", 101_000, {
        institutionLabelKa: `${EDUCATION_MINISTRY_LABEL_KA} renamed`,
      }),
      programRow(2025, "32 02", "preschool and general education", 98_000, {
        institutionLabelKa: `${EDUCATION_MINISTRY_LABEL_KA} renamed again`,
      }),
    ];

    const programFacts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "major_program");

    expect(programFacts.map((fact) => fact.year)).toEqual([2017, 2019, 2025]);
    expect(new Set(programFacts.map((fact) => fact.itemId)).size).toBe(1);
    expect(programFacts[0].itemId).toMatch(/^admin_program\.[a-z0-9_.]+$/);
  });

  it("keeps the same program label continuous across a ministry rename", () => {
    const rows = [
      programRow(2024, "32 03", "vocational education", 101_000),
      programRow(2025, "32 03", "vocational education", 99_000, {
        institutionLabelKa: `${EDUCATION_MINISTRY_LABEL_KA} renamed`,
      }),
    ];

    const programFacts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "major_program");

    expect(programFacts).toHaveLength(2);
    expect(new Set(programFacts.map((fact) => fact.itemId)).size).toBe(1);
  });

  it("uses explicit semantic eras for reused defence and culture program codes", () => {
    const rows = [
      programRow(2017, "29 08", "defence capabilities first label", 101_000, {
        institutionLabelKa: "საქართველოს თავდაცვის სამინისტრო",
      }),
      programRow(2023, "29 08", "defence capabilities renamed", 99_000, {
        institutionLabelKa: "საქართველოს თავდაცვის სამინისტრო",
      }),
      programRow(2024, "29 08", "logistics", 102_000, {
        institutionLabelKa: "საქართველოს თავდაცვის სამინისტრო",
      }),
      programRow(2018, "33 05", "sport", 103_000, {
        institutionLabelKa: "საქართველოს კულტურისა და სპორტის სამინისტრო",
      }),
      programRow(2022, "33 05", "culture support", 104_000, {
        institutionLabelKa: "საქართველოს კულტურის სამინისტრო",
      }),
      programRow(2024, "33 05", "culture support renamed", 99_000, {
        institutionLabelKa: "საქართველოს კულტურის სამინისტრო",
      }),
      programRow(2025, "33 05", "higher arts education", 105_000, {
        institutionLabelKa: "საქართველოს კულტურის სამინისტრო",
      }),
    ];

    const programFacts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "major_program");
    const defenceFacts = programFacts.filter((fact) => fact.officialCode === "29 08");
    const cultureFacts = programFacts.filter((fact) => fact.officialCode === "33 05");

    expect(defenceFacts).toHaveLength(3);
    expect(defenceFacts[0].itemId).toBe(defenceFacts[1].itemId);
    expect(defenceFacts[2].itemId).not.toBe(defenceFacts[0].itemId);
    expect(new Set(cultureFacts.map((fact) => fact.itemId)).size).toBe(3);
    expect(cultureFacts.find((fact) => fact.year === 2024)?.itemId).toBe(
      cultureFacts.find((fact) => fact.year === 2022)?.itemId,
    );
  });

  it("generates the corrected identities for real reused program codes", () => {
    const programFacts = generateAdminSpendingFacts(extractAdminSpendingOfficialRows()).filter(
      (fact) => fact.level === "major_program",
    );
    const educationFacts = programFacts.filter(
      (fact) =>
        fact.officialCode === "32 02" &&
        fact.parentItemId === "admin_spending.education_science_youth",
    );

    // Code 32 02 ("ზოგადი განათლება") is the same general-education program across the
    // drill-down years (2012-2016, 2017-2025), so they join one identity.
    expect(educationFacts.map((fact) => fact.year)).toEqual([2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(new Set(educationFacts.map((fact) => fact.itemId)).size).toBe(1);

    const yearsByItemId = (officialCode: string) => {
      const grouped = new Map<string, number[]>();
      for (const fact of programFacts.filter((row) => row.officialCode === officialCode)) {
        grouped.set(fact.itemId, [...(grouped.get(fact.itemId) ?? []), fact.year]);
      }
      return Array.from(grouped.values()).sort((a, b) => a[0] - b[0]);
    };

    expect(yearsByItemId("29 08")).toEqual([
      [2017, 2018, 2019, 2020, 2021, 2022, 2023],
      [2024, 2025],
    ]);
    expect(yearsByItemId("33 05")).toEqual([[2018], [2022, 2023, 2024]]);
    expect(yearsByItemId("06 04")).toEqual([[2019, 2020, 2021, 2022, 2023, 2024, 2025]]);
    expect(yearsByItemId("24 17")).toEqual([[2021, 2022, 2023, 2024, 2025]]);
    expect(yearsByItemId("25 06")).toEqual([[2025]]);
    // 25 07 groups two ways: the 2019-2024 school-construction rows (succession-joined to the
    // canonical 25 06 identity) and the 2025 tourism point (the tourism chain's canonical
    // segment, which the 25 08 2023-2024 rows join).
    expect(yearsByItemId("25 07")).toEqual([[2019, 2020, 2021, 2022, 2023, 2024], [2025]]);
    expect(yearsByItemId("26 02")).toEqual([[2019, 2020, 2021, 2022, 2023, 2024, 2025]]);
    expect(yearsByItemId("29 07")).toEqual([[2024, 2025]]);
    expect(yearsByItemId("30 02")).toEqual([[2019, 2020, 2021, 2022, 2023, 2024, 2025]]);
    expect(yearsByItemId("31 06")).toEqual([[2020, 2021, 2022, 2023, 2024, 2025]]);
    expect(yearsByItemId("32 08")).toEqual([[2017]]);
    // 32 09 / 32 12 are ALSO the primary source codes of the pre-2012 education joins
    // (legacyProgramJoins.ts), so those official codes appear in the modern 32 02 / 32 04
    // series' 2008-2011 points — separate identities from the era-split modern programs.
    // 32 09's own rows group two ways: the 2018 Millennium Challenge point (the MC succession
    // chain's canonical segment) and the 2020-2021 culture-support rows (succession-joined to
    // the canonical 33 02 culture identity).
    expect(yearsByItemId("32 09")).toEqual([[2008, 2009, 2010, 2011], [2018], [2020, 2021]]);
    expect(yearsByItemId("32 11")).toEqual([[2020, 2021]]);
    expect(yearsByItemId("32 12")).toEqual([[2008, 2009, 2010, 2011], [2019]]);
    expect(yearsByItemId("33 02")).toEqual([[2025]]);
    expect(yearsByItemId("33 07")).toEqual([[2022, 2023, 2024]]);
    expect(yearsByItemId("56 11")).toEqual([[2020, 2021, 2024]]);
    expect(yearsByItemId("25 08")).toEqual([[2023, 2024]]);
    expect(programFacts.every((fact) => /^[a-z0-9_.]+$/.test(fact.itemId))).toBe(true);
  }, 30_000);

  it("shows only programs that survive into the 2017-2025 series (drops abolished programs)", () => {
    const programFacts = generateAdminSpendingFacts(extractAdminSpendingOfficialRows()).filter(
      (fact) => fact.level === "major_program",
    );
    const yearsForCode = (officialCode: string) =>
      programFacts
        .filter((fact) => fact.officialCode === officialCode)
        .map((fact) => fact.year)
        .sort((a, b) => a - b);

    // Reused codes: the 2017+ program keeps only its own years; the different 2013
    // program is split off and dropped, so no 2013 figure contaminates it.
    expect(yearsForCode("25 05")).not.toContain(2013); // 2013 IDP support vs 2017+ solid waste
    expect(yearsForCode("24 07")).not.toContain(2013); // 2013 France aid vs 2017+ entrepreneurship
    expect(yearsForCode("24 06")).not.toContain(2013); // 2013 aviation obligations vs 2017+ state property

    // 2013's state-wide payment lines (institution code 51) surface ONLY as member points of
    // their canonical succession series (57 01/57 02/57 04/57 14): no drill-down series is
    // NAMED by a rotated 51-code identity, and the 2022 State Inspector reuse of 51 01/51 02
    // stays out entirely.
    expect(programFacts.some((fact) => fact.itemId.startsWith("admin_program.51_"))).toBe(false);
    expect(programFacts.some((fact) => fact.officialCode?.startsWith("51 ") && fact.year !== 2013)).toBe(false);

    // Every surfaced program identity appears in at least one 2017-2025 year.
    const yearsByItem = new Map<string, number[]>();
    for (const fact of programFacts) {
      yearsByItem.set(fact.itemId, [...(yearsByItem.get(fact.itemId) ?? []), fact.year]);
    }
    for (const years of yearsByItem.values()) {
      expect(years.some((year) => year >= 2017)).toBe(true);
    }
  }, 30_000);

  it("excludes a program series that never reaches 100M GEL", () => {
    const rows = [programRow(2024, "32 03", "სკოლები", 80_000), programRow(2025, "32 03", "სკოლები", 99_999)];

    const programFacts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "major_program");

    expect(programFacts).toHaveLength(0);
  });

  it("never promotes a modern program identity into the drill-down via a pre-2017 amount", () => {
    // Regression guard: qualifyingIds must be measured over modern (2017+) rows only, so a large
    // backfill row (e.g. an abolished 2012 program) cannot push a below-threshold 2017-2025
    // program that happens to share its code into the major-program set. Every surfaced identity
    // must reach the 100M threshold within its own 2017-2025 rows.
    const programFacts = generateAdminSpendingFacts(extractAdminSpendingOfficialRows()).filter(
      (fact) => fact.level === "major_program",
    );
    const modernMaxByItem = new Map<string, number>();
    for (const fact of programFacts) {
      if (fact.year >= 2017) modernMaxByItem.set(fact.itemId, Math.max(modernMaxByItem.get(fact.itemId) ?? 0, fact.amountGel));
    }
    for (const fact of programFacts) {
      expect(modernMaxByItem.get(fact.itemId) ?? 0).toBeGreaterThanOrEqual(100_000_000);
    }
    // The specific codes the review caught leaking: they never reach 100M in 2017-2025, so they
    // must not appear at all.
    for (const code of ["32 05", "36 02", "37 01"]) {
      expect(programFacts.some((fact) => fact.officialCode === code)).toBe(false);
    }
  }, 30_000);

  it("de-merges Sport and Culture out of the 2018-2024 combined ministries (no series holes)", () => {
    const facts = generateAdminSpendingFacts(extractAdminSpendingOfficialRows()).filter(
      (fact) => fact.level === "admin_category",
    );
    const cat = (year: number, id: string) =>
      facts.find((f) => f.year === year && f.itemId === `admin_spending.${id}`)?.amountGel ?? 0;

    // Sport was folded into the combined Culture+Sport ministry (2018, 2022-2024) and the
    // Education mega-ministry (2019-2021); the program-level split keeps the series continuous.
    for (const year of [2018, 2019, 2020, 2021, 2022, 2023, 2024]) {
      expect(cat(year, "sport")).toBeGreaterThan(0);
    }
    // Culture was additionally hidden inside the 2019-2021 education mega-ministry.
    for (const year of [2019, 2020, 2021]) {
      expect(cat(year, "culture")).toBeGreaterThan(0);
    }
    // Pinned composition: 2021 sport = the sport-development program + sport infrastructure only.
    // Crucially it does NOT include the school-student-transport program (17.2M): "ტრანსპორტ"
    // contains the substring "სპორტ", and this value would be ~202M if that leaked in.
    expect(cat(2021, "sport")).toBe(184_730_700);
    expect(cat(2019, "sport")).toBe(131_451_700);
  }, 30_000);

  it("never routes the school-transport program to sport (ტრანსპორტ contains the substring სპორტ)", () => {
    // A leaf under the 2019-2021 Education mega-ministry (its name carries "სპორტ", so the
    // program-level split is active). "ტრანსპორტ" contains "სპორტ" as a substring, so without the
    // guard this school-student-transport program would leak into Sport instead of Education.
    const megaMinistry = "საქართველოს განათლების, მეცნიერების, კულტურისა და სპორტის სამინისტრო";
    const transportRow = officialRow(
      2021,
      "32 02 10",
      "საჯარო სკოლის მოსწავლეების ტრანსპორტით უზრუნველყოფა",
      17_200,
      { institutionLabelKa: megaMinistry, isLeafCode: true, depth: 3 },
    );
    expect(classifyAdminSpendingCategory(transportRow)).toBe("admin_spending.education_science_youth");

    // A genuine sport-development program under the same ministry DOES route to Sport.
    const sportRow = officialRow(
      2021,
      "32 11",
      "მასობრივი და მაღალი მიღწევების სპორტის განვითარება და პოპულარიზაცია",
      137_000,
      { institutionLabelKa: megaMinistry, isLeafCode: true, depth: 2 },
    );
    expect(classifyAdminSpendingCategory(sportRow)).toBe("admin_spending.sport");
  });

  it("splits recycled program codes so no pre-2017 legacy program leaks into a modern drill-down series", () => {
    const programFacts = generateAdminSpendingFacts(extractAdminSpendingOfficialRows()).filter(
      (fact) => fact.level === "major_program",
    );
    const yearsFor = (code: string) =>
      programFacts.filter((f) => f.officialCode === code).map((f) => f.year).sort((a, b) => a - b);

    // Fully-recycled codes: the entire pre-2017 program is unrelated to the 2017+ program, so no
    // pre-2017 year may appear in the (modern) drill-down series for that code.
    for (const code of ["24 06", "24 07", "25 05"]) {
      expect(yearsFor(code).filter((y) => y < 2017)).toEqual([]);
    }
    // Partially-recycled codes: only the genuinely-different early years are dropped; the years
    // that are a rename of the modern program stay in the series.
    expect(yearsFor("30 06")).not.toContain(2012); // archive digitization dropped; 2016 civil-security kept
    expect(yearsFor("36 03")).not.toContain(2012); // high-mountain municipal dropped
    expect(yearsFor("36 03")).not.toContain(2013); // general energy-infra dropped
    expect(yearsFor("36 03")).toContain(2016); // system-critical electricity transmission (rename) kept

    // 32 07's 2016 Millennium Challenge point joins the MC succession series (canonical 32 09),
    // NOT the modern 32 07 infrastructure series — the two identities must stay separate.
    const mc2016 = programFacts.find((f) => f.officialCode === "32 07" && f.year === 2016);
    const infra2017 = programFacts.find((f) => f.officialCode === "32 07" && f.year === 2017);
    expect(mc2016?.itemId).toMatch(/^admin_program\.32_09\./);
    expect(infra2017?.itemId).toMatch(/^admin_program\.32_07\./);

    // General coherence guard: a drill-down series must be ONE program. Any identity whose member
    // facts carry more than one officialLabelKa must be a KNOWN legitimate rename (same program,
    // evolved name) — every other mixed-label identity is a code-reuse leak. Update this allowlist
    // only when a real rename is added; a NEW code appearing here is a bug, not a test to relax.
    // Keyed on the identity's CANONICAL code: succession-joined series (programSuccessions.ts,
    // 2026-07-09) carry their member segments' source labels (e.g. 27 02 carries the 35 02-era
    // and pre-2012-join labels; 57 04/57 14 carry the rotated state-wide labels; 34 02 carries
    // the sport chain's labels); 09 01 / 25 02 / 28 01 joined pre-2012 organizational-line
    // labels in 2026-07-07 (legacyProgramJoins.ts); the rest are documented renames.
    const KNOWN_RENAME_CODES = new Set([
      "09 01", "24 01", "24 15", "24 17", "25 02", "25 04", "25 06", "26 01", "26 02", "27 02",
      "27 03", "27 05", "27 06", "28 01", "29 01", "29 02", "29 07", "29 08", "30 01", "30 06",
      "31 06", "32 02", "32 04", "32 07", "32 09", "34 02", "57 04", "57 14",
    ]);
    const labelsByItem = new Map<string, Set<string>>();
    for (const fact of programFacts) {
      const labels = labelsByItem.get(fact.itemId) ?? new Set<string>();
      labels.add(fact.officialLabelKa ?? "");
      labelsByItem.set(fact.itemId, labels);
    }
    // Key the allowlist on the identity's MODERN code embedded in the itemId — legacy-join
    // points carry source-year officialCodes (e.g. "35 21" for the 35 02 series), which must
    // never decide the lookup regardless of fact ordering.
    const modernCodeOf = (itemId: string) => itemId.split(".")[1].replaceAll("_", " ");
    const unexpectedMixed = [...labelsByItem.entries()]
      .filter(([itemId, labels]) => labels.size > 1 && !KNOWN_RENAME_CODES.has(modernCodeOf(itemId)))
      .map(([itemId]) => modernCodeOf(itemId));
    expect(unexpectedMixed).toEqual([]);
  }, 30_000);

  it("splits recycled program codes so no pre-2017 program leaks into a modern drill-down series", () => {
    // A drill-down series must be ONE program. When a tavi-VI code was recycled for a different
    // 2017+ program, its pre-2017 rows must be split into a separate (dropped) identity, not merged
    // into the modern series. This guards the class of bug the 2026-07-06 validation caught (6 codes
    // leaking ~196M GEL of unrelated pre-2017 spend). Codes whose pre-2017 rows are a legitimate
    // RENAME of the modern program (same program, evolved name) are allowlisted; every other
    // boundary-spanning identity must carry a pre-2017 label identical to a modern-year label.
    // Keyed on canonical codes: the 2019 super-ministry successions moved the health/social/IDP
    // and penitentiary series onto 27 02/27 03/27 06/26 02 (2026-07-09); 57 14's pre-2017 donor
    // label differs from the modern hyphenated wording only.
    const PRE2017_RENAME_ALLOWLIST = new Set([
      "09 01", "24 01", "25 02", "25 04", "26 01", "26 02", "27 02", "27 03", "27 06", "28 01",
      "29 01", "29 02", "30 01", "32 02", "32 04", "57 14",
    ]);
    const programFacts = generateAdminSpendingFacts(extractAdminSpendingOfficialRows()).filter(
      (fact) => fact.level === "major_program",
    );
    const byItem = new Map<string, { code: string; pre: Set<string>; modern: Set<string> }>();
    for (const fact of programFacts) {
      // Key the allowlist on the identity's MODERN code (embedded in the itemId): pre-2012
      // legacy-join points carry their source-year officialCode (e.g. "35 21" for the 35 02
      // series in 2008), which must not decide the allowlist lookup.
      const modernCode = fact.itemId.split(".")[1].replaceAll("_", " ");
      const entry = byItem.get(fact.itemId) ?? { code: modernCode, pre: new Set<string>(), modern: new Set<string>() };
      (fact.year <= 2016 ? entry.pre : entry.modern).add(fact.officialLabelKa ?? "");
      byItem.set(fact.itemId, entry);
    }
    const leaks: string[] = [];
    for (const entry of byItem.values()) {
      if (entry.pre.size === 0 || entry.modern.size === 0) continue; // only identities spanning 2016/2017
      if (PRE2017_RENAME_ALLOWLIST.has(entry.code)) continue;
      for (const preLabel of entry.pre) {
        if (!entry.modern.has(preLabel)) leaks.push(`${entry.code}: pre-2017 "${preLabel.slice(0, 34)}" absent from modern years`);
      }
    }
    expect(leaks).toEqual([]);
  }, 30_000);

  it("joins owner-approved pre-2012 organizational lines into modern program series (drill-down only)", () => {
    const facts = generateAdminSpendingFacts(extractAdminSpendingOfficialRows());
    const programFacts = facts.filter((fact) => fact.level === "major_program");
    const factAt = (year: number, officialCode: string) =>
      programFacts.find((fact) => fact.year === year && fact.officialCode === officialCode);

    // Roads: identical label every source year; in 2008 the program ran under the Economic
    // Development ministry as 26 11, yet joins the modern 25 02 series with source-code provenance.
    const roads2008 = factAt(2008, "26 11");
    expect(roads2008?.itemId).toBe(factAt(2016, "25 02")?.itemId);
    expect(roads2008?.amountGel).toBe(272_337_100);
    expect(roads2008?.parentItemId).toBe("admin_spending.regional_development_infrastructure");

    // Social protection 2011 is the approved three-line merge (pensions + assistance + rehab).
    const social2011 = factAt(2011, "35 09");
    expect(social2011?.itemId).toBe(factAt(2016, "35 02")?.itemId);
    expect(social2011?.amountGel).toBe(1_219_386_100);

    // General education uses the owner-chosen schools + support-units perimeter.
    const education2011 = factAt(2011, "32 09");
    expect(education2011?.itemId).toBe(factAt(2016, "32 02")?.itemId);
    expect(education2011?.amountGel).toBe(349_093_500);

    // 2006/2007 points come from the reports' detail sections (parseDetailProgramRows). The
    // 2006 roads figure is the Roads Department line, independently confirmed by the report
    // narrative's 181.2M transport total.
    const roads2006 = factAt(2006, "26 14");
    expect(roads2006?.itemId).toBe(factAt(2016, "25 02")?.itemId);
    expect(roads2006?.amountGel).toBe(181_243_000);

    // 2006 pre-reform Social Insurance Fund split (owner-approved, report-narrative figures):
    // social = fund + assistance agency - health programmes; health = the narrative's 123.5M.
    // The two carve-outs complement each other exactly.
    const social2006 = programFacts.find((fact) => fact.year === 2006 && fact.itemId === factAt(2016, "35 02")?.itemId);
    const health2006 = programFacts.find((fact) => fact.year === 2006 && fact.itemId === factAt(2016, "35 03")?.itemId);
    expect(social2006?.amountGel).toBe(562_920_800);
    expect(health2006?.amountGel).toBe(123_500_000);
    expect((social2006?.amountGel ?? 0) + (health2006?.amountGel ?? 0)).toBe(630_504_700 + 55_916_100);

    // COMPLETENESS: every join-table entry must materialize as exactly one drill-down fact
    // (matched by its unique provenance note). This fails loudly if a join's year falls outside
    // the annual-report extractor set, if a semantic era or classifier change shifts a target
    // series' identity away from the join's hardcoded default-era identity, or if the target
    // series stops qualifying — all of which would otherwise drop points silently.
    const unmaterialized = LEGACY_PROGRAM_JOINS.filter(
      (join) => programFacts.filter((fact) => fact.year === join.year && fact.mappingNotes === join.note).length !== 1,
    ).map((join) => `${join.year} -> ${join.targetCode}`);
    expect(unmaterialized).toEqual([]);

    // Exactly the 50 approved points exist before 2012 (34 for 2008-2011 + 8 per year for
    // 2006/2007) — any other pre-2012 program fact is a leak.
    expect(programFacts.filter((fact) => fact.year < 2012)).toHaveLength(50);

    // Value lock: the per-year sum of all joined points. Catches a silent re-extraction drift
    // in any component amount (most 2006/2007 amounts have no individual assertion).
    const joinedSumByYear = new Map<number, number>();
    for (const fact of programFacts.filter((row) => row.year < 2012)) {
      joinedSumByYear.set(fact.year, (joinedSumByYear.get(fact.year) ?? 0) + fact.amountGel);
    }
    expect(Object.fromEntries(joinedSumByYear)).toEqual({
      2006: 1_189_206_700,
      2007: 1_510_660_400,
      2008: 1_973_920_700,
      2009: 2_486_621_100,
      2010: 2_663_316_700,
      2011: 2_683_927_100,
    });

    // The joins are drill-down-only: category totals keep the institution-level aggregation values.
    const healthByYear = Object.fromEntries(
      facts
        .filter((fact) => fact.level === "admin_category" && fact.itemId === "admin_spending.health_social_affairs")
        .map((fact) => [fact.year, fact.amountGel]),
    );
    expect(healthByYear[2008]).toBe(1_415_151_200);
    expect(healthByYear[2011]).toBe(1_710_427_200);
  }, 30_000);

  it("routes the pre-2014 Corrections/Penitentiary ministry to justice (not other_costs)", () => {
    const categoryByYear = (year: number) => {
      const facts = generateAdminSpendingFacts(extractAdminSpendingOfficialRows()).filter(
        (fact) => fact.level === "admin_category" && fact.year === year,
      );
      return Object.fromEntries(facts.map((fact) => [fact.itemId, fact.amountGel]));
    };
    // The 2009-2013 ministry label uses "სასჯელაღსრულების" (no trailing "ა"); justice must still
    // include its ~110-160M so it is not stranded in other_costs.
    for (const year of [2009, 2011, 2013]) {
      expect(categoryByYear(year)["admin_spending.justice"]).toBeGreaterThan(150_000_000);
    }
  }, 30_000);

  it("does not merge unrelated programs that reused the same official code", () => {
    const rows = [
      officialRow(2018, "27 02", "probation system", 160_000, {
        depth: 2,
        institutionCode: "27 00",
        institutionLabelKa: "საქართველოს იუსტიციის სამინისტრო",
        programCode: "27 02",
        programLabelKa: "probation system",
        subprogramCode: null,
        subprogramLabelKa: null,
      }),
      officialRow(2025, "27 02", "social protection", 6_300_000, {
        depth: 2,
        institutionCode: "27 00",
        institutionLabelKa: "საქართველოს შრომის, ჯანმრთელობისა და სოციალური დაცვის სამინისტრო",
        programCode: "27 02",
        programLabelKa: "social protection",
        subprogramCode: null,
        subprogramLabelKa: null,
      }),
    ];

    const programFacts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "major_program");

    expect(new Set(programFacts.map((fact) => fact.itemId)).size).toBe(2);
    expect(programFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ officialLabelKa: "probation system" }),
        expect.objectContaining({ officialLabelKa: "social protection" }),
      ]),
    );
  });

  it("separates debt service from other state-wide payments", () => {
    const rows = [
      officialRow(2025, "57 01", "საგარეო სახელმწიფო ვალდებულებების მომსახურება და დაფარვა", 100_000, {
        depth: 2,
        institutionCode: "57 00",
        institutionLabelKa: STATE_WIDE_PAYMENTS_LABEL_KA,
        subprogramCode: null,
        subprogramLabelKa: null,
      }),
      officialRow(2025, "57 04 02", "მუნიციპალიტეტებისათვის გადასაცემი ტრანსფერები", 200_000, {
        institutionCode: "57 00",
        institutionLabelKa: STATE_WIDE_PAYMENTS_LABEL_KA,
      }),
    ];

    const categoryFacts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "admin_category");

    expect(categoryFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: "admin_spending.debt_service", amountGel: 100_000_000 }),
        expect.objectContaining({ itemId: "admin_spending.other_costs", amountGel: 200_000_000 }),
      ]),
    );
  });

  it("allows small GEL rounding drift when reconciling category totals to source totals", () => {
    const rows = [
      officialRow(2025, "00 00", "total", 1000, {
        depth: 0,
        isTotal: true,
        isLeafCode: false,
      }),
      officialRow(2025, "32 01", "education", 1000.5),
    ];
    const facts = generateAdminSpendingFacts(rows);
    const report = buildAdminSpendingReport(rows, facts);

    expect(report.reconciliationStatusByYear[2025]).toBe("passed");
  });
});

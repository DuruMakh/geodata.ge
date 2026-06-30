import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAdminSpendingReport,
  generateAdminSpendingFacts,
} from "../../lib/data/adminSpending/generateAdminSpendingFacts";
import { extractAdminSpendingOfficialRows } from "../../lib/data/adminSpending/extractWorkbooks";
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

    expect(educationFacts.map((fact) => fact.year)).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
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
    expect(yearsByItemId("25 07")).toEqual([[2019, 2020, 2021, 2022, 2023, 2024]]);
    expect(yearsByItemId("26 02")).toEqual([[2019, 2020, 2021, 2022, 2023, 2024, 2025]]);
    expect(yearsByItemId("29 07")).toEqual([[2024, 2025]]);
    expect(yearsByItemId("30 02")).toEqual([[2019, 2020, 2021, 2022, 2023, 2024, 2025]]);
    expect(yearsByItemId("31 06")).toEqual([[2020, 2021, 2022, 2023, 2024, 2025]]);
    expect(yearsByItemId("32 08")).toEqual([[2017]]);
    expect(yearsByItemId("32 09")).toEqual([[2018]]);
    expect(yearsByItemId("32 11")).toEqual([[2020, 2021]]);
    expect(yearsByItemId("32 12")).toEqual([[2019]]);
    expect(yearsByItemId("33 02")).toEqual([[2025]]);
    expect(yearsByItemId("33 07")).toEqual([[2022, 2023, 2024]]);
    expect(yearsByItemId("56 11")).toEqual([[2020, 2021, 2024]]);
    expect(yearsByItemId("25 08")).toEqual([[2023, 2024]]);
    expect(programFacts.every((fact) => /^[a-z0-9_.]+$/.test(fact.itemId))).toBe(true);
  }, 30_000);

  it("excludes a program series that never reaches 100M GEL", () => {
    const rows = [programRow(2024, "32 03", "სკოლები", 80_000), programRow(2025, "32 03", "სკოლები", 99_999)];

    const programFacts = generateAdminSpendingFacts(rows).filter((fact) => fact.level === "major_program");

    expect(programFacts).toHaveLength(0);
  });

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
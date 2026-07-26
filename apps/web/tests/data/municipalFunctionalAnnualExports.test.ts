import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "../..");
const outputDirectory = path.join(
  repoRoot,
  "docs/Raw Data/Municipalities/combined-annual-2015-2025",
);
const excelFacingCsvFiles = [
  "municipal-functional-annual-2015-2025.csv",
  "municipal-functional-main-annual-2015-2025.csv",
  "municipal-functional-selected-detail-annual-2015-2025.csv",
  "municipal-total-payments-annual-2015-2025.csv",
  "source-manifest.csv",
];

type MunicipalTotalPaymentRow = {
  year: string;
  municipality_code: string;
  municipality_name_ka: string;
  public_total_gel: string;
  public_total_measure: string;
  total_payments_gel: string;
  financial_asset_growth_gel: string;
  liability_decrease_gel: string;
  functional_sum_gel: string;
  reconciliation_difference_gel: string;
  financing_components_gel: string;
  financing_reconciliation_difference_gel: string;
  show_warning: string;
  warning_type: string;
};

function readMunicipalTotalPaymentRows(): MunicipalTotalPaymentRow[] {
  const csvPath = path.join(
    outputDirectory,
    "municipal-total-payments-annual-2015-2025.csv",
  );

  return parse(fs.readFileSync(csvPath, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as MunicipalTotalPaymentRow[];
}

describe("municipal functional annual exports", () => {
  it("prefixes every Excel-facing CSV with a UTF-8 BOM", () => {
    for (const fileName of excelFacingCsvFiles) {
      const bytes = fs.readFileSync(path.join(outputDirectory, fileName));

      expect(
        [...bytes.subarray(0, 3)],
        `${fileName} must start with the UTF-8 BOM bytes EF BB BF`,
      ).toEqual([0xef, 0xbb, 0xbf]);
    }
  });

  it("retains Georgian text after UTF-8 decoding", () => {
    const text = fs.readFileSync(
      path.join(
        outputDirectory,
        "municipal-functional-main-annual-2015-2025.csv",
      ),
      "utf8",
    );

    expect(text).toContain("ქალაქ თბილისის მუნიციპალიტეტი");
    expect(text).toContain("საერთო დანიშნულების სახელმწიფო მომსახურება");
  });

  it("provides a native Excel workbook for double-click opening", () => {
    const workbookPath = path.join(
      outputDirectory,
      "municipal-functional-annual-2015-2025.xlsx",
    );
    const bytes = fs.readFileSync(workbookPath);

    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("provides one public-total row for every municipality and year", () => {
    const rows = readMunicipalTotalPaymentRows();

    expect(rows).toHaveLength(69 * 11);
    expect(new Set(rows.map((row) => row.year))).toEqual(
      new Set([
        "2015",
        "2016",
        "2017",
        "2018",
        "2019",
        "2020",
        "2021",
        "2022",
        "2023",
        "2024",
        "2025",
      ]),
    );
    expect(new Set(rows.map((row) => row.municipality_code)).size).toBe(69);
    expect(
      new Set(rows.map((row) => `${row.year}:${row.municipality_code}`)).size,
    ).toBe(69 * 11);

    const missingOfficialActualRows = rows.filter(
      (row) =>
        row.public_total_measure ===
        "functional_total_fallback_missing_payment_actual",
    );
    expect(missingOfficialActualRows).toEqual([
      expect.objectContaining({
        year: "2024",
        municipality_code: "11",
        total_payments_gel: "",
        warning_type: "source_actual_missing",
      }),
    ]);

    for (const row of rows) {
      expect(row.municipality_name_ka).not.toBe("");
      expect(row.public_total_gel).not.toBe("");
      expect(Number.isFinite(Number(row.public_total_gel))).toBe(true);
      expect(Number(row.public_total_gel)).toBeGreaterThanOrEqual(0);

      if (row.year === "2015") {
        expect(row.public_total_measure).toBe(
          "portal_functional_total_fallback",
        );
        expect(row.total_payments_gel).toBe("");
      } else if (
        row.public_total_measure ===
        "functional_total_fallback_missing_payment_actual"
      ) {
        expect(row.year).toBe("2024");
        expect(row.municipality_code).toBe("11");
        expect(row.total_payments_gel).toBe("");
      } else {
        expect(row.public_total_measure).toBe("total_payments");
        expect(row.total_payments_gel).not.toBe("");
        expect(Number.isFinite(Number(row.total_payments_gel))).toBe(true);
        expect(Number(row.total_payments_gel)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("applies the agreed GEL 1 million warning rules", () => {
    const rows = readMunicipalTotalPaymentRows();

    for (const row of rows) {
      const year = Number(row.year);
      const hasOfficialTotal = row.total_payments_gel !== "";
      const totalPayments = Number(row.total_payments_gel || 0);
      const functionalSum = Number(row.functional_sum_gel);
      const financialAssetGrowth = Number(row.financial_asset_growth_gel || 0);
      const liabilityDecrease = Number(row.liability_decrease_gel || 0);
      const difference = totalPayments - functionalSum;
      const financingComponents = financialAssetGrowth + liabilityDecrease;
      const financingDifference = difference - financingComponents;
      const shouldWarn =
        hasOfficialTotal && Math.abs(difference) > 1_000_000;

      expect(row.functional_sum_gel).not.toBe("");
      expect(Number.isFinite(functionalSum)).toBe(true);

      if (hasOfficialTotal) {
        expect(Number.isFinite(totalPayments)).toBe(true);
        expect(row.reconciliation_difference_gel).not.toBe("");
        expect(Number(row.reconciliation_difference_gel)).toBeCloseTo(
          difference,
          2,
        );
        expect(row.financing_components_gel).not.toBe("");
        expect(Number(row.financing_components_gel)).toBeCloseTo(
          financingComponents,
          2,
        );
        expect(row.financing_reconciliation_difference_gel).not.toBe("");
        expect(
          Number(row.financing_reconciliation_difference_gel),
        ).toBeCloseTo(financingDifference, 2);
      }

      expect(row.show_warning).toBe(shouldWarn ? "true" : "false");

      if (!shouldWarn) {
        expect(["none", "source_actual_missing"]).toContain(
          row.warning_type,
        );
        continue;
      }

      if (row.warning_type === "source_version_difference") {
        expect(year).toBeGreaterThanOrEqual(2016);
        expect(year).toBeLessThanOrEqual(2019);
      } else if (row.warning_type === "financing_outside_functional") {
        expect(year).toBeGreaterThanOrEqual(2020);
        expect(year).toBeLessThanOrEqual(2024);
        expect(difference).toBeGreaterThan(0);
        expect(financingComponents).toBeGreaterThan(0);
        expect(Math.abs(financingDifference)).toBeLessThanOrEqual(50_000);
      } else {
        expect(row.warning_type).toBe("reconciliation_review_required");
      }
    }
  });

  it("reports component reconciliation coverage for every year", () => {
    const report = JSON.parse(
      fs.readFileSync(
        path.join(outputDirectory, "validation-report.json"),
        "utf8",
      ),
    ) as {
      totalPaymentsReconciliation: {
        byYear: Array<{
          year: number;
          officialActualRows: number;
          componentReconciliations: number;
        }>;
      };
    };

    expect(
      report.totalPaymentsReconciliation.byYear.map(
        (summary) => summary.year,
      ),
    ).toEqual([
      2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);

    for (const summary of report.totalPaymentsReconciliation.byYear) {
      const expectedRows =
        summary.year === 2015 ? 0 : summary.year === 2024 ? 68 : 69;

      expect(summary.officialActualRows).toBe(expectedRows);
      expect(summary.componentReconciliations).toBe(expectedRows);
    }
  });
});

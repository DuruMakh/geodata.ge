import { createHash } from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import type { GovernmentDebtPackageBuild } from "../../../lib/data/governmentDebt/types";

type CsvRow = Record<string, string>;

const repoRoot = path.resolve(process.cwd(), "../..");
const packageDir = path.join(
  repoRoot,
  "docs/Raw Data/Debt/government-debt-annual",
);

const expectedSourceIds = new Set([
  "mof_public_debt_bulletin_n7",
  "mof_public_debt_bulletin_n13",
  "mof_public_debt_bulletin_n19",
  "mof_public_debt_bulletin_n25",
  "mof_monthly_debt_report_2026_07",
  "mof_debt_strategy_2019_2021",
  "mof_debt_strategy_2022_2025",
  "mof_debt_strategy_2023_2026",
  "mof_debt_strategy_2025_2029",
  "mof_central_government_liabilities_control",
]);
const packageModulePath = path.join(
  repoRoot,
  "apps/web/lib/data/governmentDebt/prepareGovernmentDebtPackage.ts",
);
const generatedArtifactNames = [
  "government-debt-stock-annual-2013-2025.csv",
  "government-debt-interest-rates-annual-2015-2025.csv",
  "government-debt-service-actual-annual-2013-2025.csv",
  "government-debt-service-forecast-2026-2030.csv",
  "validation-report.json",
] as const;
const reviewWorkbookPath = path.join(packageDir, "government-debt-review.xlsx");

function readPackageCsvRows(fileName: string): CsvRow[] {
  return parse(fs.readFileSync(path.join(packageDir, fileName), "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];
}

type WorkbookFieldKind = "text" | "number" | "nullable_number" | "date";

function assertWorkbookCsvParity(
  workbook: XLSX.WorkBook,
  sheetName: string,
  csvRows: CsvRow[],
  fieldKinds: Record<string, WorkbookFieldKind>,
  extraHeaders: string[] = [],
): void {
  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    blankrows: false,
  });
  expect(matrix[0]).toEqual([...Object.keys(fieldKinds), ...extraHeaders]);

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    raw: true,
    defval: null,
  });
  const displayedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    worksheet,
    { raw: false, defval: null, dateNF: "yyyy-mm-dd" },
  );
  expect(rawRows).toHaveLength(csvRows.length);
  expect(displayedRows).toHaveLength(csvRows.length);

  for (const [rowIndex, csvRow] of csvRows.entries()) {
    for (const [field, kind] of Object.entries(fieldKinds)) {
      const rawValue = rawRows[rowIndex]![field];
      const displayedValue = displayedRows[rowIndex]![field];
      const csvValue = csvRow[field]!;
      const context = `${sheetName} row ${rowIndex + 2} ${field}`;
      if (kind === "date") {
        expect(rawValue, context).toBeInstanceOf(Date);
        expect(displayedValue, context).toBe(csvValue);
      } else if (kind === "number") {
        expect(typeof rawValue, context).toBe("number");
        expect(rawValue, context).toBe(Number(csvValue));
      } else if (kind === "nullable_number") {
        expect(rawValue, context).toBe(csvValue === "" ? null : Number(csvValue));
      } else {
        expect(rawValue, context).toBe(csvValue === "" ? null : csvValue);
      }
    }
  }
}

describe("government debt research package", () => {
  it("pins every approved official source with matching hash and size", () => {
    expect(fs.existsSync(packageDir)).toBe(true);
    if (!fs.existsSync(packageDir)) return;

    const rows = readPackageCsvRows("source-manifest.csv");
    expect(new Set(rows.map((row) => row.source_id))).toEqual(expectedSourceIds);

    for (const row of rows) {
      const sourcePath = path.join(packageDir, row.local_file);
      expect(fs.existsSync(sourcePath), row.source_id).toBe(true);
      const bytes = fs.readFileSync(sourcePath);
      expect(String(bytes.length), row.source_id).toBe(row.bytes);
      expect(
        createHash("sha256").update(bytes).digest("hex").toUpperCase(),
        row.source_id,
      ).toBe(row.sha256);
    }
  });

  it("validates the complete manifest contract and rejects field drift", async () => {
    const modulePath = path.join(
      repoRoot,
      "apps/web/lib/data/governmentDebt/sourceManifest.ts",
    );
    expect(fs.existsSync(modulePath)).toBe(true);
    if (!fs.existsSync(modulePath)) return;

    const { validateGovernmentDebtSourceManifest } = await import(
      pathToFileURL(modulePath).href
    );
    const rows = readPackageCsvRows("source-manifest.csv");
    await expect(validateGovernmentDebtSourceManifest(rows)).resolves.toBe(true);

    const changedHash = rows.map((row, index) =>
      index === 0 ? { ...row, sha256: "0".repeat(64) } : { ...row },
    );
    await expect(
      validateGovernmentDebtSourceManifest(changedHash),
    ).rejects.toThrow("Unexpected source-manifest sha256");
  });

  it("builds the complete normalized package with only documented rate gaps", async () => {
    expect(fs.existsSync(packageModulePath)).toBe(true);
    if (!fs.existsSync(packageModulePath)) return;

    const { buildGovernmentDebtPackage } = await import(
      pathToFileURL(packageModulePath).href
    );
    const result = (await buildGovernmentDebtPackage({
      write: false,
    })) as GovernmentDebtPackageBuild;

    expect(result.stockRows).toHaveLength(39);
    expect(result.actualServiceRows).toHaveLength(39);
    expect(result.interestRateRows).toHaveLength(33);
    expect(result.forecastRows).toHaveLength(15);
    expect(result.validation).toMatchObject({
      status: "complete_with_documented_rate_gaps",
      estimates_created: 0,
      source_hashes_match: true,
      normalized_values_reconcile: true,
      interestRates: {
        rowCount: 33,
        availableCount: 22,
      },
    });
    expect(result.validation.interestRates.gaps).toHaveLength(11);
    const overlapComparisons = result.validation.stock.overlapComparisons;
    expect(overlapComparisons).toHaveLength(39);
    expect(
      overlapComparisons.filter(
        (comparison) => comparison.comparison_status === "revision",
      ),
    ).toEqual([]);
    expect(
      overlapComparisons.every(
        (comparison) => comparison.difference_million_gel === 0,
      ),
    ).toBe(true);
    expect(result.validation.controlComparisons).toEqual([
      {
        year: 2019,
        canonical_total_million_gel: 19915.7,
        canonical_domestic_million_gel: 4166,
        canonical_external_million_gel: 15749.7,
        control_total_million_gel: 20569.7,
        control_domestic_million_gel: 4827,
        control_external_million_gel: 15742.7,
        source_cells: "Sheet2!AX6/AX9/AX15",
      },
      {
        year: 2022,
        canonical_total_million_gel: 28587.3,
        canonical_domestic_million_gel: 7195.3,
        canonical_external_million_gel: 21392,
        control_total_million_gel: 28493.8,
        control_domestic_million_gel: 7105.1,
        control_external_million_gel: 21388.7,
        source_cells: "Sheet2!BJ6/BJ9/BJ15",
      },
    ]);
    expect(result.validation.gdpShareChecks).toHaveLength(13);

    for (const rows of [
      result.stockRows.map(({ year, debt_scope }) => ({ year, debt_scope })),
      result.actualServiceRows.map(({ year, debt_scope }) => ({
        year,
        debt_scope,
      })),
    ]) {
      expect(
        new Set(rows.map((row) => `${row.year}:${row.debt_scope}`)).size,
      ).toBe(rows.length);
    }
    for (let year = 2013; year <= 2025; year += 1) {
      const stock = result.stockRows.filter((row) => row.year === year);
      const stockTotal = stock.find((row) => row.debt_scope === "total")!;
      const stockDomestic = stock.find(
        (row) => row.debt_scope === "domestic",
      )!;
      const stockExternal = stock.find(
        (row) => row.debt_scope === "external",
      )!;
      expect(stockTotal.amount_million_gel).toBeCloseTo(
        stockDomestic.amount_million_gel + stockExternal.amount_million_gel,
        10,
      );
      expect(stockDomestic.amount_million_gel).toBeGreaterThanOrEqual(0);
      expect(stockExternal.amount_million_gel).toBeGreaterThanOrEqual(0);

      const service = result.actualServiceRows.filter(
        (row) => row.year === year,
      );
      const serviceTotal = service.find((row) => row.debt_scope === "total")!;
      const serviceDomestic = service.find(
        (row) => row.debt_scope === "domestic",
      )!;
      const serviceExternal = service.find(
        (row) => row.debt_scope === "external",
      )!;
      expect(serviceTotal.principal_paid_million_gel).toBeCloseTo(
        serviceDomestic.principal_paid_million_gel +
          serviceExternal.principal_paid_million_gel,
        10,
      );
      expect(serviceTotal.interest_paid_million_gel).toBeCloseTo(
        serviceDomestic.interest_paid_million_gel +
          serviceExternal.interest_paid_million_gel,
        10,
      );
    }
    expect(
      result.stockRows.find(
        (row) => row.year === 2019 && row.debt_scope === "domestic",
      )?.methodology_note_id,
    ).toBe("government-domestic-2019-budget-organizations");
    expect(
      result.stockRows.find(
        (row) => row.year === 2022 && row.debt_scope === "domestic",
      )?.methodology_note_id,
    ).toBe("government-domestic-2022-general-government-soes");
    expect(
      result.validation.gdpShareChecks.find(
        (row: { year: number }) => row.year === 2019,
      ),
    ).toMatchObject({
      debt_total_million_gel: 19915.7,
      gdp_million_gel: 49726.3,
      published_share_percent: 40.1,
      comparison_status: "rounding_match",
    });
    expect(
      result.validation.gdpShareChecks.find(
        (row: { year: number }) => row.year === 2025,
      ),
    ).toMatchObject({
      debt_total_million_gel: 35934.4,
      gdp_million_gel: 104598.1,
      published_share_percent: 34.4,
      comparison_status: "rounding_match",
    });
  });

  it("commits fixed-schema UTF-8-BOM CSV artifacts", () => {
    const expectations = [
      {
        fileName: generatedArtifactNames[0],
        rowCount: 39,
        headers: [
          "year",
          "debt_scope",
          "amount_million_gel",
          "amount_gel",
          "observation_date",
          "status",
          "source_id",
          "source_table",
          "source_row_label",
          "source_unit",
          "transformation",
          "methodology_note_id",
          "last_reviewed_at",
        ],
      },
      {
        fileName: generatedArtifactNames[1],
        rowCount: 33,
        headers: [
          "year",
          "debt_scope",
          "weighted_average_interest_rate_percent",
          "observation_date",
          "portfolio_scope",
          "rate_definition",
          "availability_status",
          "source_id",
          "source_table",
          "source_row_label",
          "source_unit",
          "transformation",
          "last_reviewed_at",
        ],
      },
      {
        fileName: generatedArtifactNames[2],
        rowCount: 39,
        headers: [
          "year",
          "debt_scope",
          "principal_paid_million_gel",
          "interest_paid_million_gel",
          "principal_paid_gel",
          "interest_paid_gel",
          "status",
          "source_id",
          "source_table",
          "source_row_label",
          "source_unit",
          "transformation",
          "methodology_note_id",
          "last_reviewed_at",
        ],
      },
      {
        fileName: generatedArtifactNames[3],
        rowCount: 15,
        headers: [
          "snapshot_date",
          "payment_year",
          "debt_scope",
          "principal_source_amount",
          "interest_source_amount",
          "source_currency",
          "published_exchange_rate",
          "published_exchange_rate_definition",
          "source_exchange_rate_to_gel",
          "principal_million_gel",
          "interest_million_gel",
          "total_service_million_gel",
          "status",
          "coverage_note",
          "source_id",
          "source_table",
          "source_row_label",
          "transformation",
          "last_reviewed_at",
        ],
      },
    ] as const;

    for (const expectation of expectations) {
      const bytes = fs.readFileSync(path.join(packageDir, expectation.fileName));
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(bytes.at(-1)).toBe(0x0a);
      const rows = readPackageCsvRows(expectation.fileName);
      expect(rows).toHaveLength(expectation.rowCount);
      expect(Object.keys(rows[0] ?? {})).toEqual(expectation.headers);
    }
    expect(Object.keys(readPackageCsvRows(generatedArtifactNames[0])[0]!)).not.toContain(
      "gdp_million_gel",
    );
  });

  it("keeps the review workbook in exact semantic parity with the package", () => {
    expect(fs.existsSync(reviewWorkbookPath)).toBe(true);
    if (!fs.existsSync(reviewWorkbookPath)) return;

    const workbook = XLSX.read(fs.readFileSync(reviewWorkbookPath), {
      type: "buffer",
      cellDates: true,
    });
    expect(workbook.SheetNames).toEqual([
      "Read me",
      "Stock",
      "Interest rates",
      "Actual service",
      "Forecast service",
      "2019-2022 controls",
      "Sources",
    ]);

    const stockRows = readPackageCsvRows(generatedArtifactNames[0]);
    assertWorkbookCsvParity(
      workbook,
      "Stock",
      stockRows,
      {
        year: "number",
        debt_scope: "text",
        amount_million_gel: "number",
        amount_gel: "number",
        observation_date: "date",
        status: "text",
        source_id: "text",
        source_table: "text",
        source_row_label: "text",
        source_unit: "text",
        transformation: "text",
        methodology_note_id: "text",
        last_reviewed_at: "date",
      },
      ["GDP denominator (million GEL)", "Debt/GDP (%)"],
    );
    assertWorkbookCsvParity(
      workbook,
      "Interest rates",
      readPackageCsvRows(generatedArtifactNames[1]),
      {
        year: "number",
        debt_scope: "text",
        weighted_average_interest_rate_percent: "nullable_number",
        observation_date: "date",
        portfolio_scope: "text",
        rate_definition: "text",
        availability_status: "text",
        source_id: "text",
        source_table: "text",
        source_row_label: "text",
        source_unit: "text",
        transformation: "text",
        last_reviewed_at: "date",
      },
    );
    assertWorkbookCsvParity(
      workbook,
      "Actual service",
      readPackageCsvRows(generatedArtifactNames[2]),
      {
        year: "number",
        debt_scope: "text",
        principal_paid_million_gel: "number",
        interest_paid_million_gel: "number",
        principal_paid_gel: "number",
        interest_paid_gel: "number",
        status: "text",
        source_id: "text",
        source_table: "text",
        source_row_label: "text",
        source_unit: "text",
        transformation: "text",
        methodology_note_id: "text",
        last_reviewed_at: "date",
      },
    );
    assertWorkbookCsvParity(
      workbook,
      "Forecast service",
      readPackageCsvRows(generatedArtifactNames[3]),
      {
        snapshot_date: "date",
        payment_year: "number",
        debt_scope: "text",
        principal_source_amount: "number",
        interest_source_amount: "number",
        source_currency: "text",
        published_exchange_rate: "number",
        published_exchange_rate_definition: "text",
        source_exchange_rate_to_gel: "number",
        principal_million_gel: "number",
        interest_million_gel: "number",
        total_service_million_gel: "number",
        status: "text",
        coverage_note: "text",
        source_id: "text",
        source_table: "text",
        source_row_label: "text",
        transformation: "text",
        last_reviewed_at: "date",
      },
    );

    const gdpRows = readPackageCsvRows(
      "../../../../data/imports/national-gdp-annual-1996-2025.csv",
    );
    const gdpByYear = new Map(
      gdpRows.map((row) => [
        Number(row.year),
        Number(row.gdp_current_prices_million_gel),
      ]),
    );
    const stockSheet = workbook.Sheets.Stock;
    for (const [index, stockRow] of stockRows.entries()) {
      const rowNumber = index + 2;
      expect(stockSheet[`N${rowNumber}`]?.v).toBe(
        gdpByYear.get(Number(stockRow.year)),
      );
      expect(stockSheet[`O${rowNumber}`]?.f).toBe(
        `IFERROR(C${rowNumber}/N${rowNumber},"")`,
      );
      expect(stockSheet[`O${rowNumber}`]?.v).toBeCloseTo(
        Number(stockRow.amount_million_gel) /
          gdpByYear.get(Number(stockRow.year))!,
        12,
      );
    }

    const controlRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets["2019-2022 controls"],
      { raw: true },
    );
    expect(controlRows).toEqual([
      {
        year: 2019,
        debt_scope: "total",
        canonical_government_debt_million_gel: 19915.7,
        control_value_million_gel: 20569.7,
        control_cell: "Sheet2!AX6",
      },
      {
        year: 2019,
        debt_scope: "domestic",
        canonical_government_debt_million_gel: 4166,
        control_value_million_gel: 4827,
        control_cell: "Sheet2!AX9",
      },
      {
        year: 2019,
        debt_scope: "external",
        canonical_government_debt_million_gel: 15749.7,
        control_value_million_gel: 15742.7,
        control_cell: "Sheet2!AX15",
      },
      {
        year: 2022,
        debt_scope: "total",
        canonical_government_debt_million_gel: 28587.3,
        control_value_million_gel: 28493.8,
        control_cell: "Sheet2!BJ6",
      },
      {
        year: 2022,
        debt_scope: "domestic",
        canonical_government_debt_million_gel: 7195.3,
        control_value_million_gel: 7105.1,
        control_cell: "Sheet2!BJ9",
      },
      {
        year: 2022,
        debt_scope: "external",
        canonical_government_debt_million_gel: 21392,
        control_value_million_gel: 21388.7,
        control_cell: "Sheet2!BJ15",
      },
    ]);

    const sourceMatrix = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets.Sources,
      { header: 1, raw: false, blankrows: false },
    );
    expect(sourceMatrix.flat()).toEqual(
      expect.arrayContaining([
        "mof_public_debt_bulletin_n25",
        "government-domestic-2019-budget-organizations",
        "government-domestic-2022-general-government-soes",
      ]),
    );
    const manifestRows = readPackageCsvRows("source-manifest.csv");
    manifestRows.forEach((row, index) => {
      const rowNumber = index + 2;
      expect(workbook.Sheets.Sources[`E${rowNumber}`]?.v).toBe(
        row.document_date,
      );
      expect(workbook.Sheets.Sources[`F${rowNumber}`]?.v).toBe(
        row.source_page_url,
      );
      expect(workbook.Sheets.Sources[`G${rowNumber}`]?.v).toBe(
        row.retrieved_file_url,
      );
    });
  });

  it("documents and wires the deterministic package workflow", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "apps/web/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts["data:prepare-government-debt"]).toBe(
      "tsx scripts/prepare-government-debt.ts --write",
    );
    expect(packageJson.scripts["data:check-government-debt"]).toBe(
      "tsx scripts/prepare-government-debt.ts --check",
    );
    expect(packageJson.scripts["data:validate"]).toContain(
      "npm run data:check-government-debt",
    );

    const readmePath = path.join(packageDir, "README.md");
    const methodologyPath = path.join(
      repoRoot,
      "docs/data-methodology/government-debt-annual.md",
    );
    expect(fs.existsSync(readmePath)).toBe(true);
    expect(fs.existsSync(methodologyPath)).toBe(true);
    if (!fs.existsSync(readmePath) || !fs.existsSync(methodologyPath)) return;

    const combined = `${fs.readFileSync(readmePath, "utf8")}\n${fs.readFileSync(methodologyPath, "utf8")}`;
    for (const requiredText of [
      "Stock: 2013-2025",
      "Actual service: 2013-2025",
      "Interest rates: 2015-2025",
      "Forecast service: 2026-2030",
      "2025-12-31",
      "11 documented gaps",
      "39 stock overlap comparisons",
      "2019",
      "2022",
      "existing national GDP dataset",
      "No estimates were created. The package changes no served Fiscal.ge data.",
      "No UI, route, database, or public-data import was added.",
    ]) {
      expect(combined, requiredText).toContain(requiredText);
    }

    const vitestConfig = fs.readFileSync(
      path.join(repoRoot, "apps/web/vitest.config.ts"),
      "utf8",
    );
    expect(vitestConfig).toContain(
      '"tests/data/governmentDebt/governmentDebtPackage.test.ts"',
    );
  });

  it("validates committed artifacts in check mode without writing", async () => {
    const artifactPaths = generatedArtifactNames.map((fileName) =>
      path.join(packageDir, fileName),
    );
    const before = artifactPaths.map((filePath) => fs.readFileSync(filePath));
    const { buildGovernmentDebtPackage } = await import(
      pathToFileURL(packageModulePath).href
    );

    await expect(
      buildGovernmentDebtPackage({ write: false }),
    ).resolves.toBeDefined();
    artifactPaths.forEach((filePath, index) => {
      expect(fs.readFileSync(filePath).equals(before[index]!)).toBe(true);
    });
  });

  it("rejects a stale generated artifact in check mode", async () => {
    const staleArtifactPath = path.join(packageDir, "validation-report.json");
    type ReadFileFn = (...args: unknown[]) => Promise<unknown>;
    const fsPromisesUntyped = fsPromises as unknown as { readFile: ReadFileFn };
    const originalReadFile = fsPromisesUntyped.readFile;
    const spy = vi
      .spyOn(fsPromisesUntyped, "readFile")
      .mockImplementation(async (...args: unknown[]) => {
        const [target] = args;
        if (typeof target === "string" && target === staleArtifactPath) {
          return "TAMPERED_FOR_TEST\n";
        }
        return originalReadFile(...args);
      });

    try {
      const { buildGovernmentDebtPackage } = await import(
        pathToFileURL(packageModulePath).href
      );
      await expect(
        buildGovernmentDebtPackage({ write: false }),
      ).rejects.toThrow(
        `Generated government debt artifact is stale: ${path.relative(repoRoot, staleArtifactPath)}`,
      );
    } finally {
      spy.mockRestore();
    }
  });
});

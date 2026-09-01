import { createHash } from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import { describe, expect, it, vi } from "vitest";
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

function readPackageCsvRows(fileName: string): CsvRow[] {
  return parse(fs.readFileSync(path.join(packageDir, fileName), "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];
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

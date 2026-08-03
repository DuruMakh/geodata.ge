import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

const repoRoot = path.resolve(process.cwd(), "../..");
const packageDir = path.join(
  repoRoot,
  "docs/Raw Data/Municipalities/geostat-population-regional-gdp",
);
const POPULATION_YEARS = Array.from({ length: 11 }, (_, index) => 2015 + index);
const EXCLUDED_CODES = new Set(["05", "42", "43", "46", "64"]);
const modulePath = path.join(
  process.cwd(),
  "lib/data/municipalIndicators/prepareGeostatPackage.ts",
);
const excelCsvFiles = [
  "source-manifest.csv",
  "geography-map.csv",
  "municipal-population-annual-2015-2025.csv",
  "regional-gdp-annual-2005-2025-available-years.csv",
];

async function buildPackage(write: boolean) {
  expect(fs.existsSync(modulePath)).toBe(true);
  const { buildGeostatPackage } = await import(
    "../../../lib/data/municipalIndicators/prepareGeostatPackage"
  );

  return buildGeostatPackage({ write });
}

function readCsvRows(fileName: string): Record<string, string>[] {
  return parse(fs.readFileSync(path.join(packageDir, fileName), "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
}

function sheetDataRowCount(workbook: XLSX.WorkBook, sheetName: string): number {
  return (
    XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
    }).length - 1
  );
}

describe("Geostat population and regional GDP research package", () => {
  it("builds a complete 64 x 11 municipal population panel", async () => {
    expect(fs.existsSync(modulePath)).toBe(true);
    const { buildGeostatPackage } = await import(
      "../../../lib/data/municipalIndicators/prepareGeostatPackage"
    );
    const result = await buildGeostatPackage({ write: false });
    const keys = result.populationRows.map(
      (row) => `${row.year}:${row.municipality_code}`,
    );

    expect(result.populationRows).toHaveLength(64 * 11);
    expect(new Set(result.populationRows.map((row) => row.year))).toEqual(
      new Set(POPULATION_YEARS),
    );
    expect(new Set(keys).size).toBe(64 * 11);
    expect(
      result.populationRows.filter((row) =>
        EXCLUDED_CODES.has(row.municipality_code),
      ),
    ).toEqual([]);
    expect(
      result.populationRows.every((row) =>
        row.population_thousand === null
          ? row.population_persons === null
          : row.population_thousand >= 0 &&
            row.population_persons === row.population_thousand * 1000,
      ),
    ).toBe(true);
  });

  it("emits every available regional GDP year within 2005-2025", async () => {
    const result = await buildPackage(false);
    const years = [...new Set(result.regionalGdpRows.map((row) => row.year))].sort(
      (left, right) => left - right,
    );

    expect(years).toEqual(result.validation.regionalGdp.observedYears);
    expect(years.length).toBeGreaterThan(0);
    expect(years[0]).toBeGreaterThanOrEqual(2005);
    expect(years.at(-1)).toBeLessThanOrEqual(2025);
    expect(result.regionalGdpRows).toHaveLength(years.length * 11);

    for (const year of years) {
      expect(
        new Set(
          result.regionalGdpRows
            .filter((row) => row.year === year)
            .map((row) => row.region_id),
        ).size,
      ).toBe(11);
    }
  });

  it("writes Excel-readable artifacts with source-backed validation", async () => {
    await buildPackage(true);

    for (const fileName of excelCsvFiles) {
      const bytes = fs.readFileSync(path.join(packageDir, fileName));

      expect(
        [...bytes.subarray(0, 3)],
        `${fileName} must start with the UTF-8 BOM bytes EF BB BF`,
      ).toEqual([0xef, 0xbb, 0xbf]);
    }

    const report = JSON.parse(
      fs.readFileSync(path.join(packageDir, "validation-report.json"), "utf8"),
    );
    expect(report.status).toMatch(/^complete(_with_official_gaps)?$/);
    expect(report.estimates_created).toBe(0);
    expect(report.excluded_codes_present).toEqual([]);
    expect(report.source_hashes_match).toBe(true);
    expect(report.normalized_values_reconcile).toBe(true);
  });

  it("matches XLSX review-sheet row counts to normalized CSV artifacts", async () => {
    await buildPackage(true);
    const workbook = XLSX.readFile(
      path.join(packageDir, "municipal-population-and-regional-gdp.xlsx"),
    );

    expect(workbook.SheetNames).toEqual([
      "Read me",
      "Population",
      "Regional GDP",
      "Geography map",
    ]);
    expect(sheetDataRowCount(workbook, "Population")).toBe(
      readCsvRows("municipal-population-annual-2015-2025.csv").length,
    );
    expect(sheetDataRowCount(workbook, "Regional GDP")).toBe(
      readCsvRows("regional-gdp-annual-2005-2025-available-years.csv").length,
    );
    expect(sheetDataRowCount(workbook, "Geography map")).toBe(
      readCsvRows("geography-map.csv").length,
    );
  });
});

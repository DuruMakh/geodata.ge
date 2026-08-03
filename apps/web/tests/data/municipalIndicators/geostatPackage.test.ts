import { createHash } from "node:crypto";
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
const officialDir = path.join(packageDir, "official");
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

type CsvRow = Record<string, string>;

type GeographyRow = CsvRow & {
  geography_level: "municipality" | "region";
  geodata_id: string;
  source_label: string;
  region_id: string;
};

type SourceWorkbook = {
  matrix: unknown[][];
  worksheet: XLSX.WorkSheet;
  sheetName: string;
};

async function buildPackage(write: boolean) {
  expect(fs.existsSync(modulePath)).toBe(true);
  const { buildGeostatPackage } = await import(
    "../../../lib/data/municipalIndicators/prepareGeostatPackage"
  );

  return buildGeostatPackage({ write });
}

function readCsvRows(filePath: string): CsvRow[] {
  return parse(fs.readFileSync(filePath, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];
}

function readPackageCsvRows(fileName: string): CsvRow[] {
  return readCsvRows(path.join(packageDir, fileName));
}

function readCanonicalMunicipalities(): CsvRow[] {
  return readCsvRows(path.join(repoRoot, "data/imports/municipalities.csv"));
}

function readCanonicalRegionIds(): string[] {
  return (
    JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "data/taxonomy/municipal-regions.json"),
        "utf8",
      ),
    ) as Array<{ id: string }>
  ).map((region) => region.id);
}

function readGeographyRows(): GeographyRow[] {
  return readPackageCsvRows("geography-map.csv") as GeographyRow[];
}

function readWorkbook(fileName: string, sheetName: string): SourceWorkbook {
  const workbook = XLSX.readFile(path.join(officialDir, fileName), {
    cellDates: false,
  });

  expect(workbook.SheetNames).toContain(sheetName);

  return {
    matrix: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      blankrows: false,
      defval: null,
    }) as unknown[][],
    worksheet: workbook.Sheets[sheetName],
    sheetName,
  };
}

function workbookNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const normalized = String(value).replace(/\s/g, "").replace(/,/g, "");
  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function outputNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  expect(Number.isFinite(number)).toBe(true);
  return number;
}

function sourceGdpMillionGel(value: unknown, sourceUnit: string): number | null {
  const number = workbookNumber(value);

  if (number === null) {
    return null;
  }

  expect(sourceUnit).toBe("mil. GEL");
  return number;
}

function populationSource(): SourceWorkbook {
  const source = readWorkbook(
    "01-population-by-self-governed-unit.xlsx",
    "1",
  );

  expect(String(source.matrix[0][0])).toContain(
    "Population as of 1 January by regions and self-governed units",
  );
  expect(source.matrix[1][0]).toBe("(thousands)");

  return source;
}

function regionalGdpSource(): SourceWorkbook {
  const source = readWorkbook("regional-GDP-ENG.xlsx", "regional GDP");
  const title = String(source.matrix[0][0]);

  expect(title).toMatch(/distribution of gross domestic product by regions/i);
  expect(title).toMatch(/at current prices, mil\. GEL/i);

  return source;
}

function sourceYearColumns(header: unknown[], allowedYears: number[]): Map<number, number> {
  const columns = new Map<number, number>();

  header.forEach((value, index) => {
    const year = Number(value);
    if (allowedYears.includes(year)) {
      columns.set(year, index);
    }
  });

  return columns;
}

function sourceRowsByLabel(matrix: unknown[][]): Map<string, unknown[]> {
  return new Map(
    matrix.flatMap((row) =>
      typeof row[0] === "string" ? [[row[0], row] as const] : [],
    ),
  );
}

function sourceWorksheetRowNumber(
  worksheet: XLSX.WorkSheet,
  sourceLabel: string,
): number {
  const sheetRange = worksheet["!ref"];
  expect(sheetRange).toBeDefined();
  const range = XLSX.utils.decode_range(sheetRange ?? "A1:A1");

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const address = XLSX.utils.encode_cell({ r: rowIndex, c: range.s.c });
    if (worksheet[address]?.w === sourceLabel || worksheet[address]?.v === sourceLabel) {
      return rowIndex + 1;
    }
  }

  throw new Error(`Missing source worksheet row: ${sourceLabel}`);
}

function municipalityMappings(geographyRows: GeographyRow[]): GeographyRow[] {
  return geographyRows.filter((row) => row.geography_level === "municipality");
}

function regionMappings(geographyRows: GeographyRow[]): GeographyRow[] {
  return geographyRows.filter((row) => row.geography_level === "region");
}

function assertCanonicalGeography(geographyRows: GeographyRow[]) {
  const canonicalMunicipalities = readCanonicalMunicipalities();
  const canonicalMunicipalityCodes = canonicalMunicipalities.map(
    (row) => row.municipality_code,
  );
  const canonicalRegions = readCanonicalRegionIds();
  const municipalities = municipalityMappings(geographyRows);
  const regions = regionMappings(geographyRows);

  expect(canonicalMunicipalityCodes).toHaveLength(64);
  expect(new Set(canonicalMunicipalityCodes)).toEqual(
    new Set(municipalities.map((row) => row.geodata_id)),
  );
  expect(new Set(canonicalRegions)).toEqual(
    new Set(regions.map((row) => row.geodata_id)),
  );
  expect(new Set(municipalities.map((row) => row.source_label)).size).toBe(
    municipalities.length,
  );
  expect(new Set(regions.map((row) => row.source_label)).size).toBe(
    regions.length,
  );
  expect(
    municipalities.filter((row) => EXCLUDED_CODES.has(row.geodata_id)),
  ).toEqual([]);
}

function assertPopulationRowsReconcile(
  rows: Array<Record<string, unknown>>,
  geographyRows: GeographyRow[],
) {
  const source = populationSource();
  const sourceRows = sourceRowsByLabel(source.matrix);
  const yearColumns = sourceYearColumns(source.matrix[2], POPULATION_YEARS);
  const canonicalMunicipalities = new Map(
    readCanonicalMunicipalities().map((row) => [row.municipality_code, row]),
  );
  const mappings = new Map(
    municipalityMappings(geographyRows).map((row) => [row.geodata_id, row]),
  );

  for (const row of rows) {
    const code = String(row.municipality_code);
    const year = Number(row.year);
    const canonicalMunicipality = canonicalMunicipalities.get(code);
    const mapping = mappings.get(code);

    expect(canonicalMunicipality).toBeDefined();
    expect(mapping).toBeDefined();
    expect(row.region_id).toBe(canonicalMunicipality?.region_id);
    expect(row.source_id).toBe("geostat_population_self_governed_units");
    expect(row.source_sheet).toBe(source.sheetName);
    expect(row.source_unit).toBe("(thousands)");

    const sourceRow = sourceRows.get(mapping?.source_label ?? "");
    const yearColumn = yearColumns.get(year) ?? -1;
    const sourceValue = workbookNumber(sourceRow?.[yearColumn]);
    const populationThousand = outputNumber(row.population_thousand);
    const populationPersons = outputNumber(row.population_persons);
    const rowNumber = sourceWorksheetRowNumber(
      source.worksheet,
      mapping?.source_label ?? "",
    );
    const sourceCell = XLSX.utils.encode_cell({ r: rowNumber - 1, c: yearColumn });

    expect(populationThousand).toBe(sourceValue);
    expect(populationPersons).toBe(
      sourceValue === null ? null : sourceValue * 1000,
    );
    expect(row.transformation).toBe(
      `Source sheet "1"; source row ${rowNumber}; year ${year} column ${XLSX.utils.encode_col(yearColumn)} (cell ${sourceCell}); retained published thousands; persons = thousands * 1000; no estimates.`,
    );
  }
}

function assertRegionalGdpRowsReconcile(
  rows: Array<Record<string, unknown>>,
  geographyRows: GeographyRow[],
) {
  const source = regionalGdpSource();
  const sourceRows = sourceRowsByLabel(source.matrix);
  const observedYears = source.matrix[1]
    .map((value) => Number(value))
    .filter((year) => year >= 2005 && year <= 2025);
  const yearColumns = sourceYearColumns(source.matrix[1], observedYears);
  const mappings = new Map(
    regionMappings(geographyRows).map((row) => [row.geodata_id, row]),
  );

  for (const row of rows) {
    const mapping = mappings.get(String(row.region_id));
    const sourceRow = sourceRows.get(mapping?.source_label ?? "");
    const year = Number(row.year);
    const yearColumn = yearColumns.get(year) ?? -1;
    const sourceValue = sourceGdpMillionGel(sourceRow?.[yearColumn], "mil. GEL");
    const rowNumber = sourceWorksheetRowNumber(
      source.worksheet,
      mapping?.source_label ?? "",
    );
    const sourceCell = XLSX.utils.encode_cell({ r: rowNumber - 1, c: yearColumn });

    expect(mapping).toBeDefined();
    expect(row.source_region_label).toBe(mapping?.source_label);
    expect(row.source_id).toBe("geostat_regional_gdp_current_prices");
    expect(row.source_sheet).toBe(source.sheetName);
    expect(row.source_unit).toBe("mil. GEL");
    expect(row.status).toBe("final_as_published");
    expect(outputNumber(row.gdp_current_prices_million_gel)).toBe(sourceValue);
    expect(row.transformation).toBe(
      `Source sheet "regional GDP"; source row ${rowNumber}; year ${year} column ${XLSX.utils.encode_col(yearColumn)} (cell ${sourceCell}); source already mil. GEL; no scale conversion; no estimates.`,
    );
  }
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
  it("rejects altered, missing, or duplicate normalized reconciliation entries", async () => {
    const { reconciliationEntriesMatch } = await import(
      "../../../lib/data/municipalIndicators/prepareGeostatPackage"
    );
    const expected = [
      { key: "2015:04", values: ["04", 1115.7, 1115700] },
      { key: "2015:06", values: ["06", 155.2, 155200] },
    ];

    expect(reconciliationEntriesMatch(expected, expected)).toBe(true);
    expect(
      reconciliationEntriesMatch(
        [
          { key: "2015:04", values: ["04", 1115.8, 1115800] },
          expected[1],
        ],
        expected,
      ),
    ).toBe(false);
    expect(reconciliationEntriesMatch([expected[0]], expected)).toBe(false);
    expect(
      reconciliationEntriesMatch([expected[0], expected[0]], expected),
    ).toBe(false);
  });

  it("builds a complete 64 x 11 municipal population panel", async () => {
    expect(fs.existsSync(modulePath)).toBe(true);
    const { buildGeostatPackage } = await import(
      "../../../lib/data/municipalIndicators/prepareGeostatPackage"
    );
    const result = await buildGeostatPackage({ write: false });
    const geographyRows = readGeographyRows();
    const keys = result.populationRows.map(
      (row) => `${row.year}:${row.municipality_code}`,
    );

    assertCanonicalGeography(geographyRows);
    expect(result.populationRows).toHaveLength(64 * 11);
    expect(result.populationRows[0]?.transformation).toContain(
      "source row 6; year 2015 column W (cell W6)",
    );
    expect(new Set(result.populationRows.map((row) => row.year))).toEqual(
      new Set(POPULATION_YEARS),
    );
    expect(new Set(keys).size).toBe(64 * 11);
    expect(new Set(result.populationRows.map((row) => row.municipality_code))).toEqual(
      new Set(readCanonicalMunicipalities().map((row) => row.municipality_code)),
    );
    expect(
      result.populationRows.filter((row) =>
        EXCLUDED_CODES.has(row.municipality_code),
      ),
    ).toEqual([]);
    assertPopulationRowsReconcile(result.populationRows, geographyRows);
  });

  it("emits every available total current-price regional GDP year", async () => {
    const result = await buildPackage(false);
    const geographyRows = readGeographyRows();
    const source = regionalGdpSource();
    const sourceYears = source.matrix[1]
      .map((value) => Number(value))
      .filter((year) => year >= 2005 && year <= 2025);
    const years = [...new Set(result.regionalGdpRows.map((row) => row.year))].sort(
      (left, right) => left - right,
    );
    const canonicalRegionIds = new Set(readCanonicalRegionIds());

    assertCanonicalGeography(geographyRows);
    expect(years).toEqual(sourceYears);
    expect(result.regionalGdpRows).toHaveLength(sourceYears.length * 11);

    for (const year of years) {
      expect(
        new Set(
          result.regionalGdpRows
            .filter((row) => row.year === year)
            .map((row) => row.region_id),
        ),
      ).toEqual(canonicalRegionIds);
    }

    assertRegionalGdpRowsReconcile(result.regionalGdpRows, geographyRows);
  });

  it("writes Excel-readable artifacts with independently verified provenance", async () => {
    await buildPackage(true);

    for (const fileName of excelCsvFiles) {
      const bytes = fs.readFileSync(path.join(packageDir, fileName));

      expect(
        [...bytes.subarray(0, 3)],
        `${fileName} must start with the UTF-8 BOM bytes EF BB BF`,
      ).toEqual([0xef, 0xbb, 0xbf]);
    }

    const manifestRows = readPackageCsvRows("source-manifest.csv");
    const expectedSources = new Map([
      [
        "geostat_population_self_governed_units",
        "official/01-population-by-self-governed-unit.xlsx",
      ],
      ["geostat_regional_gdp_current_prices", "official/regional-GDP-ENG.xlsx"],
    ]);

    expect(manifestRows).toHaveLength(expectedSources.size);
    for (const [sourceId, localFile] of expectedSources) {
      const manifest = manifestRows.find((row) => row.source_id === sourceId);
      const sourceBytes = fs.readFileSync(path.join(packageDir, localFile));
      const sourceHash = createHash("sha256")
        .update(sourceBytes)
        .digest("hex")
        .toUpperCase();

      expect(manifest).toMatchObject({ source_id: sourceId, local_file: localFile });
      expect(manifest?.sha256).toBe(sourceHash);
      expect(manifest?.bytes).toBe(String(sourceBytes.length));
    }

    const geographyRows = readGeographyRows();
    assertCanonicalGeography(geographyRows);
    assertPopulationRowsReconcile(
      readPackageCsvRows("municipal-population-annual-2015-2025.csv"),
      geographyRows,
    );
    assertRegionalGdpRowsReconcile(
      readPackageCsvRows("regional-gdp-annual-2005-2025-available-years.csv"),
      geographyRows,
    );

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
      readPackageCsvRows("municipal-population-annual-2015-2025.csv").length,
    );
    expect(sheetDataRowCount(workbook, "Regional GDP")).toBe(
      readPackageCsvRows("regional-gdp-annual-2005-2025-available-years.csv")
        .length,
    );
    expect(sheetDataRowCount(workbook, "Geography map")).toBe(
      readPackageCsvRows("geography-map.csv").length,
    );
    const readMeRows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets["Read me"],
      { header: 1, raw: false, blankrows: false },
    );
    expect(readMeRows.some((row) => row[0] === "Retrieval/review date")).toBe(
      true,
    );
  });
});

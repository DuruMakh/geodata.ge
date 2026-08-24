import { createHash } from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { describe, expect, it, vi } from "vitest";
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
  "population-component-map.csv",
  "municipal-population-annual-2015-2025.csv",
  "regional-gdp-annual-2005-2025-available-years.csv",
];

const COMPONENT_MAP_HEADERS = [
  "geodata_id",
  "component_source_label",
  "start_year",
  "end_year",
  "operation",
  "mapping_note",
];

const COMPONENT_RULES = [
  ["15", "C. Telavi*", "2015", "2017", "sum", "Add the separately published Telavi city row to Telavi Municipality for 2015-2017."],
  ["33", "C. Zugdidi*", "2015", "2017", "sum", "Add the separately published Zugdidi city row to Zugdidi Municipality for 2015-2017."],
  ["41", "C. Gori*", "2015", "2017", "sum", "Add the separately published Gori city row to Gori Municipality for 2015-2017."],
  ["56", "C. Ozurgeti*", "2015", "2017", "sum", "Add the separately published Ozurgeti city row to Ozurgeti Municipality for 2015-2017."],
  ["62", "C. Akhaltsikhe*", "2015", "2017", "sum", "Add the separately published Akhaltsikhe city row to Akhaltsikhe Municipality for 2015-2017."],
  ["67", "C. Mtskheta*", "2015", "2017", "sum", "Add the separately published Mtskheta city row to Mtskheta Municipality for 2015-2017."],
  ["69", "C. Ambrolauri*", "2015", "2017", "sum", "Add the separately published Ambrolauri city row to Ambrolauri Municipality for 2015-2017."],
] as const;

const MANIFEST_HEADERS = [
  "source_id",
  "dataset_title",
  "publisher",
  "role",
  "source_page_url",
  "retrieved_file_url",
  "retrieved_at",
  "local_file",
  "sha256",
  "bytes",
  "source_year_min",
  "source_year_max",
  "normalized_year_min",
  "normalized_year_max",
  "notes",
];

const APPROVED_MANIFEST_ROWS: CsvRow[] = [
  {
    source_id: "geostat_population_self_governed_units",
    dataset_title: "Population as of 1 January by regions and self-governed units",
    publisher: "National Statistics Office of Georgia (Geostat)",
    role: "municipal population",
    source_page_url: "https://www.geostat.ge/en/modules/categories/41/population",
    retrieved_file_url: "https://www.geostat.ge/media/78356/01-population-by-self-governed-unit.xlsx",
    retrieved_at: "2026-08-03",
    local_file: "official/01-population-by-self-governed-unit.xlsx",
    sha256: "8BD7A1B56E756E8D6BC92192095795B204B23FD18274AAFF39B78C0B0A487A57",
    bytes: "34994",
    source_year_min: "1994",
    source_year_max: "2026",
    normalized_year_min: "2015",
    normalized_year_max: "2025",
    notes: "2025 values were recalculated from the 2024 census; normalized output includes the 64 canonical municipalities and preserves official values without estimates.",
  },
  {
    source_id: "geostat_regional_gdp_current_prices",
    dataset_title: "Distribution of gross domestic product by regions at current prices",
    publisher: "National Statistics Office of Georgia (Geostat)",
    role: "regional GDP",
    source_page_url: "https://www.geostat.ge/en/modules/categories/23/gross-domestic-product-gdp",
    retrieved_file_url: "https://www.geostat.ge/media/79752/regional-GDP-ENG.xlsx",
    retrieved_at: "2026-08-03",
    local_file: "official/regional-GDP-ENG.xlsx",
    sha256: "DD2042DFF5E2C44B98B4BB140163B5736CF5A71F4683B9E6A359373907D59C35",
    bytes: "13871",
    source_year_min: "2010",
    source_year_max: "2024",
    normalized_year_min: "2010",
    normalized_year_max: "2024",
    notes: "Last updated 2025-12-23; normalized output includes the 11 canonical regions and excludes the national aggregate from normalized rows.",
  },
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
  const workbook = XLSX.read(fs.readFileSync(path.join(officialDir, fileName)), {
    type: "buffer",
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

function componentRulesFor(geodataId: string, year: number) {
  return COMPONENT_RULES.filter(
    ([ruleGeodataId, , startYear, endYear]) =>
      ruleGeodataId === geodataId &&
      year >= Number(startYear) &&
      year <= Number(endYear),
  );
}

function sourcePopulationValue(
  source: SourceWorkbook,
  sourceRows: Map<string, unknown[]>,
  sourceLabel: string,
  yearColumn: number,
): { value: number; rowNumber: number; cell: string } {
  const value = workbookNumber(sourceRows.get(sourceLabel)?.[yearColumn]);
  expect(value, `${sourceLabel} must have a numeric source value`).not.toBeNull();
  const rowNumber = sourceWorksheetRowNumber(source.worksheet, sourceLabel);
  return {
    value: value ?? Number.NaN,
    rowNumber,
    cell: XLSX.utils.encode_cell({ r: rowNumber - 1, c: yearColumn }),
  };
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

    const yearColumn = yearColumns.get(year) ?? -1;
    const base = sourcePopulationValue(
      source,
      sourceRows,
      mapping?.source_label ?? "",
      yearColumn,
    );
    const components = componentRulesFor(code, year).map(([, sourceLabel]) =>
      sourcePopulationValue(source, sourceRows, sourceLabel, yearColumn),
    );
    const sourceValue = Number(
      [base, ...components]
        .reduce((sum, sourceValue) => sum + sourceValue.value, 0)
        .toFixed(10),
    );
    const populationThousand = outputNumber(row.population_thousand);
    const populationPersons = outputNumber(row.population_persons);

    expect(populationThousand).toBe(sourceValue);
    expect(populationPersons).toBe(sourceValue * 1000);
    if (components.length === 0) {
      expect(row.transformation).toBe(
        `Source sheet "1"; source row ${base.rowNumber}; year ${year} column ${XLSX.utils.encode_col(yearColumn)} (cell ${base.cell}); retained published thousands; persons = thousands * 1000; no estimates.`,
      );
    } else {
      const sources = [base, ...components];
      const rowExpression = sources.map((sourceValue) => sourceValue.rowNumber).join(" + ");
      const cellExpression = sources.map((sourceValue) => sourceValue.cell).join(" + ");
      expect(row.transformation).toBe(
        `Source sheet "1"; source rows ${rowExpression}; year ${year} column ${XLSX.utils.encode_col(yearColumn)} (cells ${cellExpression}); population_thousand = ${cellExpression}; persons = thousands * 1000; no estimates.`,
      );
    }
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

type WorkbookFieldKind = "text" | "number" | "nullable_number" | "date";

function assertWorkbookSemanticParity(
  workbook: XLSX.WorkBook,
  sheetName: string,
  csvRows: CsvRow[],
  fieldKinds: Record<string, WorkbookFieldKind>,
) {
  const worksheet = workbook.Sheets[sheetName];
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
    expect(Object.keys(rawRows[rowIndex])).toEqual(Object.keys(fieldKinds));
    for (const [field, kind] of Object.entries(fieldKinds)) {
      const rawValue = rawRows[rowIndex][field];
      const displayedValue = displayedRows[rowIndex][field];
      const csvValue = csvRow[field];

      if (kind === "date") {
        expect(rawValue, `${sheetName} row ${rowIndex + 2} ${field}`).toBeInstanceOf(Date);
        expect(displayedValue).toBe(csvValue);
      } else if (kind === "number") {
        expect(typeof rawValue).toBe("number");
        expect(rawValue).toBe(Number(csvValue));
      } else if (kind === "nullable_number") {
        expect(rawValue).toBe(csvValue === "" ? null : Number(csvValue));
        if (csvValue !== "") expect(typeof rawValue).toBe("number");
      } else {
        expect(typeof rawValue).toBe("string");
        expect(rawValue).toBe(csvValue);
      }
    }
  }
}

describe("Geostat population and regional GDP research package", () => {
  it("validates every approved manifest field and rejects any field drift", async () => {
    const manifestRows = readPackageCsvRows("source-manifest.csv");
    expect(manifestRows).toEqual(APPROVED_MANIFEST_ROWS);
    for (const row of manifestRows) {
      expect(Object.keys(row)).toEqual(MANIFEST_HEADERS);
      for (const field of ["source_page_url", "retrieved_file_url"]) {
        const url = new URL(row[field]);
        expect(["http:", "https:"]).toContain(url.protocol);
      }
      expect(row.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${row.retrieved_at}T00:00:00Z`).toISOString().slice(0, 10)).toBe(
        row.retrieved_at,
      );
      const sourceMin = Number(row.source_year_min);
      const sourceMax = Number(row.source_year_max);
      const normalizedMin = Number(row.normalized_year_min);
      const normalizedMax = Number(row.normalized_year_max);
      expect(sourceMin).toBeLessThanOrEqual(normalizedMin);
      expect(normalizedMin).toBeLessThanOrEqual(normalizedMax);
      expect(normalizedMax).toBeLessThanOrEqual(sourceMax);
    }

    const packageModule = await import(
      "../../../lib/data/municipalIndicators/prepareGeostatPackage"
    );
    const validate = packageModule.validateSourceManifestRows;
    expect(validate).toBeTypeOf("function");
    if (typeof validate !== "function") return;
    expect(() => validate(manifestRows)).not.toThrow();
    for (const field of MANIFEST_HEADERS) {
      const mutated = manifestRows.map((row) => ({ ...row }));
      mutated[0][field] = `${mutated[0][field]}-changed`;
      expect(() => validate(mutated), field).toThrow();
    }
  });

  it("validates temporal component rules and rejects invalid mappings", async () => {
    const packageModule = await import(
      "../../../lib/data/municipalIndicators/prepareGeostatPackage"
    );
    const validate = packageModule.validatePopulationComponentRows;
    expect(validate).toBeTypeOf("function");
    if (typeof validate !== "function") return;

    const validRows = COMPONENT_RULES.map((values) =>
      Object.fromEntries(
        COMPONENT_MAP_HEADERS.map((header, index) => [header, values[index]]),
      ),
    );
    const knownIds = readCanonicalMunicipalities().map(
      (row) => row.municipality_code,
    );
    const knownLabels = [...sourceRowsByLabel(populationSource().matrix).keys()];
    const mutateFirst = (changes: CsvRow) =>
      validRows.map((row, index) =>
        index === 0 ? { ...row, ...changes } : { ...row },
      );
    expect(() => validate(validRows, knownIds, knownLabels)).not.toThrow();
    expect(() =>
      validate(
        validRows.map((row, index) =>
          index === 1 ? { ...row, geodata_id: validRows[0].geodata_id } : row,
        ),
        knownIds,
        knownLabels,
      ),
    ).toThrow();
    expect(() => validate(mutateFirst({ geodata_id: "999" }), knownIds, knownLabels)).toThrow();
    expect(() =>
      validate(
        mutateFirst({ component_source_label: "Missing city" }),
        knownIds,
        knownLabels,
      ),
    ).toThrow();
    expect(() => validate(mutateFirst({ start_year: "2014" }), knownIds, knownLabels)).toThrow();
    expect(() =>
      validate(
        mutateFirst({ start_year: "2018", end_year: "2017" }),
        knownIds,
        knownLabels,
      ),
    ).toThrow();
    expect(() => validate(mutateFirst({ operation: "subtract" }), knownIds, knownLabels)).toThrow();
  });

  it("makes national reconciliation incomplete when any component is null", async () => {
    const packageModule = await import(
      "../../../lib/data/municipalIndicators/prepareGeostatPackage"
    );
    const reconcile = packageModule.reconcileNationalValues;
    expect(reconcile).toBeTypeOf("function");
    if (typeof reconcile !== "function") return;
    expect(reconcile(100, [40, 60])).toEqual({
      complete: true,
      component_sum: 100,
      difference: 0,
    });
    expect(reconcile(100, [40, null, 60])).toEqual({
      complete: false,
      component_sum: null,
      difference: null,
    });
    expect(reconcile(null, [40, 60])).toEqual({
      complete: false,
      component_sum: null,
      difference: null,
    });
  });

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

  it("aggregates all 21 separately published city components", async () => {
    const result = await buildPackage(false);
    const affectedRows = result.populationRows.filter(
      (row) => componentRulesFor(row.municipality_code, row.year).length > 0,
    );
    expect(affectedRows).toHaveLength(21);
    assertPopulationRowsReconcile(affectedRows, readGeographyRows());

    const telavi2015 = affectedRows.find(
      (row) => row.municipality_code === "15" && row.year === 2015,
    );
    expect(telavi2015?.population_thousand).toBe(58.2);
    expect(telavi2015?.population_persons).toBe(58200);
    expect(telavi2015?.transformation).toBe(
      'Source sheet "1"; source rows 39 + 35; year 2015 column W (cells W39 + W35); population_thousand = W39 + W35; persons = thousands * 1000; no estimates.',
    );
  });

  it("reconciles all 64 municipality values to the published Georgia total", async () => {
    const result = await buildPackage(false);
    const reconciliation = result.validation.population.nationalReconciliation;
    expect(Array.isArray(reconciliation)).toBe(true);
    if (!Array.isArray(reconciliation)) return;
    expect(reconciliation).toHaveLength(POPULATION_YEARS.length);

    const source = populationSource();
    const sourceRows = sourceRowsByLabel(source.matrix);
    const yearColumns = sourceYearColumns(source.matrix[2], POPULATION_YEARS);
    for (const year of POPULATION_YEARS) {
      const column = yearColumns.get(year) ?? -1;
      const published = workbookNumber(sourceRows.get("Georgia")?.[column]);
      const values = result.populationRows
        .filter((row) => row.year === year)
        .map((row) => row.population_thousand);
      const complete = published !== null && values.every((value) => value !== null);
      const numericValues = values.filter(
        (value): value is number => value !== null,
      );
      const municipalitySum = complete
        ? Number(numericValues.reduce((sum, value) => sum + value, 0).toFixed(10))
        : null;
      expect(reconciliation.find((row) => row.year === year)).toEqual({
        year,
        complete,
        published_total_thousand: published,
        municipality_sum_thousand: municipalitySum,
        difference_thousand:
          complete && published !== null && municipalitySum !== null
            ? Number((published - municipalitySum).toFixed(10))
            : null,
      });
    }
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

  it("publishes the seven explicit temporal population component rules", () => {
    const componentPath = path.join(packageDir, "population-component-map.csv");
    expect(fs.existsSync(componentPath)).toBe(true);
    if (!fs.existsSync(componentPath)) return;
    const bytes = fs.readFileSync(componentPath);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const rows = readCsvRows(componentPath);
    expect(rows).toHaveLength(7);
    expect(Object.keys(rows[0])).toEqual(COMPONENT_MAP_HEADERS);
    expect(
      rows.map((row) => COMPONENT_MAP_HEADERS.map((header) => row[header])),
    ).toEqual(COMPONENT_RULES.map((row) => [...row]));
  });

  it("writes Excel-readable artifacts with independently verified provenance", async () => {
    await buildPackage(false);

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

  it("matches every XLSX review-sheet field and type to the CSV artifacts", async () => {
    await buildPackage(false);
    const workbook = XLSX.read(
      fs.readFileSync(path.join(packageDir, "municipal-population-and-regional-gdp.xlsx")),
      { type: "buffer", cellDates: true },
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
    assertWorkbookSemanticParity(
      workbook,
      "Population",
      readPackageCsvRows("municipal-population-annual-2015-2025.csv"),
      {
        year: "number",
        municipality_code: "text",
        municipality_name_ka: "text",
        region_id: "text",
        population_thousand: "nullable_number",
        population_persons: "nullable_number",
        reference_date: "date",
        source_id: "text",
        source_sheet: "text",
        source_unit: "text",
        transformation: "text",
        last_reviewed_at: "date",
      },
    );
    assertWorkbookSemanticParity(
      workbook,
      "Regional GDP",
      readPackageCsvRows("regional-gdp-annual-2005-2025-available-years.csv"),
      {
        year: "number",
        region_id: "text",
        region_name_ka: "text",
        source_region_label: "text",
        gdp_current_prices_million_gel: "nullable_number",
        source_id: "text",
        source_sheet: "text",
        source_unit: "text",
        status: "text",
        transformation: "text",
        last_reviewed_at: "date",
      },
    );
    assertWorkbookSemanticParity(
      workbook,
      "Geography map",
      readPackageCsvRows("geography-map.csv"),
      {
        geography_level: "text",
        source_label: "text",
        source_label_normalized: "text",
        geodata_id: "text",
        display_name_ka: "text",
        region_id: "text",
        mapping_status: "text",
        mapping_note: "text",
      },
    );
    const readMeRows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets["Read me"],
      { header: 1, raw: false, blankrows: false },
    );
    expect(readMeRows.some((row) => row[0] === "Retrieval/review date")).toBe(
      true,
    );
    expect(
      readMeRows.some(
        (row) =>
          row[0] === "Population component rules" &&
          String(row[1]).includes("7") &&
          String(row[1]).includes("21"),
      ),
    ).toBe(true);
  });

  it("validates the committed artifacts in check mode and writes nothing", async () => {
    const artifactPaths = [
      path.join(packageDir, "municipal-population-annual-2015-2025.csv"),
      path.join(packageDir, "regional-gdp-annual-2005-2025-available-years.csv"),
      path.join(packageDir, "validation-report.json"),
    ];
    const before = artifactPaths.map((filePath) => fs.readFileSync(filePath));

    await expect(buildPackage(false)).resolves.toBeDefined();

    for (const [index, filePath] of artifactPaths.entries()) {
      expect(fs.readFileSync(filePath).equals(before[index]!)).toBe(true);
    }
  });

  it("rejects in check mode when a committed artifact does not match generated content", async () => {
    // Proves the check-mode gate in buildGeostatPackage actually fires: intercept the
    // disk read for exactly one committed artifact so the byte-for-byte comparison sees
    // altered content, while every other read (source workbooks, crosswalks, the other
    // two artifacts) passes through untouched. No tracked file is written.
    const staleArtifactPath = path.join(packageDir, "validation-report.json");
    type ReadFileFn = (...args: unknown[]) => Promise<unknown>;
    const fsPromisesUntyped = fsPromises as unknown as { readFile: ReadFileFn };
    const originalReadFile = fsPromisesUntyped.readFile;
    const spy = vi
      .spyOn(fsPromisesUntyped, "readFile")
      .mockImplementation(async (...args: unknown[]) => {
        const [target] = args;
        if (typeof target === "string" && target === staleArtifactPath) {
          return "TAMPERED_FOR_TEST: this content can never match generator output\n";
        }
        return originalReadFile(...args);
      });

    try {
      await expect(buildPackage(false)).rejects.toThrow(
        `Generated Geostat municipal indicators artifact is stale: ${path.relative(repoRoot, staleArtifactPath)}`,
      );
    } finally {
      spy.mockRestore();
    }
  });
});

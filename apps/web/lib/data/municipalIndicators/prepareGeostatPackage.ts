import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { csvEscape } from "../csvEscape";

export type PopulationRow = {
  year: number;
  municipality_code: string;
  municipality_name_ka: string;
  region_id: string;
  population_thousand: number | null;
  population_persons: number | null;
  reference_date: string;
  source_id: "geostat_population_self_governed_units";
  source_sheet: string;
  source_unit: string;
  transformation: string;
  last_reviewed_at: string;
};

export type RegionalGdpRow = {
  year: number;
  region_id: string;
  region_name_ka: string;
  source_region_label: string;
  gdp_current_prices_million_gel: number | null;
  source_id: "geostat_regional_gdp_current_prices";
  source_sheet: string;
  source_unit: string;
  status: "final_as_published";
  transformation: string;
  last_reviewed_at: string;
};

export type GeographyMapRow = {
  geography_level: "municipality" | "region";
  source_label: string;
  source_label_normalized: string;
  geodata_id: string;
  display_name_ka: string;
  region_id: string;
  mapping_status: "exact" | "reviewed_alias";
  mapping_note: string;
};

export type PopulationComponentMapRow = {
  geodata_id: string;
  component_source_label: string;
  start_year: number;
  end_year: number;
  operation: "sum";
  mapping_note: string;
};

export type Gap = {
  dataset: "population" | "regional_gdp";
  geography_id: string;
  year: number;
  source_cell_state: "blank" | "suppressed" | "unavailable" | "non_numeric";
  source_cell: string;
};

export class OfficialGapError extends Error {
  constructor(
    public readonly context: string,
    public readonly sourceCellState: Gap["source_cell_state"],
  ) {
    super(`Official source gap at ${context}: ${sourceCellState}`);
  }
}

export type ValidationReport = {
  status: "complete" | "complete_with_official_gaps" | "failed";
  population: {
    observedYears: number[];
    rowCount: number;
    gaps: Gap[];
    nationalReconciliation: Array<{
      year: number;
      complete: boolean;
      published_total_thousand: number | null;
      municipality_sum_thousand: number | null;
      difference_thousand: number | null;
    }>;
  };
  regionalGdp: {
    observedYears: number[];
    rowCount: number;
    gaps: Gap[];
    nationalReconciliation: Array<{
      year: number;
      complete: boolean;
      published_total_million_gel: number | null;
      regional_sum_million_gel: number | null;
      difference_million_gel: number | null;
    }>;
  };
  estimates_created: 0;
  excluded_codes_present: string[];
  source_hashes_match: boolean;
  normalized_values_reconcile: boolean;
};

export type GeostatPackageBuild = {
  populationRows: PopulationRow[];
  regionalGdpRows: RegionalGdpRow[];
  geographyRows: GeographyMapRow[];
  validation: ValidationReport;
};

export type ReconciliationEntry = {
  key: string;
  values: Array<string | number | null>;
};

export function reconciliationEntriesMatch(
  actual: ReconciliationEntry[],
  expected: ReconciliationEntry[],
): boolean {
  if (actual.length !== expected.length) return false;

  const actualByKey = new Map<string, ReconciliationEntry>();
  for (const entry of actual) {
    if (actualByKey.has(entry.key)) return false;
    actualByKey.set(entry.key, entry);
  }

  return expected.every((expectedEntry) => {
    const actualEntry = actualByKey.get(expectedEntry.key);
    return (
      actualEntry !== undefined &&
      actualEntry.values.length === expectedEntry.values.length &&
      actualEntry.values.every(
        (value, index) => value === expectedEntry.values[index],
      )
    );
  });
}

type CsvRow = Record<string, string>;
type Matrix = unknown[][];
type SheetMatrix = {
  rows: Matrix;
  firstRowNumber: number;
};

const REVIEW_DATE = "2026-08-03";
const POPULATION_YEARS = Array.from({ length: 11 }, (_, index) => 2015 + index);
const EXCLUDED_CODES = new Set(["05", "42", "43", "46", "64"]);
const POPULATION_SOURCE_ID = "geostat_population_self_governed_units" as const;
const GDP_SOURCE_ID = "geostat_regional_gdp_current_prices" as const;
const COMPONENT_MAP_HEADERS = [
  "geodata_id",
  "component_source_label",
  "start_year",
  "end_year",
  "operation",
  "mapping_note",
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
] as const;
const APPROVED_SOURCE_MANIFEST: CsvRow[] = [
  {
    source_id: POPULATION_SOURCE_ID,
    dataset_title: "Population as of 1 January by regions and self-governed units",
    publisher: "National Statistics Office of Georgia (Geostat)",
    role: "municipal population",
    source_page_url: "https://www.geostat.ge/en/modules/categories/41/population",
    retrieved_file_url: "https://www.geostat.ge/media/78356/01-population-by-self-governed-unit.xlsx",
    retrieved_at: REVIEW_DATE,
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
    source_id: GDP_SOURCE_ID,
    dataset_title: "Distribution of gross domestic product by regions at current prices",
    publisher: "National Statistics Office of Georgia (Geostat)",
    role: "regional GDP",
    source_page_url: "https://www.geostat.ge/en/modules/categories/23/gross-domestic-product-gdp",
    retrieved_file_url: "https://www.geostat.ge/media/79752/regional-GDP-ENG.xlsx",
    retrieved_at: REVIEW_DATE,
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

function packagePaths() {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const packageDir = path.join(
    repoRoot,
    "docs/Raw Data/Municipalities/geostat-population-regional-gdp",
  );

  return {
    repoRoot,
    packageDir,
    geographyMap: path.join(packageDir, "geography-map.csv"),
    populationComponentMap: path.join(packageDir, "population-component-map.csv"),
    manifest: path.join(packageDir, "source-manifest.csv"),
    populationSource: path.join(
      packageDir,
      "official/01-population-by-self-governed-unit.xlsx",
    ),
    gdpSource: path.join(packageDir, "official/regional-GDP-ENG.xlsx"),
    populationOutput: path.join(
      packageDir,
      "municipal-population-annual-2015-2025.csv",
    ),
    gdpOutput: path.join(
      packageDir,
      "regional-gdp-annual-2005-2025-available-years.csv",
    ),
    validationOutput: path.join(packageDir, "validation-report.json"),
  };
}

function parseCsv(text: string): CsvRow[] {
  return parse(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];
}

async function readGeographyRows(filePath: string): Promise<GeographyMapRow[]> {
  const rows = parseCsv(await fs.readFile(filePath, "utf8")) as GeographyMapRow[];
  const labels = new Set<string>();
  const ids = new Set<string>();

  for (const row of rows) {
    const labelKey = `${row.geography_level}:${row.source_label}`;
    const idKey = `${row.geography_level}:${row.geodata_id}`;
    if (labels.has(labelKey)) throw new Error(`Duplicate source geography label: ${labelKey}`);
    if (ids.has(idKey)) throw new Error(`Duplicate GeoData geography ID: ${idKey}`);
    labels.add(labelKey);
    ids.add(idKey);
  }

  return rows;
}

function assertExactHeaders(
  row: CsvRow,
  expectedHeaders: readonly string[],
  context: string,
) {
  if (Object.keys(row).join(",") !== expectedHeaders.join(",")) {
    throw new Error(`${context} headers do not match the approved schema`);
  }
}

export function validateSourceManifestRows(rows: CsvRow[]) {
  if (rows.length !== APPROVED_SOURCE_MANIFEST.length) {
    throw new Error(`Expected ${APPROVED_SOURCE_MANIFEST.length} source-manifest rows`);
  }

  const seenIds = new Set<string>();
  for (const row of rows) {
    assertExactHeaders(row, MANIFEST_HEADERS, "Source manifest");
    if (seenIds.has(row.source_id)) {
      throw new Error(`Duplicate source-manifest ID: ${row.source_id}`);
    }
    seenIds.add(row.source_id);

    for (const field of ["source_page_url", "retrieved_file_url"] as const) {
      const url = new URL(row[field]);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`Invalid source-manifest URL protocol: ${row[field]}`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.retrieved_at)) {
      throw new Error(`Invalid source-manifest retrieval date: ${row.retrieved_at}`);
    }
    if (
      new Date(`${row.retrieved_at}T00:00:00Z`).toISOString().slice(0, 10) !==
      row.retrieved_at
    ) {
      throw new Error(`Invalid source-manifest retrieval date: ${row.retrieved_at}`);
    }

    const yearFields = [
      "source_year_min",
      "source_year_max",
      "normalized_year_min",
      "normalized_year_max",
    ] as const;
    if (yearFields.some((field) => !Number.isInteger(Number(row[field])))) {
      throw new Error(`Invalid source-manifest year bound for ${row.source_id}`);
    }
    const sourceMin = Number(row.source_year_min);
    const sourceMax = Number(row.source_year_max);
    const normalizedMin = Number(row.normalized_year_min);
    const normalizedMax = Number(row.normalized_year_max);
    if (
      sourceMin > normalizedMin ||
      normalizedMin > normalizedMax ||
      normalizedMax > sourceMax
    ) {
      throw new Error(`Invalid source-manifest year range for ${row.source_id}`);
    }

    const approved = APPROVED_SOURCE_MANIFEST.find(
      (candidate) => candidate.source_id === row.source_id,
    );
    if (!approved) throw new Error(`Unapproved source-manifest ID: ${row.source_id}`);
    for (const field of MANIFEST_HEADERS) {
      if (row[field] !== approved[field]) {
        throw new Error(`Unexpected source-manifest ${field} for ${row.source_id}`);
      }
    }
  }
}

export function validatePopulationComponentRows(
  rows: CsvRow[],
  knownMunicipalityIds: string[],
  knownSourceLabels: string[],
): PopulationComponentMapRow[] {
  if (rows.length !== 7) throw new Error(`Expected 7 population component rules`);
  const municipalityIds = new Set(knownMunicipalityIds);
  const sourceLabels = new Set(knownSourceLabels);
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();

  return rows.map((row) => {
    assertExactHeaders(row, COMPONENT_MAP_HEADERS, "Population component map");
    if (!municipalityIds.has(row.geodata_id)) {
      throw new Error(`Unknown component-map municipality ID: ${row.geodata_id}`);
    }
    if (!sourceLabels.has(row.component_source_label)) {
      throw new Error(`Unknown population component label: ${row.component_source_label}`);
    }
    if (seenIds.has(row.geodata_id) || seenLabels.has(row.component_source_label)) {
      throw new Error(`Duplicate population component rule: ${row.geodata_id}`);
    }
    seenIds.add(row.geodata_id);
    seenLabels.add(row.component_source_label);

    const startYear = Number(row.start_year);
    const endYear = Number(row.end_year);
    if (
      !Number.isInteger(startYear) ||
      !Number.isInteger(endYear) ||
      startYear > endYear ||
      startYear < POPULATION_YEARS[0] ||
      endYear > POPULATION_YEARS.at(-1)! ||
      startYear !== 2015 ||
      endYear !== 2017
    ) {
      throw new Error(`Invalid population component year bounds: ${row.geodata_id}`);
    }
    if (row.operation !== "sum") {
      throw new Error(`Unsupported population component operation: ${row.operation}`);
    }
    if (!row.mapping_note.trim()) {
      throw new Error(`Missing population component mapping note: ${row.geodata_id}`);
    }

    return {
      geodata_id: row.geodata_id,
      component_source_label: row.component_source_label,
      start_year: startYear,
      end_year: endYear,
      operation: "sum",
      mapping_note: row.mapping_note,
    };
  });
}

export function reconcileNationalValues(
  publishedTotal: number | null,
  components: Array<number | null>,
) {
  if (publishedTotal === null || components.some((value) => value === null)) {
    return { complete: false, component_sum: null, difference: null };
  }
  const numericComponents = components.filter(
    (value): value is number => value !== null,
  );
  const componentSum = Number(
    numericComponents.reduce((sum, value) => sum + value, 0).toFixed(10),
  );
  return {
    complete: true,
    component_sum: componentSum,
    difference: Number((publishedTotal - componentSum).toFixed(10)),
  };
}

function readMatrix(filePath: string, sheetName: string): SheetMatrix {
  const workbook = XLSX.read(readFileSync(filePath), { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing source sheet ${sheetName} in ${filePath}`);
  const sheetRange = sheet["!ref"];
  if (!sheetRange) throw new Error(`Empty source sheet ${sheetName} in ${filePath}`);
  return {
    rows: XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      blankrows: true,
      defval: null,
      range: sheetRange,
    }) as Matrix,
    firstRowNumber: XLSX.utils.decode_range(sheetRange).s.r + 1,
  };
}

function requireSourceNumber(value: unknown, context: string): number {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new OfficialGapError(context, "blank");
  }
  const normalized = String(value).replace(/\s/g, "").replace(/,/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    throw new OfficialGapError(context, "non_numeric");
  }
  if (number < 0) {
    throw new Error(`Invalid nonnegative source number at ${context}: ${String(value)}`);
  }
  return number;
}

function sourceNumber(value: unknown, context: string): number {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "-" || normalized === "—") {
    throw new OfficialGapError(context, "suppressed");
  }
  if (normalized === "n/a" || normalized === "na" || normalized === "..") {
    throw new OfficialGapError(context, "unavailable");
  }
  return requireSourceNumber(value, context);
}

function toMillionGel(value: number, sourceUnit: string): number {
  if (sourceUnit === "million GEL") return value;
  if (sourceUnit === "thousand GEL") return value / 1000;
  if (sourceUnit === "GEL") return value / 1_000_000;
  throw new Error(`Unsupported regional GDP unit: ${sourceUnit}`);
}

function yearColumns(header: unknown[], years?: number[]): Map<number, number> {
  const allowed = years ? new Set(years) : null;
  return new Map(
    header.flatMap((value, index) => {
      const year = Number(value);
      return Number.isInteger(year) && (!allowed || allowed.has(year))
        ? [[year, index] as const]
        : [];
    }),
  );
}

function rowsByLabel(
  matrix: Matrix,
  firstRowNumber: number,
): Map<string, { row: unknown[]; rowNumber: number }> {
  return new Map(
    matrix.flatMap((row, index) =>
      typeof row[0] === "string"
        ? [[row[0], { row, rowNumber: firstRowNumber + index }] as const]
        : [],
    ),
  );
}

function cellAddress(rowNumber: number, columnIndex: number): string {
  return XLSX.utils.encode_cell({ r: rowNumber - 1, c: columnIndex });
}

function readWithGap(
  value: unknown,
  context: string,
  gap: Omit<Gap, "source_cell_state">,
  gaps: Gap[],
): number | null {
  try {
    return sourceNumber(value, context);
  } catch (error) {
    if (!(error instanceof OfficialGapError)) throw error;
    gaps.push({ ...gap, source_cell_state: error.sourceCellState });
    return null;
  }
}

function assertSetEquals(actual: string[], expected: string[], context: string) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  if (
    actual.length !== actualSet.size ||
    actualSet.size !== expectedSet.size ||
    [...actualSet].some((value) => !expectedSet.has(value))
  ) {
    throw new Error(`${context} does not match the canonical geography registry`);
  }
}

async function verifySources(
  manifestPath: string,
  sources: Record<string, string>,
): Promise<boolean> {
  const manifest = parseCsv(await fs.readFile(manifestPath, "utf8"));
  validateSourceManifestRows(manifest);
  if (manifest.length !== Object.keys(sources).length) return false;

  for (const [sourceId, sourcePath] of Object.entries(sources)) {
    const row = manifest.find((candidate) => candidate.source_id === sourceId);
    if (!row) throw new Error(`Missing manifest row for ${sourceId}`);
    const bytes = await fs.readFile(sourcePath);
    const hash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    if (row.sha256 !== hash || row.bytes !== String(bytes.length)) return false;
  }

  return true;
}

function serializeCsv<T extends object>(headers: Array<keyof T>, rows: T[]): string {
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header] as string | number | boolean | null)).join(","),
    ),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

function csvNumber(value: string): number | null {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function serializedPopulationEntry(row: CsvRow): ReconciliationEntry {
  return {
    key: `${row.year}:${row.municipality_code}`,
    values: [
      Number(row.year),
      row.municipality_code,
      row.municipality_name_ka,
      row.region_id,
      csvNumber(row.population_thousand),
      csvNumber(row.population_persons),
      row.reference_date,
      row.source_id,
      row.source_sheet,
      row.source_unit,
      row.transformation,
      row.last_reviewed_at,
    ],
  };
}

function serializedGdpEntry(row: CsvRow): ReconciliationEntry {
  return {
    key: `${row.year}:${row.region_id}`,
    values: [
      Number(row.year),
      row.region_id,
      row.region_name_ka,
      row.source_region_label,
      csvNumber(row.gdp_current_prices_million_gel),
      row.source_id,
      row.source_sheet,
      row.source_unit,
      row.status,
      row.transformation,
      row.last_reviewed_at,
    ],
  };
}

export async function buildGeostatPackage(
  options: { write: boolean } = { write: true },
): Promise<GeostatPackageBuild> {
  const paths = packagePaths();
  const geographyRows = await readGeographyRows(paths.geographyMap);
  const municipalityMappings = geographyRows.filter(
    (row) => row.geography_level === "municipality",
  );
  const regionMappings = geographyRows.filter((row) => row.geography_level === "region");

  const canonicalMunicipalities = parseCsv(
    await fs.readFile(path.join(paths.repoRoot, "data/imports/municipalities.csv"), "utf8"),
  );
  const canonicalRegions = JSON.parse(
    await fs.readFile(path.join(paths.repoRoot, "data/taxonomy/municipal-regions.json"), "utf8"),
  ) as Array<{ id: string; kaLabel: string }>;

  assertSetEquals(
    municipalityMappings.map((row) => row.geodata_id),
    canonicalMunicipalities.map((row) => row.municipality_code),
    "Municipality crosswalk",
  );
  assertSetEquals(
    regionMappings.map((row) => row.geodata_id),
    canonicalRegions.map((row) => row.id),
    "Region crosswalk",
  );

  const sourceHashesMatch = await verifySources(paths.manifest, {
    [POPULATION_SOURCE_ID]: paths.populationSource,
    [GDP_SOURCE_ID]: paths.gdpSource,
  });
  if (!sourceHashesMatch) throw new Error("Preserved source hashes do not match source-manifest.csv");

  const populationSource = readMatrix(paths.populationSource, "1");
  const populationMatrix = populationSource.rows;
  if (!String(populationMatrix[0]?.[0]).includes("Population as of 1 January")) {
    throw new Error("Unexpected population workbook title");
  }
  const populationUnit = String(populationMatrix[2]?.[0]);
  if (populationUnit !== "(thousands)") throw new Error(`Unexpected population unit: ${populationUnit}`);
  const populationColumns = yearColumns(populationMatrix[3] ?? [], POPULATION_YEARS);
  if (populationColumns.size !== POPULATION_YEARS.length) {
    throw new Error("Population source does not contain every requested year");
  }
  const populationSourceRows = rowsByLabel(
    populationMatrix,
    populationSource.firstRowNumber,
  );
  const populationComponentRows = validatePopulationComponentRows(
    parseCsv(await fs.readFile(paths.populationComponentMap, "utf8")),
    municipalityMappings.map((row) => row.geodata_id),
    [...populationSourceRows.keys()],
  );
  const populationGaps: Gap[] = [];
  const populationRows: PopulationRow[] = [];
  const expectedPopulationEntries: ReconciliationEntry[] = [];

  for (const year of POPULATION_YEARS) {
    const columnIndex = populationColumns.get(year);
    if (columnIndex === undefined) throw new Error(`Missing population year ${year}`);
    for (const mapping of [...municipalityMappings].sort((a, b) => a.geodata_id.localeCompare(b.geodata_id))) {
      const source = populationSourceRows.get(mapping.source_label);
      if (!source) throw new Error(`Missing population source row: ${mapping.source_label}`);
      const context = `population ${mapping.geodata_id} ${year}`;
      const sourceCell = cellAddress(source.rowNumber, columnIndex);
      const basePopulationThousand = readWithGap(
        source.row[columnIndex],
        context,
        {
          dataset: "population",
          geography_id: mapping.geodata_id,
          year,
          source_cell: sourceCell,
        },
        populationGaps,
      );
      const componentSources = populationComponentRows
        .filter(
          (component) =>
            component.geodata_id === mapping.geodata_id &&
            year >= component.start_year &&
            year <= component.end_year,
        )
        .map((component) => {
          const componentSource = populationSourceRows.get(
            component.component_source_label,
          );
          if (!componentSource) {
            throw new Error(
              `Missing population component row: ${component.component_source_label}`,
            );
          }
          const componentCell = cellAddress(componentSource.rowNumber, columnIndex);
          let value: number;
          try {
            value = sourceNumber(
              componentSource.row[columnIndex],
              `population component ${component.geodata_id} ${year} ${component.component_source_label}`,
            );
          } catch (error) {
            if (!(error instanceof OfficialGapError)) throw error;
            throw new Error(
              `Missing required population component cell ${componentCell}: ${error.sourceCellState}`,
            );
          }
          return {
            rowNumber: componentSource.rowNumber,
            cell: componentCell,
            value,
          };
        });
      const populationThousand =
        basePopulationThousand === null
          ? null
          : Number(
              componentSources
                .reduce((sum, component) => sum + component.value, basePopulationThousand)
                .toFixed(10),
            );
      const populationPersons =
        populationThousand === null ? null : populationThousand * 1000;
      const transformation =
        componentSources.length === 0
          ? `Source sheet "1"; source row ${source.rowNumber}; year ${year} column ${XLSX.utils.encode_col(columnIndex)} (cell ${sourceCell}); retained published thousands; persons = thousands * 1000; no estimates.`
          : `Source sheet "1"; source rows ${[source.rowNumber, ...componentSources.map((component) => component.rowNumber)].join(" + ")}; year ${year} column ${XLSX.utils.encode_col(columnIndex)} (cells ${[sourceCell, ...componentSources.map((component) => component.cell)].join(" + ")}); population_thousand = ${[sourceCell, ...componentSources.map((component) => component.cell)].join(" + ")}; persons = thousands * 1000; no estimates.`;
      expectedPopulationEntries.push({
        key: `${year}:${mapping.geodata_id}`,
        values: [
          year,
          mapping.geodata_id,
          mapping.display_name_ka,
          mapping.region_id,
          populationThousand,
          populationPersons,
          `${year}-01-01`,
          POPULATION_SOURCE_ID,
          "1",
          populationUnit,
          transformation,
          REVIEW_DATE,
        ],
      });
      populationRows.push({
        year,
        municipality_code: mapping.geodata_id,
        municipality_name_ka: mapping.display_name_ka,
        region_id: mapping.region_id,
        population_thousand: populationThousand,
        population_persons: populationPersons,
        reference_date: `${year}-01-01`,
        source_id: POPULATION_SOURCE_ID,
        source_sheet: "1",
        source_unit: populationUnit,
        transformation,
        last_reviewed_at: REVIEW_DATE,
      });
    }
  }

  const populationNationalRow = populationSourceRows.get("Georgia");
  if (!populationNationalRow) throw new Error("Missing Georgia population total row");
  const populationNationalReconciliation = POPULATION_YEARS.map((year) => {
    const columnIndex = populationColumns.get(year);
    if (columnIndex === undefined) throw new Error(`Missing population year ${year}`);
    let publishedTotal: number | null;
    try {
      publishedTotal = sourceNumber(
        populationNationalRow.row[columnIndex],
        `population national total ${year}`,
      );
    } catch (error) {
      if (!(error instanceof OfficialGapError)) throw error;
      publishedTotal = null;
    }
    const reconciliation = reconcileNationalValues(
      publishedTotal,
      populationRows
        .filter((row) => row.year === year)
        .map((row) => row.population_thousand),
    );
    return {
      year,
      complete: reconciliation.complete,
      published_total_thousand: publishedTotal,
      municipality_sum_thousand: reconciliation.component_sum,
      difference_thousand: reconciliation.difference,
    };
  });

  const gdpSource = readMatrix(paths.gdpSource, "regional GDP");
  const gdpMatrix = gdpSource.rows;
  const gdpTitle = String(gdpMatrix[0]?.[0]);
  if (!/current prices, mil\. GEL/i.test(gdpTitle)) throw new Error("Unexpected regional GDP title or unit");
  const gdpSourceUnit = "mil. GEL";
  const gdpConversionUnit = "million GEL";
  const gdpColumns = yearColumns(gdpMatrix[1] ?? []);
  const gdpYears = [...gdpColumns.keys()]
    .filter((year) => year >= 2005 && year <= 2025)
    .sort((a, b) => a - b);
  if (gdpYears.length === 0) throw new Error("Regional GDP source has no in-window year columns");
  const gdpSourceRows = rowsByLabel(gdpMatrix, gdpSource.firstRowNumber);
  const gdpGaps: Gap[] = [];
  const regionalGdpRows: RegionalGdpRow[] = [];
  const expectedGdpEntries: ReconciliationEntry[] = [];

  for (const year of gdpYears) {
    const columnIndex = gdpColumns.get(year);
    if (columnIndex === undefined) throw new Error(`Missing regional GDP year ${year}`);
    for (const mapping of regionMappings) {
      const source = gdpSourceRows.get(mapping.source_label);
      if (!source) throw new Error(`Missing regional GDP source row: ${JSON.stringify(mapping.source_label)}`);
      const sourceCell = cellAddress(source.rowNumber, columnIndex);
      const sourceValue = readWithGap(
        source.row[columnIndex],
        `regional GDP ${mapping.geodata_id} ${year}`,
        {
          dataset: "regional_gdp",
          geography_id: mapping.geodata_id,
          year,
          source_cell: sourceCell,
        },
        gdpGaps,
      );
      const transformation = `Source sheet "regional GDP"; source row ${source.rowNumber}; year ${year} column ${XLSX.utils.encode_col(columnIndex)} (cell ${sourceCell}); source already mil. GEL; no scale conversion; no estimates.`;
      expectedGdpEntries.push({
        key: `${year}:${mapping.geodata_id}`,
        values: [
          year,
          mapping.geodata_id,
          mapping.display_name_ka,
          mapping.source_label,
          sourceValue,
          GDP_SOURCE_ID,
          "regional GDP",
          gdpSourceUnit,
          "final_as_published",
          transformation,
          REVIEW_DATE,
        ],
      });
      regionalGdpRows.push({
        year,
        region_id: mapping.geodata_id,
        region_name_ka: mapping.display_name_ka,
        source_region_label: mapping.source_label,
        gdp_current_prices_million_gel:
          sourceValue === null ? null : toMillionGel(sourceValue, gdpConversionUnit),
        source_id: GDP_SOURCE_ID,
        source_sheet: "regional GDP",
        source_unit: gdpSourceUnit,
        status: "final_as_published",
        transformation,
        last_reviewed_at: REVIEW_DATE,
      });
    }
  }

  const nationalRow = gdpSourceRows.get("GDP at market prices");
  if (!nationalRow) throw new Error("Missing GDP at market prices source row");
  const nationalReconciliation = gdpYears.map((year) => {
    const columnIndex = gdpColumns.get(year);
    if (columnIndex === undefined) throw new Error(`Missing regional GDP year ${year}`);
    let published: number | null;
    try {
      published = sourceNumber(
        nationalRow.row[columnIndex],
        `regional GDP national total ${year}`,
      );
    } catch (error) {
      if (!(error instanceof OfficialGapError)) throw error;
      published = null;
    }
    const publishedTotal =
      published === null ? null : toMillionGel(published, gdpConversionUnit);
    const reconciliation = reconcileNationalValues(
      publishedTotal,
      regionalGdpRows
        .filter((row) => row.year === year)
        .map((row) => row.gdp_current_prices_million_gel),
    );
    return {
      year,
      complete: reconciliation.complete,
      published_total_million_gel: publishedTotal,
      regional_sum_million_gel: reconciliation.component_sum,
      difference_million_gel: reconciliation.difference,
    };
  });

  const excludedCodesPresent = populationRows
    .map((row) => row.municipality_code)
    .filter((code, index, all) => EXCLUDED_CODES.has(code) && all.indexOf(code) === index);
  if (excludedCodesPresent.length > 0) {
    throw new Error(`Excluded municipality codes present: ${excludedCodesPresent.join(", ")}`);
  }
  if (populationRows.length !== 64 * POPULATION_YEARS.length) {
    throw new Error(`Unexpected population row count: ${populationRows.length}`);
  }
  if (regionalGdpRows.length !== 11 * gdpYears.length) {
    throw new Error(`Unexpected regional GDP row count: ${regionalGdpRows.length}`);
  }

  const populationHeaders: Array<keyof PopulationRow> = [
    "year",
    "municipality_code",
    "municipality_name_ka",
    "region_id",
    "population_thousand",
    "population_persons",
    "reference_date",
    "source_id",
    "source_sheet",
    "source_unit",
    "transformation",
    "last_reviewed_at",
  ];
  const gdpHeaders: Array<keyof RegionalGdpRow> = [
    "year",
    "region_id",
    "region_name_ka",
    "source_region_label",
    "gdp_current_prices_million_gel",
    "source_id",
    "source_sheet",
    "source_unit",
    "status",
    "transformation",
    "last_reviewed_at",
  ];
  const populationCsv = serializeCsv(populationHeaders, populationRows);
  const gdpCsv = serializeCsv(gdpHeaders, regionalGdpRows);
  const normalizedValuesReconcile =
    reconciliationEntriesMatch(
      parseCsv(populationCsv).map(serializedPopulationEntry),
      expectedPopulationEntries,
    ) &&
    reconciliationEntriesMatch(
      parseCsv(gdpCsv).map(serializedGdpEntry),
      expectedGdpEntries,
    );
  if (!normalizedValuesReconcile) {
    throw new Error(
      "Serialized normalized rows do not reconcile to selected preserved workbook cells",
    );
  }

  const validation: ValidationReport = {
    status:
      populationGaps.length + gdpGaps.length === 0
        ? "complete"
        : "complete_with_official_gaps",
    population: {
      observedYears: POPULATION_YEARS,
      rowCount: populationRows.length,
      gaps: populationGaps,
      nationalReconciliation: populationNationalReconciliation,
    },
    regionalGdp: {
      observedYears: gdpYears,
      rowCount: regionalGdpRows.length,
      gaps: gdpGaps,
      nationalReconciliation,
    },
    estimates_created: 0,
    excluded_codes_present: excludedCodesPresent,
    source_hashes_match: sourceHashesMatch,
    normalized_values_reconcile: normalizedValuesReconcile,
  };

  if (options.write) {
    await fs.writeFile(paths.populationOutput, populationCsv, "utf8");
    await fs.writeFile(paths.gdpOutput, gdpCsv, "utf8");
    await fs.writeFile(paths.validationOutput, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  }

  return { populationRows, regionalGdpRows, geographyRows, validation };
}

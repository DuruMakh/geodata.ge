import path from "node:path";
import { csvEscape } from "../csvEscape";
import { readCsvRecords } from "../csv";
import { loadMunicipalitiesFile } from "./municipalitiesFile";
import type { MunicipalPopulationFact } from "./types";

const SOURCE_ID = "source.geostat_municipal_population" as const;
const SOURCE_DATASET_ID = "geostat_population_self_governed_units";
const SOURCE_PATH = path.resolve(
  process.cwd(),
  "../../docs/Raw Data/Municipalities/geostat-population-regional-gdp/municipal-population-annual-2015-2025.csv",
);
const MUNICIPALITIES_PATH = path.resolve(process.cwd(), "../../data/imports/municipalities.csv");

const HEADERS = [
  "year",
  "municipality_code",
  "population_thousand",
  "population_persons",
  "reference_date",
  "source_id",
  "source_sheet",
  "source_cell",
  "source_unit",
  "transformation",
  "last_reviewed_at",
] as const;

export type MunicipalPopulation2025Output = {
  rows: MunicipalPopulationFact[];
  csvText: string;
};

function exactCodeProblems(actualCodes: string[], expectedCodes: string[]): string[] {
  const actual = new Set(actualCodes);
  const expected = new Set(expectedCodes);
  const missing = expectedCodes.filter((code) => !actual.has(code));
  const unexpected = actualCodes.filter((code) => !expected.has(code));
  const duplicate = actualCodes.filter((code, index) => actualCodes.indexOf(code) !== index);
  const problems: string[] = [];
  if (missing.length > 0) problems.push(`missing: ${[...new Set(missing)].join(", ")}`);
  if (unexpected.length > 0) problems.push(`unexpected: ${[...new Set(unexpected)].join(", ")}`);
  if (duplicate.length > 0) problems.push(`duplicate: ${[...new Set(duplicate)].join(", ")}`);
  return problems;
}

function sourceCell(transformation: string, code: string): string {
  const match = /\(cell ([A-Z]+[1-9][0-9]*)\)/.exec(transformation);
  if (!match) throw new Error(`Missing single source cell in 2025 transformation for ${code}`);
  return match[1]!;
}

function serialize(rows: MunicipalPopulationFact[]): string {
  return `${[
    HEADERS.join(","),
    ...rows.map((row) =>
      [
        row.year,
        row.municipalityCode,
        row.populationThousand,
        row.populationPersons,
        row.referenceDate,
        row.sourceId,
        row.sourceSheet,
        row.sourceCell,
        row.sourceUnit,
        row.transformation,
        row.lastReviewedAt,
      ].map(csvEscape).join(","),
    ),
  ].join("\n")}\n`;
}

export async function buildMunicipalPopulation2025Output(options: {
  sourcePath?: string;
  municipalitiesPath?: string;
} = {}): Promise<MunicipalPopulation2025Output> {
  const [sourceRows, municipalities] = await Promise.all([
    readCsvRecords(options.sourcePath ?? SOURCE_PATH),
    loadMunicipalitiesFile(options.municipalitiesPath ?? MUNICIPALITIES_PATH),
  ]);
  const selected = sourceRows.filter((row) => row.year === "2025");
  const expectedCodes = municipalities.map((municipality) => municipality.code);
  const problems = exactCodeProblems(selected.map((row) => row.municipality_code), expectedCodes);
  if (problems.length > 0) {
    throw new Error(`Municipal population 2025 code set mismatch; ${problems.join("; ")}`);
  }

  const sortByCode = new Map(municipalities.map((municipality) => [municipality.code, municipality.sortId]));
  const rows = selected
    .map((row): MunicipalPopulationFact => {
      if (row.reference_date !== "2025-01-01") {
        throw new Error(`Municipal population ${row.municipality_code} must use 2025-01-01`);
      }
      if (row.source_id !== SOURCE_DATASET_ID) {
        throw new Error(`Unexpected reviewed population source ${row.source_id}`);
      }
      const populationThousand = Number(row.population_thousand);
      const populationPersons = Number(row.population_persons);
      if (!Number.isFinite(populationThousand) || !Number.isSafeInteger(populationPersons)) {
        throw new Error(`Invalid 2025 population for ${row.municipality_code}`);
      }

      return {
        year: 2025,
        municipalityCode: row.municipality_code,
        populationThousand,
        populationPersons,
        referenceDate: "2025-01-01",
        sourceId: SOURCE_ID,
        sourceSheet: row.source_sheet,
        sourceCell: sourceCell(row.transformation, row.municipality_code),
        sourceUnit: "(thousands)",
        transformation: row.transformation,
        lastReviewedAt: row.last_reviewed_at,
      };
    })
    .sort((left, right) =>
      (sortByCode.get(left.municipalityCode) ?? Number.MAX_SAFE_INTEGER) -
        (sortByCode.get(right.municipalityCode) ?? Number.MAX_SAFE_INTEGER) ||
      left.municipalityCode.localeCompare(right.municipalityCode),
    );

  return { rows, csvText: serialize(rows) };
}

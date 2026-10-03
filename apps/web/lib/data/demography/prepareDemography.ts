import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { serializeBomCsvRows } from "../csvEscape";
import { loadReviewedAnomalies } from "./anomalies";
import { buildBreakRegister } from "./breaks";
import { loadCitizenships } from "./citizenship";
import { groupMigrationByCitizenship, loadCitizenshipGroups } from "./citizenshipGroups";
import { loadDensityRows } from "./densityRows";
import { loadDemographyGeography } from "./geography";
import { readCensusAge } from "./readCensusAge";
import { readDensity } from "./readDensity";
import { readMigration } from "./readMigration";
import { readAgeStructure, readPopulation } from "./readPopulation";
import { readVitalEvents } from "./readVital";
import { FAMILIES } from "./series";
import { loadDemographySources } from "./sourceFiles";
import { DemographyStopError } from "./stops";
import { ESTIMATE_BASES } from "./types";
import type { DemographyObservation } from "./types";
import { validateDemography } from "./validation";

/** The canonical file of each family and the dimension columns it adds to the shared ones. */
const FILES = [
  { family: "population", file: "data/imports/demography-population-annual.csv", dimensions: [] },
  { family: "structure", file: "data/imports/demography-structure-annual.csv", dimensions: ["sex", "age_group"] },
  { family: "vital", file: "data/imports/demography-vital-annual.csv", dimensions: [] },
  { family: "migration", file: "data/imports/demography-migration-annual.csv", dimensions: ["sex", "citizenship_id"] },
  { family: "density", file: "data/imports/demography-density-annual.csv", dimensions: [] },
  { family: "census", file: "data/imports/demography-census-2024-population.csv", dimensions: ["sex", "age_group", "settlement"] },
] as const;
const BREAKS_FILE = "data/imports/demography-series-breaks.csv";
const REPORT_FILE = "data/reports/demography-validation.json";

const DIMENSION: Record<(typeof FILES)[number]["dimensions"][number], (row: DemographyObservation) => string> = {
  sex: (row) => row.sex ?? "",
  age_group: (row) => row.ageGroup ?? "",
  citizenship_id: (row) => row.citizenshipId ?? "",
  settlement: (row) => row.settlement ?? "",
};

const rowSchema = z.object({
  series_id: z.string().min(1),
  geography_id: z.string().min(1),
  year: z.coerce.number().int(),
  value: z.string().min(1),
  unit: z.string().min(1),
  estimate_basis: z.enum(ESTIMATE_BASES),
  status: z.literal("published"),
  source_id: z.string().min(1),
  source_locator: z.string().min(1),
  last_reviewed_at: z.string().min(1),
  sex: z.enum(["total", "male", "female"]).optional(),
  age_group: z.string().optional(),
  citizenship_id: z.string().optional(),
  settlement: z.enum(["total", "urban", "rural"]).optional(),
});

/** The rows of the committed canonical files, which a refresh may add to but never change. Undefined on a first build. */
async function loadPreviousObservations(repositoryRoot: string): Promise<DemographyObservation[] | undefined> {
  const rows: DemographyObservation[] = [];
  let found = false;
  for (const { file } of FILES) {
    let text: string;
    try {
      text = await fs.readFile(path.join(repositoryRoot, file), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    found = true;
    const records = parse(text, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
    records.forEach((record, index) => {
      const result = rowSchema.safeParse(record);
      if (!result.success) throw new Error(`${file} row ${index + 2} is invalid: ${result.error.message}`);
      const row = result.data;
      rows.push({
        seriesId: row.series_id,
        geographyId: row.geography_id,
        year: row.year,
        value: row.value,
        unit: row.unit,
        estimateBasis: row.estimate_basis,
        status: row.status,
        sourceId: row.source_id,
        sourceLocator: row.source_locator,
        lastReviewedAt: row.last_reviewed_at,
        ...(row.sex ? { sex: row.sex } : {}),
        ...(row.age_group ? { ageGroup: row.age_group } : {}),
        ...(row.citizenship_id ? { citizenshipId: row.citizenship_id } : {}),
        ...(row.settlement ? { settlement: row.settlement } : {}),
      });
    });
  }
  return found ? rows : undefined;
}

/** Every source the canonical files cite must be a registered source, or no reader could trace a number to its document. */
async function checkSourcesRegistered(repositoryRoot: string, observations: readonly DemographyObservation[]): Promise<void> {
  const text = await fs.readFile(path.join(repositoryRoot, "data/sources/source-documents.csv"), "utf8");
  const registered = new Set((parse(text, { bom: true, columns: true, skip_empty_lines: true }) as Array<{ source_id: string }>).map((row) => row.source_id));
  const missing = [...new Set(observations.map((row) => row.sourceId))].filter((sourceId) => !registered.has(sourceId));
  if (missing.length > 0) {
    throw new DemographyStopError("unregistered_source", `Served sources are not registered in data/sources/source-documents.csv: ${missing.join(", ")}`);
  }
}

/** Reads every family from the archive and validates the whole. Throws a named stop before anything is written. */
export async function prepareDemography(repositoryRoot: string) {
  const [sources, geography, anomalies, citizenships, previous] = await Promise.all([
    loadDemographySources(repositoryRoot),
    loadDemographyGeography(repositoryRoot),
    loadReviewedAnomalies(repositoryRoot),
    loadCitizenships(repositoryRoot),
    loadPreviousObservations(repositoryRoot),
  ]);
  const [density, groups] = await Promise.all([
    loadDensityRows(repositoryRoot, geography.regions.map((region) => region.id)),
    loadCitizenshipGroups(repositoryRoot, citizenships),
  ]);
  const migration = readMigration(sources, citizenships);
  const observations = [
    ...readPopulation(sources, geography),
    ...readAgeStructure(sources),
    ...readVitalEvents(sources, geography, anomalies),
    ...migration,
    ...groupMigrationByCitizenship(migration, groups),
    ...readDensity(sources, density),
    ...readCensusAge(sources, geography),
  ];
  await checkSourcesRegistered(repositoryRoot, observations);
  const report = validateDemography({ observations, sources, geography, density, previous });
  return { observations, report, breaks: buildBreakRegister() };
}

export function buildDemographyArtifacts(result: Awaited<ReturnType<typeof prepareDemography>>) {
  const artifacts = new Map<string, Buffer>();
  for (const { family, file, dimensions } of FILES) {
    const seriesIds: readonly string[] = FAMILIES[family];
    const headers = ["series_id", "geography_id", "year", ...dimensions, "value", "unit", "estimate_basis", "status", "source_id", "source_locator", "last_reviewed_at"];
    const rows = result.observations
      .filter((row) => seriesIds.includes(row.seriesId))
      .map((row) => [
        row.seriesId,
        row.geographyId,
        row.year,
        ...dimensions.map((dimension) => DIMENSION[dimension](row)),
        row.value,
        row.unit,
        row.estimateBasis,
        row.status,
        row.sourceId,
        row.sourceLocator,
        row.lastReviewedAt,
      ]);
    artifacts.set(file, Buffer.from(serializeBomCsvRows([headers, ...rows]), "utf8"));
  }
  const breaks = serializeBomCsvRows([
    ["break_id", "applies_to", "reference_date", "reason", "source_note"],
    ...result.breaks.map((row) => [row.breakId, row.appliesTo.join(";"), row.referenceDate, row.reason, row.sourceNote]),
  ]);
  artifacts.set(BREAKS_FILE, Buffer.from(breaks, "utf8"));
  artifacts.set(REPORT_FILE, Buffer.from(`${JSON.stringify(result.report, null, 2)}\n`, "utf8"));
  return artifacts;
}

export async function writeDemographyArtifacts(write: boolean, repositoryRoot = path.resolve(process.cwd(), "../..")) {
  const result = await prepareDemography(repositoryRoot);
  const artifacts = buildDemographyArtifacts(result);
  for (const [relativePath, expected] of artifacts) {
    const target = path.join(repositoryRoot, relativePath);
    if (write) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, expected);
      continue;
    }
    let actual: Buffer;
    try {
      actual = await fs.readFile(target);
    } catch {
      throw new Error(`Generated demography artifact is missing: ${relativePath}`);
    }
    if (!actual.equals(expected)) throw new Error(`Generated demography artifact is stale: ${relativePath}`);
  }
  return result.report;
}

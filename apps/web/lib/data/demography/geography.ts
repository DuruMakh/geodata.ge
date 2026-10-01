import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import type { StoredSheet } from "./readStoredSheet";
import { DemographyStopError } from "./stops";

const MUNICIPAL_PACKAGE = "docs/Raw Data/Municipalities/geostat-population-regional-gdp";
const MAPPINGS = "data/mappings/demography";

/** Which table family a label comes from: each family spells some units differently. */
export type UnitScope = "population" | "events" | "census";
type ComponentScope = "population" | "events";

export type ResolvedUnit =
  | { kind: "country"; geographyId: typeof MUNICIPAL_COUNTRY_ID }
  | { kind: "region"; geographyId: string }
  | { kind: "municipality"; geographyId: string; regionId: string }
  /** A starred city row, added to the municipality `geographyId` for the years it is published. */
  | { kind: "city_component"; geographyId: string; startYear: number; endYear: number }
  | { kind: "excluded"; geographyId: null };

export type DemographyGeography = {
  readonly regions: ReadonlyArray<{ id: string; sortOrder: number }>;
  /** In the order of data/imports/municipalities.csv. */
  readonly municipalities: ReadonlyArray<{ code: string; regionId: string; sourceLabel: string }>;
  /** A label that no reviewed file knows stops preparation. Surrounding whitespace is ignored. */
  resolve(label: string, scope: UnitScope): ResolvedUnit;
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const mapRowSchema = z.object({
  geography_level: z.enum(["municipality", "region"]),
  source_label: z.string().min(1),
  geodata_id: z.string().min(1),
  region_id: z.string(),
});
const municipalitySchema = z.object({ municipality_code: z.string().regex(/^\d{2}$/), region_id: z.string().min(1) });
const componentSchema = z.object({
  geodata_id: z.string().regex(/^\d{2}$/),
  component_source_label: z.string().regex(/^C\. .+\*$/),
  start_year: z.coerce.number().int(),
  end_year: z.coerce.number().int(),
  operation: z.literal("sum"),
});
const aliasSchema = z.object({
  table_label: z.string().min(1),
  canonical_label: z.string().min(1),
  applies_to: z.enum(["events", "census"]),
  mapping_note: z.string().min(1),
  reviewed_at: date,
});
const excludedSchema = z.object({ table_label: z.string().min(1), mapping_note: z.string().min(1), reviewed_at: date });

async function readRecords<T>(file: string, schema: z.ZodType<T>): Promise<T[]> {
  const text = await fs.readFile(file, "utf8");
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  return records.map((record, index) => {
    const result = schema.safeParse(record);
    if (!result.success) throw new Error(`${path.basename(file)} row ${index + 2} is invalid: ${result.error.message}`);
    return result.data;
  });
}

/**
 * The unit rows of a population or event table: the labels in column A from row 5 until the
 * first blank cell. Rows are never matched across tables by position, only by reviewed label.
 */
export function readUnitRows(sheet: StoredSheet): Array<{ row: number; label: string }> {
  if (sheet.label("A4") !== "regions, self-governed units") {
    throw new DemographyStopError("layout_changed", `Unexpected header in sheet ${sheet.name}: A4 is not the unit-table heading`);
  }
  const rows: Array<{ row: number; label: string }> = [];
  for (let row = 5; row <= sheet.lastRow; row += 1) {
    const label = sheet.label(sheet.ref("A", row));
    if (label === null) break;
    rows.push({ row, label });
  }
  return rows;
}

export async function loadDemographyGeography(
  repositoryRoot = path.resolve(process.cwd(), "../.."),
): Promise<DemographyGeography> {
  const at = (...segments: string[]) => path.join(repositoryRoot, ...segments);
  const [municipalityRows, regionTaxonomy, mapRows, populationComponents, eventComponents, aliasRows, excludedRows] = await Promise.all([
    readRecords(at("data/imports/municipalities.csv"), municipalitySchema),
    fs.readFile(at("data/taxonomy/municipal-regions.json"), "utf8").then((text) => JSON.parse(text) as Array<{ id: string; sortOrder: number }>),
    readRecords(at(MUNICIPAL_PACKAGE, "geography-map.csv"), mapRowSchema),
    readRecords(at(MUNICIPAL_PACKAGE, "population-component-map.csv"), componentSchema),
    readRecords(at(MAPPINGS, "event-city-components.csv"), componentSchema),
    readRecords(at(MAPPINGS, "geography-aliases.csv"), aliasSchema),
    readRecords(at(MAPPINGS, "excluded-units.csv"), excludedSchema),
  ]);

  const regionIds = new Set(regionTaxonomy.map((region) => region.id));
  const regionByLabel = new Map<string, string>();
  const municipalityByLabel = new Map<string, { code: string; regionId: string }>();
  for (const row of mapRows) {
    const label = row.source_label.trim();
    if (row.geography_level === "region") {
      if (!regionIds.has(row.geodata_id)) throw new Error(`Geography map names an unknown region: ${row.geodata_id}`);
      regionByLabel.set(label, row.geodata_id);
    } else {
      municipalityByLabel.set(label, { code: row.geodata_id, regionId: row.region_id });
    }
  }

  const authority = new Map(municipalityRows.map((row) => [row.municipality_code, row.region_id]));
  const mapped = new Map([...municipalityByLabel.values()].map((row) => [row.code, row.regionId]));
  const sameCodes = authority.size === mapped.size && [...authority.keys()].every((code) => mapped.has(code));
  if (!sameCodes) throw new Error("The geography map and data/imports/municipalities.csv disagree on the municipality codes");
  for (const [code, regionId] of authority) {
    if (mapped.get(code) !== regionId) throw new Error(`Municipality ${code} has two regions: ${regionId} and ${mapped.get(code)}`);
  }

  const municipalities = municipalityRows.map((row) => {
    const sourceLabel = [...municipalityByLabel.entries()].find(([, value]) => value.code === row.municipality_code)![0];
    return { code: row.municipality_code, regionId: row.region_id, sourceLabel };
  });

  const componentsByScope: Record<ComponentScope, Map<string, { geographyId: string; startYear: number; endYear: number }>> = {
    population: new Map(),
    events: new Map(),
  };
  for (const [scope, rows] of [["population", populationComponents], ["events", eventComponents]] as const) {
    for (const row of rows) {
      if (!authority.has(row.geodata_id)) throw new Error(`City component ${row.component_source_label} names an unknown municipality`);
      if (row.start_year > row.end_year) throw new Error(`City component ${row.component_source_label} ends before it starts`);
      componentsByScope[scope].set(row.component_source_label, {
        geographyId: row.geodata_id,
        startYear: row.start_year,
        endYear: row.end_year,
      });
    }
  }

  const aliasKey = (scope: string, label: string) => `${scope}\u0000${label}`;
  const aliases = new Map<string, string>();
  for (const row of aliasRows) {
    if (!municipalityByLabel.has(row.canonical_label)) throw new Error(`Alias target is not a municipality label: ${row.canonical_label}`);
    if (municipalityByLabel.has(row.table_label) || regionByLabel.has(row.table_label)) {
      throw new Error(`Alias ${row.table_label} would shadow a label the geography map already knows`);
    }
    const key = aliasKey(row.applies_to, row.table_label);
    if (aliases.has(key)) throw new Error(`Alias ${row.table_label} is listed twice for ${row.applies_to}`);
    aliases.set(key, row.canonical_label);
  }

  const excluded = new Set(excludedRows.map((row) => row.table_label));
  for (const label of excluded) {
    if (municipalityByLabel.has(label) || regionByLabel.has(label)) throw new Error(`Excluded unit ${label} is also a reviewed unit`);
  }

  return {
    regions: regionTaxonomy.map((region) => ({ id: region.id, sortOrder: region.sortOrder })),
    municipalities,
    resolve(rawLabel, scope) {
      const label = rawLabel.trim();
      if (label === "Georgia") return { kind: "country", geographyId: MUNICIPAL_COUNTRY_ID };
      const canonical = aliases.get(aliasKey(scope, label)) ?? label;
      const regionId = regionByLabel.get(canonical);
      if (regionId) return { kind: "region", geographyId: regionId };
      const municipality = municipalityByLabel.get(canonical);
      if (municipality) return { kind: "municipality", geographyId: municipality.code, regionId: municipality.regionId };
      if (scope !== "census") {
        const component = componentsByScope[scope].get(label);
        if (component) return { kind: "city_component", ...component };
      }
      if (excluded.has(label)) return { kind: "excluded", geographyId: null };
      throw new DemographyStopError("unreviewed_label", `Unreviewed geography label in ${scope}: ${rawLabel}`);
    },
  };
}

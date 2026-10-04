import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import type { DemographyGeography } from "./geography";
import { readStoredSheet, type StoredSheet } from "./readStoredSheet";
import { CENSUS_AGE_GROUPS, EXTENSION_REVIEWED_AT, SERIES, SOURCE_ID } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, DemographySources, Settlement, Sex } from "./types";

const TITLE = "Population of Georgia by regions, self-governed units, 5-year age groups, urban-rural settlements and sex";
const FIRST_UNIT_ROW = 7;
/** A unit row is followed by its 18 age rows, so a unit takes 19 rows. */
const BLOCK = 1 + CENSUS_AGE_GROUPS.length;
/** The table's own notes. The first defines the dash as a true zero, so a change to it stops preparation. */
const NIL_NOTE = "- Magnitude nil";
const OCCUPIED_NOTE = "Note: Does not include occupied territories of Georgia";

/** The nine value columns: total, urban and rural, each as both sexes, males and females (B to J). */
export const CENSUS_SETTLEMENTS: ReadonlyArray<{ settlement: Settlement; heading: string; firstColumn: number }> = [
  { settlement: "total", heading: "Total", firstColumn: 1 },
  { settlement: "urban", heading: "Urban", firstColumn: 4 },
  { settlement: "rural", heading: "Rural", firstColumn: 7 },
];
export const CENSUS_SEXES: ReadonlyArray<{ sex: Sex; heading: string }> = [
  { sex: "total", heading: "Both Sexes" },
  { sex: "male", heading: "Males" },
  { sex: "female", heading: "Females" },
];

/** The whole census age table once its layout has been checked: every unit row and its 18 age rows, in whole persons. */
export type CensusGrid = {
  readonly sheet: StoredSheet;
  /** The units Geostat prints a row for: Georgia, 10 regions and 64 municipalities. Tbilisi appears once, as a municipality. */
  readonly printed: ReadonlyMap<string, number>;
  /** The unit's own row, or for Tbilisi's region the row Geostat prints for its municipality. */
  rowOf(geographyId: string): number;
  ref(row: number, sex: Sex, settlement: Settlement): string;
  /** The count at that row; a dash is the nil the table's own note says it is, and a blank cell stops preparation. */
  count(row: number, sex: Sex, settlement: Settlement): number;
};

/**
 * Checks the layout of the census age table (title, headers, both notes, every age label, no unit
 * twice, none unreviewed) and gives access to every cell. Reads nothing it has not been asked for.
 */
export function readCensusGrid(sources: DemographySources, geography: DemographyGeography): CensusGrid {
  const sheet = readStoredSheet(sources.get(SOURCE_ID.censusAge).bytes, "1");
  sheet.expectLabel("A1", TITLE);
  sheet.expectLabel("A2", "(as of November 14, 2024)");
  sheet.expectLabel("A4", "(persons)");
  for (const { heading, firstColumn } of CENSUS_SETTLEMENTS) {
    sheet.expectLabel(sheet.ref(firstColumn, 5), heading);
    CENSUS_SEXES.forEach((sex, index) => sheet.expectLabel(sheet.ref(firstColumn + index, 6), sex.heading));
  }
  sheet.findRow(NIL_NOTE);
  sheet.findRow(OCCUPIED_NOTE);

  const printed = new Map<string, number>();
  for (let row = FIRST_UNIT_ROW; ; row += BLOCK) {
    const label = sheet.label(sheet.ref("A", row));
    if (label === null) break;
    const unit = geography.resolve(label, "census");
    if (unit.kind !== "country" && unit.kind !== "region" && unit.kind !== "municipality") {
      throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} lists ${label}, which is not a unit the census age table serves`);
    }
    if (printed.has(unit.geographyId)) throw new DemographyStopError("layout_changed", `${label} appears twice in sheet ${sheet.name}`);
    CENSUS_AGE_GROUPS.forEach((group, index) => sheet.expectLabel(sheet.ref("A", row + 1 + index), group.label));
    printed.set(unit.geographyId, row);
  }

  const rowOf = (geographyId: string) => {
    const own = printed.get(geographyId);
    if (own !== undefined) return own;
    // Tbilisi is one municipality and one region, and Geostat prints only the municipality row.
    const members = geography.municipalities.filter((municipality) => municipality.regionId === geographyId);
    const row = members.length === 1 ? printed.get(members[0]!.code) : undefined;
    if (row === undefined) throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} has no row for ${geographyId}`);
    return row;
  };
  for (const id of [MUNICIPAL_COUNTRY_ID, ...geography.regions.map((region) => region.id), ...geography.municipalities.map((municipality) => municipality.code)]) rowOf(id);

  const columnOf = (sex: Sex, settlement: Settlement) =>
    CENSUS_SETTLEMENTS.find((entry) => entry.settlement === settlement)!.firstColumn + CENSUS_SEXES.findIndex((entry) => entry.sex === sex);
  return {
    sheet,
    printed,
    rowOf,
    ref: (row, sex, settlement) => sheet.ref(columnOf(sex, settlement), row),
    count(row, sex, settlement) {
      const ref = sheet.ref(columnOf(sex, settlement), row);
      const value = sheet.countNilAsZero(ref);
      if (value === null) throw new DemographyStopError("missing_served_cell", `Sheet ${sheet.name} has no value at ${ref}`);
      return value;
    },
  };
}

/**
 * Georgia's population counted by the 2024 census on 14 November 2024, by sex and urban or rural
 * settlement: for Georgia and the 11 regions also by 18 five-year age groups, for all 76 units in
 * total. The table prints no 1 January value and makes no estimate. A dash in it is "magnitude
 * nil", a true zero (a city has no rural settlements), which its own note says; every identity
 * then holds exactly, so no cell is suppressed. Municipal age rows are read and validated against
 * the regions but not served.
 */
export function readCensusAge(sources: DemographySources, geography: DemographyGeography): DemographyObservation[] {
  const grid = readCensusGrid(sources, geography);
  const sourceId = sources.get(SOURCE_ID.censusAge).row.sourceId;
  const observe = (seriesId: string, geographyId: string, row: number, sex: Sex, settlement: Settlement, ageGroup?: string): DemographyObservation => ({
    seriesId,
    geographyId,
    year: 2024,
    value: String(grid.count(row, sex, settlement)),
    unit: "persons",
    estimateBasis: "census_count",
    status: "published",
    sourceId,
    sourceLocator: `${grid.sheet.name}!${grid.ref(row, sex, settlement)} [2024-11-14]`,
    lastReviewedAt: EXTENSION_REVIEWED_AT,
    sex,
    settlement,
    ...(ageGroup === undefined ? {} : { ageGroup }),
  });

  const aggregates = [MUNICIPAL_COUNTRY_ID, ...geography.regions.map((region) => region.id)];
  const everyUnit = [...aggregates, ...geography.municipalities.map((municipality) => municipality.code)];
  const rows: DemographyObservation[] = [];
  for (const geographyId of aggregates) {
    for (const { sex } of CENSUS_SEXES) {
      for (const { settlement } of CENSUS_SETTLEMENTS) {
        CENSUS_AGE_GROUPS.forEach((group, index) => {
          rows.push(observe(SERIES.censusPopulationByAge, geographyId, grid.rowOf(geographyId) + 1 + index, sex, settlement, group.id));
        });
      }
    }
  }
  for (const geographyId of everyUnit) {
    for (const { sex } of CENSUS_SEXES) {
      for (const { settlement } of CENSUS_SETTLEMENTS) rows.push(observe(SERIES.censusPopulationBySettlement, geographyId, grid.rowOf(geographyId), sex, settlement));
    }
  }
  return rows;
}

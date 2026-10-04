import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import type { CitizenshipMap } from "./citizenship";
import { findYearBlocks, findYearRows, readStoredSheet } from "./readStoredSheet";
import { COVERAGE, REVIEWED_AT, SERIES, SOURCE_ID } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, DemographySources, Sex } from "./types";

const TOTAL_ID = "citizenship.total";

/** The citizenship table's six value columns: immigrants then emigrants, each both sexes, males, females. */
const DIRECTIONS = [
  { seriesId: SERIES.immigrants, heading: "Immigrants", firstColumn: 1 },
  { seriesId: SERIES.emigrants, heading: "Emigrants", firstColumn: 4 },
] as const;
const SEXES: ReadonlyArray<{ sex: Sex; heading: string }> = [
  { sex: "total", heading: "Both sexes" },
  { sex: "male", heading: "Males" },
  { sex: "female", heading: "Females" },
];

function observation(
  seriesId: string,
  year: number,
  value: number,
  sourceId: string,
  locator: string,
  sex: Sex,
  citizenshipId: string,
): DemographyObservation {
  return {
    seriesId,
    geographyId: MUNICIPAL_COUNTRY_ID,
    year,
    value: String(value),
    unit: "persons",
    estimateBasis: "border_police",
    status: "published",
    sourceId,
    sourceLocator: `${locator} [${year}]`,
    lastReviewedAt: REVIEWED_AT,
    sex,
    citizenshipId,
  };
}

/** Immigrants and emigrants by sex and citizenship, from 2012, in the order series, citizenship (reviewed map order), sex, year. */
function readByCitizenship(sources: DemographySources, citizenships: CitizenshipMap): DemographyObservation[] {
  const sourceId = SOURCE_ID.migrationCitizenship;
  const sheet = readStoredSheet(sources.get(sourceId).bytes, "1");
  for (const direction of DIRECTIONS) {
    sheet.expectLabel(sheet.ref(direction.firstColumn, 4), direction.heading);
    SEXES.forEach((sexColumn, index) => sheet.expectLabel(sheet.ref(direction.firstColumn + index, 5), sexColumn.heading));
  }

  const blocks = findYearBlocks(sheet).filter((block) => block.year >= COVERAGE.migrationFrom);
  blocks.forEach((block, index) => {
    if (block.year !== COVERAGE.migrationFrom + index) {
      throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} year blocks do not run consecutively from ${COVERAGE.migrationFrom}`);
    }
  });

  const series = new Map<string, DemographyObservation[]>();
  for (const block of blocks) {
    const seen = new Set<string>();
    for (let row = block.firstRow; row <= block.lastRow; row += 1) {
      const label = sheet.label(sheet.ref("A", row));
      if (label === null) break; // a blank row ends the block; a note may follow it
      const citizenshipId = citizenships.resolve(label);
      if (seen.has(citizenshipId)) throw new DemographyStopError("layout_changed", `${label} appears twice under ${block.year} in sheet ${sheet.name}`);
      seen.add(citizenshipId);
      for (const direction of DIRECTIONS) {
        SEXES.forEach(({ sex }, index) => {
          const ref = sheet.ref(direction.firstColumn + index, row);
          const value = sheet.count(ref);
          if (value === null) throw new DemographyStopError("missing_served_cell", `Sheet ${sheet.name} has no value at ${ref} (${label}, ${block.year})`);
          const key = `${direction.seriesId}|${citizenshipId}|${sex}`;
          const rows = series.get(key) ?? [];
          rows.push(observation(direction.seriesId, block.year, value, sourceId, `${sheet.name}!${ref}`, sex, citizenshipId));
          series.set(key, rows);
        });
      }
    }
    if (!seen.has(TOTAL_ID)) throw new DemographyStopError("layout_changed", `Year ${block.year} has no Total row in sheet ${sheet.name}`);
  }

  return DIRECTIONS.flatMap((direction) =>
    citizenships.ids.flatMap((citizenshipId) =>
      SEXES.flatMap(({ sex }) => series.get(`${direction.seriesId}|${citizenshipId}|${sex}`) ?? []),
    ),
  );
}

/** Net migration from 2012. Geostat's net migration rate is a validation input and is not read. */
function readNetMigration(sources: DemographySources): DemographyObservation[] {
  const sourceId = SOURCE_ID.netMigration;
  const sheet = readStoredSheet(sources.get(sourceId).bytes, "1");
  sheet.expectLabel("B4", "Net migration");
  const yearRows = findYearRows(sheet, 5);
  const rows: DemographyObservation[] = [];
  for (let year = COVERAGE.migrationFrom; year <= Math.max(...yearRows.keys()); year += 1) {
    const row = yearRows.get(year);
    if (row === undefined) throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} of ${sourceId} has no row for ${year}`);
    const ref = `B${row}`;
    const value = sheet.count(ref);
    if (value === null) throw new DemographyStopError("missing_served_cell", `Sheet ${sheet.name} of ${sourceId} has no value at ${ref}`);
    rows.push(observation(SERIES.netMigration, year, value, sourceId, `${sheet.name}!${ref}`, "total", TOTAL_ID));
  }
  return rows;
}

/** International migration for Georgia from 2012, as Border Police data. */
export function readMigration(sources: DemographySources, citizenships: CitizenshipMap): DemographyObservation[] {
  return [...readByCitizenship(sources, citizenships), ...readNetMigration(sources)];
}

import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import type { DensityRow, DensityRows } from "./densityRows";
import { findYearColumns, readStoredSheet } from "./readStoredSheet";
import { COVERAGE, EXTENSION_REVIEWED_AT, populationEstimateBasis, SERIES, SOURCE_ID } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, DemographySources } from "./types";

const TITLE = "Density by regions (number of population per 1 sq.km)";
/** Geostat's footnote that fixes the area behind every density from 2014. The series rests on it, so a change stops preparation. */
const AREA_NOTE = "Note:  Starting from 2014, the area of the regions is given as of March, 2014";
const FIRST_UNIT_ROW = 5;

/**
 * Persons per km² for Georgia from 2014 and for the 11 regions from 2015, through the last year in the
 * file. Geostat's density is the 1 January population over a fixed area, so each value carries the
 * lineage of that population. Values are carried at the one decimal the workbook displays: its 2022
 * column is stored unrounded (122.57310344827586 displays as 122.6) and the digits past the display
 * are not published.
 */
export function readDensity(sources: DemographySources, density: DensityRows): DemographyObservation[] {
  const { row: source, bytes } = sources.get(SOURCE_ID.density);
  const sheet = readStoredSheet(bytes, "1");
  sheet.expectLabel("A1", TITLE);
  sheet.expectLabel("A4", "regions");
  sheet.findRow(AREA_NOTE);
  const columns = findYearColumns(sheet, 4);
  const lastYear = Math.max(...columns.keys());
  const columnOf = (year: number) => {
    const column = columns.get(year);
    if (column?.length !== 1) throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} needs one column under ${year}`);
    return column[0]!;
  };

  const unitRows: Array<{ row: number; label: string; unit: DensityRow }> = [];
  for (let row = FIRST_UNIT_ROW; row <= sheet.lastRow; row += 1) {
    const label = sheet.label(sheet.ref("A", row));
    if (label === null) break;
    unitRows.push({ row, label, unit: density.resolve(label) });
  }
  const labels = unitRows.map((entry) => entry.label);
  if (new Set(labels).size !== labels.length || labels.length !== density.labels.length) {
    throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} lists ${labels.length} units, expected the ${density.labels.length} reviewed rows once each`);
  }

  const rows: DemographyObservation[] = [];
  for (const { row, label, unit } of unitRows) {
    const first = unit.geographyId === MUNICIPAL_COUNTRY_ID ? COVERAGE.densityFrom : COVERAGE.unitsFrom;
    for (let year = COVERAGE.densityFrom; year <= lastYear; year += 1) {
      const ref = sheet.ref(columnOf(year), row);
      if (unit.geographyId === null) {
        if (sheet.number(ref) !== null) throw new DemographyStopError("unexpected_value", `${label} holds a value at ${sheet.name}!${ref} (${year}); it is an occupied territory`);
        continue;
      }
      if (year < first) continue;
      const value = sheet.published(ref, 1);
      if (value === null) throw new DemographyStopError("missing_served_cell", `Sheet ${sheet.name} has no value at ${ref} (${label}, ${year})`);
      rows.push({
        seriesId: SERIES.populationDensity,
        geographyId: unit.geographyId,
        year,
        value,
        unit: "persons_per_km2",
        estimateBasis: populationEstimateBasis(year),
        status: "published",
        sourceId: source.sourceId,
        sourceLocator: `${sheet.name}!${ref} [${year}-01-01]`,
        lastReviewedAt: EXTENSION_REVIEWED_AT,
      });
    }
  }
  return rows;
}

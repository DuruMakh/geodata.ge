import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import { findYearRows, readStoredSheet } from "./readStoredSheet";
import { COVERAGE, EXTENSION_REVIEWED_AT, MOTHER_AGE_GROUPS, SERIES, SOURCE_ID } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, DemographySources } from "./types";

/** Geostat's note that dates the registered data. The 2014 start rests on it, so a change to it stops preparation. */
const REGISTERED_NOTE = "Note: 1995-2013 based on the retro-projection; starting from 2014 based on the registered data";
const FIRST_YEAR_ROW = 6;

/**
 * Births per 1,000 women of each age of mother, for Georgia from 2014 (where Geostat moves from
 * retro-projection to registered data), through the last year in the file. They are the components of the
 * total fertility rate in the same table and are carried at the one decimal the workbook displays. Ordered by
 * age group, then year.
 */
export function readFertilityByAge(sources: DemographySources): DemographyObservation[] {
  const { row: source, bytes } = sources.get(SOURCE_ID.fertility);
  const sheet = readStoredSheet(bytes, "1");
  sheet.expectLabel("B4", "age of mother:");
  sheet.expectLabel("I4", "TFR");
  MOTHER_AGE_GROUPS.forEach((group, index) => sheet.expectLabel(sheet.ref(1 + index, 5), group.label));
  sheet.findRow(REGISTERED_NOTE);
  const yearRows = findYearRows(sheet, FIRST_YEAR_ROW);
  const lastYear = Math.max(...yearRows.keys());

  const rows: DemographyObservation[] = [];
  MOTHER_AGE_GROUPS.forEach((group, index) => {
    for (let year = COVERAGE.vitalFrom; year <= lastYear; year += 1) {
      const row = yearRows.get(year);
      if (row === undefined) throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} of ${source.sourceId} has no row for ${year}`);
      const ref = sheet.ref(1 + index, row);
      const value = sheet.published(ref, 1);
      if (value === null) throw new DemographyStopError("missing_served_cell", `Sheet ${sheet.name} of ${source.sourceId} has no value at ${ref}`);
      rows.push({
        seriesId: SERIES.ageSpecificFertilityRate,
        geographyId: MUNICIPAL_COUNTRY_ID,
        year,
        value,
        unit: "births_per_1000_women",
        estimateBasis: "registered",
        status: "published",
        sourceId: source.sourceId,
        sourceLocator: `${sheet.name}!${ref} [${year}]`,
        lastReviewedAt: EXTENSION_REVIEWED_AT,
        ageGroup: group.id,
      });
    }
  });
  return rows;
}

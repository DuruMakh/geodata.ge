import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import type { ReviewedAnomalies } from "./anomalies";
import type { DemographyGeography } from "./geography";
import { findYearRows, readStoredSheet } from "./readStoredSheet";
import { readUnitTable, type UnitTableOptions } from "./readUnitTable";
import { COVERAGE, populationEstimateBasis, SERIES, SOURCE_ID } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, DemographySources, EstimateBasis, Sex } from "./types";

const REVIEWED_AT = "2026-10-20";

/** The two count tables and the mid-year denominator, by Georgia, region and municipality. */
const UNIT_TABLES = [
  { sourceId: SOURCE_ID.marriages, seriesId: SERIES.marriages, scale: "count", unit: "marriages" },
  { sourceId: SOURCE_ID.divorces, seriesId: SERIES.divorces, scale: "count", unit: "divorces" },
  { sourceId: SOURCE_ID.midYear, seriesId: SERIES.midYearPopulation, scale: "half_thousands", unit: "persons" },
] as const satisfies ReadonlyArray<{ scale: UnitTableOptions["scale"] } & Record<string, string>>;

/**
 * Georgia-level averages in years: a value column of a table with one row per year, the header cells that name it, and
 * the sex it is for. Remarriages and the order of marriage are not carried.
 */
const AVERAGES: ReadonlyArray<{ sourceId: string; seriesId: string; column: string; headers: Array<[string, string]>; firstRow: number; sex?: Sex }> = [
  { sourceId: SOURCE_ID.meanAgeSpouses, seriesId: SERIES.meanAgeAtMarriage, column: "B", headers: [["B4", "Total"], ["B5", "Males"]], firstRow: 6, sex: "male" },
  { sourceId: SOURCE_ID.meanAgeSpouses, seriesId: SERIES.meanAgeAtMarriage, column: "C", headers: [["C5", "Females"]], firstRow: 6, sex: "female" },
  { sourceId: SOURCE_ID.meanAgeSpouses, seriesId: SERIES.meanAgeAtFirstMarriage, column: "D", headers: [["D4", "First marriage"], ["D5", "Males"]], firstRow: 6, sex: "male" },
  { sourceId: SOURCE_ID.meanAgeSpouses, seriesId: SERIES.meanAgeAtFirstMarriage, column: "E", headers: [["E5", "Females"]], firstRow: 6, sex: "female" },
  { sourceId: SOURCE_ID.meanAgeDivorced, seriesId: SERIES.meanAgeAtDivorce, column: "B", headers: [["B4", "Total"], ["B5", "Males"]], firstRow: 6, sex: "male" },
  { sourceId: SOURCE_ID.meanAgeDivorced, seriesId: SERIES.meanAgeAtDivorce, column: "C", headers: [["C5", "Females"]], firstRow: 6, sex: "female" },
  { sourceId: SOURCE_ID.marriageDuration, seriesId: SERIES.meanMarriageDuration, column: "B", headers: [["B4", "Average duration of marriage"]], firstRow: 5 },
];

/**
 * Registered marriages and divorces with Geostat's mid-year population (the denominator of its rates): Georgia from 1994,
 * every region and municipality from 2009, through the last year in the files; then Georgia's average ages at marriage
 * and divorce and the average length of a marriage that ended in divorce, at the one decimal Geostat displays.
 */
export function readMarriage(sources: DemographySources, geography: DemographyGeography, anomalies: ReviewedAnomalies): DemographyObservation[] {
  const rows: DemographyObservation[] = [];
  const observation = (seriesId: string, geographyId: string, year: number, value: string, unit: string, basis: EstimateBasis, sourceId: string, locator: string, sex?: Sex): DemographyObservation => ({
    seriesId,
    geographyId,
    year,
    ...(sex ? { sex } : {}),
    value,
    unit,
    estimateBasis: basis,
    status: "published",
    sourceId,
    sourceLocator: `${locator} [${year}]`,
    lastReviewedAt: REVIEWED_AT,
  });

  for (const { sourceId, seriesId, scale, unit } of UNIT_TABLES) {
    const sheet = readStoredSheet(sources.get(sourceId).bytes, "1");
    // The mid-year table's city rows are those of the event tables (2014-2016), and the events scope reads its spellings too.
    const cells = readUnitTable(sheet, geography, {
      scope: "events",
      scale,
      countryFrom: COVERAGE.marriageFrom,
      unitsFrom: COVERAGE.marriageUnitsFrom,
      acceptBlank: (ref) => anomalies.blank(sourceId, ref),
    });
    const basis = (year: number) => (seriesId === SERIES.midYearPopulation ? populationEstimateBasis(year) : "registered");
    for (const cell of cells) {
      rows.push(observation(seriesId, cell.geographyId, cell.year, String(cell.value), unit, basis(cell.year), sourceId, `${sheet.name}!${cell.refs.join("+")}`));
    }
  }

  for (const average of AVERAGES) {
    const sheet = readStoredSheet(sources.get(average.sourceId).bytes, "1");
    for (const [ref, label] of average.headers) sheet.expectLabel(ref, label);
    const yearRows = findYearRows(sheet, average.firstRow);
    for (let year = COVERAGE.marriageFrom; year <= Math.max(...yearRows.keys()); year += 1) {
      const row = yearRows.get(year);
      if (row === undefined) throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} of ${average.sourceId} has no row for ${year}`);
      const ref = `${average.column}${row}`;
      const value = sheet.published(ref, 1);
      if (value === null) throw new DemographyStopError("missing_served_cell", `Sheet ${sheet.name} of ${average.sourceId} has no value at ${ref}`);
      rows.push(observation(average.seriesId, MUNICIPAL_COUNTRY_ID, year, value, "years", "registered", average.sourceId, `${sheet.name}!${ref}`, average.sex));
    }
  }
  return rows;
}

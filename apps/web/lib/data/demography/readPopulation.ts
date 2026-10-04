import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import { ageBands } from "./calculations";
import type { DemographyGeography } from "./geography";
import { findYearColumns, readStoredSheet } from "./readStoredSheet";
import { readUnitTable } from "./readUnitTable";
import { AGE_BANDS, AGE_GROUPS, COVERAGE, populationEstimateBasis, REVIEWED_AT, SERIES, SOURCE_ID } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, DemographySources, Sex } from "./types";

/** Population on 1 January for Georgia from 2004 and for every region and municipality from 2015. */
export function readPopulation(sources: DemographySources, geography: DemographyGeography): DemographyObservation[] {
  const { row, bytes } = sources.get(SOURCE_ID.populationUnits);
  const sheet = readStoredSheet(bytes, "1");
  const cells = readUnitTable(sheet, geography, {
    scope: "population",
    scale: "thousands",
    countryFrom: COVERAGE.populationFrom,
    unitsFrom: COVERAGE.unitsFrom,
  });
  return cells.map((cell) => ({
    seriesId: SERIES.populationTotal,
    geographyId: cell.geographyId,
    year: cell.year,
    value: String(cell.value),
    unit: "persons",
    estimateBasis: populationEstimateBasis(cell.year),
    status: "published",
    sourceId: row.sourceId,
    sourceLocator: `${sheet.name}!${cell.refs.join("+")} [${cell.year}-01-01]`,
    lastReviewedAt: REVIEWED_AT,
  }));
}

/** The three column labels under each year of the age table, in the order Geostat prints them. */
const SEX_COLUMNS: ReadonlyArray<{ sex: Sex; label: string }> = [
  { sex: "total", label: "Both Sexes" },
  { sex: "male", label: "Males" },
  { sex: "female", label: "Females" },
];
const TOTAL_ROW = 6;
const FIRST_AGE_ROW = 7;

/**
 * Georgia's population on 1 January by sex and 5-year age group from 2004, with each sex's total
 * and the 0–14, 15–64 and 65+ bands added from the age groups in whole persons. Ordered by sex,
 * then the total, the 19 groups and the three bands, each by year.
 */
export function readAgeStructure(sources: DemographySources): DemographyObservation[] {
  const { row, bytes } = sources.get(SOURCE_ID.ageSex);
  const sheet = readStoredSheet(bytes, "1");
  const columns = findYearColumns(sheet, 4);
  const lastYear = Math.max(...columns.keys());
  const years = Array.from({ length: lastYear - COVERAGE.populationFrom + 1 }, (_, index) => COVERAGE.populationFrom + index);

  if (sheet.label(sheet.ref("A", TOTAL_ROW)) !== "Total") {
    throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} row ${TOTAL_ROW} is not the total row`);
  }
  AGE_GROUPS.forEach((group, index) => {
    const label = sheet.label(sheet.ref("A", FIRST_AGE_ROW + index));
    if (label !== group.label) {
      throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} row ${FIRST_AGE_ROW + index} is ${label}, expected age group ${group.label}`);
    }
  });
  if (!sheet.isBlank(sheet.ref("A", FIRST_AGE_ROW + AGE_GROUPS.length))) {
    throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} has rows below the ${AGE_GROUPS.length} reviewed age groups`);
  }
  const columnOf = (year: number, sexIndex: number) => {
    const block = columns.get(year);
    if (block?.length !== SEX_COLUMNS.length) {
      throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} needs ${SEX_COLUMNS.length} columns under ${year}`);
    }
    const found = sheet.label(sheet.ref(block[sexIndex]!, 5));
    if (found !== SEX_COLUMNS[sexIndex]!.label) {
      throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} column ${sheet.ref(block[sexIndex]!, 5)} is ${found}, expected ${SEX_COLUMNS[sexIndex]!.label}`);
    }
    return block[sexIndex]!;
  };

  const observation = (
    sex: Sex,
    ageGroup: string,
    year: number,
    seriesId: string,
    value: number,
    locator: string,
  ): DemographyObservation => ({
    seriesId,
    geographyId: MUNICIPAL_COUNTRY_ID,
    year,
    value: String(value),
    unit: "persons",
    estimateBasis: populationEstimateBasis(year),
    status: "published",
    sourceId: row.sourceId,
    sourceLocator: `${sheet.name}!${locator} [${year}-01-01]`,
    lastReviewedAt: REVIEWED_AT,
    sex,
    ageGroup,
  });
  const required = (ref: string) => {
    const value = sheet.persons(ref);
    if (value === null) throw new DemographyStopError("missing_served_cell", `Sheet ${sheet.name} has no value at ${ref}`);
    return value;
  };

  const rows: DemographyObservation[] = [];
  SEX_COLUMNS.forEach(({ sex }, sexIndex) => {
    const perYear = years.map((year) => {
      const column = columnOf(year, sexIndex);
      const totalRef = sheet.ref(column, TOTAL_ROW);
      const ages = AGE_GROUPS.map((_, index) => {
        const ref = sheet.ref(column, FIRST_AGE_ROW + index);
        return { ref, value: required(ref) };
      });
      return { year, column, total: { ref: totalRef, value: required(totalRef) }, ages, bands: ageBands(ages.map((age) => age.value)) };
    });
    const series = SERIES.populationByAgeSex;
    for (const { year, total } of perYear) rows.push(observation(sex, "total", year, series, total.value, total.ref));
    AGE_GROUPS.forEach((group, index) => {
      for (const { year, ages } of perYear) rows.push(observation(sex, group.id, year, series, ages[index]!.value, ages[index]!.ref));
    });
    for (const band of AGE_BANDS) {
      for (const { year, column, bands } of perYear) {
        const range = `${sheet.ref(column, FIRST_AGE_ROW + band.first)}:${sheet.ref(column, FIRST_AGE_ROW + band.last)} (sum)`;
        rows.push(observation(sex, band.id, year, SERIES.populationAgeBand, bands[band.id], range));
      }
    }
  });
  return rows;
}

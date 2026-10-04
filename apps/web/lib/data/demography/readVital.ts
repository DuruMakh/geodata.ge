import type { ReviewedAnomalies } from "./anomalies";
import type { DemographyGeography } from "./geography";
import { findYearRows, readStoredSheet } from "./readStoredSheet";
import type { StoredSheet } from "./readStoredSheet";
import { readUnitTable } from "./readUnitTable";
import { COVERAGE, REVIEWED_AT, SERIES, SOURCE_ID } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, DemographySources } from "./types";
import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";

/** Counts by Georgia, region and municipality. Natural increase is read as published, not recomputed. */
const COUNTS = [
  { sourceId: SOURCE_ID.births, seriesId: SERIES.liveBirths },
  { sourceId: SOURCE_ID.deaths, seriesId: SERIES.deaths },
  { sourceId: SOURCE_ID.naturalIncrease, seriesId: SERIES.naturalIncrease },
] as const;

/**
 * Georgia-level rates: one value column of a table with one row per year, headed in row 4, and the
 * decimals Geostat displays for it. The natural increase rate and net migration rate stay unserved.
 */
const RATES = [
  { sourceId: SOURCE_ID.crudeBirthRate, column: "B", header: "Rate", firstRow: 5, seriesId: SERIES.crudeBirthRate, unit: "per_1000_population", decimals: 1 },
  { sourceId: SOURCE_ID.crudeDeathRate, column: "B", header: "Rate", firstRow: 5, seriesId: SERIES.crudeDeathRate, unit: "per_1000_population", decimals: 1 },
  { sourceId: SOURCE_ID.fertility, column: "I", header: "TFR", firstRow: 6, seriesId: SERIES.totalFertilityRate, unit: "children_per_woman", decimals: 2 },
  { sourceId: SOURCE_ID.infantMortality, column: "B", header: "Both sexes", firstRow: 5, seriesId: SERIES.infantMortalityRate, unit: "per_1000_live_births", decimals: 1 },
  { sourceId: SOURCE_ID.lifeExpectancy, column: "B", header: "Both sexes", firstRow: 5, seriesId: SERIES.lifeExpectancyTotal, unit: "years", decimals: 1 },
  { sourceId: SOURCE_ID.lifeExpectancy, column: "C", header: "Males", firstRow: 5, seriesId: SERIES.lifeExpectancyMale, unit: "years", decimals: 1 },
  { sourceId: SOURCE_ID.lifeExpectancy, column: "D", header: "Females", firstRow: 5, seriesId: SERIES.lifeExpectancyFemale, unit: "years", decimals: 1 },
] as const;

/**
 * Registered vital events: Georgia from 2014 (where Geostat moves from retro-projection to registered
 * data) and every region and municipality from 2015, through the last year in the files; then the
 * Georgia-level rates from 2014. A year is a calendar year, so a locator carries the year alone.
 */
export function readVitalEvents(
  sources: DemographySources,
  geography: DemographyGeography,
  anomalies: ReviewedAnomalies,
): DemographyObservation[] {
  const rows: DemographyObservation[] = [];
  const observation = (
    seriesId: string,
    geographyId: string,
    year: number,
    value: string,
    unit: string,
    sourceId: string,
    locator: string,
  ): DemographyObservation => ({
    seriesId,
    geographyId,
    year,
    value,
    unit,
    estimateBasis: "registered",
    status: "published",
    sourceId,
    sourceLocator: `${locator} [${year}]`,
    lastReviewedAt: REVIEWED_AT,
  });

  for (const { sourceId, seriesId } of COUNTS) {
    const sheet = readStoredSheet(sources.get(sourceId).bytes, "1");
    const cells = readUnitTable(sheet, geography, {
      scope: "events",
      scale: "count",
      countryFrom: COVERAGE.vitalFrom,
      unitsFrom: COVERAGE.unitsFrom,
      acceptStray: (ref, value) => anomalies.accepts(sourceId, ref, value),
    });
    for (const cell of cells) {
      rows.push(observation(seriesId, cell.geographyId, cell.year, String(cell.value), "persons", sourceId, `${sheet.name}!${cell.refs.join("+")}`));
    }
  }

  const sheets = new Map<string, StoredSheet>();
  for (const rate of RATES) {
    const sheet = sheets.get(rate.sourceId) ?? readStoredSheet(sources.get(rate.sourceId).bytes, "1");
    sheets.set(rate.sourceId, sheet);
    sheet.expectLabel(`${rate.column}4`, rate.header);
    const yearRows = findYearRows(sheet, rate.firstRow);
    for (let year = COVERAGE.vitalFrom; year <= Math.max(...yearRows.keys()); year += 1) {
      const row = yearRows.get(year);
      if (row === undefined) throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} of ${rate.sourceId} has no row for ${year}`);
      const ref = `${rate.column}${row}`;
      const value = sheet.published(ref, rate.decimals);
      if (value === null) throw new DemographyStopError("missing_served_cell", `Sheet ${sheet.name} of ${rate.sourceId} has no value at ${ref}`);
      rows.push(observation(rate.seriesId, MUNICIPAL_COUNTRY_ID, year, value, rate.unit, rate.sourceId, `${sheet.name}!${ref}`));
    }
  }
  return rows;
}

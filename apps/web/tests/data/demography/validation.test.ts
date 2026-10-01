import { beforeAll, describe, expect, test } from "vitest";
import type * as XLSX from "xlsx";
import { loadReviewedAnomalies, type ReviewedAnomalies } from "../../../lib/data/demography/anomalies";
import { loadCitizenships, type CitizenshipMap } from "../../../lib/data/demography/citizenship";
import { loadDemographyGeography, type DemographyGeography } from "../../../lib/data/demography/geography";
import { readMigration } from "../../../lib/data/demography/readMigration";
import { readAgeStructure, readPopulation } from "../../../lib/data/demography/readPopulation";
import { findYearBlocks, readStoredSheet } from "../../../lib/data/demography/readStoredSheet";
import { readVitalEvents } from "../../../lib/data/demography/readVital";
import { SOURCE_ID } from "../../../lib/data/demography/series";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { DemographyStopError } from "../../../lib/data/demography/stops";
import type { DemographyObservation, DemographySources } from "../../../lib/data/demography/types";
import { validateDemography } from "../../../lib/data/demography/validation";
import { editSource, repositoryRoot, setCell, unitCell } from "./helpers";

let sources: DemographySources;
let geography: DemographyGeography;
let anomalies: ReviewedAnomalies;
let citizenships: CitizenshipMap;
let observations: DemographyObservation[];
beforeAll(async () => {
  [sources, geography, anomalies, citizenships] = await Promise.all([
    loadDemographySources(repositoryRoot),
    loadDemographyGeography(repositoryRoot),
    loadReviewedAnomalies(repositoryRoot),
    loadCitizenships(repositoryRoot),
  ]);
  observations = readAll(sources);
});

/** What preparation does before it writes anything: read every family, then validate the whole. */
function readAll(from: DemographySources): DemographyObservation[] {
  return [
    ...readPopulation(from, geography),
    ...readAgeStructure(from),
    ...readVitalEvents(from, geography, anomalies),
    ...readMigration(from, citizenships),
  ];
}
const prepare = (from: DemographySources, previous?: readonly DemographyObservation[]) =>
  validateDemography({ observations: readAll(from), sources: from, geography, previous });
/** The condition of the stop a run raises, or why it did not stop. */
const stop = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof DemographyStopError ? error.condition : `not a stop: ${String(error)}`;
  }
  return "no error";
};
const bump = (sheet: XLSX.WorkSheet, ref: string, by: number) => setCell(sheet, ref, (sheet[ref]!.v as number) + by);

describe("validation of the reviewed archive", () => {
  test("passes and records the archive and the coverage", () => {
    const report = validateDemography({ observations, sources, geography });

    expect(report.vintage).toBe("2026-10");
    expect(report.sources).toHaveLength(26);
    expect(report.sources[0]).toMatchObject({ sourceId: "source.geostat_municipal_population", role: "canonical_input", bytes: 34_994 });
    expect(report.sources.every((source) => /^[0-9a-f]{64}$/.test(source.sha256))).toBe(true);
    const coverage = (seriesId: string) => report.coverage.find((entry) => entry.seriesId === seriesId);
    expect(coverage("demography.population_total")).toEqual({ family: "population", seriesId: "demography.population_total", geographies: 76, firstYear: 2004, lastYear: 2026, rows: 923 });
    expect(coverage("demography.population_by_age_sex")).toMatchObject({ family: "structure", geographies: 1, firstYear: 2004, rows: 3 * 20 * 23 });
    expect(coverage("demography.live_births")).toMatchObject({ family: "vital", geographies: 76, firstYear: 2014, lastYear: 2025, rows: 837 });
    expect(coverage("demography.life_expectancy_male")).toMatchObject({ family: "vital", geographies: 1, firstYear: 2014, lastYear: 2025 });
    expect(coverage("demography.net_migration")).toMatchObject({ family: "migration", firstYear: 2012, lastYear: 2025, rows: 14 });
    expect(report.coverage).toHaveLength(16);
  });

  test("balances the 1 January population over the whole archive, with the census step the only residual", () => {
    const { balancing } = validateDemography({ observations, sources, geography });

    expect(balancing.fromYear).toBe(1994);
    expect(balancing.toYear).toBe(2025);
    expect(balancing.residuals).toHaveLength(32);
    expect(balancing.residuals.filter((entry) => entry.residual !== 0)).toEqual([{ fromYear: 2024, residual: 225_922 }]);
    expect(balancing.censusStep).toEqual({ fromYear: 2024, residual: 225_922 });
  });

  test("anchors 1 January 2025 to the census: +847 persons in total and every municipality within 1%", () => {
    const { censusAnchor } = validateDemography({ observations, sources, geography });

    expect(censusAnchor).toMatchObject({ censusCount: 3_929_581, january2025: 3_930_428, difference: 847, municipalities: 64, largestGapMunicipality: "68" });
    expect(censusAnchor.largestGapPercent).toBeCloseTo(0.818, 3);
  });

  test("recomputes every published rate within its published rounding and reports the observed deviation", () => {
    const { rates, midYear } = validateDemography({ observations, sources, geography });
    const observed = (check: string) => rates.find((entry) => entry.check === check)!;

    expect(midYear).toMatchObject({ firstYear: 2014, lastYear: 2025 });
    expect(midYear.maxDifferencePersons).toBeLessThan(1e-6);
    expect(rates.map((entry) => entry.check)).toEqual([
      "crude_birth_rate",
      "crude_death_rate",
      "natural_increase_rate",
      "net_migration_rate",
      "infant_mortality_rate",
      "total_fertility_rate",
      "share_65_plus",
      "total_dependency_ratio",
      "child_dependency_ratio",
      "old_age_dependency_ratio",
      "life_expectancy_abridged_vs_headline",
    ]);
    for (const entry of rates) expect(entry.maxDeviation, entry.check).toBeLessThanOrEqual(entry.bound + 1e-9);
    expect(observed("crude_birth_rate").maxDeviation).toBeCloseTo(0.028, 3);
    expect(observed("crude_death_rate").maxDeviation).toBeCloseTo(0.047, 3);
    expect(observed("natural_increase_rate").maxDeviation).toBeCloseTo(0.045, 3);
    expect(observed("net_migration_rate").maxDeviation).toBeCloseTo(0.048, 3);
    expect(observed("infant_mortality_rate").maxDeviation).toBeCloseTo(0.044, 3);
    expect(observed("total_fertility_rate")).toMatchObject({ bound: 0.005, maxDeviation: 0.005 });
    expect(observed("share_65_plus").maxDeviation).toBeCloseTo(0.0496, 3);
    expect(observed("life_expectancy_abridged_vs_headline")).toMatchObject({ bound: 0.25, firstYear: 1994, lastYear: 2025, at: "2009 males" });
    expect(observed("life_expectancy_abridged_vs_headline").maxDeviation).toBeCloseTo(0.158, 3);
  });

  test("inventories the blank cells it expects: occupied territories, city rows outside their years, absent countries", () => {
    const { blankCells } = validateDemography({ observations, sources, geography });
    const table = (sourceId: string) => blankCells.unitTables.find((entry) => entry.sourceId === sourceId)!;

    expect(table(SOURCE_ID.populationUnits)).toEqual({ sourceId: SOURCE_ID.populationUnits, excludedUnitCells: 6 * 12, cityRowCellsOutsideWindow: 7 * 9, ignoredValueCells: 0 });
    expect(table(SOURCE_ID.births)).toMatchObject({ excludedUnitCells: 6 * 11, cityRowCellsOutsideWindow: 7 * 9, ignoredValueCells: 0 });
    expect(table(SOURCE_ID.naturalIncrease)).toMatchObject({ excludedUnitCells: 6 * 11, cityRowCellsOutsideWindow: 7 * 9 - 1, ignoredValueCells: 1 });
    expect(blankCells.absentCitizenshipRows).toBeGreaterThan(0);
  });

  test("compares with the previous capture: new years pass, a changed or removed value stops", () => {
    const earlier = observations.filter((row) => row.year <= 2024);
    const changed = observations.map((row) => (row.seriesId === "demography.live_births" && row.geographyId === "country.georgia" && row.year === 2020 ? { ...row, value: "1" } : row));
    const removed = [...observations, { ...observations[0]!, year: 1999 }];

    expect(() => validateDemography({ observations, sources, geography, previous: earlier })).not.toThrow();
    expect(() => validateDemography({ observations, sources, geography, previous: changed })).toThrow(/live_births\|country\.georgia\|2020\S* value 1 → \d+/);
    expect(stop(() => validateDemography({ observations, sources, geography, previous: changed }))).toBe("revision");
    expect(stop(() => validateDemography({ observations, sources, geography, previous: removed }))).toBe("revision");
  });
});

describe("one corrupted case per stop condition", () => {
  test("an unreviewed label", () => {
    const renamed = editSource(sources, SOURCE_ID.deaths, (sheet) => setCell(sheet, "A92", "Khashuri Municipalty"));

    expect(stop(() => prepare(renamed))).toBe("unreviewed_label");
  });

  test("a changed layout", () => {
    const moved = editSource(sources, SOURCE_ID.births, (sheet) => setCell(sheet, "A4", "units"));

    expect(stop(() => prepare(moved))).toBe("layout_changed");
  });

  test("a new missing-value pattern", () => {
    const blank = editSource(sources, SOURCE_ID.populationUnits, (sheet) => setCell(sheet, unitCell(sheet, "C. Batumi Municipality", 2020), "-"));

    expect(stop(() => prepare(blank))).toBe("missing_served_cell");
  });

  test("a display-rounded value read in place of a stored one", () => {
    const rounded = editSource(sources, SOURCE_ID.populationUnits, (sheet) => setCell(sheet, "AG6", 1335.7));

    expect(stop(() => prepare(rounded))).toBe("identity_failed");
  });

  test("a second balancing residual, in a year the data does not serve", () => {
    const second = editSource(sources, SOURCE_ID.netMigration, (sheet) => bump(sheet, "B16", 1));

    expect(stop(() => prepare(second))).toBe("balancing_residual");
  });

  test("a census step that moved", () => {
    const moved = editSource(sources, SOURCE_ID.netMigration, (sheet) => bump(sheet, "B35", 1));

    expect(stop(() => prepare(moved))).toBe("census_residual_changed");
  });

  test("a municipality outside 1% of its census count", () => {
    const sheetOf = readStoredSheet(sources.get(SOURCE_ID.census).bytes, "1");
    const row = sheetOf.findRow("Kazbegi Municipality");
    const far = editSource(sources, SOURCE_ID.census, (sheet) => setCell(sheet, `B${row}`, Math.round((sheet[`B${row}`]!.v as number) * 0.9)));

    expect(stop(() => prepare(far))).toBe("census_anchor");
  });

  test("a rate that no longer matches its counts, for every recomputation", () => {
    const corrupted = [
      editSource(sources, SOURCE_ID.crudeBirthRate, (sheet) => setCell(sheet, "B31", 14)),
      editSource(sources, SOURCE_ID.fertility, (sheet) => setCell(sheet, "I31", 2.5)),
      editSource(sources, SOURCE_ID.infantMortality, (sheet) => setCell(sheet, "B30", 9.9)),
      editSource(sources, SOURCE_ID.naturalIncreaseRate, (sheet) => setCell(sheet, "B31", 5)),
      editSource(sources, SOURCE_ID.share65Plus, (sheet) => setCell(sheet, "B31", 99)),
      editSource(sources, SOURCE_ID.ageDependency, (sheet) => setCell(sheet, "E32", 99)),
      editSource(sources, SOURCE_ID.lifeTables, (sheet) => bump(sheet, "H7", 1)),
    ];

    for (const from of corrupted) expect(stop(() => prepare(from))).toBe("rate_deviation");
  });

  test("a changed 2015 to 2024 value", () => {
    const earlier = observations.map((row) => (row.seriesId === "demography.population_total" && row.geographyId === "04" && row.year === 2018 ? { ...row, value: "1" } : row));

    expect(stop(() => validateDemography({ observations, sources, geography, previous: earlier }))).toBe("revision");
  });

  test("a part that no longer adds to its whole, wherever the whole is read", () => {
    const sexes = editSource(sources, SOURCE_ID.ageSex, (sheet) => bump(sheet, "CR20", 1));
    const midYear = editSource(sources, SOURCE_ID.midYear, (sheet) => bump(sheet, "AG5", 1));
    const total32 = readStoredSheet(sources.get(SOURCE_ID.migrationAgeSex).bytes, "1");
    const block2012 = findYearBlocks(total32).find((block) => block.year === 2012)!;
    const totalRow = total32.findRow("Total", { fromRow: block2012.firstRow, toRow: block2012.lastRow });
    const tables = editSource(sources, SOURCE_ID.migrationAgeSex, (sheet) => bump(sheet, `B${totalRow}`, 1));

    expect(stop(() => prepare(sexes))).toBe("identity_failed");
    expect(stop(() => prepare(midYear))).toBe("identity_failed");
    expect(stop(() => prepare(tables))).toBe("identity_failed");
  });

  test("a row outside the coverage rules, a repeated key and a geography nobody reviewed", () => {
    const births = observations.find((row) => row.seriesId === "demography.live_births")!;
    const early = [...observations, { ...births, year: 2013 }];
    const regional = [...observations, { ...observations.find((row) => row.seriesId === "demography.net_migration")!, geographyId: "region.adjara" }];
    const repeated = [...observations, births];
    const unknown = [...observations, { ...births, geographyId: "05", year: 2020 }];

    for (const rows of [early, regional, repeated, unknown]) expect(stop(() => validateDemography({ observations: rows, sources, geography }))).toBe("layout_changed");
  });
});

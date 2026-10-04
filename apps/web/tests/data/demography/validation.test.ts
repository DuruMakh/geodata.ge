import { beforeAll, describe, expect, test } from "vitest";
import type * as XLSX from "xlsx";
import { loadReviewedAnomalies, type ReviewedAnomalies } from "../../../lib/data/demography/anomalies";
import { loadCitizenships, type CitizenshipMap } from "../../../lib/data/demography/citizenship";
import { groupMigrationByCitizenship, loadCitizenshipGroups, type CitizenshipGroups } from "../../../lib/data/demography/citizenshipGroups";
import { loadDensityRows, type DensityRows } from "../../../lib/data/demography/densityRows";
import { loadDemographyGeography, type DemographyGeography } from "../../../lib/data/demography/geography";
import { readCensusAge } from "../../../lib/data/demography/readCensusAge";
import { readDensity } from "../../../lib/data/demography/readDensity";
import { readFertilityByAge } from "../../../lib/data/demography/readFertilityAge";
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
let groups: CitizenshipGroups;
let density: DensityRows;
let observations: DemographyObservation[];
beforeAll(async () => {
  [sources, geography, anomalies, citizenships] = await Promise.all([
    loadDemographySources(repositoryRoot),
    loadDemographyGeography(repositoryRoot),
    loadReviewedAnomalies(repositoryRoot),
    loadCitizenships(repositoryRoot),
  ]);
  groups = await loadCitizenshipGroups(repositoryRoot, citizenships);
  density = await loadDensityRows(repositoryRoot, geography.regions.map((region) => region.id));
  observations = readAll(sources);
});

/** What preparation does before it writes anything: read every family, then validate the whole. */
function readAll(from: DemographySources): DemographyObservation[] {
  const migration = readMigration(from, citizenships);
  return [
    ...readPopulation(from, geography),
    ...readAgeStructure(from),
    ...readVitalEvents(from, geography, anomalies),
    ...migration,
    ...groupMigrationByCitizenship(migration, groups),
    ...readDensity(from, density),
    ...readCensusAge(from, geography),
    ...readFertilityByAge(from),
  ];
}
const prepare = (from: DemographySources, previous?: readonly DemographyObservation[]) =>
  validateDemography({ observations: readAll(from), sources: from, geography, density, previous });
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
    const report = validateDemography({ observations, sources, geography, density });

    expect(report.vintage).toBe("2026-10");
    expect(report.sources).toHaveLength(28);
    expect(report.sources[0]).toMatchObject({ sourceId: "source.geostat_municipal_population", role: "canonical_input", bytes: 34_994 });
    expect(report.sources.every((source) => /^[0-9a-f]{64}$/.test(source.sha256))).toBe(true);
    const coverage = (seriesId: string) => report.coverage.find((entry) => entry.seriesId === seriesId);
    expect(coverage("demography.population_total")).toEqual({ family: "population", seriesId: "demography.population_total", geographies: 76, firstYear: 2004, lastYear: 2026, rows: 923 });
    expect(coverage("demography.population_by_age_sex")).toMatchObject({ family: "structure", geographies: 1, firstYear: 2004, rows: 3 * 20 * 23 });
    expect(coverage("demography.live_births")).toMatchObject({ family: "vital", geographies: 76, firstYear: 2014, lastYear: 2025, rows: 837 });
    expect(coverage("demography.life_expectancy_male")).toMatchObject({ family: "vital", geographies: 1, firstYear: 2014, lastYear: 2025 });
    expect(coverage("demography.net_migration")).toMatchObject({ family: "migration", firstYear: 2012, lastYear: 2025, rows: 14 });
    expect(coverage("demography.population_density")).toEqual({ family: "density", seriesId: "demography.population_density", geographies: 12, firstYear: 2014, lastYear: 2026, rows: 13 + 11 * 12 });
    expect(coverage("demography.immigrants_by_citizenship_group")).toEqual({ family: "migration", seriesId: "demography.immigrants_by_citizenship_group", geographies: 1, firstYear: 2012, lastYear: 2025, rows: 6 * 3 * 14 });
    expect(coverage("demography.emigrants_by_citizenship_group")).toMatchObject({ family: "migration", geographies: 1, rows: 6 * 3 * 14 });
    expect(coverage("demography.census_population_by_age")).toEqual({ family: "census", seriesId: "demography.census_population_by_age", geographies: 12, firstYear: 2024, lastYear: 2024, rows: 12 * 9 * 18 });
    expect(coverage("demography.census_population_by_settlement")).toEqual({ family: "census", seriesId: "demography.census_population_by_settlement", geographies: 76, firstYear: 2024, lastYear: 2024, rows: 76 * 9 });
    expect(coverage("demography.age_specific_fertility_rate")).toEqual({ family: "fertility", seriesId: "demography.age_specific_fertility_rate", geographies: 1, firstYear: 2014, lastYear: 2025, rows: 7 * 12 });
    expect(report.coverage).toHaveLength(22);
  });

  test("checks the whole census age table, municipal age rows included, and records what it covered", () => {
    const { censusSnapshot } = validateDemography({ observations, sources, geography, density });

    // 75 printed units, each a unit row and 18 age rows, in nine columns; Georgia and the 64 municipalities agree with the census unit table.
    expect(censusSnapshot).toEqual({ units: 75, cellsChecked: 75 * 19 * 9, agreeingWithCensusUnitTable: 65 });
  });

  test("balances the 1 January population over the whole archive, with the census step the only residual", () => {
    const { balancing } = validateDemography({ observations, sources, geography, density });

    expect(balancing.fromYear).toBe(1994);
    expect(balancing.toYear).toBe(2025);
    expect(balancing.residuals).toHaveLength(32);
    expect(balancing.residuals.filter((entry) => entry.residual !== 0)).toEqual([{ fromYear: 2024, residual: 225_922 }]);
    expect(balancing.censusStep).toEqual({ fromYear: 2024, residual: 225_922 });
  });

  test("anchors 1 January 2025 to the census: +847 persons in total and every municipality within 1%", () => {
    const { censusAnchor } = validateDemography({ observations, sources, geography, density });

    expect(censusAnchor).toMatchObject({ censusCount: 3_929_581, january2025: 3_930_428, difference: 847, municipalities: 64, largestGapMunicipality: "68" });
    expect(censusAnchor.largestGapPercent).toBeCloseTo(0.818, 3);
  });

  test("recomputes every published rate within its published rounding and reports the observed deviation", () => {
    const { rates, midYear } = validateDemography({ observations, sources, geography, density });
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
      "population_density",
      "age_specific_fertility_vs_total_fertility_rate",
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
    expect(observed("population_density")).toMatchObject({ bound: 0.05, firstYear: 2014, lastYear: 2026 });
    expect(observed("age_specific_fertility_vs_total_fertility_rate")).toMatchObject({ bound: 0.005, firstYear: 2014, lastYear: 2025, maxDeviation: 0.005 });
  });

  test("inventories the blank cells it expects: occupied territories, city rows outside their years, absent countries", () => {
    const { blankCells } = validateDemography({ observations, sources, geography, density });
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

    expect(() => validateDemography({ observations, sources, geography, density, previous: earlier })).not.toThrow();
    expect(() => validateDemography({ observations, sources, geography, density, previous: changed })).toThrow(/live_births\|country\.georgia\|2020\S* value 1 → \d+/);
    expect(stop(() => validateDemography({ observations, sources, geography, density, previous: changed }))).toBe("revision");
    expect(stop(() => validateDemography({ observations, sources, geography, density, previous: removed }))).toBe("revision");
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

  test("a density that no longer matches its population and area", () => {
    const region = editSource(sources, SOURCE_ID.density, (sheet) => setCell(sheet, unitCell(sheet, "Guria", 2024), 99));
    const nudged = editSource(sources, SOURCE_ID.density, (sheet) => bump(sheet, unitCell(sheet, "Georgia", 2020), 0.2));

    expect(stop(() => prepare(region))).toBe("rate_deviation");
    expect(stop(() => prepare(nudged))).toBe("rate_deviation");
  });

  test("citizenship groups that no longer add up to the published total, or to both sexes", () => {
    const russia = (row: DemographyObservation) => row.seriesId === "demography.immigrants_by_citizenship_group" && row.citizenshipId === "citizenship.russian_federation" && row.year === 2020;
    const total = observations.map((row) => (russia(row) && row.sex === "total" ? { ...row, value: String(Number(row.value) + 1) } : row));
    const male = observations.map((row) => (russia(row) && row.sex === "male" ? { ...row, value: String(Number(row.value) + 1) } : row));

    expect(stop(() => validateDemography({ observations: total, sources, geography, density }))).toBe("identity_failed");
    expect(stop(() => validateDemography({ observations: male, sources, geography, density }))).toBe("identity_failed");
  });

  test("a municipal census age cell that no longer adds to its region, which no served row shows", () => {
    const row = readStoredSheet(sources.get(SOURCE_ID.censusAge).bytes, "1").findRow("Keda Municipality");
    // Add one boy aged 5-9 to Keda in every cell that must move with him (both sexes, males; total and urban; the age row and the
    // unit total), so the municipality stays consistent with itself and only the regional and national sums can notice.
    const municipal = editSource(sources, SOURCE_ID.censusAge, (sheet) => {
      for (const at of [row, row + 2]) for (const column of ["B", "C", "E", "F"]) bump(sheet, `${column}${at}`, 1);
    });

    expect(stop(() => prepare(municipal))).toBe("identity_failed");
  });

  test("a census age table that disagrees with the census unit table", () => {
    const disagree = editSource(sources, SOURCE_ID.census, (sheet) => bump(sheet, "C6", 1));

    expect(stop(() => prepare(disagree))).toBe("identity_failed");
  });

  test("served census rows that no longer add up: urban and rural to the total, ages to the settlement total", () => {
    const urban = observations.map((row) =>
      row.seriesId === "demography.census_population_by_settlement" && row.geographyId === "region.tbilisi" && row.sex === "total" && row.settlement === "urban" ? { ...row, value: String(Number(row.value) + 1) } : row,
    );
    const ages = observations.map((row) =>
      row.seriesId === "demography.census_population_by_age" && row.geographyId === "country.georgia" && row.sex === "total" && row.settlement === "total" && row.ageGroup === "age_0_4" ? { ...row, value: String(Number(row.value) + 1) } : row,
    );

    expect(stop(() => validateDemography({ observations: urban, sources, geography, density }))).toBe("identity_failed");
    expect(stop(() => validateDemography({ observations: ages, sources, geography, density }))).toBe("identity_failed");
  });

  test("age-specific fertility rates that no longer match the total fertility rate", () => {
    const rate = (row: DemographyObservation) => row.seriesId === "demography.age_specific_fertility_rate" && row.ageGroup === "mother_25_29" && row.year === 2020;
    const shifted = observations.map((row) => (rate(row) ? { ...row, value: String(Number(row.value) + 10) } : row));

    expect(stop(() => validateDemography({ observations: shifted, sources, geography, density }))).toBe("rate_deviation");
  });

  test("a changed 2015 to 2024 value", () => {
    const earlier = observations.map((row) => (row.seriesId === "demography.population_total" && row.geographyId === "04" && row.year === 2018 ? { ...row, value: "1" } : row));

    expect(stop(() => validateDemography({ observations, sources, geography, density, previous: earlier }))).toBe("revision");
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

  test("a manifest that states different served years than its rows cover", () => {
    const stale = (sourceId: string, servedYearMax: number) => ({
      ...sources,
      rows: sources.rows.map((row) => (row.sourceId === sourceId ? { ...row, servedYearMax } : row)),
    });

    expect(() => validateDemography({ observations, sources, geography, density })).not.toThrow();
    expect(stop(() => validateDemography({ observations, sources: stale("source.geostat_demography_births", 2024), geography, density }))).toBe("layout_changed");
    expect(stop(() => validateDemography({ observations, sources: stale("source.geostat_municipal_population", 2025), geography, density }))).toBe("layout_changed");
  });

  test("a row outside the coverage rules, a repeated key and a geography nobody reviewed", () => {
    const births = observations.find((row) => row.seriesId === "demography.live_births")!;
    const early = [...observations, { ...births, year: 2013 }];
    const regional = [...observations, { ...observations.find((row) => row.seriesId === "demography.net_migration")!, geographyId: "region.adjara" }];
    const repeated = [...observations, births];
    const unknown = [...observations, { ...births, geographyId: "05", year: 2020 }];
    const georgiaDensity = observations.find((row) => row.seriesId === "demography.population_density" && row.geographyId === "country.georgia")!;
    const municipalDensity = [...observations, { ...georgiaDensity, geographyId: "04", year: 2020 }];
    const earlyDensity = [...observations, { ...georgiaDensity, year: 2013 }];
    const earlyRegionalDensity = [...observations, { ...georgiaDensity, geographyId: "region.adjara", year: 2014 }];

    const fertilityRate = observations.find((row) => row.seriesId === "demography.age_specific_fertility_rate")!;
    const regionalFertility = [...observations, { ...fertilityRate, geographyId: "region.adjara", ageGroup: "mother_20_24" }];
    const earlyFertility = [...observations, { ...fertilityRate, year: 2013 }];
    const censusAge = observations.find((row) => row.seriesId === "demography.census_population_by_age")!;
    const municipalCensusAge = [...observations, { ...censusAge, geographyId: "04" }];
    const lateCensus = [...observations, { ...censusAge, year: 2025, ageGroup: "age_0_4", sex: "male" as const, settlement: "urban" as const }];

    for (const rows of [early, regional, repeated, unknown, municipalDensity, earlyDensity, earlyRegionalDensity, municipalCensusAge, lateCensus, regionalFertility, earlyFertility]) expect(stop(() => validateDemography({ observations: rows, sources, geography, density }))).toBe("layout_changed");
  });
});

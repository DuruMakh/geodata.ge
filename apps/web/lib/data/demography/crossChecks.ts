import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import type { DensityRows } from "./densityRows";
import type { DemographyGeography } from "./geography";
import { CENSUS_SETTLEMENTS, CENSUS_SEXES, readCensusGrid } from "./readCensusAge";
import { findYearBlocks, findYearColumns, findYearRows, readStoredSheet } from "./readStoredSheet";
import { AGE_BANDS, CENSUS_STEP, COVERAGE, SERIES, SOURCE_ID } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, DemographySources, Settlement, Sex } from "./types";

/**
 * Checks that read the archived tables beyond the served rows, or compare the served rows with a
 * table Geostat publishes only for validation. Tolerances come from the audit's observed precision
 * and are not widened to pass.
 */

const GEORGIA = MUNICIPAL_COUNTRY_ID;
const ALL_CITIZENSHIPS = "citizenship.total";

/** A rate Geostat displays to one decimal sits within half of 0.1 of its exact value; to two, within half of 0.01. */
const ONE_DECIMAL = 0.05;
const TWO_DECIMALS = 0.005;
const LIFE_EXPECTANCY_BOUND = 0.25;
const CENSUS_ANCHOR_PERCENT = 1;
const MID_YEAR_TOLERANCE = 1e-6;
/** A bound is met when exceeded only by float noise, which is about 1e-16. */
const EPSILON = 1e-9;

const round6 = (value: number) => Number(value.toFixed(6));
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const SEX_LABEL: Record<Sex, string> = { total: "both sexes", male: "males", female: "females" };
const SEXES: readonly Sex[] = ["total", "male", "female"];

/** A served Georgia, region or municipality value. A missing row stops preparation. */
export type Lookup = (
  seriesId: string,
  geographyId: string,
  year: number,
  dims?: { sex?: Sex; ageGroup?: string; citizenshipId?: string; settlement?: Settlement },
) => number;

const sheetOf = (sources: DemographySources, sourceId: string) => readStoredSheet(sources.get(sourceId).bytes, "1");

function required<T>(value: T | null, where: string): T {
  if (value === null) throw new DemographyStopError("missing_served_cell", `No value at ${where}`);
  return value;
}

function need(values: ReadonlyMap<number, number>, year: number, what: string): number {
  const value = values.get(year);
  if (value === undefined) throw new DemographyStopError("layout_changed", `The archive has no ${what} for ${year}`);
  return value;
}

/** Georgia's row of a unit table for every year the file holds, in whole persons or events. */
function georgiaRow(sources: DemographySources, sourceId: string, scale: "thousands" | "count"): Map<number, number> {
  const sheet = sheetOf(sources, sourceId);
  const row = sheet.findRow("Georgia");
  const values = new Map<number, number>();
  for (const [year, [column]] of findYearColumns(sheet, 4)) {
    const ref = sheet.ref(column!, row);
    values.set(year, required(scale === "thousands" ? sheet.persons(ref) : sheet.count(ref), `${sourceId} ${sheet.name}!${ref}`));
  }
  return values;
}

/** One value column of a table with one row per year, after its headers are checked. */
function yearTable(sources: DemographySources, sourceId: string, firstRow: number, headers: ReadonlyArray<readonly [string, string]>) {
  const sheet = sheetOf(sources, sourceId);
  for (const [ref, label] of headers) sheet.expectLabel(ref, label);
  const rows = findYearRows(sheet, firstRow);
  const refOf = (year: number, column: string) => {
    const row = rows.get(year);
    if (row === undefined) throw new DemographyStopError("layout_changed", `${sourceId} has no row for ${year}`);
    return `${column}${row}`;
  };
  const where = (ref: string) => `${sourceId} ${sheet.name}!${ref}`;
  return {
    years: [...rows.keys()],
    /** A rate at the one decimal Geostat displays. */
    rate: (year: number, column: string) => Number(required(sheet.published(refOf(year, column), 1), where(refOf(year, column)))),
    count: (year: number, column: string) => required(sheet.count(refOf(year, column)), where(refOf(year, column))),
    number: (year: number, column: string) => required(sheet.number(refOf(year, column)), where(refOf(year, column))),
  };
}

export type Balancing = {
  fromYear: number;
  toYear: number;
  censusStep: { fromYear: number; residual: number };
  residuals: Array<{ fromYear: number; residual: number }>;
};

/**
 * The change in Georgia's 1 January population equals births minus deaths plus net migration, exactly
 * in whole persons, over every year the archive holds, served or not. The census step is the only
 * residual allowed, and it must equal the reviewed recalculation.
 */
export function checkBalancing(sources: DemographySources): Balancing {
  const population = georgiaRow(sources, SOURCE_ID.populationUnits, "thousands");
  const births = georgiaRow(sources, SOURCE_ID.births, "count");
  const deaths = georgiaRow(sources, SOURCE_ID.deaths, "count");
  const netTable = yearTable(sources, SOURCE_ID.netMigration, 5, [["B4", "Net migration"]]);
  const net = new Map(netTable.years.map((year) => [year, netTable.count(year, "B")]));

  const years = [...births.keys()].sort((a, b) => a - b);
  const residuals = years.map((year) => ({
    fromYear: year,
    residual:
      need(population, year + 1, "1 January population") -
      need(population, year, "1 January population") -
      (need(births, year, "births") - need(deaths, year, "deaths") + need(net, year, "net migration")),
  }));
  for (const { fromYear, residual } of residuals) {
    if (fromYear === CENSUS_STEP.fromYear) {
      if (residual !== CENSUS_STEP.residual) {
        throw new DemographyStopError("census_residual_changed", `The census step ${fromYear}→${fromYear + 1} is ${residual}, reviewed as ${CENSUS_STEP.residual}`);
      }
    } else if (residual !== 0) {
      throw new DemographyStopError("balancing_residual", `The population does not balance ${fromYear}→${fromYear + 1}: residual ${residual}`);
    }
  }
  return {
    fromYear: years[0]!,
    toYear: years.at(-1)!,
    censusStep: { fromYear: CENSUS_STEP.fromYear, residual: CENSUS_STEP.residual },
    residuals,
  };
}

/** Geostat's mid-year population in persons, which is a half where the two 1 January values it averages differ by an odd number. */
export function readMidYear(sources: DemographySources): Map<number, number> {
  const sheet = sheetOf(sources, SOURCE_ID.midYear);
  const row = sheet.findRow("Georgia");
  const values = new Map<number, number>();
  for (const [year, [column]] of findYearColumns(sheet, 4)) {
    const ref = sheet.ref(column!, row);
    values.set(year, required(sheet.number(ref), `${SOURCE_ID.midYear} ${sheet.name}!${ref}`) * 1000);
  }
  return values;
}

/**
 * Mid-year population is the 1 January value plus half of that year's natural increase and net
 * migration. In 2024 that is the average of the 2024 value and the pre-census 2025 value, so the 2024
 * rates sit on the pre-census basis and the 2025 rates on the census basis.
 */
export function checkMidYear(midYear: ReadonlyMap<number, number>, lookup: Lookup, years: readonly number[]) {
  let worst = 0;
  for (const year of years) {
    const implied =
      lookup(SERIES.populationTotal, GEORGIA, year) +
      (lookup(SERIES.naturalIncrease, GEORGIA, year) + lookup(SERIES.netMigration, GEORGIA, year, { sex: "total", citizenshipId: ALL_CITIZENSHIPS })) / 2;
    const difference = Math.abs(need(midYear, year, "mid-year population") - implied);
    if (difference > MID_YEAR_TOLERANCE) {
      throw new DemographyStopError("identity_failed", `Mid-year population ${year} is ${midYear.get(year)}, expected ${implied}`);
    }
    worst = Math.max(worst, difference);
  }
  return { firstYear: years[0]!, lastYear: years.at(-1)!, maxDifferencePersons: round6(worst) };
}

/** A census row is a municipality only if the reviewed map says so; villages, boroughs and districts are not in it. */
function municipalityOf(geography: DemographyGeography, label: string) {
  try {
    const unit = geography.resolve(label, "census");
    return unit.kind === "municipality" ? unit : null;
  } catch (error) {
    if (error instanceof DemographyStopError && error.condition === "unreviewed_label") return null;
    throw error;
  }
}

export type CensusAnchor = {
  censusCount: number;
  january2025: number;
  difference: number;
  municipalities: number;
  largestGapPercent: number;
  largestGapMunicipality: string;
};

/**
 * The census counts people at 14 November 2024 and the recalculated 1 January 2025 value follows 48
 * days later. The difference for Georgia is reported; every municipality must be within 1% of its count.
 */
export function checkCensusAnchor(sources: DemographySources, geography: DemographyGeography, lookup: Lookup): CensusAnchor {
  const sheet = sheetOf(sources, SOURCE_ID.census);
  sheet.expectLabel("A6", "Georgia");
  sheet.expectLabel("B5", "Both Sexes");
  const censusCount = required(sheet.count("B6"), `${SOURCE_ID.census} B6`);

  const counts = new Map<string, number>();
  for (let row = 7; row <= sheet.lastRow; row += 1) {
    const label = sheet.label(sheet.ref("A", row));
    const unit = label === null ? null : municipalityOf(geography, label);
    if (unit === null) continue;
    if (counts.has(unit.geographyId)) throw new DemographyStopError("census_anchor", `The census table lists ${label} twice`);
    counts.set(unit.geographyId, required(sheet.count(sheet.ref("B", row)), `${SOURCE_ID.census} B${row}`));
  }

  let largest = { percent: 0, code: "" };
  for (const municipality of geography.municipalities) {
    const count = counts.get(municipality.code);
    if (count === undefined) throw new DemographyStopError("census_anchor", `The census table has no count for ${municipality.sourceLabel}`);
    const percent = Math.abs(lookup(SERIES.populationTotal, municipality.code, CENSUS_STEP.toYear) / count - 1) * 100;
    if (percent > CENSUS_ANCHOR_PERCENT + EPSILON) {
      throw new DemographyStopError("census_anchor", `${municipality.sourceLabel} is ${percent.toFixed(3)}% from its census count, beyond ${CENSUS_ANCHOR_PERCENT}%`);
    }
    if (percent > largest.percent) largest = { percent, code: municipality.code };
  }
  const january2025 = lookup(SERIES.populationTotal, GEORGIA, CENSUS_STEP.toYear);
  return {
    censusCount,
    january2025,
    difference: january2025 - censusCount,
    municipalities: counts.size,
    largestGapPercent: round6(largest.percent),
    largestGapMunicipality: largest.code,
  };
}

export type CensusSnapshot = { units: number; cellsChecked: number; agreeingWithCensusUnitTable: number };

/**
 * The whole census age table, municipal age rows included, which no served row shows: every unit's
 * sexes add to both sexes, urban and rural to the total, and its 18 age groups to its own total;
 * municipalities add up to their region and to Georgia for every age group and column; and Georgia
 * and each municipality's total agree with the census unit table, which comes from the same count.
 * All exact, in whole persons. The table's dash is the nil its own note defines.
 */
export function checkCensusAge(sources: DemographySources, geography: DemographyGeography): CensusSnapshot {
  const grid = readCensusGrid(sources, geography);
  const offsets = Array.from({ length: 19 }, (_, index) => index);
  const equal = (what: string, parts: number, whole: number) => {
    if (parts !== whole) throw new DemographyStopError("identity_failed", `Census age table, ${what}: the parts add to ${parts}, not ${whole}`);
  };
  const at = (unitRow: number, offset: number, sex: Sex, settlement: Settlement) => grid.count(unitRow + offset, sex, settlement);

  let cells = 0;
  for (const [geographyId, unitRow] of grid.printed) {
    for (const offset of offsets) {
      const where = `${geographyId} row ${unitRow + offset}`;
      for (const { settlement } of CENSUS_SETTLEMENTS) {
        equal(`${where} ${settlement}: males and females against both sexes`, at(unitRow, offset, "male", settlement) + at(unitRow, offset, "female", settlement), at(unitRow, offset, "total", settlement));
      }
      for (const { sex } of CENSUS_SEXES) {
        equal(`${where} ${sex}: urban and rural against the total`, at(unitRow, offset, sex, "urban") + at(unitRow, offset, sex, "rural"), at(unitRow, offset, sex, "total"));
      }
      cells += CENSUS_SEXES.length * CENSUS_SETTLEMENTS.length;
    }
    for (const { sex } of CENSUS_SEXES) {
      for (const { settlement } of CENSUS_SETTLEMENTS) {
        const ages = offsets.slice(1).reduce((total, offset) => total + at(unitRow, offset, sex, settlement), 0);
        equal(`${geographyId} ${sex} ${settlement}: the age groups against the unit total`, ages, at(unitRow, 0, sex, settlement));
      }
    }
  }

  const memberSum = (members: readonly string[], offset: number, sex: Sex, settlement: Settlement) =>
    members.reduce((total, code) => total + at(grid.rowOf(code), offset, sex, settlement), 0);
  const allMunicipalities = geography.municipalities.map((municipality) => municipality.code);
  const groups = [
    { id: GEORGIA, members: allMunicipalities },
    ...geography.regions
      .filter((region) => grid.printed.has(region.id))
      .map((region) => ({ id: region.id, members: geography.municipalities.filter((municipality) => municipality.regionId === region.id).map((municipality) => municipality.code) })),
  ];
  for (const { id, members } of groups) {
    for (const offset of offsets) {
      for (const { sex } of CENSUS_SEXES) {
        for (const { settlement } of CENSUS_SETTLEMENTS) {
          equal(`${id} row offset ${offset} ${sex} ${settlement}: its municipalities against the unit`, memberSum(members, offset, sex, settlement), at(grid.rowOf(id), offset, sex, settlement));
        }
      }
    }
  }

  const unitTable = sheetOf(sources, SOURCE_ID.census);
  unitTable.expectLabel("A6", "Georgia");
  const printed = new Map<string, number>([[GEORGIA, 6]]);
  for (let row = 7; row <= unitTable.lastRow; row += 1) {
    const label = unitTable.label(unitTable.ref("A", row));
    const unit = label === null ? null : municipalityOf(geography, label);
    if (unit === null) continue;
    if (printed.has(unit.geographyId)) throw new DemographyStopError("identity_failed", `The census unit table lists ${label} twice`);
    printed.set(unit.geographyId, row);
  }
  for (const code of allMunicipalities) {
    if (!printed.has(code)) throw new DemographyStopError("identity_failed", `The census unit table has no row for municipality ${code}`);
  }
  for (const [geographyId, row] of printed) {
    CENSUS_SEXES.forEach(({ sex }, index) => {
      const there = required(unitTable.count(unitTable.ref(1 + index, row)), `${SOURCE_ID.census} ${unitTable.ref(1 + index, row)}`);
      equal(`${geographyId} ${sex} against the census unit table`, at(grid.rowOf(geographyId), 0, sex, "total"), there);
    });
  }
  return { units: grid.printed.size, cellsChecked: cells, agreeingWithCensusUnitTable: printed.size };
}

export type RateCheck = { check: string; firstYear: number; lastYear: number; maxDeviation: number; at: string; bound: number };
type Point = { year: number; label: string; published: number; recomputed: number };

function worst(check: string, bound: number, points: readonly Point[]): RateCheck {
  const deviation = (point: Point) => Math.abs(point.published - point.recomputed);
  const top = points.reduce((best, point) => (deviation(point) > deviation(best) ? point : best));
  if (deviation(top) > bound + EPSILON) {
    throw new DemographyStopError("rate_deviation", `${check} is ${top.published} at ${top.label} but recomputes to ${top.recomputed.toFixed(4)}, beyond ${bound}`);
  }
  const years = points.map((point) => point.year);
  return { check, firstYear: Math.min(...years), lastYear: Math.max(...years), maxDeviation: round6(deviation(top)), at: top.label, bound };
}

/**
 * Geostat's density is the 1 January population over a fixed area, so every served density is
 * recomputed from the served population and the reviewed area and must sit within the one decimal
 * the table displays. This is also what keeps the reviewed areas honest.
 */
export function checkDensity(rows: readonly DemographyObservation[], lookup: Lookup, density: DensityRows): RateCheck {
  const points = rows
    .filter((row) => row.seriesId === SERIES.populationDensity)
    .map((row) => ({
      year: row.year,
      label: `${row.geographyId} ${row.year}`,
      published: Number(row.value),
      recomputed: lookup(SERIES.populationTotal, row.geographyId, row.year) / density.areaOf(row.geographyId),
    }));
  return worst("population_density", ONE_DECIMAL, points);
}

/**
 * Every published rate recomputed from counts: the served rates over the served years, and the rates
 * and ratios Geostat publishes only for validation (natural increase, net migration, share aged 65+, the
 * dependency ratios) against the served counts and age bands.
 */
export function checkRates(
  sources: DemographySources,
  lookup: Lookup,
  midYear: ReadonlyMap<number, number>,
  years: { vital: readonly number[]; structure: readonly number[] },
): RateCheck[] {
  const georgia = (seriesId: string, year: number, dims?: Parameters<Lookup>[3]) => lookup(seriesId, GEORGIA, year, dims);
  const allCitizens = { sex: "total", citizenshipId: ALL_CITIZENSHIPS } as const;
  const perThousand = (events: number, year: number) => (events * 1000) / need(midYear, year, "mid-year population");
  const point = (year: number, published: number, recomputed: number, label = String(year)): Point => ({ year, label, published, recomputed });

  const naturalIncreaseRate = yearTable(sources, SOURCE_ID.naturalIncreaseRate, 5, [["B4", "Rate"]]);
  const netMigration = yearTable(sources, SOURCE_ID.netMigration, 5, [["B4", "Net migration"], ["C4", "Rate per 1 000 persons"]]);
  const infantDeaths = yearTable(sources, SOURCE_ID.infantDeaths, 6, [["B4", "Infant mortality (1)"], ["B5", "Both sexes"]]);
  const AGE_OF_MOTHER = ["-20", "20-24", "25-29", "30-34", "35-39", "40-44", "45-54"];
  const fertility = yearTable(sources, SOURCE_ID.fertility, 6, [["I4", "TFR"], ...AGE_OF_MOTHER.map((label, index) => [`${"BCDEFGH"[index]}5`, label] as const)]);
  const share = yearTable(sources, SOURCE_ID.share65Plus, 5, [["B4", "Both sexes"], ["C4", "Males"], ["D4", "Females"]]);
  const dependency = yearTable(sources, SOURCE_ID.ageDependency, 6, [
    ["B4", "Total dependency ratio (1)"],
    ["E4", "Child dependency ratio (2)"],
    ["H4", "Old-age dependency ratio (3)"],
    ...["B", "C", "D", "E", "F", "G", "H", "I", "J"].map((column, index) => [`${column}5`, ["Both sexes", "Males", "Females"][index % 3]!] as const),
  ]);

  const vital = (series: string, rate: number, published: (year: number) => number, events: (year: number) => number) =>
    worst(series, rate, years.vital.map((year) => point(year, published(year), perThousand(events(year), year))));
  const bySex = (check: string, columns: readonly string[], table: ReturnType<typeof yearTable>, recompute: (young: number, working: number, old: number) => number) =>
    worst(
      check,
      ONE_DECIMAL,
      years.structure.flatMap((year) =>
        SEXES.map((sex, index) => {
          const [young, working, old] = AGE_BANDS.map((band) => georgia(SERIES.populationAgeBand, year, { sex, ageGroup: band.id }));
          return point(year, table.rate(year, columns[index]!), recompute(young!, working!, old!), `${year} ${SEX_LABEL[sex]}`);
        }),
      ),
    );

  return [
    vital("crude_birth_rate", ONE_DECIMAL, (year) => georgia(SERIES.crudeBirthRate, year), (year) => georgia(SERIES.liveBirths, year)),
    vital("crude_death_rate", ONE_DECIMAL, (year) => georgia(SERIES.crudeDeathRate, year), (year) => georgia(SERIES.deaths, year)),
    vital("natural_increase_rate", ONE_DECIMAL, (year) => naturalIncreaseRate.rate(year, "B"), (year) => georgia(SERIES.naturalIncrease, year)),
    vital("net_migration_rate", ONE_DECIMAL, (year) => netMigration.rate(year, "C"), (year) => georgia(SERIES.netMigration, year, allCitizens)),
    worst(
      "infant_mortality_rate",
      ONE_DECIMAL,
      years.vital.map((year) => point(year, georgia(SERIES.infantMortalityRate, year), (infantDeaths.count(year, "B") * 1000) / georgia(SERIES.liveBirths, year))),
    ),
    worst(
      "total_fertility_rate",
      TWO_DECIMALS,
      years.vital.map((year) =>
        point(year, georgia(SERIES.totalFertilityRate, year), (5 * sum([..."BCDEFGH"].map((column) => fertility.number(year, column)))) / 1000),
      ),
    ),
    bySex("share_65_plus", ["B", "C", "D"], share, (young, working, old) => (old * 100) / (young + working + old)),
    bySex("total_dependency_ratio", ["B", "C", "D"], dependency, (young, working, old) => ((young + old) * 100) / working),
    bySex("child_dependency_ratio", ["E", "F", "G"], dependency, (young, working) => (young * 100) / working),
    bySex("old_age_dependency_ratio", ["H", "I", "J"], dependency, (_young, working, old) => (old * 100) / working),
    checkLifeExpectancy(sources),
  ];
}

/**
 * Life expectancy at birth in the abridged life tables (table 27) against the headline table 28.
 * Table 28 is actuarial from 2002 and table 27 stays abridged, so the two differ by up to 0.157
 * years: a method difference, reported and not corrected.
 */
function checkLifeExpectancy(sources: DemographySources): RateCheck {
  const tables = sheetOf(sources, SOURCE_ID.lifeTables);
  const columns = findYearColumns(tables, 4);
  const headline = yearTable(sources, SOURCE_ID.lifeExpectancy, 5, [["B4", "Both sexes"], ["C4", "Males"], ["D4", "Females"]]);
  const blocks = [
    { sex: "total" as const, label: "Both sexes", firstRow: 7, column: "B" },
    { sex: "male" as const, label: "Males", firstRow: 27, column: "C" },
    { sex: "female" as const, label: "Females", firstRow: 47, column: "D" },
  ];
  for (const block of blocks) {
    tables.expectLabel(tables.ref("B", block.firstRow - 1), block.label);
    tables.expectLabel(tables.ref("A", block.firstRow), "0");
  }
  const points: Point[] = [];
  for (const [year, block] of columns) {
    if (block.length !== 7) throw new DemographyStopError("layout_changed", `${SOURCE_ID.lifeTables} needs 7 columns under ${year}`);
    tables.expectLabel(tables.ref(block[6]!, 5), "ex");
    for (const { sex, firstRow, column } of blocks) {
      const abridged = required(tables.number(tables.ref(block[6]!, firstRow)), `${SOURCE_ID.lifeTables} ${year}`);
      points.push({ year, label: `${year} ${SEX_LABEL[sex]}`, published: headline.number(year, column), recomputed: abridged });
    }
  }
  return worst("life_expectancy_abridged_vs_headline", LIFE_EXPECTANCY_BOUND, points);
}

/** The migration totals of the age table (32) and the citizenship table (33) agree in every served year. */
export function checkMigrationTotals(sources: DemographySources): void {
  const totals = (sourceId: string) => {
    const sheet = sheetOf(sources, sourceId);
    return new Map(
      findYearBlocks(sheet)
        .filter((block) => block.year >= COVERAGE.migrationFrom)
        .map((block) => {
          const row = sheet.findRow("Total", { fromRow: block.firstRow, toRow: block.lastRow });
          return [block.year, ["B", "C", "D", "E", "F", "G"].map((column) => required(sheet.count(`${column}${row}`), `${sourceId} ${column}${row}`))] as const;
        }),
    );
  };
  const byAge = totals(SOURCE_ID.migrationAgeSex);
  for (const [year, values] of totals(SOURCE_ID.migrationCitizenship)) {
    if (byAge.get(year)?.join() !== values.join()) {
      throw new DemographyStopError("identity_failed", `The migration totals of tables 32 and 33 differ in ${year}`);
    }
  }
}

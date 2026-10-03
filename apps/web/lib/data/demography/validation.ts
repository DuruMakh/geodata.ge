import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import {
  checkBalancing,
  checkCensusAge,
  checkCensusAnchor,
  checkDensity,
  checkFertilityByAge,
  checkMidYear,
  checkMigrationTotals,
  checkRates,
  readMidYear,
} from "./crossChecks";
import type { Balancing, CensusAnchor, CensusSnapshot, Lookup, RateCheck } from "./crossChecks";
import type { DensityRows } from "./densityRows";
import { readUnitRows } from "./geography";
import type { DemographyGeography, UnitScope } from "./geography";
import { findYearColumns, readStoredSheet } from "./readStoredSheet";
import { AGE_BANDS, AGE_GROUPS, CENSUS_AGE_GROUPS, CENSUS_YEAR, COVERAGE, FAMILIES, SERIES, SOURCE_ID } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, DemographySources, Settlement, Sex } from "./types";

type Family = keyof typeof FAMILIES;
const GEORGIA = MUNICIPAL_COUNTRY_ID;
const ALL_CITIZENSHIPS = "citizenship.total";
const AGGREGATE_CITIZENSHIPS = new Set([ALL_CITIZENSHIPS, "citizenship.other", "citizenship.stateless", "citizenship.not_stated"]);
const SEXES: readonly Sex[] = ["total", "male", "female"];
/** Each direction of migration, as Geostat publishes it and as the reviewed citizenship groups add it up. */
const DIRECTIONS = [
  { published: SERIES.immigrants, grouped: SERIES.immigrantsByCitizenshipGroup },
  { published: SERIES.emigrants, grouped: SERIES.emigrantsByCitizenshipGroup },
] as const;
const CITIZENSHIP_SERIES: readonly string[] = DIRECTIONS.flatMap((direction) => [direction.published, direction.grouped]);
/** Series published for Georgia, every region and every municipality. The rest are Georgia-level only. */
const UNIT_SERIES: readonly string[] = [SERIES.populationTotal, SERIES.liveBirths, SERIES.deaths, SERIES.naturalIncrease];
/** Series published for Georgia and the 11 regions only: Geostat's density table has no municipal rows. */
const REGION_SERIES: readonly string[] = [SERIES.populationDensity, SERIES.censusPopulationByAge];
/** Series with a row for Georgia, every region and every municipality. The census split is read for all of them; the census ages for Georgia and the regions only. */
const ALL_UNIT_SERIES: readonly string[] = [...UNIT_SERIES, SERIES.censusPopulationBySettlement];
const SETTLEMENTS: readonly Settlement[] = ["total", "urban", "rural"];
const FAMILY_START: Record<Family, number> = {
  population: COVERAGE.populationFrom,
  structure: COVERAGE.populationFrom,
  vital: COVERAGE.vitalFrom,
  migration: COVERAGE.migrationFrom,
  density: COVERAGE.densityFrom,
  census: CENSUS_YEAR,
  fertility: COVERAGE.vitalFrom,
};
const FAMILY_OF = new Map<string, Family>(Object.entries(FAMILIES).flatMap(([family, ids]) => ids.map((id) => [id, family as Family] as const)));

export type ValidationInput = {
  observations: readonly DemographyObservation[];
  sources: DemographySources;
  geography: DemographyGeography;
  /** The reviewed areas behind Geostat's densities. */
  density: DensityRows;
  /** The committed canonical rows. A change to any of them stops preparation. Omit on a first build. */
  previous?: readonly DemographyObservation[];
};

export type DemographyValidationReport = {
  vintage: string;
  sources: Array<{ sourceId: string; role: string; localFile: string; sha256: string; bytes: number }>;
  coverage: Array<{ family: string; seriesId: string; geographies: number; firstYear: number; lastYear: number; rows: number }>;
  blankCells: {
    unitTables: Array<{ sourceId: string; excludedUnitCells: number; cityRowCellsOutsideWindow: number; ignoredValueCells: number }>;
    absentCitizenshipRows: number;
  };
  balancing: Balancing;
  midYear: { firstYear: number; lastYear: number; maxDifferencePersons: number };
  censusAnchor: CensusAnchor;
  censusSnapshot: CensusSnapshot;
  rates: RateCheck[];
};

type Keyed = Pick<DemographyObservation, "seriesId" | "geographyId" | "year" | "sex" | "ageGroup" | "citizenshipId" | "settlement">;
const keyOf = (row: Keyed) => [row.seriesId, row.geographyId, row.year, row.sex ?? "", row.ageGroup ?? "", row.citizenshipId ?? "", row.settlement ?? ""].join("|");
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const unique = (values: readonly number[]) => [...new Set(values)].sort((a, b) => a - b);

function indexRows(rows: readonly DemographyObservation[]): Map<string, DemographyObservation> {
  const index = new Map<string, DemographyObservation>();
  for (const row of rows) {
    const key = keyOf(row);
    if (index.has(key)) throw new DemographyStopError("layout_changed", `Duplicate observation ${key}`);
    index.set(key, row);
  }
  return index;
}

/** Geography, start years and series: the served rows are exactly the reviewed coverage, and nothing earlier. */
function checkCoverage(rows: readonly DemographyObservation[], geography: DemographyGeography): void {
  const reviewed = new Set([GEORGIA, ...geography.regions.map((region) => region.id), ...geography.municipalities.map((municipality) => municipality.code)]);
  const regional = new Set([GEORGIA, ...geography.regions.map((region) => region.id)]);
  const geographiesOf = new Map<string, Set<string>>();
  for (const row of rows) {
    const family = FAMILY_OF.get(row.seriesId);
    if (!family) throw new DemographyStopError("layout_changed", `Unknown series ${row.seriesId}`);
    if (!reviewed.has(row.geographyId)) throw new DemographyStopError("layout_changed", `${row.seriesId} has a row for ${row.geographyId}, which is not a reviewed unit`);
    const regionSeries = REGION_SERIES.includes(row.seriesId);
    if (family === "census" && row.year !== CENSUS_YEAR) throw new DemographyStopError("layout_changed", `${row.seriesId} has a row for ${row.year}; the census counts hold ${CENSUS_YEAR} only`);
    if (row.geographyId !== GEORGIA && !ALL_UNIT_SERIES.includes(row.seriesId) && !(regionSeries && regional.has(row.geographyId))) {
      throw new DemographyStopError("layout_changed", `${row.seriesId} is published for ${regionSeries ? "Georgia and the regions" : "Georgia"} only, not ${row.geographyId}`);
    }
    const start = row.geographyId === GEORGIA ? FAMILY_START[family] : COVERAGE.unitsFrom;
    if (row.year < start) throw new DemographyStopError("layout_changed", `${row.seriesId} has a ${row.geographyId} row for ${row.year}, before its start year ${start}`);
    geographiesOf.set(row.seriesId, (geographiesOf.get(row.seriesId) ?? new Set()).add(row.geographyId));
  }
  for (const seriesId of FAMILY_OF.keys()) {
    const expected = ALL_UNIT_SERIES.includes(seriesId) ? reviewed.size : REGION_SERIES.includes(seriesId) ? regional.size : 1;
    if ((geographiesOf.get(seriesId)?.size ?? 0) !== expected) {
      throw new DemographyStopError("layout_changed", `${seriesId} covers ${geographiesOf.get(seriesId)?.size ?? 0} geographies, expected ${expected}`);
    }
  }
}

/** The years the manifest states for each canonical input are the years its rows cover, so a citation claims neither more nor less than the data. */
function checkServedYears(sources: DemographySources, rows: readonly DemographyObservation[]): void {
  for (const source of sources.rows.filter((entry) => entry.role === "canonical_input")) {
    const years = rows.filter((row) => row.sourceId === source.sourceId).map((row) => row.year);
    const first = years.length > 0 ? Math.min(...years) : null;
    const last = years.length > 0 ? Math.max(...years) : null;
    if (first !== source.servedYearMin || last !== source.servedYearMax) {
      throw new DemographyStopError(
        "layout_changed",
        `${source.sourceId} serves ${first}–${last}, but the manifest states ${source.servedYearMin}–${source.servedYearMax}`,
      );
    }
  }
}

/** Parts add to wholes exactly, in whole persons, for every identity the audit established. */
function checkWholes(rows: readonly DemographyObservation[], lookup: Lookup, geography: DemographyGeography): void {
  const equal = (what: string, parts: number, whole: number) => {
    if (parts !== whole) throw new DemographyStopError("identity_failed", `${what}: the parts add to ${parts}, not ${whole}`);
  };
  const georgiaYears = (seriesId: string) => unique(rows.filter((row) => row.seriesId === seriesId && row.geographyId === GEORGIA).map((row) => row.year));

  for (const seriesId of UNIT_SERIES) {
    for (const year of georgiaYears(seriesId).filter((year) => year >= COVERAGE.unitsFrom)) {
      const municipal = geography.municipalities.map((municipality) => ({ regionId: municipality.regionId, value: lookup(seriesId, municipality.code, year) }));
      equal(`${seriesId} ${year}: the municipalities against Georgia`, sum(municipal.map((entry) => entry.value)), lookup(seriesId, GEORGIA, year));
      for (const region of geography.regions) {
        const members = municipal.filter((entry) => entry.regionId === region.id);
        equal(`${seriesId} ${year}: the members of ${region.id}`, sum(members.map((entry) => entry.value)), lookup(seriesId, region.id, year));
      }
    }
  }

  for (const row of rows.filter((entry) => entry.seriesId === SERIES.naturalIncrease)) {
    const births = lookup(SERIES.liveBirths, row.geographyId, row.year);
    const deaths = lookup(SERIES.deaths, row.geographyId, row.year);
    equal(`natural increase ${row.geographyId} ${row.year}: births minus deaths`, births - deaths, Number(row.value));
  }

  for (const year of georgiaYears(SERIES.populationByAgeSex)) {
    const cell = (sex: Sex, ageGroup: string, seriesId: string = SERIES.populationByAgeSex) => lookup(seriesId, GEORGIA, year, { sex, ageGroup });
    for (const sex of SEXES) {
      equal(`${year} ${sex}: the age groups against the total`, sum(AGE_GROUPS.map((group) => cell(sex, group.id))), cell(sex, "total"));
      equal(`${year} ${sex}: the age bands against the total`, sum(AGE_BANDS.map((band) => cell(sex, band.id, SERIES.populationAgeBand))), cell(sex, "total"));
    }
    const parts = [
      { id: "total", seriesId: SERIES.populationByAgeSex },
      ...AGE_GROUPS.map((group) => ({ id: group.id, seriesId: SERIES.populationByAgeSex })),
      ...AGE_BANDS.map((band) => ({ id: band.id, seriesId: SERIES.populationAgeBand })),
    ];
    for (const { id, seriesId } of parts) {
      equal(`${year} ${id}: males and females against both sexes`, cell("male", id, seriesId) + cell("female", id, seriesId), cell("total", id, seriesId));
    }
    equal(`${year}: Georgia in the population table against the age table`, lookup(SERIES.populationTotal, GEORGIA, year), cell("total", "total"));
  }

  const allCitizens = { sex: "total", citizenshipId: ALL_CITIZENSHIPS } as const;
  for (const year of georgiaYears(SERIES.netMigration)) {
    const net = lookup(SERIES.immigrants, GEORGIA, year, allCitizens) - lookup(SERIES.emigrants, GEORGIA, year, allCitizens);
    equal(`${year}: immigrants minus emigrants against net migration`, net, lookup(SERIES.netMigration, GEORGIA, year, allCitizens));
  }
  const citizenships = new Map<string, { parts: number; total: number | undefined }>();
  const sexes = new Map<string, Partial<Record<Sex, number>>>();
  for (const row of rows.filter((entry) => CITIZENSHIP_SERIES.includes(entry.seriesId))) {
    const value = Number(row.value);
    if (DIRECTIONS.some((direction) => direction.published === row.seriesId)) {
      const group = citizenships.get(`${row.seriesId} ${row.year} ${row.sex}`) ?? { parts: 0, total: undefined };
      if (row.citizenshipId === ALL_CITIZENSHIPS) group.total = value;
      else group.parts += value;
      citizenships.set(`${row.seriesId} ${row.year} ${row.sex}`, group);
    }
    sexes.set(`${row.seriesId} ${row.year} ${row.citizenshipId}`, { ...sexes.get(`${row.seriesId} ${row.year} ${row.citizenshipId}`), [row.sex!]: value });
  }
  for (const [key, group] of citizenships) {
    if (group.total === undefined) throw new DemographyStopError("layout_changed", `${key} has no total row`);
    equal(`${key}: the citizenships against the total`, group.parts, group.total);
  }
  for (const [key, bySex] of sexes) equal(`${key}: males and females against both sexes`, bySex.male! + bySex.female!, bySex.total!);
  for (const { published, grouped } of DIRECTIONS) {
    for (const sex of SEXES) {
      for (const year of georgiaYears(SERIES.netMigration)) {
        const parts = rows.filter((row) => row.seriesId === grouped && row.sex === sex && row.year === year);
        equal(`${grouped} ${year} ${sex}: the citizenship groups against the published total`, sum(parts.map((row) => Number(row.value))), lookup(published, GEORGIA, year, { sex, citizenshipId: ALL_CITIZENSHIPS }));
      }
    }
  }
}

/**
 * The served census counts add up exactly: in every unit the sexes to both sexes and urban plus rural to
 * the total; the 64 municipalities to each region and to Georgia; and, for Georgia and the regions, the
 * 18 age groups to the unit's total and the regions to Georgia for every age group. The table the rows
 * come from is checked in full, municipal age rows included, by checkCensusAge.
 */
function checkCensusWholes(lookup: Lookup, geography: DemographyGeography): void {
  const equal = (what: string, parts: number, whole: number) => {
    if (parts !== whole) throw new DemographyStopError("identity_failed", `Census ${what}: the parts add to ${parts}, not ${whole}`);
  };
  const split = (id: string, sex: Sex, settlement: Settlement) => lookup(SERIES.censusPopulationBySettlement, id, CENSUS_YEAR, { sex, settlement });
  const aged = (id: string, sex: Sex, settlement: Settlement, ageGroup: string) => lookup(SERIES.censusPopulationByAge, id, CENSUS_YEAR, { sex, settlement, ageGroup });
  const regionIds = geography.regions.map((region) => region.id);
  const aggregates = [GEORGIA, ...regionIds];
  const municipalities = geography.municipalities;

  for (const id of [...aggregates, ...municipalities.map((municipality) => municipality.code)]) {
    for (const settlement of SETTLEMENTS) equal(`${id} ${settlement}: males and females against both sexes`, split(id, "male", settlement) + split(id, "female", settlement), split(id, "total", settlement));
    for (const sex of SEXES) equal(`${id} ${sex}: urban and rural against the total`, split(id, sex, "urban") + split(id, sex, "rural"), split(id, sex, "total"));
  }
  for (const sex of SEXES) {
    for (const settlement of SETTLEMENTS) {
      equal(`${sex} ${settlement}: the municipalities against Georgia`, sum(municipalities.map((municipality) => split(municipality.code, sex, settlement))), split(GEORGIA, sex, settlement));
      for (const regionId of regionIds) {
        const members = municipalities.filter((municipality) => municipality.regionId === regionId);
        equal(`${sex} ${settlement}: the members of ${regionId}`, sum(members.map((municipality) => split(municipality.code, sex, settlement))), split(regionId, sex, settlement));
      }
      for (const group of CENSUS_AGE_GROUPS) {
        equal(`${sex} ${settlement} ${group.id}: the regions against Georgia`, sum(regionIds.map((regionId) => aged(regionId, sex, settlement, group.id))), aged(GEORGIA, sex, settlement, group.id));
      }
      for (const id of aggregates) {
        equal(`${id} ${sex} ${settlement}: the age groups against the unit total`, sum(CENSUS_AGE_GROUPS.map((group) => aged(id, sex, settlement, group.id))), split(id, sex, settlement));
      }
    }
  }
  for (const id of aggregates) {
    for (const group of CENSUS_AGE_GROUPS) {
      for (const settlement of SETTLEMENTS) equal(`${id} ${settlement} ${group.id}: males and females against both sexes`, aged(id, "male", settlement, group.id) + aged(id, "female", settlement, group.id), aged(id, "total", settlement, group.id));
      for (const sex of SEXES) equal(`${id} ${sex} ${group.id}: urban and rural against the total`, aged(id, sex, "urban", group.id) + aged(id, sex, "rural", group.id), aged(id, sex, "total", group.id));
    }
  }
}

/** Every change to a previously captured row, including a row that disappeared. New rows are not changes. */
function findRevisions(previous: readonly DemographyObservation[], index: ReadonlyMap<string, DemographyObservation>): string[] {
  const problems: string[] = [];
  for (const before of previous) {
    const key = keyOf(before);
    const after = index.get(key);
    if (!after) {
      problems.push(`${key} removed`);
      continue;
    }
    for (const field of ["value", "unit", "estimateBasis", "sourceId"] as const) {
      if (after[field] !== before[field]) problems.push(`${key} ${field} ${before[field]} → ${after[field]}`);
    }
  }
  return problems;
}

/**
 * The cells the readers leave out on purpose, counted again straight from the unit tables: the occupied
 * territories, a city row outside the years Geostat prints it, and the reviewed stray cell. A served cell
 * that is blank has already stopped preparation.
 */
function unitTableInventory(sources: DemographySources, geography: DemographyGeography, sourceId: string, scope: UnitScope) {
  const sheet = readStoredSheet(sources.get(sourceId).bytes, "1");
  const columns = findYearColumns(sheet, 4);
  const lastYear = Math.max(...columns.keys());
  const tally = { sourceId, excludedUnitCells: 0, cityRowCellsOutsideWindow: 0, ignoredValueCells: 0 };
  for (const { row, label } of readUnitRows(sheet)) {
    const unit = geography.resolve(label, scope);
    if (unit.kind !== "excluded" && unit.kind !== "city_component") continue;
    for (let year = COVERAGE.unitsFrom; year <= lastYear; year += 1) {
      if (unit.kind === "city_component" && year >= unit.startYear && year <= unit.endYear) continue;
      if (sheet.number(sheet.ref(columns.get(year)![0]!, row)) !== null) tally.ignoredValueCells += 1;
      else if (unit.kind === "excluded") tally.excludedUnitCells += 1;
      else tally.cityRowCellsOutsideWindow += 1;
    }
  }
  return tally;
}

/** Countries Geostat lists in some years and folds into Other in the rest: no row, never a zero. */
function absentCitizenshipRows(rows: readonly DemographyObservation[]): number {
  const immigrants = rows.filter((row) => row.seriesId === SERIES.immigrants && row.sex === "total");
  const countries = new Set(immigrants.filter((row) => !AGGREGATE_CITIZENSHIPS.has(row.citizenshipId!)).map((row) => row.citizenshipId!));
  const listed = immigrants.filter((row) => countries.has(row.citizenshipId!)).length;
  return unique(immigrants.map((row) => row.year)).length * countries.size - listed;
}

/**
 * Validates the served rows against the audit's identities and the archive. Throws a named
 * DemographyStopError at the first check that fails, and otherwise returns the report. The order
 * matters: the archive balance runs before the identities, so a changed census step is named as such.
 */
export function validateDemography(input: ValidationInput): DemographyValidationReport {
  const { observations: rows, sources, geography, density, previous } = input;
  const index = indexRows(rows);
  const lookup: Lookup = (seriesId, geographyId, year, dims = {}) => {
    const key = keyOf({ seriesId, geographyId, year, ...dims });
    const row = index.get(key);
    if (!row) throw new DemographyStopError("layout_changed", `Missing observation ${key}`);
    return Number(row.value);
  };

  checkCoverage(rows, geography);
  checkServedYears(sources, rows);
  const balancing = checkBalancing(sources);
  checkWholes(rows, lookup, geography);
  checkCensusWholes(lookup, geography);
  checkMigrationTotals(sources);

  const georgiaYears = (seriesId: string) => unique(rows.filter((row) => row.seriesId === seriesId && row.geographyId === GEORGIA).map((row) => row.year));
  const years = { vital: georgiaYears(SERIES.liveBirths), structure: georgiaYears(SERIES.populationByAgeSex) };
  const midYearValues = readMidYear(sources);
  const midYear = checkMidYear(midYearValues, lookup, years.vital);
  const censusAnchor = checkCensusAnchor(sources, geography, lookup);
  const censusSnapshot = checkCensusAge(sources, geography);
  const rates = [...checkRates(sources, lookup, midYearValues, years), checkDensity(rows, lookup, density), checkFertilityByAge(rows, lookup)];

  const problems = previous ? findRevisions(previous, index) : [];
  if (problems.length > 0) {
    throw new DemographyStopError("revision", `Geostat revised previously captured history; review before accepting (${problems.length}):\n${problems.slice(0, 20).join("\n")}`);
  }

  return {
    vintage: sources.vintage,
    sources: sources.rows.map((row) => ({ sourceId: row.sourceId, role: row.role, localFile: row.localFile, sha256: row.sha256, bytes: row.bytes })),
    coverage: Object.entries(FAMILIES).flatMap(([family, seriesIds]) =>
      seriesIds.map((seriesId) => {
        const own = rows.filter((row) => row.seriesId === seriesId);
        const ownYears = own.map((row) => row.year);
        return {
          family,
          seriesId,
          geographies: new Set(own.map((row) => row.geographyId)).size,
          firstYear: Math.min(...ownYears),
          lastYear: Math.max(...ownYears),
          rows: own.length,
        };
      }),
    ),
    blankCells: {
      unitTables: [
        unitTableInventory(sources, geography, SOURCE_ID.populationUnits, "population"),
        unitTableInventory(sources, geography, SOURCE_ID.births, "events"),
        unitTableInventory(sources, geography, SOURCE_ID.deaths, "events"),
        unitTableInventory(sources, geography, SOURCE_ID.naturalIncrease, "events"),
      ],
      absentCitizenshipRows: absentCitizenshipRows(rows),
    },
    balancing,
    midYear,
    censusAnchor,
    censusSnapshot,
    rates,
  };
}

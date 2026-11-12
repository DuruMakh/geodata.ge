// apps/web/tests/factQuery/topics/demography.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../../lib/data/demography/types";
import { AGE_SEX_GROUPS, ageGroupLabel, ageSexCrawlStates, annualAgeFacts, censusAgeFactsForPlace, censusCrawlSettlements } from "../../../lib/explorer/demographyAgeSex";
import { buildCensusPlaceWorkbookExportModel, buildPyramidWorkbookExportModel } from "../../../lib/explorer/demographyAgeSexWorkbook";
import { GEORGIA_PLACE_ID, placeLabel, type DemographyPlace } from "../../../lib/explorer/demographyAreas";
import { MARRIAGE_SERIES, SOURCES as MARRIAGE_SOURCES, marriageCrawlStates, marriageFactsForPlace, type MarriagePlaceFacts } from "../../../lib/explorer/demographyMarriage";
import { buildMarriageWorkbookExportModel } from "../../../lib/explorer/demographyMarriageWorkbook";
import { MIGRATION_GROUPS, migrationCrawlStates } from "../../../lib/explorer/demographyMigration";
import { buildMigrationWorkbookExportModel } from "../../../lib/explorer/demographyMigrationWorkbook";
import { AGE_GROUPS as MOTHER_AGE_GROUPS, LIFE_SERIES } from "../../../lib/explorer/demographyNational";
import { buildFertilityWorkbookExportModel, buildLifeWorkbookExportModel } from "../../../lib/explorer/demographyNationalWorkbook";
import { birthsDeathsNationalFacts, loadPopulationSources, marriagePageData, migrationPageFacts } from "../../../lib/explorer/demographyPageData";
import { populationPlaceCrawlQueries } from "../../../lib/explorer/demographyPopulation";
import { buildPopulationWorkbookExportModel } from "../../../lib/explorer/demographyPopulationWorkbook";
import { vitalFactsForPlace } from "../../../lib/explorer/demographyVital";
import { buildVitalWorkbookExportModel } from "../../../lib/explorer/demographyVitalWorkbook";
import { loadPopulationBasics } from "../../../lib/explorer/populationBasics.server";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { demographyTopicAdapter } from "../../../lib/factQuery/topics/demography";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import { breakBetween } from "../../../lib/factQuery/topics/store";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { message } from "../../../lib/i18n/messages";
import type { Locale, Presentation } from "../../../lib/i18n/types";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const SHUAKHEVI = "10";
const ADJARA = "region.adjara";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const CENSUS_BREAK = "census_recalculation_2025";

type CsvRow = Record<string, string>;
const readCsv = async (file: string) => parse(await readFile(path.resolve(process.cwd(), "../../data/imports", file)), { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[];

let builds: TopicDatasetBuild[];
let served: ServedDemographyObservation[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);

beforeAll(async () => {
  [builds, { facts: served }] = await Promise.all([demographyTopicAdapter.build(), loadServedDemographyData()]);
}, 60_000);

describe("demography topic adapter", () => {
  it("is registered, reads the demography source archive and builds the five Demography pages", () => {
    expect(TOPIC_ADAPTERS).toContain(demographyTopicAdapter);
    expect(demographyTopicAdapter).toMatchObject({ family: "demography", sourceArchive: ["demography"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "demography"));
    expect(builds.map((build) => build.page.datasetId)).toEqual(["demography-population", "demography-age-sex", "demography-migration", "demography-births-deaths", "demography-marriages-divorces"]);
  });

  it("Population, Births and deaths and Marriages serve Georgia, the 11 regions and the 63 municipalities; Age and sex Georgia and the regions; Migration Georgia", async () => {
    const { places } = await loadPopulationBasics("en");
    const all = places.map((place) => place.id);
    expect(all).toHaveLength(75);
    for (const id of ["demography-population", "demography-births-deaths", "demography-marriages-divorces"]) {
      expect(dataset(id).entities.map((entity) => entity.entityId)).toEqual(all);
      expect(dataset(id).entities.find((entity) => entity.entityId === SHUAKHEVI)).toMatchObject({ entityType: "municipality", parentEntityId: ADJARA, labelEn: "Shuakhevi" });
      expect(dataset(id).entities.find((entity) => entity.entityId === "region.tbilisi")).toMatchObject({ entityType: "region", parentEntityId: GEORGIA_PLACE_ID });
    }
    expect(dataset("demography-age-sex").entities.map((entity) => entity.entityId)).toEqual(places.filter((place) => place.level !== "municipality").map((place) => place.id));
    expect(dataset("demography-migration").entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
    // Tbilisi is one place, the region; its municipality code is never an entity.
    for (const build of builds) expect(build.entities.some((entity) => entity.entityId === "04")).toBe(false);
    // Codes 05, 42, 43, 46 and 64 are budgets not attributable to spending inside one place: never an entity (AGENTS.md).
    for (const build of builds) expect(build.entities.filter((entity) => ["05", "42", "43", "46", "64"].includes(entity.entityId)), build.page.datasetId).toEqual([]);
  });

  it("Shuakhevi's population in 2015 and 2025 and its 2024 births are the reviewed CSV rows", async () => {
    const [population, vital] = await Promise.all([readCsv("demography-population-annual.csv"), readCsv("demography-vital-annual.csv")]);
    for (const year of [2015, 2025]) {
      const row = population.find((candidate) => candidate.geography_id === SHUAKHEVI && candidate.series_id === "demography.population_total" && Number(candidate.year) === year)!;
      expect(factOf("demography-population", SHUAKHEVI, "demography.population_total", year)).toEqual({
        entityId: SHUAKHEVI, seriesId: "demography.population_total", year, value: Number(row.value), basis: "published", status: "official", sourceIds: [row.source_id],
      });
    }
    const births = vital.find((candidate) => candidate.geography_id === SHUAKHEVI && candidate.series_id === "demography.live_births" && candidate.year === "2024")!;
    expect(factOf("demography-births-deaths", SHUAKHEVI, "demography.live_births", 2024)).toMatchObject({ value: Number(births.value), status: "official", sourceIds: [births.source_id] });
    expect(dataset("demography-population").series).toEqual([
      expect.objectContaining({ seriesId: "demography.population_total", unit: "persons", isTotal: true, parentSeriesId: null }),
      expect.objectContaining({ seriesId: "demography.population_density", unit: "persons_per_km2", isTotal: false }),
    ]);
  });

  it("serves nothing a page does not show: no crude rates, infant mortality, mid-year population, age bands, single citizenships or municipal density", () => {
    const seriesIds = builds.flatMap((build) => build.series.map((series) => series.seriesId));
    for (const hidden of ["crude_birth_rate", "crude_death_rate", "infant_mortality_rate", "mid_year_population", "population_age_band"]) {
      expect(seriesIds.filter((id) => id.startsWith(`demography.${hidden}`))).toEqual([]);
    }
    // The single-year groups the pyramid adds into 0-4, and the citizenships the page folds into "other countries".
    expect(seriesIds.filter((id) => /\.(age_0|age_1_4)$/.test(id))).toEqual([]);
    expect(seriesIds.filter((id) => /\.(armenia|china|stateless|not_stated)$/.test(id))).toEqual([]);
    const municipalities = new Set(dataset("demography-population").entities.filter((entity) => entity.entityType === "municipality").map((entity) => entity.entityId));
    expect(dataset("demography-population").facts.filter((fact) => fact.seriesId === "demography.population_density" && municipalities.has(fact.entityId))).toEqual([]);
    expect(dataset("demography-age-sex").facts.some((fact) => municipalities.has(fact.entityId))).toBe(false);
    // The data hold no gap inside a span a page prints, so nothing is served missing.
    expect(builds.flatMap((build) => build.facts).filter((fact) => fact.value === null)).toEqual([]);
  });

  it("serves the rows a page adds up itself as Fiscal.ge derivations from the reviewed rows", () => {
    const row = (seriesId: string, year: number, dims: Partial<ServedDemographyObservation>) =>
      served.find((fact) => fact.seriesId === seriesId && fact.geographyId === GEORGIA_PLACE_ID && fact.year === year && Object.entries(dims).every(([key, value]) => fact[key as keyof ServedDemographyObservation] === value))!;
    const zeroToFour = factOf("demography-age-sex", GEORGIA_PLACE_ID, "demography.population_by_age_sex.female.age_0_4", 2010)!;
    expect(zeroToFour).toMatchObject({
      value: row("demography.population_by_age_sex", 2010, { sex: "female", ageGroup: "age_0" }).value + row("demography.population_by_age_sex", 2010, { sex: "female", ageGroup: "age_1_4" }).value,
      status: "derived", sourceIds: ["source.geostat_demography_population_age_sex"],
    });
    const net = factOf("demography-migration", GEORGIA_PLACE_ID, "demography.net_migration.male", 2020)!;
    const total = (seriesId: string) => row(seriesId, 2020, { sex: "male", citizenshipId: "citizenship.total" }).value;
    expect(net).toMatchObject({ value: total("demography.immigrants") - total("demography.emigrants"), status: "derived", sourceIds: ["source.geostat_demography_migration_citizenship"] });
    // Geostat publishes the net of both sexes together, and that is served as published.
    expect(factOf("demography-migration", GEORGIA_PLACE_ID, "demography.net_migration.total", 2020)).toMatchObject({ status: "official", sourceIds: ["source.geostat_demography_net_migration"] });
    const derived = builds.flatMap((build) => build.facts.filter((fact) => fact.status === "derived" && fact.entityId === GEORGIA_PLACE_ID && !fact.seriesId.endsWith(".all_other_computed")).map((fact) => fact.seriesId));
    expect(new Set(derived.map((id) => id.replace(/\.(male|female|total)/, "")))).toEqual(new Set(["demography.population_by_age_sex.age_0_4", "demography.net_migration"]));
  });

  // Full review I2 (spec 5.2): a reviewed row whose locator adds published cells is Fiscal.ge's sum, not Geostat's figure.
  it("serves the reviewed rows Fiscal.ge added up (Other countries, a city merged into its municipality) as derivations", () => {
    const summed = served.filter((fact) => fact.sourceLocator.split(" [")[0]!.includes("+"));
    const servedSummed = builds.flatMap((build) => build.facts.filter((fact) => fact.status === "derived" && (fact.seriesId.endsWith(".all_other_computed") || fact.entityId !== GEORGIA_PLACE_ID)));
    expect(servedSummed).toHaveLength(188);
    // Migration's "Other countries": 14 years, 3 sexes, 2 directions.
    expect(servedSummed.filter((fact) => fact.seriesId.endsWith(".all_other_computed"))).toHaveLength(84);
    const otherCountries = factOf("demography-migration", GEORGIA_PLACE_ID, "demography.immigrants_by_citizenship_group.total.all_other_computed", 2012)!;
    expect(otherCountries).toMatchObject({ value: 21720, status: "derived" });
    // Municipality 15 in 2015 adds its city's own row (1!W39+W35).
    expect(factOf("demography-population", "15", "demography.population_total", 2015)).toMatchObject({ value: 58146, status: "derived" });
    expect(factOf("demography-population", "15", "demography.population_total", 2018)).toMatchObject({ status: "official" });
    // Every summed reviewed row a page serves is derived, and only those beside the page's own sums.
    expect(summed.filter((fact) => fact.seriesId !== "demography.mid_year_population")).toHaveLength(188);
  });

  it("puts age and sex groups under the page's headings, each group under its heading's total", async () => {
    const { presentation } = await loadPopulationBasics("en");
    const t = (key: string) => message(presentation.messages, `demography.${key}`);
    const ageSex = dataset("demography-age-sex");
    const men = ageSex.series.filter((series) => series.headingEn === t("sexMale"));
    expect(men.map((series) => series.labelEn)).toEqual([...AGE_SEX_GROUPS.map(ageGroupLabel), t("totalHeader")]);
    expect(men.at(-1)).toMatchObject({ seriesId: "demography.population_by_age_sex.male.total", isTotal: true, parentSeriesId: null });
    expect(men.slice(0, -1).every((series) => series.parentSeriesId === "demography.population_by_age_sex.male.total" && !series.isTotal)).toBe(true);
    const censusRural = ageSex.series.filter((series) => series.headingEn === `${t("ageSexCensusHeading")} · ${t("settlementRural")} · ${t("sexFemale")}`);
    expect(censusRural).toHaveLength(19);
    expect(censusRural.at(-1)).toMatchObject({ seriesId: "demography.census_population_by_settlement.rural.female", isTotal: true });
    expect(ageSex.facts.filter((fact) => fact.seriesId.startsWith("demography.census_")).every((fact) => fact.year === 2024)).toBe(true);
    const migration = dataset("demography-migration").series.filter((series) => series.headingEn === `${t("dirArrivals")} · ${t("sexFemale")}`);
    expect(migration.map((series) => series.seriesId)).toEqual(["demography.immigrants.female", ...MIGRATION_GROUPS.map((group) => `demography.immigrants_by_citizenship_group.female.${group.replace("citizenship.", "")}`)]);
  });

  it("names its units with the site's own unit words; none is a percent, so no series takes a percentage-point change", () => {
    const units = new Set(builds.flatMap((build) => build.series.map((series) => series.unit)));
    expect([...units].sort()).toEqual(["births_per_1000_women", "children_per_woman", "divorces", "marriages", "persons", "persons_per_km2", "years"]);
  });

  it("carries the census re-base onto every served series it applies to, and only there", () => {
    const population = dataset("demography-population");
    expect(population.breaks.map((entry) => [entry.breakId, entry.seriesIds])).toEqual([[CENSUS_BREAK, ["demography.population_total", "demography.population_density"]]]);
    expect(breakBetween(population.breaks, "demography.population_total", 2024, 2025, "year")?.breakId).toBe(CENSUS_BREAK);
    expect(breakBetween(population.breaks, "demography.population_total", 2015, 2024, "year")).toBeNull();
    expect(breakBetween(population.breaks, "demography.population_total", 2025, 2026, "year")).toBeNull();
    const ageSex = dataset("demography-age-sex").breaks[0]!;
    expect(ageSex.seriesIds).toHaveLength(57);
    expect(ageSex.seriesIds).toContain("demography.population_by_age_sex.male.age_0_4");
    expect(ageSex.seriesIds.some((id) => id.startsWith("demography.census_"))).toBe(false);
    const births = dataset("demography-births-deaths").breaks[0]!;
    expect(births.seriesIds).toEqual(expect.arrayContaining(["demography.total_fertility_rate", "demography.age_specific_fertility_rate.mother_20_24", "demography.life_expectancy_female"]));
    expect(births.seriesIds).not.toContain("demography.live_births");
    expect(dataset("demography-migration").breaks).toEqual([]);
    expect(dataset("demography-marriages-divorces").breaks).toEqual([]);
  });
});

describe("compare across the census re-base", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const pairs = (datasetId: string, seriesIds: string[], fromYear: number, toYear: number, entityIds?: string[]) => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds, ...(entityIds ? { entityIds } : {}) }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons;
  };

  it("refuses Georgia's and Shuakhevi's population 2024 → 2025 and keeps either side comparable", () => {
    for (const pair of pairs("demography-population", ["demography.population_total"], 2024, 2025, [GEORGIA_PLACE_ID, SHUAKHEVI])) {
      expect(pair).toMatchObject({ comparability: "not_comparable", absoluteChange: null, percentageChange: null });
      expect(pair.caveatIds).toContain("topic_series_break");
      expect(pair.reasonsEn[0]).toContain("2025-01-01: ");
    }
    expect(pairs("demography-population", ["demography.population_total"], 2015, 2024)[0]!.comparability).toBe("comparable");
    expect(pairs("demography-population", ["demography.population_total"], 2025, 2026)[0]!.comparability).toBe("comparable");
  });

  it("refuses the fertility rate and an age group across it, and compares births, which are counts of events", () => {
    expect(pairs("demography-births-deaths", ["demography.total_fertility_rate"], 2020, 2025)[0]!.comparability).toBe("not_comparable");
    expect(pairs("demography-age-sex", ["demography.population_by_age_sex.total.age_0_4"], 2024, 2025)[0]!.comparability).toBe("not_comparable");
    const births = pairs("demography-births-deaths", ["demography.live_births"], 2020, 2025)[0]!;
    expect(births.comparability).toBe("comparable");
    expect(births.percentageChange).not.toBeNull();
    expect(births.percentagePointChange).toBeNull();
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, the models their Excel files
// and hidden crawl tables are built from, fed exactly as the pages feed them.

/** Each model's rows, named: the place it is about and how a row's label names a served series. */
type Reader = (row: WorkbookReadableRow) => ParityTarget | null;
function matcher() {
  const readers = new Map<WorkbookExportModel, Reader>();
  const add = (model: WorkbookExportModel, reader: Reader) => {
    readers.set(model, reader);
    return model;
  };
  return { add, match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.(row) ?? null };
}
type Matcher = ReturnType<typeof matcher>;
const byLabel = (entries: readonly (readonly [string, string])[]) => {
  const map = new Map<string, string>();
  for (const [label, id] of entries) {
    if (map.has(label)) throw new Error(`Two rows read ${label}`);
    map.set(label, id);
  }
  return map;
};

/** A workbook whose columns are not years (the pyramid's men, women and total), as one model per column keyed by `year`. */
function columnsAsYears(model: WorkbookExportModel, year: number): WorkbookExportModel[] {
  return model.readable.years.map((column) => ({
    ...model,
    filename: `${model.filename} [${column}]`,
    readable: {
      ...model.readable, years: [year],
      rows: model.readable.rows.map((row) => ({ ...row, valuesByYear: { [year]: row.valuesByYear[column] ?? null }, basisByYear: { [year]: row.basisByYear[column] ?? null } })),
    },
  }));
}

type Basics = Awaited<ReturnType<typeof loadPopulationBasics>>;
const pageInputs = async (locale: Locale) => {
  const [basics, sources] = await Promise.all([loadPopulationBasics(locale), loadPopulationSources(locale)]);
  return { basics, sources, presentation: basics.presentation as Presentation, place: (id: string) => basics.places.find((place) => place.id === id)! };
};
const placeLabels = (basics: Basics, locale: Locale) => byLabel(basics.places.map((place) => [placeLabel(place, locale), place.id] as const));

/** The population place pages' models (population-place-explorer.tsx), and the density their Data sheet prints for Georgia and the regions. */
async function populationModels(locale: Locale, placeIds: readonly string[], m: Matcher) {
  const { basics, sources, presentation, place } = await pageInputs(locale);
  const labels = placeLabels(basics, locale);
  const own = sources.filter((source) => source.sourceId === "source.geostat_municipal_population" || source.sourceId === "source.geostat_demography_density");
  return placeIds.flatMap((id) => populationPlaceCrawlQueries(basics.clientFacts, place(id), basics.places).flatMap((query) => {
    const model = buildPopulationWorkbookExportModel(basics.clientFacts, basics.places, query, presentation, own, ORIGIN, id, id);
    const target = (seriesId: string): Reader => (row) => (labels.has(row.label) ? { entityId: labels.get(row.label)!, seriesId } : null);
    // The density is a column of the Data sheet ([place, level, year, persons, density, ...]), not a row of the readable one.
    const density = new Map<string, Record<number, number | null>>();
    for (const [label, , year, , value] of model.analysis.rows as [string, string, number, number | null, number | null][]) density.set(label, { ...density.get(label), [year]: value });
    const densityModel: WorkbookExportModel = {
      ...model, filename: `${model.filename} [density]`,
      readable: { ...model.readable, rows: [...density].filter(([, values]) => Object.values(values).some((value) => value !== null)).map(([label, valuesByYear]) =>
        ({ kind: "item" as const, parentLabel: null, label, change: null, valuesByYear, basisByYear: {} })) },
    };
    return [m.add(model, target("demography.population_total")), ...(densityModel.readable.rows.length ? [m.add(densityModel, target("demography.population_density"))] : [])];
  }));
}

/** The place pages' births and deaths sections (vital-section.tsx) and the Births and deaths page's national charts (national-vital-charts.tsx). */
async function birthsModels(locale: Locale, placeIds: readonly string[], m: Matcher) {
  const { sources, presentation, place } = await pageInputs(locale);
  const t = (key: string) => message(presentation.messages, `demography.${key}`);
  const vital = byLabel([[t("vitalBirths"), "demography.live_births"], [t("vitalDeaths"), "demography.deaths"], [t("vitalNatural"), "demography.natural_increase"]]);
  const models = placeIds.flatMap((id) => {
    const facts = vitalFactsForPlace(served, id);
    if (!facts.length) return [];
    const model = buildVitalWorkbookExportModel({ facts, place: place(id), sources, siteOrigin: ORIGIN, scope: id }, presentation);
    return [m.add(model, (row) => (vital.has(row.label) ? { entityId: id, seriesId: vital.get(row.label)! } : null))];
  });
  if (!placeIds.includes(GEORGIA_PLACE_ID)) return models;
  const facts = birthsDeathsNationalFacts(served);
  const national = byLabel([
    [`${t("tfrLabel")} (${t("tfrUnit")})`, "demography.total_fertility_rate"],
    ...MOTHER_AGE_GROUPS.map((group) => [`${t(`ageGroup.${group}`)} (${t("asfrUnit")})`, `demography.age_specific_fertility_rate.${group}`] as const),
    ...LIFE_SERIES.map((line) => [t(line.key), line.seriesId] as const),
  ]);
  const reader: Reader = (row) => (national.has(row.label) ? { entityId: GEORGIA_PLACE_ID, seriesId: national.get(row.label)! } : null);
  return [...models, m.add(buildFertilityWorkbookExportModel({ facts, sources, siteOrigin: ORIGIN }, presentation), reader), m.add(buildLifeWorkbookExportModel({ facts, sources, siteOrigin: ORIGIN }, presentation), reader)];
}

/**
 * Georgia's Marriages and divorces explorer (marriage-explorer.tsx) and the place pages' sections (marriage-section.tsx), counts
 * and years as published. Their per-1,000 states are rates Fiscal.ge divides out of the mid-year population: not served.
 */
async function marriageModels(locale: Locale, placeIds: readonly string[], m: Matcher) {
  const { sources, presentation, place } = await pageInputs(locale);
  const t = (key: string) => message(presentation.messages, `demography.${key}`);
  const page = marriagePageData(presentation.messages, served);
  const servedId = (id: keyof typeof MARRIAGE_SOURCES) => (MARRIAGE_SOURCES[id].sex ? `${MARRIAGE_SOURCES[id].seriesId}.${MARRIAGE_SOURCES[id].sex}` : MARRIAGE_SOURCES[id].seriesId);
  const models = (id: string, facts: MarriagePlaceFacts, labels: Record<string, string>, title: string, scope: string) => {
    const states = marriageCrawlStates(facts);
    expect(states.some((state) => state.measure === "per1000")).toBe(true);
    const rows = byLabel(MARRIAGE_SERIES.filter((series) => labels[series.id]).map((series) => [labels[series.id]!, servedId(series.id)] as const));
    return states.filter((state) => state.measure === "count").map((state) =>
      m.add(buildMarriageWorkbookExportModel({ place: facts, state, labels, sources, siteOrigin: ORIGIN, title, scope }, presentation), (row) => (rows.has(row.label) ? { entityId: id, seriesId: rows.get(row.label)! } : null)));
  };
  return placeIds.flatMap((id) => {
    const sectionLabels = { marriages: t("marriageSeries.marriages"), divorces: t("marriageSeries.divorces") };
    const section = marriageFactsForPlace(served, id);
    return [
      ...(id === GEORGIA_PLACE_ID ? models(id, page.georgia, page.labels, t("marriagesTitle"), "georgia") : []),
      ...(section.facts.length ? models(id, section, sectionLabels, `${t("marriageSectionTitle")} · ${placeLabel(place(id), locale)}`, id) : []),
    ];
  });
}

/** The Migration page's models (demography-migration.tsx): one per sex, its groups' arrivals and departures and the net. */
async function migrationModels(locale: Locale, m: Matcher) {
  const { sources, presentation } = await pageInputs(locale);
  const t = (key: string) => message(presentation.messages, `demography.${key}`);
  const facts = migrationPageFacts(served);
  const directions = byLabel([[t("dirArrivals"), "immigrants"], [t("dirDepartures"), "emigrants"]]);
  const groups = byLabel(MIGRATION_GROUPS.map((group) => [t(`group.${group}`), group.replace("citizenship.", "")] as const));
  return migrationCrawlStates(facts).map((state) => m.add(buildMigrationWorkbookExportModel({ facts, state, sources, siteOrigin: ORIGIN }, presentation), (row) => {
    const seriesId = row.kind === "total" && row.label === t("netLabel") ? `demography.net_migration.${state.sex}`
      : row.kind === "group" && directions.has(row.label) ? `demography.${directions.get(row.label)}.${state.sex}`
        : row.parentLabel && directions.has(row.parentLabel) && groups.has(row.label) ? `demography.${directions.get(row.parentLabel)}_by_citizenship_group.${state.sex}.${groups.get(row.label)}` : null;
    return seriesId ? { entityId: GEORGIA_PLACE_ID, seriesId } : null;
  }));
}

/** The Age and sex page's pyramids (age-sex-explorer.tsx) and the place pages' census pyramids (age-sex-section.tsx), a sex per column. */
async function ageSexModels(locale: Locale, placeIds: readonly string[], m: Matcher) {
  const { sources, presentation, place } = await pageInputs(locale);
  const t = (key: string) => message(presentation.messages, `demography.${key}`);
  const sexes = ["male", "female", "total"] as const;
  const groups = byLabel([...AGE_SEX_GROUPS.map((group) => [ageGroupLabel(group), group] as const), [t("totalHeader"), "total"]]);
  const reader = (entityId: string, seriesOf: (group: string) => string): Reader => (row) => (groups.has(row.label) ? { entityId, seriesId: seriesOf(groups.get(row.label)!) } : null);
  const facts = annualAgeFacts(served);
  const annual = placeIds.includes(GEORGIA_PLACE_ID) ? ageSexCrawlStates(facts).flatMap((crawl) =>
    columnsAsYears(buildPyramidWorkbookExportModel({ facts, sources, siteOrigin: ORIGIN, year: crawl.year, compare: crawl.compare }, presentation), crawl.year)
      .map((model, column) => m.add(model, reader(GEORGIA_PLACE_ID, (group) => `demography.population_by_age_sex.${sexes[column]}.${group}`)))) : [];
  const census = placeIds.flatMap((id) => {
    const own = censusAgeFactsForPlace(served, id);
    return censusCrawlSettlements(own).flatMap((settlement) =>
      columnsAsYears(buildCensusPlaceWorkbookExportModel({ facts: own, sources, siteOrigin: ORIGIN, place: place(id), settlement, scope: id }, presentation), 2024)
        .map((model, column) => m.add(model, reader(id, (group) => (group === "total"
          ? `demography.census_population_by_settlement.${settlement}.${sexes[column]}`
          : `demography.census_population_by_age.${settlement}.${sexes[column]}.${group}`)))));
  });
  return [...annual, ...census];
}

describe("demography parity with the pages' workbook models", () => {
  const places = [GEORGIA_PLACE_ID, ADJARA, SHUAKHEVI];
  for (const locale of LOCALES) {
    it(`population (${locale}): Georgia, Adjara and Shuakhevi`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("demography-population"), await populationModels(locale, places, m), m.match, places);
    });
    it(`births and deaths (${locale}): Georgia, Adjara and Shuakhevi`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("demography-births-deaths"), await birthsModels(locale, places, m), m.match, places);
    });
    it(`marriages and divorces (${locale}): Georgia, Adjara and Shuakhevi`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("demography-marriages-divorces"), await marriageModels(locale, places, m), m.match, places);
    });
    it(`age and sex (${locale}): Georgia and Adjara`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("demography-age-sex"), await ageSexModels(locale, [GEORGIA_PLACE_ID, ADJARA], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
    });
    it(`migration (${locale}): Georgia`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("demography-migration"), await migrationModels(locale, m), m.match);
    });
  }

  it("Population, Births and deaths, Marriages and Age and sex (en): every place the pages list", async () => {
    const all = (await loadPopulationBasics("en")).places.map((place: DemographyPlace) => place.id);
    const m = matcher();
    expectWorkbookParity(dataset("demography-population"), await populationModels("en", all, m), m.match);
    expectWorkbookParity(dataset("demography-births-deaths"), await birthsModels("en", all, m), m.match);
    expectWorkbookParity(dataset("demography-marriages-divorces"), await marriageModels("en", all, m), m.match);
    expectWorkbookParity(dataset("demography-age-sex"), await ageSexModels("en", all, m), m.match);
  }, 60_000);

  it("fails when a served value differs from the page's", async () => {
    const population = dataset("demography-population");
    const facts = population.facts.map((fact): TopicFact => (fact.entityId === SHUAKHEVI && fact.year === 2020 && fact.seriesId === "demography.population_total" ? { ...fact, value: fact.value! + 1 } : fact));
    const m = matcher();
    const models = await populationModels("en", [SHUAKHEVI], m);
    expect(() => expectWorkbookParity({ ...population, facts }, models, m.match, [SHUAKHEVI])).toThrow(/Shuakhevi.* 2020: the page prints \d+, 10 demography.population_total serves/);
  });
});

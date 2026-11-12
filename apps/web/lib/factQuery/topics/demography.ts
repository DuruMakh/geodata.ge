// apps/web/lib/factQuery/topics/demography.ts
//
// The Demography pages as topic datasets. Population: Georgia, the 11 regions and the 63 municipalities (the place pages),
// with the population and, for Georgia and the regions, the density. The place pages' other sections are served with the
// page each one links to as its national page: births and deaths with Births and deaths (beside Georgia's fertility and life
// expectancy), marriages and divorces with Marriages and divorces (beside Georgia's average ages and marriage length), and
// the census age structure of Georgia and the regions with Age and sex (beside Georgia's yearly pyramid). Migration is
// Georgia's. Rates per 1,000 residents, shares and ratios the pages divide out are not served. Series, places, names and
// years come from the pages' own functions; values are the reviewed CSV rows, and the few rows a page adds up itself (the
// pyramid's 0-4, the net migration of men and of women) are served as Fiscal.ge derivations. Build-time only: runtime code
// never imports it (tests/factQuery/purity.test.ts).
import { loadServedDemographyData } from "../../data/demography/importDemography";
import { CENSUS_STEP, SERIES } from "../../data/demography/series";
import type { ServedDemographyObservation } from "../../data/demography/types";
import { AGE_SEX_GROUPS, ageGroupLabel, ageSexCrawlStates, annualAgeFacts, censusAgeFactsForPlace, censusCrawlSettlements } from "../../explorer/demographyAgeSex";
import { GEORGIA_PLACE_ID, placeIdForMunicipalityCode, type DemographyPlace } from "../../explorer/demographyAreas";
import { MARRIAGE_SERIES, SOURCES as MARRIAGE_SOURCES, marriageFactsForPlace } from "../../explorer/demographyMarriage";
import { MIGRATION_GROUPS, migrationCoverage, migrationCrawlStates } from "../../explorer/demographyMigration";
import { AGE_GROUPS as MOTHER_AGE_GROUPS, LIFE_SERIES, nationalYears } from "../../explorer/demographyNational";
import { birthsDeathsNationalFacts, marriagePageData, migrationPageFacts } from "../../explorer/demographyPageData";
import { placeYears } from "../../explorer/demographyPopulation";
import { vitalFactsForPlace } from "../../explorer/demographyVital";
import { loadPopulationBasics } from "../../explorer/populationBasics.server";
import { message } from "../../i18n/messages";
import type { Messages } from "../../i18n/types";
import { loadTopicBreaks } from "./breaks";
import { collectTopicDataset, span, type Cell, type Names, type SeriesSpec } from "./collect";
import { placeEntity } from "./education";
import type { TopicAdapter, TopicBreak, TopicDatasetBuild, TopicEntity, TopicSeriesNote } from "./types";

/** The dimensions a reviewed demography row may carry besides its series, place and year. */
type Dimensions = { sex?: string; ageGroup?: string; settlement?: string; citizenshipId?: string };
const rowKey = (seriesId: string, geographyId: string, year: number, { sex = "", ageGroup = "", settlement = "", citizenshipId = "" }: Dimensions) =>
  [seriesId, geographyId, year, sex, ageGroup, settlement, citizenshipId].join("|");

/** The reviewed rows by series, place, year and dimensions, and a cell for the one a page prints as published. */
function rowIndex(served: readonly ServedDemographyObservation[]) {
  const rows = new Map(served.map((fact) => [rowKey(fact.seriesId, fact.geographyId, fact.year, fact), fact]));
  const row = (seriesId: string, geographyId: string, year: number, dimensions: Dimensions = {}) => rows.get(rowKey(seriesId, geographyId, year, dimensions));
  // A reviewed row whose locator adds cells ("1!W39+W35": a city's own row added to its municipality, 2014-2017; the
  // migration group "Other countries") is a sum Fiscal.ge made from published cells, served as a derivation (spec 5.2).
  const published = (fact: ServedDemographyObservation | undefined): Cell | undefined =>
    fact && { value: fact.value, unit: fact.unit, sourceIds: [fact.sourceId], status: isSummedLocator(fact.sourceLocator) ? "derived" : "official" };
  /** A row the page adds up from published rows: missing when any of them is. */
  const summed = (parts: readonly (ServedDemographyObservation | undefined)[], sign: readonly number[] = parts.map(() => 1)): Cell | undefined => {
    if (parts.some((part) => part === undefined)) return undefined;
    const units = new Set(parts.map((part) => part!.unit));
    if (units.size !== 1) throw new Error(`A summed demography cell mixes units ${[...units].join(", ")}`);
    return { value: parts.reduce((total, part, index) => total + sign[index]! * part!.value, 0), unit: [...units][0]!, sourceIds: [...new Set(parts.map((part) => part!.sourceId))], status: "derived" };
  };
  return { row, published, summed };
}

/** Whether a reviewed row's source locator adds several cells: its cells, before the bracketed date, hold a "+". */
export const isSummedLocator = (locator: string) => locator.split(" [")[0]!.includes("+");

const yearsOf = (facts: readonly { year: number }[]) => [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);

type Context = {
  served: readonly ServedDemographyObservation[];
  index: ReturnType<typeof rowIndex>;
  ka: Messages;
  en: Messages;
  /** Georgia, the regions and the municipalities, as the Population pages list them, with their entities. */
  places: { place: DemographyPlace; entity: TopicEntity }[];
};

function names(context: Context, key: string): Names {
  return { ka: message(context.ka, `demography.${key}`), en: message(context.en, `demography.${key}`) };
}
const joined = (...parts: Names[]): Names => ({ ka: parts.map((part) => part.ka).join(" · "), en: parts.map((part) => part.en).join(" · ") });
const plain = (text: string): Names => ({ ka: text, en: text });
/** A population count is the stock on 1 January of its year (2026 is 1 January 2026), as the pages say: its definition says so. */
const JANUARY: TopicSeriesNote = { key: "definitions.topicJanuaryStock", values: {} };

/** Population: each place's population over its page's years, and the density Georgia and the regions publish. */
function buildPopulation(context: Context, clientFacts: Parameters<typeof placeYears>[0], breaks: readonly TopicBreak[]): TopicDatasetBuild {
  const dataset = collectTopicDataset("demography-population", names(context, "populationTitle"));
  // Municipality 04 and the region of Tbilisi carry the same number; the page keeps one place for it.
  const population = new Map(context.served.filter((fact) => fact.seriesId === SERIES.populationTotal).map((fact) => [`${placeIdForMunicipalityCode(fact.geographyId)}:${fact.year}`, fact]));
  const density = context.served.filter((fact) => fact.seriesId === SERIES.populationDensity);
  const populationSpec: SeriesSpec = { seriesId: SERIES.populationTotal, indicatorId: SERIES.populationTotal, label: names(context, "measurePopulation"), heading: null, parentSeriesId: null, isTotal: true, note: JANUARY };
  const densitySpec: SeriesSpec = { seriesId: SERIES.populationDensity, indicatorId: SERIES.populationDensity, label: names(context, "sideDensity"), heading: null, parentSeriesId: null, isTotal: false };
  for (const { place, entity } of context.places) {
    dataset.add(entity, populationSpec, span(placeYears(clientFacts, place)), (year) => context.index.published(population.get(`${place.id}:${year}`)));
    // Density is published for Georgia and the regions only.
    if (place.level === "municipality") continue;
    const own = density.filter((fact) => fact.geographyId === place.id);
    if (own.length) dataset.add(entity, densitySpec, span(yearsOf(own)), (year) => context.index.published(context.index.row(SERIES.populationDensity, place.id, year)));
  }
  return dataset.build(breaks);
}

/** Births and deaths: every place's births, deaths and natural increase, and Georgia's fertility and life expectancy. */
function buildBirthsDeaths(context: Context, breaks: readonly TopicBreak[]): TopicDatasetBuild {
  const dataset = collectTopicDataset("demography-births-deaths", names(context, "birthsDeathsTitle"));
  const { index } = context;
  const vitalHeading = names(context, "vitalTitle");
  const vital = [[SERIES.liveBirths, "vitalBirths"], [SERIES.deaths, "vitalDeaths"], [SERIES.naturalIncrease, "vitalNatural"]] as const;
  const national = birthsDeathsNationalFacts(context.served);
  const years = nationalYears(national);
  for (const { place, entity } of context.places) {
    // The section charts the years the place has rows for.
    const own = yearsOf(vitalFactsForPlace(context.served, place.id));
    for (const [seriesId, key] of own.length ? vital : []) {
      dataset.add(entity, { seriesId, indicatorId: seriesId, label: names(context, key), heading: vitalHeading, parentSeriesId: null, isTotal: false }, own, (year) => index.published(index.row(seriesId, place.id, year)));
    }
    if (place.id !== GEORGIA_PLACE_ID) continue;
    // The fertility and life expectancy charts share the national series' years.
    dataset.add(entity, { seriesId: SERIES.totalFertilityRate, indicatorId: SERIES.totalFertilityRate, label: names(context, "tfrLabel"), heading: names(context, "fertilityTitle"), parentSeriesId: null, isTotal: false },
      years, (year) => index.published(index.row(SERIES.totalFertilityRate, GEORGIA_PLACE_ID, year)));
    for (const group of MOTHER_AGE_GROUPS) {
      dataset.add(entity, { seriesId: `${SERIES.ageSpecificFertilityRate}.${group}`, indicatorId: SERIES.ageSpecificFertilityRate, label: names(context, `ageGroup.${group}`), heading: names(context, "asfrLabel"), parentSeriesId: null, isTotal: false },
        years, (year) => index.published(index.row(SERIES.ageSpecificFertilityRate, GEORGIA_PLACE_ID, year, { ageGroup: group })));
    }
    for (const line of LIFE_SERIES) {
      const isTotal = line.seriesId === SERIES.lifeExpectancyTotal;
      dataset.add(entity, { seriesId: line.seriesId, indicatorId: line.seriesId, label: names(context, line.key), heading: names(context, "lifeTitle"), parentSeriesId: isTotal ? null : SERIES.lifeExpectancyTotal, isTotal },
        years, (year) => index.published(index.row(line.seriesId, GEORGIA_PLACE_ID, year)));
    }
  }
  return dataset.build(breaks);
}

/** Marriages and divorces: Georgia's nine rows under the page's headings, and every other place's two counts. */
function buildMarriages(context: Context, breaks: readonly TopicBreak[]): TopicDatasetBuild {
  const dataset = collectTopicDataset("demography-marriages-divorces", names(context, "marriagesTitle"));
  const { index } = context;
  const [ka, en] = [marriagePageData(context.ka, context.served), marriagePageData(context.en, context.served)];
  for (const { place, entity } of context.places) {
    const rows = place.id === GEORGIA_PLACE_ID ? ka.georgia : marriageFactsForPlace(context.served, place.id);
    if (!rows.facts.length) continue;
    // Every row the place lists is charted over the place's whole span.
    const years = span(yearsOf(rows.facts));
    for (const definition of MARRIAGE_SERIES.filter(({ id }) => rows.facts.some((fact) => fact.indicatorId === id))) {
      const { seriesId, sex } = MARRIAGE_SOURCES[definition.id];
      dataset.add(entity, {
        seriesId: sex ? `${seriesId}.${sex}` : seriesId, indicatorId: seriesId, label: { ka: ka.labels[definition.id]!, en: en.labels[definition.id]! },
        heading: names(context, `marriageHeading.${definition.heading}`), parentSeriesId: null, isTotal: false,
      }, years, (year) => index.published(index.row(seriesId, place.id, year, { sex })));
    }
  }
  return dataset.build(breaks);
}

/** Migration: Georgia's arrivals and departures by citizenship group, each sex the page offers, and the net. */
function buildMigration(context: Context, breaks: readonly TopicBreak[]): TopicDatasetBuild {
  const dataset = collectTopicDataset("demography-migration", names(context, "migrationTitle"));
  const { index } = context;
  const facts = migrationPageFacts(context.served);
  const { years } = migrationCoverage(facts);
  const georgia = context.places.find(({ place }) => place.id === GEORGIA_PLACE_ID)!.entity;
  const sexKeys = { total: "sexTotal", male: "sexMale", female: "sexFemale" } as const;
  const directions = [
    { key: "dirArrivals", total: SERIES.immigrants, groups: SERIES.immigrantsByCitizenshipGroup },
    { key: "dirDepartures", total: SERIES.emigrants, groups: SERIES.emigrantsByCitizenshipGroup },
  ] as const;
  for (const { sex } of migrationCrawlStates(facts)) {
    const sexName = names(context, sexKeys[sex]);
    const totalOf = (seriesId: string, year: number) => index.row(seriesId, GEORGIA_PLACE_ID, year, { sex, citizenshipId: "citizenship.total" });
    for (const direction of directions) {
      // The heading row prints the direction's sum over the groups, which is Geostat's published total.
      const heading = joined(names(context, direction.key), sexName);
      const totalId = `${direction.total}.${sex}`;
      dataset.add(georgia, { seriesId: totalId, indicatorId: direction.total, label: heading, heading, parentSeriesId: null, isTotal: true }, years, (year) => index.published(totalOf(direction.total, year)));
      for (const group of MIGRATION_GROUPS) {
        dataset.add(georgia, {
          seriesId: `${direction.groups}.${sex}.${group.replace(/^citizenship\./, "")}`, indicatorId: direction.groups, label: names(context, `group.${group}`), heading, parentSeriesId: totalId, isTotal: false,
        }, years, (year) => index.published(index.row(direction.groups, GEORGIA_PLACE_ID, year, { sex, citizenshipId: group })));
      }
    }
    // Geostat publishes the net for both sexes together; the page takes the net of men and of women as arrivals less departures.
    dataset.add(georgia, { seriesId: `${SERIES.netMigration}.${sex}`, indicatorId: SERIES.netMigration, label: joined(names(context, "netLabel"), sexName), heading: null, parentSeriesId: null, isTotal: false }, years,
      (year) => sex === "total" ? index.published(totalOf(SERIES.netMigration, year)) : index.summed([totalOf(SERIES.immigrants, year), totalOf(SERIES.emigrants, year)], [1, -1]));
  }
  return dataset.build(breaks);
}

/**
 * Age and sex: Georgia's 1 January population by sex and age group in every year the pyramid shows, and the census count
 * by settlement, sex and age group of Georgia and of each region. Each sex (and settlement) is a heading; its age groups
 * are its series under its total.
 */
function buildAgeSex(context: Context, breaks: readonly TopicBreak[]): TopicDatasetBuild {
  const dataset = collectTopicDataset("demography-age-sex", names(context, "ageSexTitle"));
  const { index } = context;
  const sexes = [["male", "sexMale"], ["female", "sexFemale"], ["total", "totalHeader"]] as const;
  const total = names(context, "totalHeader");
  const georgia = context.places.find(({ place }) => place.id === GEORGIA_PLACE_ID)!.entity;
  const annualYears = ageSexCrawlStates(annualAgeFacts(context.served)).map((state) => state.year);
  for (const [sex, key] of sexes) {
    const heading = names(context, key);
    const totalId = `${SERIES.populationByAgeSex}.${sex}.total`;
    const row = (year: number, ageGroup: string) => index.row(SERIES.populationByAgeSex, GEORGIA_PLACE_ID, year, { sex, ageGroup });
    for (const group of AGE_SEX_GROUPS) {
      // The pyramid's 0-4 is the annual table's 0 and 1-4 added up.
      dataset.add(georgia, { seriesId: `${SERIES.populationByAgeSex}.${sex}.${group}`, indicatorId: SERIES.populationByAgeSex, label: plain(ageGroupLabel(group)), heading, parentSeriesId: totalId, isTotal: false, note: JANUARY }, annualYears,
        (year) => (group === "age_0_4" ? index.summed([row(year, "age_0"), row(year, "age_1_4")]) : index.published(row(year, group))));
    }
    dataset.add(georgia, { seriesId: totalId, indicatorId: SERIES.populationByAgeSex, label: total, heading, parentSeriesId: null, isTotal: true, note: JANUARY }, annualYears, (year) => index.published(row(year, "total")));
  }
  const settlements = { total: "settlementAll", urban: "settlementUrban", rural: "settlementRural" } as const;
  for (const { place, entity } of context.places.filter(({ place }) => place.level !== "municipality")) {
    for (const settlement of censusCrawlSettlements(censusAgeFactsForPlace(context.served, place.id))) {
      for (const [sex, key] of sexes) {
        const heading = joined(names(context, "ageSexCensusHeading"), names(context, settlements[settlement]), names(context, key));
        const totalId = `${SERIES.censusPopulationBySettlement}.${settlement}.${sex}`;
        for (const group of AGE_SEX_GROUPS) {
          dataset.add(entity, { seriesId: `${SERIES.censusPopulationByAge}.${settlement}.${sex}.${group}`, indicatorId: SERIES.censusPopulationByAge, label: plain(ageGroupLabel(group)), heading, parentSeriesId: totalId, isTotal: false },
            [CENSUS_STEP.fromYear], (year) => index.published(index.row(SERIES.censusPopulationByAge, place.id, year, { sex, ageGroup: group, settlement })));
        }
        dataset.add(entity, { seriesId: totalId, indicatorId: SERIES.censusPopulationBySettlement, label: total, heading, parentSeriesId: null, isTotal: true },
          [CENSUS_STEP.fromYear], (year) => index.published(index.row(SERIES.censusPopulationBySettlement, place.id, year, { sex, settlement })));
      }
    }
  }
  return dataset.build(breaks);
}

export const demographyTopicAdapter: TopicAdapter = {
  family: "demography",
  sourceArchive: ["demography"],
  async build() {
    const [breaks, { facts: served }, ka, en] = await Promise.all([
      loadTopicBreaks("demography-series-breaks.csv"), loadServedDemographyData(), loadPopulationBasics("ka"), loadPopulationBasics("en"),
    ]);
    const context: Context = {
      served, index: rowIndex(served), ka: ka.presentation.messages, en: en.presentation.messages,
      places: ka.places.map((place) => ({ place, entity: placeEntity(place, en.places.find((candidate) => candidate.id === place.id)!) })),
    };
    return [buildPopulation(context, ka.clientFacts, breaks), buildAgeSex(context, breaks), buildMigration(context, breaks), buildBirthsDeaths(context, breaks), buildMarriages(context, breaks)];
  },
};

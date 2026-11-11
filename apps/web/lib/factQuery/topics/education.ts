// apps/web/lib/factQuery/topics/education.ts
//
// The Education pages as topic datasets: Schools and Kindergartens (Georgia, the 11 regions and the 63 municipalities, each
// with the list its place page shows) and Universities and Vocational colleges (Georgia). Series, places, names and years
// come from the pages' own functions (lib/explorer/educationPageData.ts and the list and coverage functions); values are the
// reviewed CSV's published values. Build-time only: runtime code never imports it (tests/factQuery/purity.test.ts).
import { educationFactKey, type ClientEducationFact, type EducationFact } from "../../data/education/types";
import { GEORGIA_PLACE_ID, placeLabel, type DemographyPlace } from "../../explorer/demographyAreas";
import { educationCoverage, type EducationSectionId, type EducationSeriesDefinition, type EducationTopicId } from "../../explorer/education";
import { educationPlaceListData, educationPlacePageData, educationTopicPageData } from "../../explorer/educationPageData";
import { educationPlaceCoverage, type EducationPlaceSet } from "../../explorer/educationPlaces";
import { message } from "../../i18n/messages";
import type { Messages } from "../../i18n/types";
import { loadTopicBreaks } from "./breaks";
import { TOPIC_PAGES } from "./pages";
import type { TopicAdapter, TopicBreak, TopicDatasetBuild, TopicEntity, TopicFact, TopicPage, TopicSeries } from "./types";

/** A list's names in one language, as the page hands them to its explorer. */
type ListNames = { labels: Readonly<Record<string, string>>; headingLabels: Readonly<Record<string, string>> };
type YearSpan = { min: number; max: number };

const yearsOf = ({ min, max }: YearSpan) => Array.from({ length: max - min + 1 }, (_, index) => min + index);

/**
 * Collects one page's dataset. `addList` adds a place's list: each series that has facts there, over the years the page's
 * table shows it (its heading's on a place page, the whole list's on a topic page), and missing (`value: null`) in a year
 * Geostat printed nothing for, never zero. The first place that lists a series names it.
 */
function educationDataset(section: EducationSectionId, ka: Messages, en: Messages, shown: readonly EducationFact[], breaks: readonly TopicBreak[]) {
  const datasetId = `education-${section}`;
  const page: TopicPage = TOPIC_PAGES.find((candidate) => candidate.datasetId === datasetId)!;
  const cells = new Map(shown.map((fact) => [educationFactKey(fact), fact]));
  const series = new Map<string, TopicSeries>();
  const entities: TopicEntity[] = [];
  const facts: TopicFact[] = [];

  function addList(entityId: string, definitions: readonly EducationSeriesDefinition[], names: { ka: ListNames; en: ListNames }, listed: readonly ClientEducationFact[], spanOf: (id: string) => YearSpan) {
    const withFacts = new Set<string>(listed.map((fact) => fact.indicatorId));
    for (const definition of definitions.filter(({ id }) => withFacts.has(id))) {
      const rows = yearsOf(spanOf(definition.id)).map((year) => ({ year, row: cells.get(educationFactKey({ indicatorId: definition.id as EducationFact["indicatorId"], geographyId: entityId, year })) }));
      const units = new Set(rows.flatMap(({ row }) => row ? [row.unit] : []));
      if (units.size !== 1) throw new Error(`${datasetId}: ${entityId} ${definition.id} has units ${[...units].join(", ") || "none"}`);
      const unit = [...units][0]!;
      const known = series.get(definition.id);
      if (known && known.unit !== unit) throw new Error(`${datasetId}: ${definition.id} is ${known.unit} and ${unit}`);
      if (!known) {
        const isTotal = definition.id.endsWith(".total");
        series.set(definition.id, {
          seriesId: definition.id, labelKa: names.ka.labels[definition.id]!, labelEn: names.en.labels[definition.id]!,
          headingKa: names.ka.headingLabels[definition.heading]!, headingEn: names.en.headingLabels[definition.heading]!,
          parentSeriesId: isTotal ? null : definition.id.replace(/\.[^.]+$/, ".total"), isTotal, unit,
        });
      }
      for (const { year, row } of rows) {
        facts.push(row
          ? { entityId, seriesId: definition.id, year, value: Number(row.publishedValue), basis: row.basis, status: row.valueStatus, sourceIds: [row.sourceId] }
          : { entityId, seriesId: definition.id, year, value: null, basis: "actual", status: "official", sourceIds: [] });
      }
    }
  }

  function build(): TopicDatasetBuild {
    const list = [...series.values()];
    return {
      page, titleKa: message(ka, `education.page.${section}.title`), titleEn: message(en, `education.page.${section}.title`), series: list, entities, facts,
      breaks: breaks.filter((entry) => entry.seriesIds.some((id) => series.has(id))),
    };
  }
  return { entities, addList, build };
}

/** The entity of a place the Schools and Kindergartens pages list, named as its page names it in each language. */
function placeEntity(ka: DemographyPlace, en: DemographyPlace): TopicEntity {
  return {
    entityId: ka.id, entityType: ka.level, labelKa: placeLabel(ka, "ka"), labelEn: placeLabel(en, "en"),
    parentEntityId: ka.level === "country" ? null : ka.level === "region" ? GEORGIA_PLACE_ID : ka.regionId,
  };
}

type PlacePageData = Awaited<ReturnType<typeof educationPlacePageData>>;

function buildPlaceSet(set: EducationPlaceSet, ka: PlacePageData, en: PlacePageData, breaks: readonly TopicBreak[]): TopicDatasetBuild {
  const dataset = educationDataset(set, ka.presentation.messages, en.presentation.messages, ka.shown, breaks);
  for (const place of ka.places) {
    dataset.entities.push(placeEntity(place, en.places.find((candidate) => candidate.id === place.id)!));
    const kaList = educationPlaceListData(ka.presentation.messages, set, place.id, ka.facts);
    const enList = educationPlaceListData(en.presentation.messages, set, place.id, en.facts);
    // A place page charts one heading at a time, so a series' years are its heading's at that place.
    dataset.addList(place.id, kaList.series, { ka: kaList, en: enList }, kaList.facts, (id) => educationPlaceCoverage(set, place.id, ka.facts, [id]));
  }
  return dataset.build();
}

/** Universities or Vocational colleges: Georgia's list, Georgia named as the place pages name it. */
async function buildTopicSection(section: EducationTopicId, georgia: TopicEntity, breaks: readonly TopicBreak[]): Promise<TopicDatasetBuild> {
  const [ka, en] = await Promise.all([educationTopicPageData("ka", section), educationTopicPageData("en", section)]);
  const dataset = educationDataset(section, ka.presentation.messages, en.presentation.messages, ka.shown, breaks);
  dataset.entities.push(georgia);
  // Any mix of rows is charted together, so every series spans the whole list's years.
  const span = educationCoverage(section, ka.facts);
  dataset.addList(GEORGIA_PLACE_ID, ka.series, { ka, en }, ka.facts, () => span);
  return dataset.build();
}

export const educationTopicAdapter: TopicAdapter = {
  family: "education",
  sourceArchive: ["education"],
  async build() {
    const [breaks, ka, en] = await Promise.all([loadTopicBreaks("education-series-breaks.csv"), educationPlacePageData("ka"), educationPlacePageData("en")]);
    const georgia = placeEntity(ka.places.find((place) => place.id === GEORGIA_PLACE_ID)!, en.places.find((place) => place.id === GEORGIA_PLACE_ID)!);
    const [universities, vocational] = await Promise.all([buildTopicSection("universities", georgia, breaks), buildTopicSection("vocational", georgia, breaks)]);
    return [buildPlaceSet("schools", ka, en, breaks), buildPlaceSet("kindergartens", ka, en, breaks), universities, vocational];
  },
};

// apps/web/lib/factQuery/topics/social.ts
//
// The Social protection pages as topic datasets: Social payments, Social package and the funded pension (Georgia), and
// Pensions and Subsistence allowance (Georgia, the 11 regions and the 63 municipalities, each with its place page's list).
// Each crawl table's rows (one heading at a time) are served over the heading's years, as the pages' workbooks print them:
// money in million GEL (the pages' own conversion), averages in GEL a month, counts as they are, the fund's return in %.
// Rows Fiscal.ge divides out in the browser (shares of residents, averages at 2025 prices, % of GDP) are not served. A
// 12-month sum or an average of SSA's monthly rows is served as a Fiscal.ge derivation, and money or an average that covers
// fewer than 12 months as a part of a year with its months. Build-time only: runtime code never imports it
// (tests/factQuery/purity.test.ts).
import { loadServedSocialData, toClientSocialFact } from "../../data/social/importSocial";
import { isMoney } from "../../data/social/validation";
import { SOCIAL_GEORGIA, socialFactKey, type SocialFact } from "../../data/social/types";
import { isSocialTotal, socialCoverage, socialCrawlStates, socialTopicSeries, type SocialPlaceSet, type SocialSeriesDefinition, type SocialTopicId } from "../../explorer/social";
import { loadSocialPlaceBasics, socialPlacePageData, socialTopicPageData } from "../../explorer/socialPageData";
import { socialPlaceCoverage, socialPlaceCrawlStates, socialPlaceFacts, socialPlaceSeries } from "../../explorer/socialPlaces";
import type { TopicCoverage, TopicState } from "../../explorer/topicSeries";
import { message } from "../../i18n/messages";
import type { Messages } from "../../i18n/types";
import { loadTopicBreaks } from "./breaks";
import { collectTopicDataset, span, type Cell, type Names } from "./collect";
import { placeEntity } from "./education";
import type { TopicBreak, TopicAdapter, TopicDatasetBuild, TopicEntity } from "./types";

/** Money is served as the pages show it, in million GEL: the CSV stores GEL and `toClientSocialFact` divides. */
const MONEY_UNIT = "gel_million";
/** The headings whose rows the pages mark with their months when a year is partly covered (buildSocialSeriesModel). */
const COUNTED_HEADINGS: readonly string[] = ["money", "average"];
const PAYMENTS_TOTAL = "social.payments.total.amount";

type ListNames = { labels: Readonly<Record<string, string>>; headingLabels: Readonly<Record<string, string>> };
type Context = { cells: ReadonlyMap<string, SocialFact>; ka: Messages; en: Messages; breaks: readonly TopicBreak[] };

/** A reviewed row as the page's model carries it: money in million GEL, a December count, a sum or average marked as Fiscal.ge's. */
function cellOf(context: Context, definition: SocialSeriesDefinition, geographyId: string, year: number): Cell | undefined {
  const row = context.cells.get(socialFactKey({ indicatorId: definition.id as SocialFact["indicatorId"], geographyId, year }));
  if (!row) return undefined;
  const partial = COUNTED_HEADINGS.includes(definition.heading) && row.months < 12;
  return {
    value: toClientSocialFact(row).value, unit: isMoney(row.indicatorId) ? MONEY_UNIT : row.unit, sourceIds: [row.sourceId],
    status: partial ? "partial" : row.valueStatus === "calculated" ? "derived" : "official", ...(partial ? { monthsReported: row.months } : {}),
  };
}

/**
 * Collects one page's dataset. `addList` adds a place's crawl tables: each heading's served rows over the heading's years,
 * missing (`value: null`) in a year SSA printed nothing for, never zero. Calculated rows (`#share`, `#real`) are skipped.
 */
function socialDataset(context: Context, datasetId: string, title: Names) {
  const dataset = collectTopicDataset(datasetId, title, "actual");
  function addList(entity: TopicEntity, geographyId: string, definitions: readonly SocialSeriesDefinition[], names: { ka: ListNames; en: ListNames }, states: readonly TopicState[], coverageOf: (selectedIds: readonly string[]) => TopicCoverage) {
    for (const state of states) {
      const { min, max } = coverageOf(state.selectedIds);
      for (const definition of definitions.filter(({ id, calculated }) => calculated === undefined && state.selectedIds.includes(id))) {
        dataset.add(entity, {
          seriesId: definition.id, indicatorId: definition.id, label: { ka: names.ka.labels[definition.id]!, en: names.en.labels[definition.id]! },
          heading: { ka: names.ka.headingLabels[definition.heading]!, en: names.en.headingLabels[definition.heading]! },
          // Social payments' programmes are parts of its total; no other list says what its rows add up to.
          parentSeriesId: definition.id.startsWith("social.payments.") && definition.id !== PAYMENTS_TOTAL ? PAYMENTS_TOTAL : null, isTotal: isSocialTotal(definition),
        }, span([min, max]), (year) => cellOf(context, definition, geographyId, year));
      }
    }
  }
  return { addList, build: () => dataset.build(context.breaks) };
}

/** Social payments, Social package or the funded pension: Georgia's crawl tables of the million GEL view (never % of GDP). */
function buildTopic(context: Context, served: readonly SocialFact[], georgia: TopicEntity, section: SocialTopicId): TopicDatasetBuild {
  const [ka, en] = [socialTopicPageData(served, context.ka, section), socialTopicPageData(served, context.en, section)];
  const dataset = socialDataset(context, `health-${section}`, { ka: message(context.ka, `social.page.${section}.title`), en: message(context.en, `social.page.${section}.title`) });
  // Without GDP facts the crawl states are the million GEL view's only.
  dataset.addList(georgia, SOCIAL_GEORGIA, socialTopicSeries(section), { ka, en }, socialCrawlStates(section, ka.facts, []), (selectedIds) => socialCoverage(section, "amount", ka.facts, [], selectedIds));
  return dataset.build();
}

type Basics = Awaited<ReturnType<typeof loadSocialPlaceBasics>>;

/** Pensions or Subsistence allowance: every place page's crawl tables, each place named as the place pages name it. */
function buildPlaceSet(context: Context, ka: Basics, en: Basics, set: SocialPlaceSet): TopicDatasetBuild {
  const dataset = socialDataset(context, `health-${set}`, { ka: message(context.ka, `social.page.${set}.title`), en: message(context.en, `social.page.${set}.title`) });
  const definitions = socialPlaceSeries(set);
  for (const place of ka.places) {
    const kaList = socialPlacePageData(ka, context.ka, set, place.id);
    const enList = socialPlacePageData(en, context.en, set, place.id);
    // The page's shown facts, calculated rows included: they decide which headings it lists and their years.
    const shown = socialPlaceFacts(set, place.id, kaList.facts, { population: kaList.population, cpi: ka.cpi });
    const entity = placeEntity(place, en.places.find((candidate) => candidate.id === place.id)!);
    dataset.addList(entity, place.id, definitions, { ka: kaList, en: enList }, socialPlaceCrawlStates(set, shown), (selectedIds) => socialPlaceCoverage(set, place.id, shown, selectedIds));
  }
  return dataset.build();
}

export const socialTopicAdapter: TopicAdapter = {
  family: "social",
  sourceArchive: ["social-protection"],
  async build() {
    const [breaks, { facts: served }, ka, en] = await Promise.all([
      loadTopicBreaks("social-protection-series-breaks.csv"), loadServedSocialData(), loadSocialPlaceBasics("ka"), loadSocialPlaceBasics("en"),
    ]);
    const context: Context = { cells: new Map(served.map((fact) => [socialFactKey(fact), fact])), ka: ka.presentation.messages, en: en.presentation.messages, breaks };
    const georgiaPlace = (basics: Basics) => basics.places.find((place) => place.id === SOCIAL_GEORGIA)!;
    const georgia = placeEntity(georgiaPlace(ka), georgiaPlace(en));
    return [
      buildTopic(context, served, georgia, "social-payments"), buildPlaceSet(context, ka, en, "pensions"), buildPlaceSet(context, ka, en, "subsistence-allowance"),
      buildTopic(context, served, georgia, "social-package"), buildTopic(context, served, georgia, "funded-pension"),
    ];
  },
};

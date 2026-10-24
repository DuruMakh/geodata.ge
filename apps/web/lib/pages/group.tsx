import { GroupPage, type GroupTopicSection } from "../../components/explorer-groups/group-page";
import { updatedDate } from "../explorer/coverageLabel";
import { groupHeadlines } from "../explorer/groupHeadlines";
import { buildPlaceIndex, entriesForPage } from "../explorer/places/buildPlaceIndex.server";
import { regionSpread } from "../explorer/regionSpread";
import { getCommonMessages } from "../i18n/common.server";
import { getGroupsMessages } from "../i18n/groups.server";
import { message } from "../i18n/messages";
import type { Locale, Messages } from "../i18n/types";
import { groupPages, NAV_GROUPS, type GroupId, type NavGroup } from "../navigation/navTree";
import { fiscalMetadata } from "../seo/metadata";
import { loadPopulationBasics } from "./demography-population";
import { loadTopicHubs, topicHubCoverage } from "./topicHubs.server";

const navGroup = (group: GroupId): NavGroup => NAV_GROUPS.find(({ id }) => id === group)!;

const pagesLabel = (messages: Messages, n: number) => message(messages, n === 1 ? "common.pagesCountOne" : "common.pagesCount", { n });

/** A Regions page's card shows its regions' spread. */
const isRegionsPage = (href: string | null) => href?.endsWith("/regions") ?? false;

export function groupPageMetadata(group: GroupId, locale: Locale) {
  const messages = getGroupsMessages(locale);
  return fiscalMetadata({ locale, path: navGroup(group).href, title: message(messages, `groups.metaTitle.${group}`), description: message(messages, `groups.metaDescription.${group}`) });
}

/**
 * The places' names and the place index, for the Regions cards' spreads. Georgia is named as its Population page names it,
 * the same names the place index gives the regions.
 */
async function loadSpreadInputs(locale: Locale) {
  const [index, { places }] = await Promise.all([buildPlaceIndex(locale), loadPopulationBasics(locale)]);
  const names = new Map(places.map((place) => [place.id, locale === "en" ? place.nameEn : place.nameKa]));
  const regionName = (id: string) => names.get(id) ?? id;
  return { index, regionName, regionCount: index.places.filter((place) => place.kind === "region").length };
}

/** A group page: its topics' hub cards in sections, with four headline numbers from those cards (spec 2026-10-24-explorer-regroup §5). */
export async function renderGroupPage(group: GroupId, locale: Locale) {
  const nav = navGroup(group);
  const hubs = await loadTopicHubs(locale, nav.topics);
  const cards = hubs.flatMap((hub) => hub.cards);
  const spreadInputs = cards.some((card) => isRegionsPage(card.href)) ? await loadSpreadInputs(locale) : null;
  const messages = { ...getCommonMessages(locale), ...getGroupsMessages(locale) };

  const pages = groupPages(nav).length;
  const date = updatedDate(hubs.map((hub) => hub.lastReviewedAt).reduce((latest, reviewed) => (reviewed > latest ? reviewed : latest)), locale);
  const meta = nav.topics.length > 1
    ? message(messages, "groups.meta", { topics: nav.topics.length, pages, date })
    : message(messages, "groups.metaSolo", { pages, date });

  const topics: GroupTopicSection[] = hubs.map((hub) => ({
    topic: hub.topic,
    label: message(messages, `common.topic.${hub.topic}`),
    meta: `${topicHubCoverage(messages, locale, hub)} · ${pagesLabel(messages, hub.cards.length)}`,
    line: nav.topics.length > 1 ? message(messages, `groups.topicLine.${hub.topic}`) : null,
    cards: hub.cards,
    spreads: hub.cards.map((card) => (spreadInputs && card.href && isRegionsPage(card.href)
      ? regionSpread(entriesForPage(spreadInputs.index, card.href), spreadInputs.regionName, locale)
      : null)),
  }));

  return (
    <GroupPage
      locale={locale}
      messages={messages}
      group={group}
      href={nav.href}
      name={message(messages, nav.labelKey)}
      line={message(messages, `groups.line.${group}`)}
      meta={meta}
      headlines={groupHeadlines(group, cards, messages)}
      topics={topics}
      regionCount={spreadInputs?.regionCount ?? 0}
    />
  );
}

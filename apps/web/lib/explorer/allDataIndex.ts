import { message } from "../i18n/messages";
import type { Locale, Messages } from "../i18n/types";
import { NAV_GROUPS, NAV_TREE, groupOfTopic, groupPages, topicHub, topicSection } from "../navigation/navTree";
import { rowLabel, type SearchPage, type SearchShortcut } from "./search/searchExplorer";
import type { TopicHubData } from "./topicHub";

// The All data page's lists (spec 2026-10-24-explorer-regroup §6): every navigation page as search and the A to Z list
// see it, the group and topic shortcuts, and the A to Z letters split into two columns, after the prototype's script.

/** The pages that start with one letter, under that letter's anchor. */
export type AzGroup = { letter: string; id: string; rows: SearchPage[] };

const KA_ALPHABET = "აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ";
const EN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The letters the A to Z bar shows, in order. */
export const azAlphabet = (locale: Locale) => (locale === "ka" ? KA_ALPHABET : EN_ALPHABET);

/** A letter's anchor on the page. */
const azLetterId = (letter: string) => `az-${letter.codePointAt(0)}`;

/** A page's search words: `allData.words.{href below /explorer/, slashes as dots}`, in both languages. */
const wordsKey = (href: string) => `allData.words.${href.replace("/explorer/", "").replaceAll("/", ".")}`;
const words = (href: string, messagesKa: Messages, messagesEn: Messages) =>
  [messagesKa[wordsKey(href)], messagesEn[wordsKey(href)]].filter(Boolean).join(" ");

const bilingual = (key: string, messagesKa: Messages, messagesEn: Messages) => ({ ka: message(messagesKa, key), en: message(messagesEn, key) });

/**
 * Every navigation page, in navigation order, with its names in both languages (`common` and `allData` messages) and
 * the latest value and trend line of its card on its topic's hub.
 */
export function buildSearchPages(topics: readonly TopicHubData[], messagesKa: Messages, messagesEn: Messages): SearchPage[] {
  const cards = new Map(topics.flatMap((hub) => hub.cards.flatMap((card) => (card.href ? [[card.href, card] as const] : []))));
  return NAV_TREE.flatMap((hub) => {
    const group = groupOfTopic(hub.id);
    return hub.sections.map((section) => {
      const card = cards.get(section.href);
      return {
        href: section.href,
        group: group.id,
        topic: hub.id,
        name: bilingual(section.labelKey, messagesKa, messagesEn),
        topicName: bilingual(`common.topic.${hub.id}`, messagesKa, messagesEn),
        groupName: bilingual(group.labelKey, messagesKa, messagesEn),
        words: words(section.href, messagesKa, messagesEn),
        value: card?.latest?.value ?? "",
        period: card?.latest?.period ?? "",
        spark: card?.series ?? null,
      };
    });
  });
}

/** Every group, and the topics of the groups that hold more than one, each linking to its page or section. */
export function buildShortcuts(messagesKa: Messages, messagesEn: Messages): SearchShortcut[] {
  return NAV_GROUPS.flatMap((group) => [
    { kind: "group" as const, href: group.href, group: group.id, name: bilingual(group.labelKey, messagesKa, messagesEn), count: groupPages(group).length },
    ...(group.topics.length > 1
      ? group.topics.map((topic) => ({
        kind: "topic" as const, href: topicSection(topic).href, group: group.id,
        name: bilingual(`common.topic.${topic}`, messagesKa, messagesEn), count: topicHub(topic).sections.length,
      }))
      : []),
  ]);
}

/**
 * The `allData` strings the search box reads in the browser: not the search words, which ship inside the pages, nor those
 * only the server renders. `common` comes from the root layout's provider.
 */
export function searchMessages(messages: Messages): Messages {
  return Object.fromEntries(Object.entries(messages).filter(([key]) => key.startsWith("allData.") && !/^allData\.(words\.|meta|title$|line$|alphabetLabel$|indexTitle$)/.test(key)));
}

/** A row's first letter: as written in Georgian, upper case in English. */
const firstLetter = (label: string, locale: Locale) => (locale === "ka" ? label[0] : label[0].toUpperCase());

/** The pages by first letter of their row label, Georgian in its alphabet's order (`ა`–`ჰ`), English A to Z. */
export function azGroups(pages: readonly SearchPage[], locale: Locale): AzGroup[] {
  const alphabet = azAlphabet(locale);
  const sorted = pages.map((page) => ({ page, label: rowLabel(page, locale) })).sort((a, b) => (locale === "en"
    ? a.label.localeCompare(b.label, "en", { sensitivity: "base" })
    : a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  const byLetter = new Map<string, SearchPage[]>();
  for (const { page, label } of sorted) {
    const letter = firstLetter(label, locale);
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), page]);
  }
  return [...byLetter]
    .sort(([a], [b]) => alphabet.indexOf(a) - alphabet.indexOf(b))
    .map(([letter, rows]) => ({ letter, id: azLetterId(letter), rows }));
}

/** The letters in two columns of about the same height: a letter weighs its rows plus 1.4 for its heading. */
export function azColumns(groups: readonly AzGroup[]): [AzGroup[], AzGroup[]] {
  const weight = (group: AzGroup) => group.rows.length + 1.4;
  const half = groups.reduce((total, group) => total + weight(group), 0) / 2;
  let sum = 0;
  let cut = groups.length;
  for (let index = 0; index < groups.length; index++) {
    if (sum + weight(groups[index]) / 2 > half) {
      cut = index;
      break;
    }
    sum += weight(groups[index]);
  }
  return [groups.slice(0, cut), groups.slice(cut)];
}

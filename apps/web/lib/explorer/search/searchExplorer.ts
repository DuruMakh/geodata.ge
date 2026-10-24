import type { Locale } from "../../i18n/types";
import { fold } from "../../i18n/search";
import type { GroupId, TopicId } from "../../navigation/navTree";
import type { Place, PlaceEntry } from "../places/types";
import { isLatin, latinToGeorgian, stem } from "./georgian";

// The All data page's search (spec 2026-10-24-explorer-regroup §7), ported from the prototype
// `docs/superpowers/specs/assets/2026-10-24-explorer-prototype.dc.html`. It runs in the browser, so it stays pure.

type Bilingual = { ka: string; en: string };

/** One navigation page as search sees it: its names, its topic and group names, its extra words and latest value. */
export type SearchPage = {
  href: string;
  group: GroupId;
  topic: TopicId;
  name: Bilingual;
  topicName: Bilingual;
  groupName: Bilingual;
  /** The page's extra search words in both languages. */
  words: string;
  value: string;
  period: string;
  spark: (number | null)[] | null;
};

/** A group or topic row shown above the results when every word matches its name. */
export type SearchShortcut = { kind: "group" | "topic"; href: string; group: GroupId; name: Bilingual; count: number };

/** A run of a result's name, marked where it matches the query. */
export type Segment = { text: string; mark: boolean };

export type ResultRow = { href: string; page: SearchPage; label: Segment[]; mirror: Segment[]; value: string; period: string };

export type SearchResult = {
  /** The query read through the Georgian keyboard, when that reading is what found the results. */
  reading: string | null;
  place: { place: Place; typeLabelArgs: { kind: "region" | "municipality" | "capital"; count?: number; region?: string } } | null;
  groups: { kind: "own" | "region" | "flat"; label: string; rows: ResultRow[] }[];
  shortcuts: SearchShortcut[];
  total: number;
};

type PlaceIndexData = { places: Place[]; entries: PlaceEntry[] };

const MUNICIPAL_BUDGET_PAGE = "/explorer/municipalities";

/** Matching text: folded (case, accents, dashes), with quotes and punctuation as spaces. */
const norm = (text: string) => fold(text).replace(/[„“”"'‘’«».,:;!?()/\\+]/g, " ").replace(/\s+/g, " ").trim();
const wordsOf = (text: string) => norm(text).split(" ").filter(Boolean);

/** How well one query word matches a field: a word start 1, inside the field from 3 letters 0.7, by stem 0.55. */
function wordScore(word: string, field: string): number {
  if (!word) return 0;
  const fieldWords = field.split(" ");
  if (fieldWords.some((fieldWord) => fieldWord.startsWith(word))) return 1;
  if (word.length >= 3 && field.includes(word)) return 0.7;
  const wordStem = stem(word);
  if (wordStem.length >= 4 && wordStem !== word && fieldWords.some((fieldWord) => fieldWord.startsWith(wordStem))) return 0.55;
  return 0;
}

/** Weights of a page's fields: its name, its name in the other language, topic, group, extra words. */
const WEIGHTS = [10, 10, 4, 3, 6];

function pageFields(page: SearchPage, locale: Locale): string[] {
  const other = locale === "ka" ? "en" : "ka";
  return [
    norm(page.name[locale]), norm(page.name[other]), norm(`${page.topicName.ka} ${page.topicName.en}`), norm(`${page.groupName.ka} ${page.groupName.en}`), norm(page.words),
  ];
}

/** A page's score for the words: each word's best weighted field, plus 8 for its exact name; 0 unless every word matches. */
function pageScore(page: SearchPage, locale: Locale, words: string[]): number {
  const fields = pageFields(page, locale);
  let total = 0;
  for (const word of words) {
    const best = Math.max(...fields.map((field, index) => wordScore(word, field) * WEIGHTS[index]));
    if (!best) return 0;
    total += best;
  }
  const phrase = words.join(" ");
  if (norm(page.name.ka) === phrase || norm(page.name.en) === phrase) total += 8;
  return total;
}

/** The place a word names best, and how well: the whole name 3, its first word or the name without spaces 2.6, its start 2, by stem 1.8. */
function placeFor(word: string, places: Place[]): { place: Place; score: number } | null {
  if (word.length < 2) return null;
  const compact = word.replace(/[\s-]/g, "");
  let best: Place | null = null;
  let bestScore = 0;
  for (const place of places) {
    for (const name of [norm(place.nameKa), norm(place.nameEn)]) {
      let score = 0;
      if (name === word) score = 3;
      else if (name.split(" ")[0] === word || name.replace(/[\s-]/g, "") === compact) score = 2.6;
      else if (word.length >= 3 && name.startsWith(word)) score = 2;
      else if (word.length >= 4 && stem(word).length >= 3 && name.startsWith(stem(word))) score = 1.8;
      if (score > bestScore) {
        bestScore = score;
        best = place;
      }
    }
  }
  return best ? { place: best, score: bestScore } : null;
}

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/**
 * A label cut into runs, marked where a query word starts a word. A word found by its stem marks as many letters as
 * were typed, up to the end of the label's word: `ინფლაცია` marks `ინფლაციი` of `ინფლაციის`.
 */
function segments(label: string, words: string[]): Segment[] {
  const lower = label.toLocaleLowerCase("en");
  const mark: boolean[] = new Array(label.length).fill(false);
  for (const word of words) {
    const wordStem = stem(word);
    const candidates = wordStem !== word && wordStem.length >= 4 ? [word, wordStem] : [word];
    for (const candidate of candidates) {
      if (candidate.length < 2) continue;
      let found = false;
      for (let start = lower.indexOf(candidate); start >= 0; start = lower.indexOf(candidate, start + 1)) {
        if (isWordChar(lower[start - 1])) continue;
        let end = start + candidate.length;
        if (candidate !== word) while (end < start + word.length && isWordChar(lower[end])) end++;
        mark.fill(true, start, end);
        found = true;
      }
      if (found) break;
    }
  }
  const out: Segment[] = [];
  for (let index = 0; index < label.length; index++) {
    const last = out.at(-1);
    if (last && last.mark === mark[index]) last.text += label[index];
    else out.push({ text: label[index], mark: mark[index] });
  }
  return out.length ? out : [{ text: label, mark: false }];
}

/** Page names that only make sense beside their topic (Georgian names, as in the prototype). */
const GENERIC = [
  "რეგიონები", "ხარჯები", "შემოსავლები", "პროდუქტები", "კატეგორიები", "ქალაქები", "საქმიანობები", "სექტორები", "ანალიზი", "ბრუნვა", "დასაქმებულები", "სქესი",
  "ასაკობრივი ჯგუფები", "ვალი", "მუნიციპალიტეტები",
];

/** A page's name for a row: a vague name gets its topic in front, `ხელფასები — რეგიონები` / `Wages — regions`. */
export function rowLabel(page: SearchPage, locale: Locale): string {
  if (!GENERIC.includes(page.name.ka)) return page.name[locale];
  return locale === "ka" ? `${page.topicName.ka} — ${page.name.ka}` : `${page.topicName.en} — ${page.name.en.toLowerCase()}`;
}

type Run = { place: { place: Place; word: string; score: number } | null; rest: string[]; scored: { page: SearchPage; score: number }[] };

function runWords(words: string[], locale: Locale, pages: SearchPage[], places: Place[]): Run {
  let place: Run["place"] = null;
  for (const word of words) {
    const match = placeFor(word, places);
    if (match && match.score >= 1.8 && (!place || match.score > place.score)) place = { ...match, word };
  }
  if (!place && words.length > 1) {
    const phrase = words.join(" ");
    const match = placeFor(phrase, places);
    if (match && match.score >= 2) place = { ...match, word: phrase };
  }
  let rest = words;
  if (place) {
    const nameKa = norm(place.place.nameKa);
    const nameEn = norm(place.place.nameEn);
    const placeWord = place.word;
    rest = words.filter((word) => word !== placeWord && !nameKa.includes(word) && !nameEn.includes(word));
  }
  const scored = rest.length
    ? pages.map((page) => ({ page, score: pageScore(page, locale, rest) })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score)
    : [];
  return { place, rest, scored };
}

/**
 * Searches the pages and, once the place index has arrived, the places. A query that names a place gives its card,
 * its own rows (its municipal budget first) and its region's other rows, each linking to the place's page; other
 * words narrow those rows. Otherwise the pages that match every word, best first, under the matching shortcuts.
 * A Latin query that finds nothing is read through the Georgian keyboard. `null` for an empty query.
 */
export function searchExplorer(
  query: string, locale: Locale, pages: SearchPage[], shortcuts: SearchShortcut[], places: PlaceIndexData | null,
): SearchResult | null {
  let words = wordsOf(query);
  if (!words.length) return null;
  const placeList = places?.places ?? [];
  let reading: string | null = null;
  let found = runWords(words, locale, pages, placeList);
  if (!found.place && !found.scored.length && isLatin(query)) {
    const georgian = wordsOf(latinToGeorgian(query.trim()));
    const retry = runWords(georgian, locale, pages, placeList);
    if (retry.place || retry.scored.length) {
      reading = georgian.join(" ");
      words = georgian;
      found = retry;
    }
  }

  const row = (page: SearchPage, href: string, value: string, period: string): ResultRow => ({
    href, page, label: segments(rowLabel(page, locale), words), mirror: segments(page.name[locale === "ka" ? "en" : "ka"], words), value, period,
  });
  const result: SearchResult = { reading, place: null, groups: [], shortcuts: [], total: 0 };

  if (found.place && places) {
    const { place } = found.place;
    const { rest } = found;
    const pageOf = new Map(pages.map((page) => [page.href, page]));
    const placeName = (candidate: Place) => (locale === "ka" ? candidate.nameKa : candidate.nameEn);
    const rowsFor = (placeId: string, skip: ReadonlySet<string>) => places.entries
      .filter((entry) => entry.placeId === placeId && !skip.has(entry.page))
      .flatMap((entry) => {
        const page = pageOf.get(entry.page);
        return page && (!rest.length || pageScore(page, locale, rest) > 0) ? [row(page, entry.href, entry.value, entry.period)] : [];
      });

    const own = rowsFor(place.id, new Set())
      .sort((a, b) => Number(b.page.href === MUNICIPAL_BUDGET_PAGE) - Number(a.page.href === MUNICIPAL_BUDGET_PAGE));
    const region = place.regionId === place.id ? undefined : placeList.find((candidate) => candidate.id === place.regionId);
    const regional = region ? rowsFor(region.id, new Set(own.map((candidate) => candidate.page.href))) : [];

    result.place = {
      place,
      typeLabelArgs: place.capital
        ? { kind: "capital" }
        : place.kind === "region"
          ? { kind: "region", count: place.municipalityCount }
          : { kind: "municipality", region: region ? placeName(region) : undefined },
    };
    if (own.length) result.groups.push({ kind: "own", label: placeName(place), rows: own });
    if (region && regional.length) result.groups.push({ kind: "region", label: placeName(region), rows: regional });
  } else {
    if (found.scored.length) {
      result.groups.push({ kind: "flat", label: "", rows: found.scored.map(({ page }) => row(page, page.href, page.value, page.period)) });
    }
    const matchesAll = (name: string) => words.every((word) => wordScore(word, norm(name)) >= 0.55);
    result.shortcuts = shortcuts.filter((shortcut) => matchesAll(shortcut.name.ka) || matchesAll(shortcut.name.en));
  }
  result.total = result.groups.reduce((total, group) => total + group.rows.length, 0);
  return result;
}

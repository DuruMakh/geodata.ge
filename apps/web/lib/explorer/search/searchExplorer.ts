import type { Locale } from "../../i18n/types";
import { fold } from "../../i18n/search";
import type { GroupId, TopicId } from "../../navigation/navTree";
import { BUDGET_SECTIONS } from "../sections";
import { MUNICIPAL_COUNTRY_ID as GEORGIA_PLACE_ID } from "../../data/municipal/types";
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
  /** What the value measures where its card names it (`Deaths per 1,000 people, Georgia`), or empty. */
  caption: string;
  /** A preliminary value, marked after its period as the card marks it. */
  status?: "preliminary";
  spark: (number | null)[] | null;
};

/** A group or topic row shown above the results when every word matches its name. */
export type SearchShortcut = { kind: "group" | "topic"; href: string; group: GroupId; name: Bilingual; count: number };

/** A run of a result's name, marked where it matches the query. */
export type Segment = { text: string; mark: boolean };

/** A result row: a page's own value with its caption and mark, or a place's value on that page, which its period alone dates. */
export type ResultRow = { href: string; page: SearchPage; label: Segment[]; mirror: Segment[]; value: string; period: string; caption: string; status?: "preliminary" };

/** The line under a row's value: its caption, its period and a preliminary mark (`preliminary`, the language's word), as a card writes them. */
export function valueNote(row: Pick<ResultRow, "caption" | "period" | "status">, preliminary: string): string {
  return [row.caption, row.period, row.status === "preliminary" ? preliminary : ""].filter(Boolean).join(" · ");
}

export type SearchResult = {
  /** The query read through the Georgian keyboard, when that reading is what found the results. */
  reading: string | null;
  place: { place: Place; typeLabelArgs: { kind: "region" | "municipality" | "capital"; count?: number; region?: string } } | null;
  /** A place's own rows, its region's, Georgia's (`country`, its label left to the page's strings) or the pages found. */
  groups: { kind: "own" | "region" | "country" | "flat"; label: string; rows: ResultRow[] }[];
  shortcuts: SearchShortcut[];
  total: number;
};

type PlaceIndexData = { places: Place[]; entries: PlaceEntry[] };

const MUNICIPAL_BUDGET_PAGE = BUDGET_SECTIONS.municipalities.href;

/** Matching text: folded (case, accents, dashes), with quotes and punctuation as spaces. */
const norm = (text: string) => fold(text).replace(/[„“”"'‘’«».,:;!?()/\\+]/g, " ").replace(/\s+/g, " ").trim();
/** A query's words; a lone dash (`Wages — regions`) is not a word, while `15-19` keeps its hyphen. */
const wordsOf = (text: string) => norm(text).split(" ").filter((word) => /[\p{L}\p{N}]/u.test(word));

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

/**
 * A page's matching fields, normalised once per page object rather than on every keystroke. The two names weigh the
 * same, so the Georgian name comes first in both languages.
 */
const PAGE_FIELDS = new WeakMap<SearchPage, string[]>();
function pageFields(page: SearchPage): string[] {
  let fields = PAGE_FIELDS.get(page);
  if (!fields) {
    fields = [norm(page.name.ka), norm(page.name.en), norm(`${page.topicName.ka} ${page.topicName.en}`), norm(`${page.groupName.ka} ${page.groupName.en}`), norm(page.words)];
    PAGE_FIELDS.set(page, fields);
  }
  return fields;
}

/**
 * A page's score for the words: each word's best weighted field, plus 8 when `phrase` (the words as typed, joining words
 * included) is its exact name; 0 unless every word matches.
 */
function pageScore(page: SearchPage, words: string[], phrase = words.join(" ")): number {
  const fields = pageFields(page);
  let total = 0;
  for (const word of words) {
    const best = Math.max(...fields.map((field, index) => wordScore(word, field) * WEIGHTS[index]));
    if (!best) return 0;
    total += best;
  }
  if (fields[0] === phrase || fields[1] === phrase) total += 8;
  return total;
}

/** The pages that match every word, best first. */
function searchPages(pages: SearchPage[], words: string[], phrase: string): { page: SearchPage; score: number }[] {
  if (!words.length) return [];
  return pages.map((page) => ({ page, score: pageScore(page, words, phrase) })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
}

/** English words that only join others (`schools in gori`), dropped while other words remain. */
const JOINING_WORDS = new Set(["in", "of", "the", "for", "and", "at"]);
const COUNTRY_STEM = stem("საქართველო");
/** Georgia itself, in English or in any Georgian case (`საქართველოს`, `საქართველოში`): no page's word, so it is dropped beside others. */
const isCountryWord = (word: string) => word === "georgia" || stem(word) === COUNTRY_STEM;

/** The words that search pages: without joining words, then without Georgia, each only while other words remain. */
function contentWords(words: string[]): string[] {
  const joined = words.some((word) => !JOINING_WORDS.has(word)) ? words.filter((word) => !JOINING_WORDS.has(word)) : words;
  return joined.some((word) => !isCountryWord(word)) ? joined.filter((word) => !isCountryWord(word)) : joined;
}

type PlaceName = {
  name: string;
  /** The name's first word and, for a hyphenated name, its first part (`რაჭა-ლეჩხუმი`, `რაჭა`). */
  firstWords: string[];
  /** Every word of the name, split at spaces and hyphens. */
  words: string[];
  compact: string;
  firstStem: string;
  nameStem: string;
  /** A name in `-ია` loses the `ა` before its case endings, so `გურიის` stems to `გურ`, not `გური`. */
  iaStem: string | null;
  shortStem: string | null;
  /** The first word is a common adjective (`შიდა`, `ქვემო`), which names the place only together with the next word. */
  weakFirst: boolean;
};

/** First words of place names that are ordinary words too: `შიდა პროდუქტი` is domestic product, not Shida Kartli. */
const WEAK_FIRST_WORDS = new Set(["შიდა", "ქვემო", "ზემო", "shida", "kvemo", "zemo"]);

/** What may follow a short name's stem: its own final vowel, if any, then a case ending (`გორში`, `ქედაში`, `ონში`), not a plural. */
const SHORT_NAME_ENDING = /^[იაეოუ]?(?:ისთვის|იდან|ამდე|ში|ზე|ით|ად|ის|მა|ს)$/;

/** A place's two names and its other spellings, normalised once per place object. */
const PLACE_NAMES = new WeakMap<Place, PlaceName[]>();
function placeNames(place: Place): PlaceName[] {
  let names = PLACE_NAMES.get(place);
  if (!names) {
    names = [place.nameKa, place.nameEn, ...(place.aliases ?? [])].map((raw) => {
      const name = norm(raw);
      const words = name.split(/[\s-]/);
      // `stem` leaves a name under 5 letters whole, so its own stem is the name without its final vowel (`გორი` → `გორ`).
      const short = name.length >= 3 && name.length < 5 ? name.replace(/[იაეოუ]$/, "") : name;
      const nameStem = stem(name);
      return {
        name, firstWords: [...new Set([name.split(" ")[0], words[0]])], words, compact: name.replace(/[\s-]/g, ""), firstStem: stem(words[0]), nameStem,
        iaStem: name.endsWith("ია") ? nameStem.slice(0, -1) : null, shortStem: short === name ? null : short, weakFirst: WEAK_FIRST_WORDS.has(words[0]),
      };
    });
    PLACE_NAMES.set(place, names);
  }
  return names;
}

/** The score of a match by a name's start alone: a word still being typed, which never displaces the pages it finds. */
const PREFIX_SCORE = 2;

/**
 * The place a word (or a run of words) names best, and how well: the whole name 3, its first word or the name without
 * spaces 2.6, its start 2, the whole name with another ending 1.9 (`მცხეთაში` is Mtskheta, not Mtskheta-Mtianeti; a short
 * name's stem then a case ending, `გორში`), the first word with another ending 1.8 (`ბათუმში`, `აჭარაში`). The stem must
 * equal the name's own stem, not just start it, or `საგარეო` would find Sagarejo and `ბაღები` Baghdati. A weak first
 * word (`შიდა`) names nothing alone, nor does any start of it.
 */
function placeFor(word: string, places: Place[]): { place: Place; score: number } | null {
  if (word.length < 2 || WEAK_FIRST_WORDS.has(word)) return null;
  const compact = word.replace(/[\s-]/g, "");
  const wordStem = stem(word);
  let best: Place | null = null;
  let bestScore = 0;
  for (const place of places) {
    for (const { name, firstWords, words, compact: nameCompact, firstStem, nameStem, iaStem, shortStem, weakFirst } of placeNames(place)) {
      const stemmed = word.length >= 4 && wordStem.length >= 3;
      let score = 0;
      if (name === word) score = 3;
      else if (firstWords.includes(word) || nameCompact === compact) score = 2.6;
      else if (word.length >= 3 && name.startsWith(word) && !(weakFirst && word.length <= words[0].length)) score = PREFIX_SCORE;
      else if (stemmed && (wordStem === nameStem || wordStem === iaStem)) score = 1.9;
      else if (shortStem !== null && word.startsWith(shortStem) && SHORT_NAME_ENDING.test(word.slice(shortStem.length))) score = 1.9;
      else if (stemmed && !weakFirst && wordStem === firstStem) score = 1.8;
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
  "ასაკობრივი ჯგუფები", "ვალი", "მუნიციპალიტეტები", "მიმოხილვა", "დანახარჯები",
];

/** A page's name for a row: a vague name gets its topic in front, `ხელფასები — რეგიონები` / `Wages — regions`. */
export function rowLabel(page: SearchPage, locale: Locale): string {
  if (!GENERIC.includes(page.name.ka)) return page.name[locale];
  return locale === "ka" ? `${page.topicName.ka} — ${page.name.ka}` : `${page.topicName.en} — ${page.name.en.toLowerCase()}`;
}

type PlaceMatch = { place: Place; score: number; start: number; end: number };

/** The longest place name, in words (`რაჭა-ლეჩხუმი და ქვემო სვანეთი`). */
const MAX_PLACE_WORDS = 4;

/**
 * The place the words name best: each run of up to four words is tried, and each word a run covers beyond its first
 * adds 1, so a place named by more of the query wins (`მცხეთა მთიანეთი` is the region, not Mtskheta and a stray word).
 */
function placeIn(words: string[], places: Place[]): PlaceMatch | null {
  let best: (PlaceMatch & { rank: number }) | null = null;
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= Math.min(words.length, start + MAX_PLACE_WORDS); end++) {
      const match = placeFor(words.slice(start, end).join(" "), places);
      if (!match || match.score < 1.8) continue;
      const rank = match.score + (end - start - 1);
      if (!best || rank > best.rank) best = { ...match, start, end, rank };
    }
  }
  return best && { place: best.place, score: best.score, start: best.start, end: best.end };
}

/** Whether a word is one of the place's own words, as written or with another ending: `kvemo kartli` leaves nothing, `tsageri age` leaves `age`. */
function isPlaceWord(place: Place, word: string): boolean {
  const wordStem = stem(word);
  return placeNames(place).some((name) => name.words.some((nameWord) => nameWord === word || (wordStem.length >= 3 && stem(nameWord) === wordStem)));
}

type Run = {
  place: PlaceMatch | null;
  /** The query names Georgia and nothing else. */
  country: boolean;
  /** The words that narrow a place's rows. */
  rest: string[];
  /** The words that search the pages, and are marked in the results. */
  content: string[];
  /** The pages that match the content words, best first; with a place, those that match its other words. */
  scored: { page: SearchPage; score: number }[];
};

function runWords(words: string[], pages: SearchPage[], places: Place[]): Run {
  const content = contentWords(words);
  const country = content.every(isCountryWord);
  const scored = country ? [] : searchPages(pages, content, words.join(" "));
  let place = placeIn(words, places);
  // A word half typed (`საგ` on its way to `საგარეო ვალი`) does not swap the pages it finds for a place's.
  if (place?.score === PREFIX_SCORE && scored.length) place = null;
  if (!place) return { place, country, rest: [], content, scored };
  const rest = words.filter((word, index) => (index < place.start || index >= place.end) && !JOINING_WORDS.has(word) && !isCountryWord(word) && !isPlaceWord(place.place, word));
  return { place, country: false, rest, content: rest, scored: searchPages(pages, rest, rest.join(" ")) };
}

/**
 * Searches the pages and, once the place index has arrived, the places. A query that names a place gives its card,
 * its own rows (its municipal budget first) and its region's other rows, each linking to the place's page; other
 * words narrow those rows, and give their pages instead when they rule all of them out. Georgia alone gives Georgia's
 * own rows. Otherwise the pages that match every word, best first, under the matching shortcuts.
 * A Latin query that finds nothing is read through the Georgian keyboard, as typed (Shift letters such as `T` → `თ`)
 * and then in lower case, so `XELFASEBI` still reads `ხელფასები`. `null` for an empty query.
 */
export function searchExplorer(
  query: string, locale: Locale, pages: SearchPage[], shortcuts: SearchShortcut[], places: PlaceIndexData | null,
): SearchResult | null {
  const words = wordsOf(query);
  if (!words.length) return null;
  const placeList = places?.places ?? [];
  let reading: string | null = null;
  let found = runWords(words, pages, placeList);
  if (!found.place && !found.country && !found.scored.length && isLatin(query)) {
    for (const typed of new Set([query.trim(), query.trim().toLowerCase()])) {
      const georgian = wordsOf(latinToGeorgian(typed));
      const retry = runWords(georgian, pages, placeList);
      if (retry.place || retry.scored.length) {
        reading = georgian.join(" ");
        found = retry;
        break;
      }
    }
  }

  const marks = found.content;
  const row = (page: SearchPage, href: string, value: string, period: string, own?: Pick<SearchPage, "caption" | "status">): ResultRow => ({
    href, page, label: segments(rowLabel(page, locale), marks), mirror: segments(page.name[locale === "ka" ? "en" : "ka"], marks), value, period,
    caption: own?.caption ?? "", ...(own?.status ? { status: own.status } : {}),
  });
  const result: SearchResult = { reading, place: null, groups: [], shortcuts: [], total: 0 };
  const pageOf = new Map(pages.map((page) => [page.href, page]));
  const rowsFor = (placeId: string, rest: string[], skip: ReadonlySet<string> = new Set()) => (places?.entries ?? [])
    .filter((entry) => entry.placeId === placeId && !skip.has(entry.page))
    .flatMap((entry) => {
      const page = pageOf.get(entry.page);
      return page && (!rest.length || pageScore(page, rest) > 0) ? [row(page, entry.href, entry.value, entry.period, { caption: entry.caption ?? "" })] : [];
    });

  const named = found.place && places ? found.place.place : null;
  const own = named ? rowsFor(named.id, found.rest).sort((a, b) => Number(b.page.href === MUNICIPAL_BUDGET_PAGE) - Number(a.page.href === MUNICIPAL_BUDGET_PAGE)) : [];
  const region = named && named.regionId !== named.id ? placeList.find((candidate) => candidate.id === named.regionId) : undefined;
  const regional = region ? rowsFor(region.id, found.rest, new Set(own.map((candidate) => candidate.page.href))) : [];

  // A place whose rows the other words all rule out gives way to the pages those words find.
  if (named && (own.length || regional.length || !found.scored.length)) {
    const place = named;
    const placeName = (candidate: Place) => (locale === "ka" ? candidate.nameKa : candidate.nameEn);
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
  } else if (found.country) {
    // Georgia has no place card: its rows are the national figures of the pages that also hold places.
    const rows = rowsFor(GEORGIA_PLACE_ID, []);
    if (rows.length) result.groups.push({ kind: "country", label: "", rows });
  } else {
    if (found.scored.length) {
      result.groups.push({ kind: "flat", label: "", rows: found.scored.map(({ page }) => row(page, page.href, page.value, page.period, page)) });
    }
    const matchesAll = (name: string) => found.content.every((word) => wordScore(word, norm(name)) >= 0.55);
    result.shortcuts = shortcuts.filter((shortcut) => matchesAll(shortcut.name.ka) || matchesAll(shortcut.name.en));
  }
  result.total = result.groups.reduce((total, group) => total + group.rows.length, 0);
  return result;
}

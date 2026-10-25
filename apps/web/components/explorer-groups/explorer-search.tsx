"use client";

import { ChevronRight, Languages, MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useHashState, writeHash } from "../explorer-shell/use-hash-state";
import { GROUP_ICONS } from "../shell/group-icons";
import { Sparkline } from "../ui/sparkline";
import { EXPLORER_SEARCH_INPUT_ID } from "./explorer-search-focus";
import type { PlaceFact, PlaceIndex } from "../../lib/explorer/places/types";
import { searchExplorer, valueNote, type ResultRow, type SearchPage, type SearchResult, type SearchShortcut, type Segment } from "../../lib/explorer/search/searchExplorer";
import { pagesLabel } from "../../lib/explorer/pagesLabel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale, Messages } from "../../lib/i18n/types";
import { navGroup } from "../../lib/navigation/navTree";

// The All data page's search (spec 2026-10-24-explorer-regroup §7, prototype `dx-search`, `dx-q`, `dx-try`, `dx-place`, `dx-res`,
// `dx-row`, `dx-grp`): a combobox over a listbox of results, with the server's A to Z list below it while the box is empty. The query
// lives in the address as `#q=`. Pages are searched at once; the places file is fetched on the first query and joins the search when
// it lands, however long it takes. If it fails, page search goes on, the place card is simply absent, and the next query asks for the
// file again.

type FetchLike = (url: string) => Promise<Response>;

/** How long a query that finds nothing waits for the places file before it says the places are still loading. */
export const PLACES_TIMEOUT_MS = 4000;

const placesFiles = new Map<Locale, Promise<PlaceIndex | null>>();

/**
 * The language's places file, or `null` when the request fails, is not OK or is not the index. A slow file is never cancelled:
 * every query waits on the one request. A failure is forgotten, so the next call asks again; the first good file is kept for
 * the page's life.
 */
export function loadPlaces(fetchImpl: FetchLike, locale: Locale): Promise<PlaceIndex | null> {
  const cached = placesFiles.get(locale);
  if (cached) return cached;
  const request = fetchImpl(`/explorer-places.${locale}.json`)
    .then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json() as Partial<PlaceIndex> | null;
      return Array.isArray(data?.places) && Array.isArray(data?.entries) ? data as PlaceIndex : null;
    })
    .catch(() => null)
    .then((data) => {
      if (!data) placesFiles.delete(locale);
      return data;
    });
  placesFiles.set(locale, request);
  return request;
}

const parseQuery = (hash: string) => new URLSearchParams(hash.replace(/^#/, "")).get("q") ?? "";
/** An empty box leaves no `q` behind, so a cleared page reloads or is shared without the focus an empty `#q=` asks for. */
const serializeQuery = (query: string) => (query ? `q=${encodeURIComponent(query)}` : "");
const NO_DATA = null;
/** The hash state writes `#` for an empty box; drop the bare `#` from the address. */
function dropEmptyHash() {
  if (window.location.href.endsWith("#")) writeHash(`${window.location.pathname}${window.location.search}`, "replace");
}
const HASH_OPTIONS = { afterWrite: dropEmptyHash };
/** `#q=` with nothing after it: the sidebar's search link, which opens the page with the box focused. */
const EMPTY_QUERY_HASH = /(?:^#|&)q=(?:&|$)/;

const NUMERIC = "font-[family-name:var(--font-numeric)]";
const DISPLAY = "font-[family-name:var(--font-display)]";
const CHIP_CLASS = "inline-flex min-h-[34px] items-center border border-[var(--hairline)] bg-[var(--paper)] px-[13px] text-[12.5px] text-[var(--ink)] transition-colors duration-150 hover:border-[var(--ink)] hover:bg-[var(--tile)] motion-reduce:transition-none max-[768px]:min-h-11 max-[768px]:flex-none";
const MARK_CLASS = "bg-transparent text-[var(--accent)]";

const PLACE_FACT_KEYS: Record<PlaceFact["label"], string> = {
  population: "allData.fact.population",
  budget: "allData.fact.budget",
  perResident: "allData.fact.budgetPerResident",
  birthsPer100Deaths: "allData.fact.birthsPer100Deaths",
};

function Marked({ segments, markClass }: { segments: Segment[]; markClass: string }) {
  return segments.map((segment, index) => (segment.mark ? <mark key={index} className={markClass}>{segment.text}</mark> : <span key={index}>{segment.text}</span>));
}

/** A page's place in the navigation: its group, and its topic when the group has several. */
function crumb(page: SearchPage, locale: Locale) {
  return navGroup(page.group).topics.length > 1 ? `${page.groupName[locale]} › ${page.topicName[locale]}` : page.groupName[locale];
}

type Option = { id: string; href: string };

function PlaceCard({ result, locale, messages }: { result: NonNullable<SearchResult["place"]>; locale: Locale; messages: Messages }) {
  const { place, typeLabelArgs } = result;
  const type = typeLabelArgs.kind === "capital"
    ? message(messages, "allData.place.capital")
    : typeLabelArgs.kind === "region"
      ? message(messages, "allData.place.region", { n: typeLabelArgs.count ?? 0 })
      : message(messages, "allData.place.municipality", { region: typeLabelArgs.region ?? "" });
  return (
    <div data-testid="place-card" className="mt-[26px] border-[1.5px] border-[var(--ink)] bg-[var(--tile)]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-[var(--hairline)] px-[22px] pt-4 pb-3.5 max-[768px]:px-4">
        <p className={`flex items-center gap-2.5 ${DISPLAY} text-[30px] leading-[1.15] font-semibold max-[768px]:text-[25px]`}>
          <MapPin aria-hidden strokeWidth={1.75} className="size-6 flex-none text-[var(--accent)]" />
          <span>{locale === "en" ? place.nameEn : place.nameKa}</span>
        </p>
        <p className={`${NUMERIC} text-[12px] text-[var(--muted)]`}>{type}</p>
      </div>
      <div className="grid grid-cols-4 max-[1101px]:grid-cols-2">
        {place.facts.map((fact) => (
          <div
            key={fact.label}
            data-testid="place-fact"
            className="border-r border-[var(--hairline-soft)] px-[22px] pt-3.5 pb-4 last:border-r-0 max-[1101px]:even:border-r-0 max-[1101px]:nth-[n+3]:border-t max-[768px]:px-4"
          >
            <b className={`block ${NUMERIC} text-[23px] leading-[1.2] font-semibold tracking-[-0.015em] max-[768px]:text-[19px]`}>{fact.value}</b>
            <span className="mt-1 block text-[12.5px] leading-[1.35] text-[var(--body)]">{message(messages, PLACE_FACT_KEYS[fact.label])}</span>
            <em className={`mt-0.5 block ${NUMERIC} text-[10.5px] text-[var(--faint)] not-italic max-[768px]:text-[11px]`}>{fact.period}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

/** `onHover` runs on a pointer move over the option, not on the pointer's arrival: rows that scroll under a resting pointer leave the keys' choice alone. */
type OptionProps = { option: Option; active: boolean; onHover: (event: MouseEvent) => void; locale: Locale };

function ShortcutOption({ shortcut, option, active, onHover, locale, messages }: OptionProps & { shortcut: SearchShortcut; messages: Messages }) {
  const Icon = GROUP_ICONS[shortcut.group];
  const name = shortcut.name[locale];
  const kind = shortcut.kind === "topic"
    ? message(messages, "allData.shortcut.topic", { group: message(messages, navGroup(shortcut.group).labelKey) })
    : message(messages, "allData.shortcut.group");
  const count = pagesLabel(messages, shortcut.count);
  return (
    <Link
      id={option.id}
      href={pageHref(shortcut.href, locale)}
      prefetch={false}
      role="option"
      aria-selected={active}
      aria-label={`${name} — ${kind}, ${count}`}
      tabIndex={-1}
      data-testid="search-shortcut"
      onMouseMove={onHover}
      className={`mt-5 grid min-h-16 grid-cols-[22px_minmax(0,1fr)_auto_18px] items-center gap-3.5 border border-[var(--ink)] px-[18px] py-3 text-[var(--ink)] no-underline hover:bg-[var(--tint)] max-[768px]:grid-cols-[22px_minmax(0,1fr)_18px] ${active ? "bg-[var(--tint)] shadow-[inset_3px_0_0_var(--accent)]" : "bg-[var(--tile)]"}`}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-[18px] text-[var(--accent)]" />
      <span className="min-w-0">
        <b className={`block ${DISPLAY} text-[19px] leading-[1.25] font-semibold`}>{name}</b>
        <span className="block text-[12px] text-[var(--muted)]">{kind}</span>
      </span>
      <span className={`${NUMERIC} text-[12px] text-[var(--muted)] max-[768px]:hidden`}>{count}</span>
      <ChevronRight aria-hidden strokeWidth={1.75} className="size-[18px] text-[var(--ink)]" />
    </Link>
  );
}

/** `placeName`: the place (or Georgia) whose figure a place row states, which its accessible name leads with. */
function RowOption({ row, place, placeName, option, active, onHover, locale }: OptionProps & { row: ResultRow; place: boolean; placeName?: string }) {
  const { page } = row;
  const note = valueNote(row, message(useI18n().messages, "allData.preliminary"));
  const Icon = GROUP_ICONS[page.group];
  const label = row.label.map((segment) => segment.text).join("");
  const sub = crumb(page, locale);
  const muted = active ? "text-[var(--muted)]" : "text-[var(--faint)] group-hover:text-[var(--muted)]";
  return (
    <Link
      id={option.id}
      href={pageHref(row.href, locale)}
      prefetch={false}
      role="option"
      aria-selected={active}
      aria-label={`${placeName ? `${placeName}: ` : ""}${label}${row.value ? `, ${row.value} (${note})` : ""} — ${sub}`}
      tabIndex={-1}
      data-testid="search-result"
      onMouseMove={onHover}
      className={`group grid min-h-[60px] grid-cols-[20px_minmax(0,1fr)_88px_minmax(110px,auto)_18px] items-center gap-4 border-b border-[var(--row-border)] px-3 py-[9px] text-[var(--ink)] no-underline hover:bg-[var(--tint)] max-[1101px]:grid-cols-[20px_minmax(0,1fr)_minmax(96px,auto)_18px] max-[768px]:grid-cols-[18px_minmax(0,1fr)_auto] max-[768px]:gap-3 max-[768px]:px-2 max-[768px]:py-2.5 ${active ? "bg-[var(--tint)] shadow-[inset_3px_0_0_var(--accent)]" : ""}`}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-[18px] text-[var(--muted)]" />
      <span className="min-w-0">
        <span className="block text-[14.5px] leading-[1.35] font-semibold">
          <Marked segments={row.label} markClass={`${MARK_CLASS} underline decoration-[1.5px] underline-offset-[3px]`} />
        </span>
        <span className={`mt-[3px] block ${NUMERIC} text-[11px] leading-[1.4] ${muted}`}>
          {sub}
          {" · "}
          <span lang={locale === "ka" ? "en" : "ka"}><Marked segments={row.mirror} markClass={`${MARK_CLASS} font-semibold`} /></span>
        </span>
      </span>
      <span aria-hidden className="max-[1101px]:hidden [&>svg]:mt-0">
        {!place && page.spark ? <Sparkline values={page.spark} color="var(--ink)" width={88} height={22} /> : null}
      </span>
      <span className={`text-right ${NUMERIC} text-[13px] font-semibold whitespace-nowrap max-[768px]:max-w-[110px] max-[768px]:text-[12.5px] max-[768px]:whitespace-normal`}>
        {row.value}
        {row.value ? <em className={`block text-[10.5px] font-normal not-italic max-[768px]:text-[11px] ${muted}`}>{note}</em> : null}
      </span>
      <ChevronRight aria-hidden strokeWidth={1.75} className={`size-4 max-[768px]:hidden ${active ? "text-[var(--accent)]" : "text-[var(--faint)] opacity-0"}`} />
    </Link>
  );
}

type ExplorerSearchProps = {
  locale: Locale;
  /** Every page, and the group and topic shortcuts: the same arrays on every render, which search caches by. */
  pages: SearchPage[];
  shortcuts: SearchShortcut[];
  /** The A to Z list, rendered on the server and hidden while the box has a query. */
  children: ReactNode;
};

/** The All data search: its box, example words, results and the A to Z list below. Strings come from the page's `allData` provider. */
export function ExplorerSearch({ locale, pages, shortcuts, children }: ExplorerSearchProps) {
  const { messages } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const { state: query, update } = useHashState(NO_DATA, parseQuery, serializeQuery, HASH_OPTIONS);
  const [places, setPlaces] = useState<PlaceIndex | null>(null);
  /** While the places file is on its way, a query that finds no page may still name a place: no "nothing found" yet. */
  const [placesPending, setPlacesPending] = useState(false);
  /** The places file has taken longer than `PLACES_TIMEOUT_MS`: a query that finds nothing says so rather than nothing. */
  const [placesSlow, setPlacesSlow] = useState(false);
  const [active, setActive] = useState(-1);
  const placesAsked = useRef(false);
  /** Where the pointer last moved, so a move event that comes with no movement (as some browsers send after a scroll) is no hover. */
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (EMPTY_QUERY_HASH.test(window.location.hash)) input.current?.focus();
  }, []);

  useEffect(() => {
    if (placesAsked.current || !query.trim()) return;
    placesAsked.current = true;
    setPlacesPending(true);
    const slow = setTimeout(() => setPlacesSlow(true), PLACES_TIMEOUT_MS);
    void loadPlaces((url) => fetch(url), locale).then((data) => {
      // The rows change under the arrow keys when the places join, so nothing stays selected.
      if (data) {
        setPlaces(data);
        setActive(-1);
      } else placesAsked.current = false;
      clearTimeout(slow);
      setPlacesSlow(false);
      setPlacesPending(false);
    });
  }, [query, locale]);

  const result = useMemo(() => searchExplorer(query, locale, pages, shortcuts, places), [query, locale, pages, shortcuts, places]);

  const options: Option[] = [];
  const option = (href: string): Option => {
    const made = { id: `explorer-o${options.length}`, href };
    options.push(made);
    return made;
  };
  const shortcutOptions = result?.shortcuts.map((shortcut) => ({ shortcut, option: option(shortcut.href) })) ?? [];
  const groups = result?.groups.map((group) => ({ group, rows: group.rows.map((row) => ({ row, option: option(row.href) })) })) ?? [];
  const total = options.length;
  const current = active < total ? active : -1;

  useEffect(() => {
    if (current >= 0) document.getElementById(`explorer-o${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const hover = (index: number) => (event: MouseEvent) => {
    const last = pointer.current;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (last?.x === event.clientX && last.y === event.clientY) return;
    setActive(index);
  };
  const setQuery = (next: string) => {
    setActive(-1);
    update(() => next, "replace");
  };
  const pick = (word: string) => {
    setQuery(word);
    input.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (total) setActive(event.key === "ArrowDown" ? (current + 1) % total : current <= 0 ? total - 1 : current - 1);
    } else if (event.key === "Enter" && total) {
      // With no option highlighted, Enter opens the first.
      event.preventDefault();
      router.push(pageHref(options[Math.max(current, 0)].href, locale));
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  };

  const trimmed = query.trim();
  const none = message(messages, "allData.none", { q: trimmed });
  const nothing = result !== null && !total && !placesPending;
  const loading = result !== null && !total && placesPending && placesSlow;
  const loadingText = message(messages, "allData.placesLoading");
  const country = message(messages, "allData.country");
  const groupLabel = (group: SearchResult["groups"][number]) => (group.kind === "country" ? country : group.label);
  /** The place the rows are about, which the announcement leads with: `ბათუმი: ნაპოვნია 23 შედეგი`. */
  const about = result?.place ? (locale === "en" ? result.place.place.nameEn : result.place.place.nameKa) : result?.groups[0]?.kind === "country" ? country : "";
  const found = total ? message(messages, total === 1 ? "allData.foundOne" : "allData.found", { n: total }) : "";
  const announce = !result ? "" : total ? (about ? `${about}: ${found}` : found) : nothing ? none : loading ? loadingText : "";
  const placeTag = result?.place
    ? message(messages, result.place.typeLabelArgs.kind === "capital" ? "allData.tag.capital" : result.place.typeLabelArgs.kind === "region" ? "allData.tag.region" : "allData.tag.municipality")
    : "";

  return (
    <>
      {/* Without JavaScript the box and its example words do nothing, so they stay out of the way of the A to Z list. */}
      <noscript><style>{'[data-testid="all-data-search"]{display:none}'}</style></noscript>
      <div role="search" data-testid="all-data-search" className="mt-7 max-[768px]:mt-5">
        <label htmlFor={EXPLORER_SEARCH_INPUT_ID} className="sr-only">{message(messages, "allData.label")}</label>
        {/* The box draws the focus ring, so the input drops the site's own (an unlayered rule, hence the `!`). */}
        <div className="flex h-[66px] items-center gap-3.5 border-[1.5px] border-[var(--ink)] bg-[var(--tile)] pr-2.5 pl-[22px] focus-within:outline-2 focus-within:outline-offset-[3px] focus-within:outline-[var(--accent)] max-[768px]:h-14 max-[768px]:gap-2.5 max-[768px]:pr-1 max-[768px]:pl-3.5">
          <Search aria-hidden strokeWidth={1.75} className="size-[22px] flex-none" />
          <input
            ref={input}
            id={EXPLORER_SEARCH_INPUT_ID}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="explorer-results"
            aria-expanded={total > 0}
            aria-activedescendant={current >= 0 ? `explorer-o${current}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={message(messages, "allData.placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-[family-name:var(--font-ui)] text-[19px] text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus-visible:outline-none! max-[768px]:text-[16.5px]"
          />
          {query ? (
            <>
              {result ? <span className={`${NUMERIC} text-[12px] whitespace-nowrap text-[var(--muted)]`}>{pagesLabel(messages, total)}</span> : null}
              <button
                type="button"
                aria-label={message(messages, "allData.clear")}
                onClick={() => pick("")}
                className="flex size-11 flex-none items-center justify-center text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X aria-hidden strokeWidth={1.75} className="size-[18px]" />
              </button>
            </>
          ) : (
            <kbd aria-hidden className={`mr-3 border border-[var(--hairline)] bg-[var(--paper)] px-2 ${NUMERIC} text-[12px] leading-6 text-[var(--muted)] max-[768px]:hidden`}>/</kbd>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--muted)] [scrollbar-width:none] max-[768px]:-mx-5 max-[768px]:flex-nowrap max-[768px]:overflow-x-auto max-[768px]:px-5 max-[768px]:pb-0.5">
          <span className="flex-none">{message(messages, "allData.try")}</span>
          {[1, 2, 3, 4, 5].map((n) => {
            const word = message(messages, `allData.chip.${n}`);
            return <button key={n} type="button" data-testid="search-chip" onClick={() => pick(word)} className={CHIP_CLASS}>{word}</button>;
          })}
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      {result ? (
        <>
          {result.reading ? (
            <p data-testid="search-reading" className="mt-[26px] flex items-center gap-2.5 bg-[var(--tint)] px-4 py-3 text-[13.5px]">
              <Languages aria-hidden strokeWidth={1.75} className="size-[18px] flex-none" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{message(messages, "allData.reading")} <b className="font-semibold">{result.reading}</b></span>
            </p>
          ) : null}
          {result.place ? <PlaceCard result={result.place} locale={locale} messages={messages} /> : null}
          <div id="explorer-results" role={total ? "listbox" : undefined} aria-label={total ? message(messages, "allData.results") : undefined} className="mt-2">
            {shortcutOptions.map(({ shortcut, option: made }) => (
              <ShortcutOption key={made.id} shortcut={shortcut} option={made} active={made.id === `explorer-o${current}`} onHover={hover(options.indexOf(made))} locale={locale} messages={messages} />
            ))}
            {groups.map(({ group, rows }, index) => {
              const headingId = `explorer-g${index}`;
              const flat = group.kind === "flat";
              return (
                <div
                  key={headingId}
                  role={flat ? "presentation" : "group"}
                  aria-labelledby={flat ? undefined : headingId}
                  className={flat ? "mt-5 border-t border-[var(--ink)]" : "mt-[26px]"}
                >
                  {flat ? null : (
                    <div aria-hidden className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--ink)] pb-2">
                      <h3 id={headingId} className="text-[14.5px] leading-[1.3] font-bold">{groupLabel(group)}</h3>
                      <span className={`${NUMERIC} text-[11px] text-[var(--muted)]`}>
                        {group.kind === "own" ? placeTag : message(messages, group.kind === "country" ? "allData.tag.countryData" : "allData.tag.regionData")}
                      </span>
                      <span className={`ml-auto ${NUMERIC} text-[11px] text-[var(--muted)]`}>{pagesLabel(messages, rows.length)}</span>
                    </div>
                  )}
                  {rows.map(({ row, option: made }) => (
                    <RowOption
                      key={made.id}
                      row={row}
                      place={!flat}
                      placeName={flat ? undefined : groupLabel(group)}
                      option={made}
                      active={made.id === `explorer-o${current}`}
                      onHover={hover(options.indexOf(made))}
                      locale={locale}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {total ? (
            <p aria-hidden className={`mt-3.5 ${NUMERIC} text-[11px] text-[var(--faint)]`}>{message(messages, "allData.keys")}</p>
          ) : null}
          {nothing ? (
            <div data-testid="search-none" className="mt-[26px] border border-dashed border-[var(--hairline)] px-6 py-[26px]">
              <p className={`${DISPLAY} text-[22px] font-semibold [overflow-wrap:anywhere]`}>{none}</p>
              <p className="mt-1.5 text-[13.5px] text-[var(--body)]">{message(messages, "allData.noneHint")}</p>
              <button type="button" onClick={() => pick("")} className={`mt-4 ${CHIP_CLASS}`}>{message(messages, "allData.showAll")}</button>
            </div>
          ) : null}
          {loading ? (
            <p data-testid="search-loading" className="mt-[26px] border border-dashed border-[var(--hairline)] px-6 py-[26px] text-[15px] text-[var(--body)]">{loadingText}</p>
          ) : null}
        </>
      ) : null}
      <div hidden={result !== null}>{children}</div>
    </>
  );
}

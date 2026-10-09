"use client";

import Link from "next/link";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { pageHref } from "../../lib/i18n/routes";
import { MUNICIPAL_COUNTRY_BUDGET_COUNT } from "../../lib/explorer/municipalData";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { MunicipalKpi, MunicipalListRow } from "../../lib/explorer/municipalData";
import { formatAmount, formatInUnit, formatPerResidentGel, UNIT_PERSONS } from "../../lib/explorer/format";
import type { MunicipalityMapModel } from "../../lib/explorer/municipalityMapData";
import { parseMunicipalLevel } from "../../lib/explorer/urlState";
import { municipalEntityHref, type MunicipalEntityKind } from "../../lib/seo/internalLinks";
import { SourceNote, TabDivider, TextTab } from "../ui/editorial";
import { SEARCH_FIELD_PROPS } from "../main-explorer/series-selector";
import { MunicipalityMap } from "./municipality-map";
import { useAppReady } from "../explorer-shell/use-app-ready";

/** Plain data, so a server page can hand it over. Every field is omitted by the Budget index. */
export type MunicipalitiesIndexOverrides = {
  /** Where each row and each map shape opens, by id (country id, region id, municipality code). Ids not listed open the Budget page. */
  hrefById?: Readonly<Record<string, string>>;
  /** How a row's figure prints: the budget amount (default) or a whole number of persons. */
  valueFormat?: "amount" | "persons";
  /** A second line under a row's figure, by row id; rows not listed keep the per-resident budget line, if they have one. */
  secondaryById?: Readonly<Record<string, string>>;
  /** The Georgia row's line under its name, in English only; the municipal-budget count by default. Georgian reads the row's own `subtitleKa`, so this has no effect there. */
  countrySubtitle?: string;
  /** What sits where the Budget index prints the currency; the currency by default. */
  unitLabel?: string;
  /** The map's group label and legend caption, in place of the per-resident budget wording. */
  mapWording?: { groupAria: string; legendCaption: string };
  /** A note under the map. */
  mapNote?: ReactNode;
};

type MunicipalitiesIndexProps = Omit<MunicipalityMapModel, "legendMinPerResidentGel" | "legendMaxPerResidentGel"> & {
  legendMin: string;
  legendMax: string;
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
  country: MunicipalListRow;
  kpis: MunicipalKpi[];
  /** Inline content only: it renders inside the source note's paragraph. */
  sourceNote: ReactNode;
  overrides?: MunicipalitiesIndexOverrides;
};

export function MunicipalitiesIndex(props: MunicipalitiesIndexProps) {
  const { locale, messages, englishLabels } = useI18n();
  const { overrides } = props;
  const hrefFor = (kind: MunicipalEntityKind, id: string) => overrides?.hrefById?.[id] ?? municipalEntityHref(kind, id);
  const formatValue = (value: number) => (overrides?.valueFormat === "persons" ? formatInUnit(value, UNIT_PERSONS) : formatAmount(value, locale));
  function subtitleFor(row: MunicipalListRow): string {
    if (locale === "ka") return row.subtitleKa;
    if (row.kind === "municipality" && row.regionId) return publicLabel(locale, row.regionId, row.subtitleKa, englishLabels);
    if (row.kind === "region") {
      const count = props.municipalities.filter(member => member.regionId === row.id).length;
      return message(messages, count === 1 ? "municipal.memberOne" : "municipal.members", { count });
    }
    return overrides?.countrySubtitle ?? message(messages, "municipal.budgets", { count: MUNICIPAL_COUNTRY_BUDGET_COUNT });
  }
  const router = useRouter();
  const [level, setLevel] = useState<"muni" | "region">("muni");
  const [query, setQuery] = useState("");
  const [mapActiveCode, setMapActiveCode] = useState<string | null>(null);
  const [listPointerCode, setListPointerCode] = useState<string | null>(null);
  const [listFocusCode, setListFocusCode] = useState<string | null>(null);
  const activeMunicipalityCode = listFocusCode ?? mapActiveCode ?? listPointerCode;

  // Restore the level from the URL hash once, after mount (the server render
  // always shows "muni"; an unknown value falls back to it in the parser).
  // The hash is a one-time external input on load, so the one extra render is
  // intended — same pattern as use-explorer-state.ts's hash restore.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLevel(parseMunicipalLevel(window.location.hash));
  }, []);

  useEffect(() => {
    try {
      // Clearing the hash must restore the path (and any query string), not
      // write a literal space or silently drop `?...`. Preserve the router's
      // history entry: this mount effect can run before its history wrapper.
      history.replaceState(
        history.state,
        "",
        level === "region" ? "#lvl=region" : `${window.location.pathname}${window.location.search}`,
      );
    } catch {
      // History can be unavailable in embedded contexts; the UI still works.
    }
  }, [level]);

  useAppReady();

  const sources = useMemo(
    () => ({ muni: props.municipalities, region: [props.country, ...props.regions] }),
    [props.country, props.municipalities, props.regions],
  );
  const rowsByLevel = useMemo(() => {
    const needle = query.trim();
    if (needle === "") return sources;
    const filter = (rows: MunicipalListRow[]) =>
      rows.filter((row) => matchesLabelQuery(needle, [row.nameKa, row.subtitleKa, publicLabel("en", row.id, row.nameKa, englishLabels), ...(row.regionId ? [publicLabel("en", row.regionId, row.subtitleKa, englishLabels)] : [])]));
    return { muni: filter(sources.muni), region: filter(sources.region) };
  }, [sources, query, englishLabels]);
  const source = sources[level];
  const rows = rowsByLevel[level];

  const openMunicipality = (code: string) => router.push(pageHref(hrefFor("municipality", code), locale));

  function renderRowsFor(panelLevel: "muni" | "region") {
    const panelRows = rowsByLevel[panelLevel];
    const max = sources[panelLevel][0]?.valueGel ?? 1;
    const activePanel = panelLevel === level;

    return (
      <div
        data-testid={`municipal-list-${panelLevel}`}
        hidden={!activePanel}
        // Below 768px the page scrolls the list; an inner 620px box trapped the swipe.
        className="mt-1.5 @min-[768px]:max-h-[620px] @min-[768px]:overflow-y-auto"
      >
        {panelRows.map((row) => (
          <Link
            key={row.id}
            href={pageHref(hrefFor(row.kind, row.id), locale)}
            data-testid={activePanel ? "municipal-list-row" : undefined}
            data-municipality-row-code={row.kind === "municipality" ? row.id : undefined}
            data-active={row.kind === "municipality" && row.id === activeMunicipalityCode ? "true" : undefined}
            onMouseEnter={() => {
              if (row.kind === "municipality") setListPointerCode(row.id);
            }}
            onMouseLeave={() => {
              if (row.kind === "municipality") setListPointerCode(null);
            }}
            onFocus={() => {
              if (row.kind === "municipality") setListFocusCode(row.id);
            }}
            onBlur={() => {
              if (row.kind === "municipality") setListFocusCode(null);
            }}
            className={`grid w-full grid-cols-[22px_minmax(0,1fr)_122px_12px] items-center gap-[9px] border-b border-[var(--row-border)] py-[7px] pr-1 text-left transition-colors duration-100 hover:bg-[var(--tint)] ${
              row.kind === "municipality" && row.id === activeMunicipalityCode ? "bg-[var(--tint)]" : "bg-transparent"
            }`}
          >
            <span className="font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10.5px] text-[var(--faint)]">
              {row.rank === null ? "—" : String(row.rank).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span data-testid="municipal-row-name" className="block truncate text-[12.5px] font-medium">
                {publicLabel(locale, row.id, row.nameKa, englishLabels)}
              </span>
              <span className="block text-[11px] min-[768px]:truncate min-[768px]:text-[10.5px] text-[var(--faint)]">{subtitleFor(row)}</span>
              <span className="mt-[5px] block h-[3px] bg-[var(--hairline-soft)]">
                <span
                  data-testid="municipal-row-bar"
                  className="block h-[3px] bg-[var(--accent)]"
                  style={{ width: `${((row.valueGel / max) * 100).toFixed(1)}%` }}
                />
              </span>
            </span>
            <span className="min-w-0 text-right font-[family-name:var(--font-numeric)]">
              <span data-testid="municipal-row-primary-amount" className="block text-[11.5px]">
                {formatValue(row.valueGel)}
              </span>
              {overrides?.secondaryById?.[row.id] !== undefined ? (
                <span data-testid="municipal-row-secondary" className="mt-0.5 block text-[11px] min-[768px]:text-[10px] leading-[1.25] text-[var(--muted)]">
                  {overrides.secondaryById[row.id]}
                </span>
              ) : row.budgetPerResidentGel !== null ? (
                <span data-testid="municipal-row-per-resident" className="mt-0.5 block text-[11px] min-[768px]:text-[10px] leading-[1.25] text-[var(--muted)]">
                  {message(messages, "municipal.perResidentShort", { amount: formatPerResidentGel(row.budgetPerResidentGel, locale).replace(locale === "ka" ? " ₾" : " GEL", "") })}
                </span>
              ) : null}
            </span>
            <span aria-hidden className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
              →
            </span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <>
      <div data-testid="municipal-index-workspace" className="grid items-start gap-10 @min-[1100px]:grid-cols-[minmax(0,1fr)_336px]">
        <div className="min-w-0">
          <div>
            <MunicipalityMap
              viewBox={props.viewBox}
              shapes={props.shapes}
              markers={props.markers}
              occupiedAreas={props.occupiedAreas}
              touchTargets={props.touchTargets}
              legendMin={props.legendMin}
              legendMax={props.legendMax}
              activeCode={activeMunicipalityCode}
              onActiveCodeChange={setMapActiveCode}
              onOpenMunicipality={openMunicipality}
              wording={overrides?.mapWording}
              hrefForCode={(code) => hrefFor("municipality", code)}
            />
          </div>
          {overrides?.mapNote}

          <div className="mt-8 border-t-2 border-[var(--ink)] pt-5">
            <h2 className="mb-[18px] font-[family-name:var(--font-display)] text-[22px] font-semibold">
              {message(messages, "municipal.indicators")}
            </h2>
            <div data-testid="index-kpi-grid" className="grid grid-cols-2 gap-8 @min-[1100px]:grid-cols-4">
              {props.kpis.map((kpi) => (
                <div key={kpi.label} data-testid="index-kpi" className="flex flex-col gap-[5px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">
                    {kpi.label}
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] whitespace-nowrap">
                    {kpi.value}
                  </span>
                  <span className="text-[11.5px] leading-snug text-[var(--muted)]">{kpi.detail}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]">
          {/* A unit label of its own (`overrides.unitLabel`) wraps under the tabs when the column is too narrow for both: Georgian tab
              labels fill a 310px column, and the Georgian word for "persons" does not fit beside them. The Budget index keeps its row. */}
          <div
            className={
              overrides?.unitLabel === undefined
                ? "flex items-baseline justify-between gap-2.5 border-b-2 border-[var(--ink)] pb-2"
                : "flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-1 border-b-2 border-[var(--ink)] pb-2"
            }
          >
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3.5">
              <TextTab label={message(messages, "municipal.municipalities")} active={level === "muni"} onClick={() => setLevel("muni")} testId="level-muni" />
              <TabDivider />
              <TextTab label={message(messages, "municipal.regions")} active={level === "region"} onClick={() => setLevel("region")} testId="level-region" />
            </span>
            <span className={`${overrides?.unitLabel === undefined ? "" : "ml-auto "}font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10.5px] text-[var(--faint)]`}>
              {overrides?.unitLabel ?? message(messages, "municipal.gel")}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-3 pb-1">
            <input
              data-testid="municipal-search"
              {...SEARCH_FIELD_PROPS}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={message(messages, "municipal.search")}
              aria-label={message(messages, "municipal.search")}
              className="h-[34px] min-w-0 flex-1 scroll-mt-3 appearance-none rounded-none border-0 border-b border-[var(--control)] bg-transparent px-0.5 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--ink)]"
            />
            <span data-testid="row-count" className="font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10.5px] whitespace-nowrap text-[var(--faint)]">
              {rows.length === source.length ? `${source.length}` : `${rows.length} / ${source.length}`}
            </span>
          </div>

          {rows.length === 0 ? (
            <div data-testid="municipal-empty" className="px-1 py-[26px] text-center">
              <div className="text-[13px] text-[var(--body)]">{message(messages, "municipal.empty")}</div>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 inline-flex h-[30px] cursor-pointer items-center rounded-[3px] border border-[var(--control)] px-3 text-[12px] text-[var(--accent)]"
              >
                {message(messages, "municipal.clearSearch")}
              </button>
            </div>
          ) : (
            <>
              {renderRowsFor("muni")}
              {renderRowsFor("region")}
            </>
          )}
        </div>
      </div>
      <div className="mt-9 border-t border-[var(--hairline)] pt-4">
        <SourceNote testId="municipal-source-note">
          {props.sourceNote}{" "}
          {/* The choropleth is a vendored OSM derivative, so ODbL §4.3 attribution
              belongs wherever it is publicly used. Fixed text, so it lives here
              rather than being threaded through the page as data. */}
          {message(messages, "municipal.boundaries")}{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-[var(--accent)]"
          >
            © OpenStreetMap contributors
          </a>{" "}
          (ODbL).
        </SourceNote>
      </div>
    </>
  );
}

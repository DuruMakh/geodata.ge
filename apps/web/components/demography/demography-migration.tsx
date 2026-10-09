"use client";

import { ArrowDown, ArrowUp, Mars, Users, Venus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  buildMigrationIndicators,
  buildMigrationModel,
  DEFAULT_MIGRATION_STATE,
  MIGRATION_COLORS,
  MIGRATION_DIRECTIONS,
  MIGRATION_GROUPS,
  MIGRATION_SEXES,
  migrationCoverage,
  parseMigrationHash,
  serializeMigrationHash,
  type MigrationDirection,
  type MigrationGroup,
  type MigrationSex,
  type MigrationState,
} from "../../lib/explorer/demographyMigration";
import { buildMigrationWorkbookExportModel } from "../../lib/explorer/demographyMigrationWorkbook";
import { INK, NEGATIVE } from "../../lib/explorer/colors";
import { formatInUnit, formatShare, UNIT_PERSONS } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { Message } from "../../lib/i18n/message";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientMigrationFact } from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { SeriesAside } from "../explorer-shell/series-aside";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";
import { RangeStrip } from "../main-explorer/range-strip";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { Callout, SectionTitle, SegmentedTabs, SourceNote } from "../ui/editorial";

const SEX_KEYS = { total: "sexTotal", male: "sexMale", female: "sexFemale" } as const;
const SEX_ICONS = {
  total: <Users aria-hidden="true" size={18} strokeWidth={1.5} />,
  male: <Mars aria-hidden="true" size={18} strokeWidth={1.5} />,
  female: <Venus aria-hidden="true" size={18} strokeWidth={1.5} />,
} as const;
const DIRECTION_KEYS = { arrivals: "dirArrivals", departures: "dirDepartures", net: "dirNet" } as const;
/** The chart draws thousands, so its axis stays short; every printed value is converted back to whole persons. */
const CHART_SCALE = 1_000;

const persons = (value: number | null | undefined) => formatInUnit(value, UNIT_PERSONS);
const signedPersons = (value: number | null | undefined) =>
  value === null || value === undefined ? persons(value) : `${value > 0 ? "+" : ""}${persons(value)}`;
const KPI_META_CLASS = "font-[family-name:var(--font-numeric)] text-[0.6875rem] text-[var(--muted)]";

export function MigrationExplorer({
  facts,
  sources,
  siteOrigin,
  sourceNote,
  searchLabels,
}: {
  facts: ClientMigrationFact[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  /** Inline content only: it renders inside the source note's paragraph. */
  sourceNote: ReactNode;
  /** Georgian and English names per group (`migrationSearchLabels`), so search matches either language. */
  searchLabels: Record<MigrationGroup, string[]>;
}) {
  const presentation = useI18n();
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const [state, setState] = useState<MigrationState>(DEFAULT_MIGRATION_STATE);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(parseMigrationHash(window.location.hash, facts));
    setReady(true);
  }, [facts]);
  useAppReady();
  useReplaceHash(serializeMigrationHash(state), ready);

  const update = (change: (previous: MigrationState) => MigrationState) => setState(change);
  const model = buildMigrationModel(facts, state);
  const indicators = buildMigrationIndicators(facts, state);
  const groupLabel = (group: MigrationGroup) => t(`group.${group}`);
  const direction = (id: MigrationDirection) => t(DIRECTION_KEYS[id]);
  // Search covers both languages' names, whichever page is open.
  const matches = (group: MigrationGroup) => matchesLabelQuery(query, [groupLabel(group), ...searchLabels[group]]);
  const netLabel = t(model.allSelected ? "netLabel" : "netSelectedLabel");
  const scaled = (values: Record<number, number | null>, sign: 1 | -1) =>
    model.years.map((year) => (values[year] === null || values[year] === undefined ? null : (sign * values[year]!) / CHART_SCALE));

  const segments = (["arrivals", "departures"] as const).flatMap((id) =>
    model.selectedIds.map((group) => ({
      id: `${id}:${group}`,
      label: t("segment", { direction: direction(id), group: groupLabel(group) }),
      // The readout names the country only; its arrow says the direction.
      readoutLabel: groupLabel(group),
      marker: (id === "arrivals" ? "up" : "down") as "up" | "down",
      color: MIGRATION_COLORS[group],
      values: scaled(model.byDirection[id][group], id === "arrivals" ? 1 : -1),
    })),
  );
  const tableRows = model.selectedIds.map((group) => ({
    itemId: group,
    kaLabel: groupLabel(group),
    color: MIGRATION_COLORS[group],
    valuesByYear: model.byDirection[state.direction][group],
  }));
  const totalRow = model.selectedIds.length
    ? { itemId: "migration.total", kaLabel: t(model.allSelected ? "totalAll" : "totalSelected"), color: INK, valuesByYear: model.totals[state.direction] }
    : null;
  const end = model.range.end;
  const net = indicators.net;
  const { start } = model.range;
  const singleYear = start === end;
  // Arrivals and departures of the end year as one two-part bar, like the budget gauge.
  const flow = indicators.arrivals === null || indicators.departures === null ? 0 : indicators.arrivals + indicators.departures;
  const arrivalsShare = flow > 0 ? indicators.arrivals! / flow : null;
  const startDetail = (value: string) => (singleYear ? "" : `${start}: ${value}`);
  const heroSentence = net === null ? null : t(net > 0 ? "heroMoreArrived" : net < 0 ? "heroMoreLeft" : "heroBalanced");

  return (
    <div data-testid="migration-explorer" className="@container">
      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={state.mode} className="border-t border-[var(--ink)] pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SegmentedTabs
                ariaLabel={message(messages, "controls.viewMode")}
                value={state.mode}
                onChange={(mode) => update((s) => ({ ...s, mode }))}
                options={[
                  { value: "line", label: t("columns"), testId: "chart-mode-line" },
                  { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
                ]}
              />
              <SegmentedTabs
                ariaLabel={t("sexAria")}
                value={state.sex}
                onChange={(sex: MigrationSex) => update((s) => ({ ...s, sex }))}
                options={MIGRATION_SEXES.map((sex) => ({ value: sex, label: t(SEX_KEYS[sex]), icon: SEX_ICONS[sex], testId: `migration-sex-${sex}` }))}
              />
            </div>
            {!model.selectedIds.length ? (
              <div className="mt-5"><Callout testId="no-selection-callout">{t("migrationEmpty")}</Callout></div>
            ) : state.mode === "line" ? (
              <div className="mt-5">
                <p className="mb-2 text-[11px] text-[var(--muted)]">{t("chartUnit")}</p>
                <StackedColumnChart
                  periods={model.years}
                  periodsPerYear={1}
                  segments={segments}
                  overlay={{ label: netLabel, values: scaled(model.totals.net, 1) }}
                  formatPeriod={String}
                  formatValue={(value) => persons(Math.abs(Math.round(value * CHART_SCALE)))}
                  formatOverlayValue={(value) => signedPersons(Math.round(value * CHART_SCALE))}
                  readoutOrder="sign-then-magnitude"
                  readoutRowCap={MIGRATION_GROUPS.length * 2}
                  ariaLabel={t("chartAria", { start: model.range.start, end })}
                />
              </div>
            ) : (
              <div className="mt-5">
                <SegmentedTabs
                  ariaLabel={t("directionAria")}
                  value={state.direction}
                  onChange={(id: MigrationDirection) => update((s) => ({ ...s, direction: id }))}
                  options={MIGRATION_DIRECTIONS.map((id) => ({ value: id, label: direction(id), testId: `migration-direction-${id}` }))}
                />
                <div className="mt-4">
                  <ExplorerTable
                    caption={t("migrationTableCaption", { direction: direction(state.direction), start: model.range.start, end })}
                    rows={tableRows}
                    totalRow={totalRow}
                    showTotal={totalRow !== null}
                    wrapRowLabels
                    rowLabelsLocalized
                    years={model.years}
                    firstColumnLabel={t("citizenshipHeader")}
                    unit={UNIT_PERSONS}
                    share={false}
                    showChangeColumn={false}
                    shareValueForYear={() => null}
                  />
                </div>
              </div>
            )}
            <RangeStrip
              years={migrationCoverage(facts).years}
              range={model.range}
              onChange={(patch) => update((s) => ({ ...s, range: rangeFromPatch(buildMigrationModel(facts, s).range, patch) }))}
            />
          </section>
          <div className="mt-[18px]"><SourceNote testId="source-label">{sourceNote}</SourceNote></div>
        </div>
        <SeriesAside label={message(messages, "controls.series")}>
          <p className="mb-3 text-[11px] text-[var(--muted)]">{t("asideCaption", { year: end })}</p>
          <SeriesSelector
            query={query}
            onQueryChange={setQuery}
            searchPlaceholder={t("migrationSearch")}
            selectedCount={model.selectedIds.length}
            totalCount={MIGRATION_GROUPS.length}
            hasSelection={model.selectedIds.length > 0}
            allSelected={model.allSelected}
            onToggleAll={() => update((s) => ({ ...s, selectedIds: s.selectedIds.length ? [] : [...MIGRATION_GROUPS] }))}
            hasVisibleMatches={MIGRATION_GROUPS.some(matches)}
          >
            {MIGRATION_GROUPS.filter(matches).map((group) => (
              <SeriesSelectorRow
                key={group}
                id={group}
                label={groupLabel(group)}
                color={MIGRATION_COLORS[group]}
                value={persons(model.byDirection.departures[group][end])}
                meta={persons(model.byDirection.arrivals[group][end])}
                metaLabel={t("sideArrivals")}
                selected={model.selectedIds.includes(group)}
                level="item"
                wrapLabel
                onToggle={() =>
                  update((s) => ({
                    ...s,
                    selectedIds: s.selectedIds.includes(group) ? s.selectedIds.filter((id) => id !== group) : [...s.selectedIds, group],
                  }))
                }
              />
            ))}
          </SeriesSelector>
          <ExcelDownloadButton
            testId="migration-excel-download"
            disabled={!model.selectedIds.length}
            onDownload={async () => {
              const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
              await downloadWorkbook(buildMigrationWorkbookExportModel({ facts, state, sources, siteOrigin }, presentation));
            }}
          />
        </SeriesAside>
      </ExplorerWorkspace>
      <section data-testid="migration-highlights" data-end-year={indicators.year} className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <SectionTitle>{t("highlights")}</SectionTitle>
          <p className="text-[0.78125rem] text-[var(--muted)]">
            <Message
              messages={messages}
              id="main.selectedPeriod"
              values={{ years: <span className="font-[family-name:var(--font-numeric)]">{singleYear ? start : `${start}–${end}`}</span> }}
            />
          </p>
        </div>
        <div className={KPI_GRID_CLASS}>
          <HeroKpi label={t("heroNetLabel", { year: indicators.year })} value={signedPersons(net)} valueColor={net !== null && net < 0 ? NEGATIVE : "var(--ink)"}>
            {arrivalsShare === null ? null : (
              <>
                <div className="flex h-[3px] bg-[var(--hairline-soft)]">
                  <div className="h-[3px] bg-[var(--ink)]" style={{ width: `${(arrivalsShare * 100).toFixed(1)}%` }} />
                  <div className="h-[3px] bg-[var(--accent)]" style={{ width: `${((1 - arrivalsShare) * 100).toFixed(1)}%` }} />
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <p className={`inline-flex items-center gap-1 ${KPI_META_CLASS}`}>
                    <ArrowUp aria-hidden size={12} strokeWidth={2} />
                    <span className="sr-only">{t("sideArrivals")}</span>
                    {persons(indicators.arrivals)}
                  </p>
                  <p className={`inline-flex items-center gap-1 ${KPI_META_CLASS}`}>
                    <ArrowDown aria-hidden size={12} strokeWidth={2} />
                    <span className="sr-only">{t("sideDepartures")}</span>
                    {persons(indicators.departures)}
                  </p>
                </div>
              </>
            )}
            <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">
              {heroSentence ? `${heroSentence} ` : ""}
              {t("heroCumulative", { start, end, value: signedPersons(indicators.cumulativeNet) })}
            </p>
          </HeroKpi>
          <SideKpiList
            kpis={[
              { label: t("sideArrivals"), value: persons(indicators.arrivals), unit: "", color: INK, detail: startDetail(persons(indicators.sparks.arrivals[0])), spark: { values: indicators.sparks.arrivals, color: INK } },
              { label: t("sideDepartures"), value: persons(indicators.departures), unit: "", color: INK, detail: startDetail(persons(indicators.sparks.departures[0])), spark: { values: indicators.sparks.departures, color: INK } },
              { label: t("sideForeignShare"), value: formatShare(indicators.foreignShare), unit: "", color: INK, detail: startDetail(formatShare(indicators.sparks.foreignShare[0] ?? null)), spark: { values: indicators.sparks.foreignShare, color: INK } },
            ]}
          />
        </div>
        <div className="mt-5"><SourceNote>{t("migrationIndicatorsNote")}</SourceNote></div>
      </section>
    </div>
  );
}

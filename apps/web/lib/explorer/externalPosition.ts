import type { ClientExternalPositionFact, ExternalPositionIndicator } from "../data/externalPosition/types";
import type { CurrentAccountGdp } from "./currentAccount";
import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { refitRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicHashView, topicSeriesColor, type TopicState } from "./topicSeries";

export const EXTERNAL_POSITION_SECTIONS = [
  { id: "foreign-debt", href: "/explorer/external/foreign-debt", labelKey: "common.foreignDebt" },
  { id: "reserves", href: "/explorer/external/reserves", labelKey: "common.reserves" },
] as const;
export type ExternalPositionSectionId = typeof EXTERNAL_POSITION_SECTIONS[number]["id"];
/** Both pages switch between the amount in US dollars and the same amount as a percentage of GDP. */
export type ExternalPositionView = "amount" | "gdp";
const VIEWS: readonly ExternalPositionView[] = ["amount", "gdp"];

export type ExternalPositionSeriesDefinition = { id: ExternalPositionIndicator; reference: boolean };
/** The total first, drawn in ink, then its parts as rows of the same flat list. */
const withParts = (id: ExternalPositionIndicator, parts: readonly ExternalPositionIndicator[]): ExternalPositionSeriesDefinition[] =>
  [{ id, reference: true }, ...parts.map(part => ({ id: part, reference: false }))];

export function externalPositionSeries(section: ExternalPositionSectionId): ExternalPositionSeriesDefinition[] {
  return section === "foreign-debt"
    ? withParts("ext_debt.total", ["ext_debt.government", "ext_debt.banks", "ext_debt.companies", "ext_debt.intercompany", "ext_debt.central_bank"])
    : withParts("reserves.total", ["reserves.fx", "reserves.gold", "reserves.sdr"]);
}

export type ExternalPositionState = TopicState & { view: ExternalPositionView };

const cellKey = (f: { indicatorId: string; year: number }) => `${f.indicatorId}:${f.year}`;

/**
 * The values a view shows. % of GDP divides each amount by the nominal GDP in US dollars of the same year and drops a year
 * without one (1995), so a missing share is a gap, never 0. A latest-period point (the 2026 mid-year amount) is never divided
 * by a full year's GDP, so it is dropped even if a GDP row for its year exists. Amounts are shown as they are.
 */
export function externalPositionViewFacts(view: ExternalPositionView, facts: readonly ClientExternalPositionFact[], gdp: readonly CurrentAccountGdp[]): readonly ClientExternalPositionFact[] {
  if (view !== "gdp") return facts;
  const gdpByYear = new Map(gdp.map(row => [row.year, row.valueUsd]));
  return facts.flatMap(f => {
    const valueUsd = gdpByYear.get(f.year);
    return f.latestPeriod || valueUsd === undefined ? [] : [{ ...f, value: f.value / valueUsd * 100 }];
  });
}

/** A view's years: every year any of the page's series has a value. */
export function externalPositionCoverage(section: ExternalPositionSectionId, view: ExternalPositionView, facts: readonly ClientExternalPositionFact[], gdp: readonly CurrentAccountGdp[]) {
  const ids = new Set<string>(externalPositionSeries(section).map(s => s.id));
  return topicCoverage(externalPositionViewFacts(view, facts, gdp).filter(f => ids.has(f.indicatorId)).map(f => f.year), `No external position years for ${section}:${view}`);
}

const defaultSelection = (section: ExternalPositionSectionId) => [externalPositionSeries(section)[0].id];

export function defaultExternalPositionState(section: ExternalPositionSectionId): ExternalPositionState {
  return { mode: "line", range: { kind: "all" }, view: VIEWS[0], selectedIds: defaultSelection(section) };
}

export function parseExternalPositionHash(hash: string, section: ExternalPositionSectionId, facts: readonly ClientExternalPositionFact[], gdp: readonly CurrentAccountGdp[]): ExternalPositionState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const view = topicHashView(p, VIEWS);
  return { ...parseTopicHash(p, externalPositionSeries(section), defaultSelection(section), externalPositionCoverage(section, view, facts, gdp)), view };
}

/** Both pages have two views, so the hash always names its tab. */
export function serializeExternalPositionHash(state: ExternalPositionState): string {
  const p = new URLSearchParams();
  p.set("tab", state.view);
  return serializeTopicHash(state, p);
}

/**
 * Switching view keeps mode, the selected series (both views list the same ones; a selection the user emptied stays empty)
 * and the years, clamped to the view's coverage. A chosen range is never collapsed to "all", so 2015–2026 on the amounts
 * becomes 2015–2025 on % of GDP and stays 2015–2025 when switching back.
 */
export function changeExternalPositionView(state: ExternalPositionState, section: ExternalPositionSectionId, view: ExternalPositionView, facts: readonly ClientExternalPositionFact[], gdp: readonly CurrentAccountGdp[]): ExternalPositionState {
  return { ...state, view, range: refitRange(state.range, externalPositionCoverage(section, view, facts, gdp), { collapseToAll: false }) };
}

export type ExternalPositionLatest = { year: number; periodEnd: string; value: number; latestPeriod: boolean };
export type ExternalPositionModel = ReturnType<typeof buildTopicModel<ExternalPositionSeriesDefinition>> & {
  unit: "usd" | "percent";
  /** Years in range whose value is the latest-period point rather than a 31 December value; none on % of GDP. */
  latestYears: number[];
  /** The reference series' last value in this view. */
  latest: ExternalPositionLatest;
};

export function buildExternalPositionModel(section: ExternalPositionSectionId, allFacts: readonly ClientExternalPositionFact[], state: ExternalPositionState, gdp: readonly CurrentAccountGdp[]): ExternalPositionModel {
  const coverage = externalPositionCoverage(section, state.view, allFacts, gdp);
  const facts = externalPositionViewFacts(state.view, allFacts, gdp);
  const byCell = new Map(facts.map(f => [cellKey(f), f]));
  const definitions = externalPositionSeries(section);
  const model = buildTopicModel({ range: state.range, coverage, selectedIds: state.selectedIds, color: topicSeriesColor, definitions,
    value: (definition, year) => byCell.get(cellKey({ indicatorId: definition.id, year }))?.value });
  const reference = facts.filter(f => f.indicatorId === definitions[0].id).reduce((last, f) => f.year > last.year ? f : last);
  return {
    ...model,
    unit: state.view === "gdp" ? "percent" : "usd",
    latestYears: state.view === "gdp" ? [] : model.years.filter(year => facts.some(f => f.year === year && f.latestPeriod)),
    latest: { year: reference.year, periodEnd: reference.periodEnd, value: reference.value, latestPeriod: reference.latestPeriod },
  };
}

/** The short month of a latest-period point, from its `periodEnd` (`2026-09-30` gives September's abbreviation). */
export function externalPositionLatestMonth(periodEnd: string, messages: Messages): string {
  return message(messages, `external.position.latestMonth.${periodEnd.slice(5, 7)}`);
}

/** The header of the latest-period column, for example `2026 (Sep)`. */
export function externalPositionLatestLabel(latest: Pick<ExternalPositionLatest, "year" | "periodEnd">, messages: Messages): string {
  return `${latest.year} (${externalPositionLatestMonth(latest.periodEnd, messages)})`;
}

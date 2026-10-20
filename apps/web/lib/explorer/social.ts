import { buildBreakRegister } from "../data/demography/breaks";
import { SOCIAL_GEORGIA, SOCIAL_PACKAGE_GROUPS, SOCIAL_PAYMENT_PROGRAMMES, type ClientSocialFact, type SocialSeriesBreak } from "../data/social/types";
import type { ClientNationalGdpFact } from "./clientData";
import { INK } from "./colors";
import { CENSUS_BREAK, perPopulation } from "./crime";
import { shareOfGdp } from "./debtExplorer";
import { placeIdForMunicipalityCode } from "./demographyAreas";
import { HEALTH_HUB_PATH } from "./health";
import { refitRange, resolveRange, type ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, serializeTopicHash, topicHashView, topicSeriesColor, type TopicCoverage, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { changeUnitListSelection, listLatestByHeading, parseUnitListHash, unitListCoverage } from "./unitList";

/** The four pages sit on the Health and social protection hub, after its Health sections. */
export const SOCIAL_SECTIONS = [
  { id: "social-payments", href: `${HEALTH_HUB_PATH}/social-payments`, labelKey: "common.socialPayments" },
  { id: "pensions", href: `${HEALTH_HUB_PATH}/pensions`, labelKey: "common.socialPensions" },
  { id: "subsistence-allowance", href: `${HEALTH_HUB_PATH}/subsistence-allowance`, labelKey: "common.socialSubsistence" },
  { id: "social-package", href: `${HEALTH_HUB_PATH}/social-package`, labelKey: "common.socialPackage" },
] as const;
export type SocialSectionId = typeof SOCIAL_SECTIONS[number]["id"];
/** The two pages with a chart of national series; Pensions and Subsistence allowance are map indexes of place pages (socialPlaces.ts). */
export type SocialTopicId = "social-payments" | "social-package";
export type SocialPlaceSet = "pensions" | "subsistence-allowance";

/** The small heading a row is listed under. A chart shows the rows of one heading at a time. */
export type SocialHeading = "money" | "pensioners" | "share" | "average" | "families" | "people" | "recipients";
/**
 * A listed row. A calculated row's id is its base indicator plus `#share` (per 100 residents) or `#real` (at 2025 prices),
 * so a hash naming it stays stable.
 */
export type SocialSeriesDefinition = { id: string; reference: boolean; heading: SocialHeading; calculated?: "share" | "real" };
/** How a page shows a value: money in million GEL (or % of GDP), averages in GEL a month, shares in %, counts as they are. */
export type SocialUnit = "persons" | "families" | "gel_million" | "gel" | "percent";
/** A value as a page shows it: a served fact, or one calculated from it (whose id carries the `#` suffix). */
export type SocialShownFact = Omit<ClientSocialFact, "indicatorId"> & { indicatorId: string; unit: SocialUnit };

/** Rows listed under one heading, the first of them the reference if `reference` is set. */
export const socialRows = (heading: SocialHeading, ids: readonly string[], reference = false): SocialSeriesDefinition[] =>
  ids.map((id, index) => ({ id, reference: reference && index === 0, heading, ...(id.endsWith("#share") ? { calculated: "share" as const } : id.endsWith("#real") ? { calculated: "real" as const } : {}) }));

/** The series a topic page lists: Social payments' total and its 18 programmes in spec order; Social package's 10 groups twice and the average. */
export function socialTopicSeries(section: SocialTopicId): SocialSeriesDefinition[] {
  if (section === "social-payments") return socialRows("money", ["social.payments.total.amount", ...SOCIAL_PAYMENT_PROGRAMMES.map(programme => `social.payments.${programme}.amount`)], true);
  return [
    ...socialRows("recipients", SOCIAL_PACKAGE_GROUPS.map(group => `social.social_package.${group}.recipients`), true),
    ...socialRows("money", SOCIAL_PACKAGE_GROUPS.map(group => `social.social_package.${group}.amount`)),
    ...socialRows("average", ["social.social_package.total.avg_monthly"]),
  ];
}

export const socialDefaultSelection = (section: SocialTopicId): string[] => [socialTopicSeries(section)[0].id];

/**
 * Social payments' last four programmes have a fixed colour: the palette (14 hexes) cannot colour 18 programmes by position.
 * They wear existing site hexes that no palette hex is within 15 CIEDE2000 of: the three Housing gives its overflow types
 * and Energy and food's extra olive. The other 14 take the palette by position in `SOCIAL_PAYMENT_PROGRAMMES`.
 */
const FIXED_PAYMENT_COLORS: Readonly<Record<string, string>> = {
  water_subsidy: "#C16671", highmountain_doctors_nurses: "#667722", workplace_injury: "#0D89C2", covid_vulnerable_compensation: "#474A02",
};

/**
 * The default series is ink. As on Housing, a row is keyed by its position in a fixed list, so no list repeats a colour:
 * a Social payments programme by `SOCIAL_PAYMENT_PROGRAMMES` (four of them fixed), and a Social package group by
 * `SOCIAL_PACKAGE_GROUPS`, so a group wears one colour under Recipients and Money. Place rows take the palette by position.
 */
export function socialSeriesColor(series: SocialSeriesDefinition, index: number): string {
  if (series.reference) return INK;
  const [, programme, group] = series.id.split(".");
  if (programme === "payments") return FIXED_PAYMENT_COLORS[group!] ?? topicSeriesColor(series, SOCIAL_PAYMENT_PROGRAMMES.indexOf(group as typeof SOCIAL_PAYMENT_PROGRAMMES[number]));
  if (programme === "social_package") return topicSeriesColor(series, SOCIAL_PACKAGE_GROUPS.indexOf(group as typeof SOCIAL_PACKAGE_GROUPS[number]));
  return topicSeriesColor(series, index);
}

/** A served or calculated id's display unit; the % of GDP view overrides money with `percent`. */
export function socialUnitOf(indicatorId: string): SocialUnit {
  if (indicatorId.endsWith("#share")) return "percent";
  if (indicatorId.endsWith("#real") || indicatorId.endsWith(".avg_monthly")) return "gel";
  if (indicatorId.endsWith("amount")) return "gel_million";
  return indicatorId.includes("families") ? "families" : "persons";
}

const shown = (fact: ClientSocialFact): SocialShownFact => ({ ...fact, unit: socialUnitOf(fact.indicatorId) });
/** Rounding to 15 digits removes the binary noise of a calculated value, as Crime's per-100,000 rate (`perPopulation`) does. */
const calculated = (value: number) => Number(value.toPrecision(15));

// ---- Calculations ---------------------------------------------------------------------------------------------------

/** The 1 January population of each place, the divisor of a share of residents. */
export type SocialPopulation = readonly { year: number; geographyId: string; persons: number }[];
/** The headline consumer price index's yearly average (2010 = 100), the deflator of "at 2025 prices". */
export type SocialPriceIndex = readonly { year: number; index: number }[];

/**
 * The served population for the shares: `demography.population_total` from Geostat's municipal population file. Georgia's
 * retro-projected years before 2015 are another estimate, which no other place has, so every place uses the same source
 * and the shares start in 2014 everywhere.
 */
export function socialPopulation(observations: readonly { seriesId: string; geographyId: string; year: number; value: number; estimateBasis: string }[]): SocialPopulation {
  return observations.filter(f => f.seriesId === "demography.population_total" && f.estimateBasis !== "retro_projection").map(f => ({ year: f.year, geographyId: f.geographyId, persons: f.value }));
}

/** The yearly average of the headline index's 12 monthly values; a year with fewer published months has none. */
export function socialAnnualCpi(cpiFacts: readonly { seriesId: string; measure: string; period: string; value: number | string }[]): SocialPriceIndex {
  const months = new Map<number, number[]>();
  for (const fact of cpiFacts) {
    if (fact.seriesId !== "cpi.headline" || fact.measure !== "index_2010") continue;
    const year = Number(fact.period.slice(0, 4));
    months.set(year, months.get(year) ?? []).get(year)!.push(Number(fact.value));
  }
  return [...months].filter(([, values]) => values.length === 12).map(([year, values]) => ({ year, index: values.reduce((sum, value) => sum + value, 0) / 12 })).sort((a, b) => a.year - b.year);
}

/** The counts a share of residents divides: pensioners, people in receiving families and registered people. */
const SHARE_BASES: readonly string[] = ["social.pension.recipients", "social.subsistence.persons", "social.subsistence.registered_persons"];

/**
 * A place's shares of residents: each December count ÷ the place's population on 1 January of the next year × 100, marked
 * calculated and shown with one decimal. A year or place without a population (an excluded area) has no share.
 */
export function sharePerHundred(facts: readonly ClientSocialFact[], population: SocialPopulation, placeId: string): SocialShownFact[] {
  const place = placeIdForMunicipalityCode(placeId);
  const personsByYear = new Map(population.filter(p => p.geographyId === place).map(p => [p.year, p.persons]));
  return facts.flatMap(f => {
    const persons = f.geographyId === place && SHARE_BASES.includes(f.indicatorId) ? personsByYear.get(f.year + 1) : undefined;
    return persons === undefined ? [] : [{ ...f, indicatorId: `${f.indicatorId}#share`, value: perPopulation(f.value, persons, 100), valueStatus: "calculated" as const, unit: "percent" as const }];
  });
}

/** Averages at `baseYear` prices: value × (base year's average index ÷ that year's), marked calculated and shown with two decimals. A year without an index has none. */
export function atPrices(facts: readonly ClientSocialFact[], cpi: SocialPriceIndex, baseYear = 2025): SocialShownFact[] {
  const indexByYear = new Map(cpi.map(row => [row.year, row.index]));
  const base = indexByYear.get(baseYear);
  if (base === undefined) throw new Error(`No ${baseYear} price index`);
  return facts.flatMap(f => {
    const index = indexByYear.get(f.year);
    return index === undefined ? [] : [{ ...f, indicatorId: `${f.indicatorId}#real`, value: calculated(f.value * base / index), valueStatus: "calculated" as const, unit: "gel" as const }];
  });
}

/** Social payments' two views: million GEL, or the same money as % of GDP. */
export type SocialPayView = "amount" | "gdp";
const VIEWS: Record<SocialTopicId, readonly SocialPayView[]> = { "social-payments": ["amount", "gdp"], "social-package": ["amount"] };
export const socialViews = (section: SocialTopicId): readonly SocialPayView[] => VIEWS[section];

/**
 * The values a Social payments view shows. The % of GDP view divides each year's money by Fiscal.ge's nominal GDP for the
 * year (the debt page's share of GDP, as on Money and banks), marked calculated; a year without GDP has none.
 */
export function socialPaymentsViewFacts(view: SocialPayView, facts: readonly ClientSocialFact[], gdpFacts: readonly ClientNationalGdpFact[]): SocialShownFact[] {
  const ids = new Set<string>(socialTopicSeries("social-payments").map(s => s.id));
  const payments = facts.filter(f => ids.has(f.indicatorId) && f.geographyId === SOCIAL_GEORGIA).map(shown);
  if (view === "amount") return payments;
  if (!gdpFacts.length) throw new Error("No GDP facts for the Social payments % of GDP view");
  const gdpByYear = new Map(gdpFacts.map(f => [f.year, f]));
  return payments.flatMap(f => {
    const share = shareOfGdp(f.value * 1e6, f.year, gdpByYear);
    return share === null ? [] : [{ ...f, value: calculated(share * 100), valueStatus: "calculated" as const, unit: "percent" as const }];
  });
}

/** A topic page's shown facts: Georgia's rows of its series, in the view's unit. */
export function socialTopicFacts(section: SocialTopicId, view: SocialPayView, facts: readonly ClientSocialFact[], gdpFacts: readonly ClientNationalGdpFact[]): SocialShownFact[] {
  if (section === "social-payments") return socialPaymentsViewFacts(view, facts, gdpFacts);
  const ids = new Set<string>(socialTopicSeries(section).map(s => s.id));
  return facts.filter(f => ids.has(f.indicatorId) && f.geographyId === SOCIAL_GEORGIA).map(shown);
}

// ---- State ----------------------------------------------------------------------------------------------------------

/** The list's one-heading rule: a row's group is its heading. Shared with the place pages. */
export function socialHeadingOf(definitions: readonly SocialSeriesDefinition[]): (id: string) => string | undefined {
  const headings = new Map(definitions.map(definition => [definition.id, definition.heading]));
  return id => headings.get(id);
}
const noSocialYears = (id: string) => `No social protection years for ${id}`;

export type SocialState = TopicState & { view: SocialPayView };

export function defaultSocialState(section: SocialTopicId): SocialState {
  return { mode: "line", range: { kind: "all" }, view: socialViews(section)[0], selectedIds: socialDefaultSelection(section) };
}

/**
 * A topic page's years for a selection: every year any row of the selection's heading has a value in the view (any row when
 * nothing is selected). `gdpFacts` is required: Social payments' % of GDP view divides by it (Social package passes none).
 */
export function socialCoverage(section: SocialTopicId, view: SocialPayView, facts: readonly ClientSocialFact[], gdpFacts: readonly ClientNationalGdpFact[], selectedIds: readonly string[] = []): TopicCoverage {
  const definitions = socialTopicSeries(section);
  return unitListCoverage(definitions, selectedIds, socialTopicFacts(section, view, facts, gdpFacts), noSocialYears(section), socialHeadingOf(definitions));
}

/** Reads a topic page's hash: `tab` names Social payments' view; a selection that mixes headings keeps its first row's heading, and the years fit it. */
export function parseSocialHash(hash: string, section: SocialTopicId, facts: readonly ClientSocialFact[], gdpFacts: readonly ClientNationalGdpFact[]): SocialState {
  const view = topicHashView(new URLSearchParams(hash.replace(/^#/, "")), socialViews(section));
  const definitions = socialTopicSeries(section);
  return { ...parseUnitListHash(hash, definitions, socialDefaultSelection(section), socialTopicFacts(section, view, facts, gdpFacts), noSocialYears(section), socialHeadingOf(definitions)), view };
}

/** A topic page's new selection: a row under another heading replaces it. The years stay, clamped to the heading's (never collapsed to "all"). */
export function changeSocialSelection(state: SocialState, section: SocialTopicId, next: readonly string[], facts: readonly ClientSocialFact[], gdpFacts: readonly ClientNationalGdpFact[]): SocialState {
  const definitions = socialTopicSeries(section);
  return { ...changeUnitListSelection(state, definitions, next, socialTopicFacts(section, state.view, facts, gdpFacts), noSocialYears(section), socialHeadingOf(definitions)), view: state.view };
}

/** Switching Social payments between million GEL and % of GDP keeps the selection and mode; the years are clamped to the view's (never collapsed to "all"). */
export function changeSocialView(state: SocialState, view: SocialPayView, facts: readonly ClientSocialFact[], gdpFacts: readonly ClientNationalGdpFact[]): SocialState {
  return { ...state, view, range: refitRange(state.range, socialCoverage("social-payments", view, facts, gdpFacts, state.selectedIds), { collapseToAll: false }) };
}

/**
 * A topic page's list, as on the place pages (`socialPlaceList`): it reads at the chosen years' end over all of the view's
 * years, never the selection's, and each row shows its latest value up to then (COVID-19 compensation its 2021 figure).
 */
export function socialTopicList(section: SocialTopicId, facts: readonly ClientSocialFact[], gdpFacts: readonly ClientNationalGdpFact[], state: SocialState) {
  const end = resolveRange(state.range, socialCoverage(section, state.view, facts, gdpFacts)).end;
  return { end, rows: listLatestByHeading(socialTopicFacts(section, state.view, facts, gdpFacts), socialTopicSeries(section), end) };
}

export function serializeSocialHash(state: SocialState, section: SocialTopicId): string {
  const p = new URLSearchParams();
  if (socialViews(section).length > 1) p.set("tab", state.view);
  return serializeTopicHash(state, p);
}

// ---- Model ----------------------------------------------------------------------------------------------------------

/** A heading's unit and decimals: million GEL to one decimal (% of GDP to two), averages to two, shares to one, counts whole. */
function socialDisplay(heading: SocialHeading, view: SocialPayView): { unit: SocialUnit; decimals: number } {
  switch (heading) {
    case "money": return view === "gdp" ? { unit: "percent", decimals: 2 } : { unit: "gel_million", decimals: 1 };
    case "average": return { unit: "gel", decimals: 2 };
    case "share": return { unit: "percent", decimals: 1 };
    case "families": return { unit: "families", decimals: 0 };
    default: return { unit: "persons", decimals: 0 };
  }
}

/** `partialMonths` lists the years whose money or average covers fewer than 12 months, with the months it covers. */
export type SocialSeriesModel = TopicSeriesModel<SocialSeriesDefinition & { decimals: number; unit: SocialUnit }> & { partialMonths: Record<number, number> };
/** `unit` and `heading` are the selection's (the list's first row's when nothing is selected). */
export type SocialModel = {
  range: ResolvedPeriodRange; years: number[]; series: SocialSeriesModel[]; selected: SocialSeriesModel[]; unit: SocialUnit; heading: SocialHeading;
  /** The counting changes inside the range that touch the selection (a share also crosses the census recalculation): the chart draws a gap and a rule, the table marks the year. */
  breaks: { year: number; label: "newCounting" }[];
};

const cellKey = (f: { indicatorId: string; year: number }) => `${f.indicatorId}:${f.year}`;
/** A calculated row's served indicator: a counting change of the count is one of its share too. */
const baseId = (id: string) => id.split("#")[0]!;
const breakYear = (item: { referenceDate: string }) => Number(item.referenceDate.slice(0, 4));

/**
 * The years, values, colours, units, partial years and counting changes of one place's list. `facts` are the place's shown
 * facts. A year without a value is null, never zero. Shared by the topic and place pages.
 */
export function buildSocialSeriesModel(definitions: readonly SocialSeriesDefinition[], facts: readonly SocialShownFact[], state: TopicState & { view?: SocialPayView }, coverage: TopicCoverage, breaks: readonly SocialSeriesBreak[]): SocialModel {
  const view = state.view ?? "amount";
  const byCell = new Map(facts.map(f => [cellKey(f), f]));
  const model = buildTopicModel({ range: state.range, coverage, selectedIds: state.selectedIds, color: socialSeriesColor,
    definitions: definitions.map(definition => ({ ...definition, ...socialDisplay(definition.heading, view) })),
    value: (definition, year) => byCell.get(cellKey({ indicatorId: definition.id, year }))?.value });
  const withMonths = (series: (typeof model.series)[number]): SocialSeriesModel => {
    const counted = series.heading === "money" || series.heading === "average";
    const partialMonths: Record<number, number> = {};
    for (const year of model.years) {
      const months = byCell.get(cellKey({ indicatorId: series.id, year }))?.months;
      if (counted && months !== undefined && months < 12) partialMonths[year] = months;
    }
    return { ...series, partialMonths };
  };
  const series = model.series.map(withMonths);
  const selected = series.filter(s => state.selectedIds.includes(s.id));
  const lead = selected[0] ?? series[0];
  const selectedBases = new Set(state.selectedIds.map(baseId));
  // A share divides by the next 1 January's population, so the census recalculation of 1 January 2025 first reaches the 2024 share.
  const census = buildBreakRegister().find(item => item.breakId === CENSUS_BREAK)!;
  const censusYears = state.selectedIds.some(id => id.endsWith("#share")) ? [breakYear(census) - 1] : [];
  const years = [...breaks.filter(item => item.appliesTo.some(id => selectedBases.has(id))).map(breakYear), ...censusYears].filter(year => year > model.range.start && year <= model.range.end);
  return {
    ...model, series, selected, unit: lead.unit, heading: lead.heading,
    breaks: [...new Set(years)].sort((a, b) => a - b).map(year => ({ year, label: "newCounting" as const })),
  };
}

export function buildSocialModel(section: SocialTopicId, facts: readonly ClientSocialFact[], state: SocialState, extras: { breaks: readonly SocialSeriesBreak[]; gdpFacts: readonly ClientNationalGdpFact[] }): SocialModel {
  return buildSocialSeriesModel(socialTopicSeries(section), socialTopicFacts(section, state.view, facts, extras.gdpFacts), state,
    socialCoverage(section, state.view, facts, extras.gdpFacts, state.selectedIds), extras.breaks);
}

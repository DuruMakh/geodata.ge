import { TAX_BREAKS_REFUNDS_INDICATORS, type ClientTaxBreaksRefundsFact, type TaxBreaksRefundsIndicator } from "../data/taxBreaksRefunds/types";
import type { ClientNationalGdpFact } from "./clientData";
import { shareOfGdp } from "./debtExplorer";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicHashView, topicSeriesColor, type TopicCoverage, type TopicSeriesDefinition, type TopicSeriesModel, type TopicState } from "./topicSeries";

export const TAX_BREAKS_REFUNDS_PATH = "/explorer/tax-breaks-refunds";
/** Amounts, or each amount divided by the same year's GDP. The icon measure switch changes it (DESIGN §7.2a). */
export type TaxBreaksRefundsView = "amount" | "gdp";
const VIEWS: readonly TaxBreaksRefundsView[] = ["amount", "gdp"];
/** The small headings of the series list. */
export type TaxBreaksRefundsHeading = "breaks" | "vat" | "income" | "refunds";
export type TaxBreaksRefundsSeries = TopicSeriesDefinition & { id: TaxBreaksRefundsIndicator; heading: TaxBreaksRefundsHeading };

const headingOf = (id: TaxBreaksRefundsIndicator): TaxBreaksRefundsHeading =>
  id === "tax_breaks.total" ? "breaks" : id.startsWith("tax_breaks.vat.") ? "vat" : id.startsWith("tax_breaks.income.") ? "income" : "refunds";
/** Every series, flat under its heading: no series is the ink reference, because both totals are drawn at arrival. */
export const TAX_BREAKS_REFUNDS_SERIES: readonly TaxBreaksRefundsSeries[] = TAX_BREAKS_REFUNDS_INDICATORS.map(id => ({ id, reference: false, heading: headingOf(id) }));
/** The page's two totals, both on at arrival (an approved exception to the one-total rule; Project_Definition §2). */
export const TAX_BREAKS_REFUNDS_DEFAULT: readonly string[] = ["tax_breaks.total", "tax_refunds.total"];

export type TaxBreaksRefundsState = TopicState & { view: TaxBreaksRefundsView };

/** The values a view shows: the amounts as they are, or each divided by Fiscal.ge's national GDP for the year (a year without GDP has none). */
export function taxBreaksRefundsViewFacts(view: TaxBreaksRefundsView, facts: readonly ClientTaxBreaksRefundsFact[], gdpFacts: readonly ClientNationalGdpFact[]): readonly ClientTaxBreaksRefundsFact[] {
  if (view === "amount") return facts;
  const gdpByYear = new Map(gdpFacts.map(f => [f.year, f]));
  return facts.flatMap(f => {
    const share = shareOfGdp(f.value, f.year, gdpByYear);
    return share === null ? [] : [{ ...f, value: share * 100, unit: "percent" as const }];
  });
}

/** The years of the selected series (of every series when none is selected): 2008–2025 with refunds, 2018–2024 with tax breaks alone. */
export function taxBreaksRefundsCoverage(view: TaxBreaksRefundsView, selectedIds: readonly string[], facts: readonly ClientTaxBreaksRefundsFact[], gdpFacts: readonly ClientNationalGdpFact[]): TopicCoverage {
  const ids = new Set<string>(selectedIds.length ? selectedIds : TAX_BREAKS_REFUNDS_INDICATORS);
  return topicCoverage(taxBreaksRefundsViewFacts(view, facts, gdpFacts).filter(f => ids.has(f.indicatorId)).map(f => f.year), `No tax breaks and refunds years for ${view}`);
}

export function parseTaxBreaksRefundsHash(hash: string, facts: readonly ClientTaxBreaksRefundsFact[], gdpFacts: readonly ClientNationalGdpFact[]): TaxBreaksRefundsState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const view = topicHashView(p, VIEWS);
  // The years are refitted to the requested series' own coverage, so the selection is read before the range.
  const requested = p.has("sel") ? p.get("sel")!.split(",") : TAX_BREAKS_REFUNDS_DEFAULT;
  const coverage = taxBreaksRefundsCoverage(view, TAX_BREAKS_REFUNDS_INDICATORS.filter(id => requested.includes(id)), facts, gdpFacts);
  return { ...parseTopicHash(p, TAX_BREAKS_REFUNDS_SERIES, TAX_BREAKS_REFUNDS_DEFAULT, coverage), view };
}

export function serializeTaxBreaksRefundsHash(state: TaxBreaksRefundsState): string {
  const p = new URLSearchParams();
  if (state.view === "gdp") p.set("tab", state.view);
  return serializeTopicHash(state, p);
}

export type TaxBreaksRefundsSeriesModel = TopicSeriesModel<TaxBreaksRefundsSeries>;
export type TaxBreaksRefundsModel = { range: ResolvedPeriodRange; years: number[]; series: TaxBreaksRefundsSeriesModel[]; selected: TaxBreaksRefundsSeriesModel[]; unit: "gel" | "percent" };

const cellKey = (f: { indicatorId: string; year: number }) => `${f.indicatorId}:${f.year}`;

export function buildTaxBreaksRefundsModel(allFacts: readonly ClientTaxBreaksRefundsFact[], state: TaxBreaksRefundsState, gdpFacts: readonly ClientNationalGdpFact[]): TaxBreaksRefundsModel {
  const byCell = new Map(taxBreaksRefundsViewFacts(state.view, allFacts, gdpFacts).map(f => [cellKey(f), f]));
  return {
    ...buildTopicModel({
      range: state.range, coverage: taxBreaksRefundsCoverage(state.view, state.selectedIds, allFacts, gdpFacts), selectedIds: state.selectedIds,
      definitions: TAX_BREAKS_REFUNDS_SERIES, color: (definition, index) => topicSeriesColor(definition, index),
      value: (definition, year) => byCell.get(cellKey({ indicatorId: definition.id, year }))?.value,
    }),
    unit: state.view === "gdp" ? "percent" : "gel",
  };
}

/** The heading line's figure: the latest refunds. Both totals do not fit one 375px line, so tax breaks are left to the list. */
export function taxBreaksRefundsHeadline(facts: readonly ClientTaxBreaksRefundsFact[]): { year: number; value: number } {
  const fact = facts.filter(f => f.indicatorId === "tax_refunds.total").sort((a, b) => a.year - b.year).at(-1)!;
  return { year: fact.year, value: fact.value };
}

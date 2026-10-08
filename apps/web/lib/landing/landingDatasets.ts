import type { ServedGdpObservation } from "../data/gdpOverview/types";
import type { ServedCpiFact } from "../data/inflation/types";
import { periodFromKey } from "../data/inflation/periods";
import type { ClientUnemploymentObservation } from "../data/unemployment/types";
import type { ClientTradeOverviewFact } from "../data/tradeOverview/types";
import { formatAmount, formatInUnit, formatShare } from "../explorer/format";
import { periodLabel } from "../explorer/inflationLabels";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";

// The landing's dataset row (owner decision D3, 2026-10-07): one link per
// dataset hub, each with one latest figure computed from the served facts —
// never a maintained snapshot, so the row cannot drift from the hubs behind it.

export type LandingDatasetLink = {
  href: string;
  title: string;
  /** "{measure} · {period}: {value}" — the one-line latest-value pattern. */
  measure: string;
  period: string;
  value: string;
};

export function buildLandingDatasetLinks(
  input: {
    expenditure: { latestYear: number; totalGel: number };
    gdpFacts: readonly Pick<ServedGdpObservation, "seriesId" | "year" | "value">[];
    cpiFacts: readonly Pick<ServedCpiFact, "seriesId" | "measure" | "period" | "value">[];
    unemploymentFacts: readonly Pick<ClientUnemploymentObservation, "dimension" | "indicatorId" | "year" | "value">[];
    tradeFacts: readonly Pick<ClientTradeOverviewFact, "indicatorId" | "year" | "valueUsd">[];
  },
  { locale, messages }: Pick<Presentation, "locale" | "messages">,
): LandingDatasetLink[] {
  const t = (key: string) => message(messages, key);
  const gdp = latestBy(input.gdpFacts.filter((fact) => fact.seriesId === "nominal_gel"), (fact) => fact.year);
  const cpi = latestBy(input.cpiFacts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct"), (fact) => fact.period);
  const unemployment = latestBy(
    input.unemploymentFacts.filter((fact) => fact.dimension === "national" && fact.indicatorId === "unemployment_rate"),
    (fact) => fact.year,
  );
  const trade = latestBy(input.tradeFacts.filter((fact) => fact.indicatorId === "trade.turnover"), (fact) => fact.year);
  if (!gdp || !cpi || !unemployment || !trade) throw new Error("Landing dataset row needs served GDP, CPI, unemployment and trade facts");
  // The Trade overview's own scale: billions once any value reaches one.
  const tradeBillion = Math.abs(trade.valueUsd) >= 1_000_000_000;
  const tradeUnit = { divisor: tradeBillion ? 1_000_000_000 : 1_000_000, label: t(tradeBillion ? "trade.unit.billion" : "trade.unit.million"), decimals: 1 };
  return [
    { href: "/explorer", title: t("common.budget"), measure: t("landing.datasetBudgetMeasure"), period: String(input.expenditure.latestYear), value: formatAmount(input.expenditure.totalGel, locale) },
    { href: "/explorer/economy", title: t("common.economy"), measure: t("landing.datasetEconomyMeasure"), period: String(gdp.year), value: formatAmount(gdp.value, locale) },
    { href: "/explorer/inflation", title: t("common.inflation"), measure: t("landing.datasetInflationMeasure"), period: periodLabel(messages, periodFromKey(cpi.period), "short"), value: formatShare(cpi.value / 100) },
    { href: "/explorer/unemployment", title: t("common.unemployment"), measure: t("landing.datasetUnemploymentMeasure"), period: String(unemployment.year), value: formatShare(unemployment.value / 100) },
    { href: "/explorer/trade", title: t("common.trade"), measure: t("landing.datasetTradeMeasure"), period: String(trade.year), value: `${formatInUnit(trade.valueUsd, tradeUnit)} ${tradeUnit.label}` },
  ];
}

function latestBy<T, K extends number | string>(rows: readonly T[], key: (row: T) => K): T | undefined {
  return rows.reduce<T | undefined>((latest, row) => (latest === undefined || key(row) > key(latest) ? row : latest), undefined);
}

import type { ServedGdpObservation } from "../data/gdpOverview/types";
import type { ServedCpiFact } from "../data/inflation/types";
import { periodFromKey } from "../data/inflation/periods";
import type { ClientUnemploymentObservation } from "../data/unemployment/types";
import { formatAmount, formatShare } from "../explorer/format";
import { periodLabel } from "../explorer/inflationLabels";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";

// The landing's four-dataset row (owner decision D3, 2026-10-07): one link per
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
  if (!gdp || !cpi || !unemployment) throw new Error("Landing dataset row needs served GDP, CPI and unemployment facts");
  return [
    { href: "/explorer", title: t("common.budget"), measure: t("landing.datasetBudgetMeasure"), period: String(input.expenditure.latestYear), value: formatAmount(input.expenditure.totalGel, locale) },
    { href: "/explorer/economy", title: t("common.economy"), measure: t("landing.datasetEconomyMeasure"), period: String(gdp.year), value: formatAmount(gdp.value, locale) },
    { href: "/explorer/inflation", title: t("common.inflation"), measure: t("landing.datasetInflationMeasure"), period: periodLabel(messages, periodFromKey(cpi.period), "short"), value: formatShare(cpi.value / 100) },
    { href: "/explorer/unemployment", title: t("common.unemployment"), measure: t("landing.datasetUnemploymentMeasure"), period: String(unemployment.year), value: formatShare(unemployment.value / 100) },
  ];
}

function latestBy<T, K extends number | string>(rows: readonly T[], key: (row: T) => K): T | undefined {
  return rows.reduce<T | undefined>((latest, row) => (latest === undefined || key(row) > key(latest) ? row : latest), undefined);
}

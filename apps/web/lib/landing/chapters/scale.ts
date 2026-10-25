import {
  FOREIGN_INVESTMENT_TOTAL_ID,
  MONEY_TRANSFER_TOTAL_ID,
  type ForeignInvestmentFact,
  type MoneyTransferFact,
} from "../../data/externalFlows/types";
import type { ServedGdpObservation } from "../../data/gdpOverview/types";
import { message } from "../../i18n/messages";
import type { Messages } from "../../i18n/types";
import type { ServedGeneralGovernmentBalanceFact, ServedGovernmentDebtFact } from "../../servedRows";
import { GEL_PER_SQUARE, type RevenueSeries, type ScaleChapter, type ScaleMeasureId, type SpendingSeries } from "./types";

// Chapter 01: each measure beside nominal GDP of the same year. One square is
// GEL 10 million (GEL_PER_SQUARE), so GDP itself is the full grid.

export type ScaleInput = {
  gdp: ServedGdpObservation[];
  spending: SpendingSeries;
  revenue: RevenueSeries;
  debtFacts: ServedGovernmentDebtFact[];
  balanceFacts: ServedGeneralGovernmentBalanceFact[];
  municipalTotals: Map<number, number>;
  fdiFacts: ForeignInvestmentFact[];
  transferFacts: MoneyTransferFact[];
};

function gdpValue(gdp: ServedGdpObservation[], seriesId: ServedGdpObservation["seriesId"], year: number): number | null {
  return gdp.find((observation) => observation.seriesId === seriesId && observation.year === year)?.value ?? null;
}

function seriesTotal(series: SpendingSeries | RevenueSeries, year: number): number | null {
  const index = series.years.indexOf(year);
  return index === -1 ? null : series.totals[index];
}

function seriesPlanned(series: SpendingSeries | RevenueSeries, year: number): boolean {
  return series.planned[series.years.indexOf(year)] ?? false;
}

// A partial-year or blank value is not a full-year amount to set beside GDP: it counts as missing.
function usdToGel(fact: ForeignInvestmentFact | MoneyTransferFact | undefined, gelPerUsd: number | null): number | null {
  if (!fact || fact.valueStatus !== "numeric" || fact.valueUsd === null || gelPerUsd === null) return null;
  const value = Number(fact.valueUsd);
  return Number.isFinite(value) ? value * gelPerUsd : null;
}

export function buildScaleChapter(input: ScaleInput, messages: Messages): ScaleChapter {
  const gelYears = input.gdp.filter((observation) => observation.seriesId === "nominal_gel").map((observation) => observation.year);
  if (gelYears.length === 0) throw new Error("Scale chapter needs nominal GDP in GEL");
  const year = Math.max(...gelYears);
  const gdpGel = gdpValue(input.gdp, "nominal_gel", year)!;
  const gdpUsd = gdpValue(input.gdp, "nominal_usd", year);
  const gelPerUsd = gdpUsd === null || gdpUsd === 0 ? null : gdpGel / gdpUsd;

  const debt = input.debtFacts.find(
    (fact) =>
      fact.year === year &&
      fact.family === "stock" &&
      fact.seriesId === "debt.stock.total" &&
      fact.status === "actual" &&
      fact.valueKind === "amount_gel",
  );
  const balance = input.balanceFacts.find((fact) => fact.year === year && fact.status === "actual");
  const fdi = input.fdiFacts.find((fact) => fact.entityId === FOREIGN_INVESTMENT_TOTAL_ID && fact.year === year);
  const transfer = input.transferFacts.find(
    (fact) => fact.entityId === MONEY_TRANSFER_TOTAL_ID && fact.measure === "received" && fact.year === year,
  );

  const candidates: { id: ScaleMeasureId; label: string; valueGel: number | null; planned?: boolean }[] = [
    { id: "gdp", label: message(messages, "landing.scale.gdp"), valueGel: gdpGel },
    { id: "revenue", label: message(messages, "landing.scale.revenue"), valueGel: seriesTotal(input.revenue, year), planned: seriesPlanned(input.revenue, year) },
    { id: "spending", label: message(messages, "landing.scale.spending"), valueGel: seriesTotal(input.spending, year), planned: seriesPlanned(input.spending, year) },
    { id: "debt", label: message(messages, "landing.scale.debt"), valueGel: debt?.value ?? null },
    {
      id: "balance",
      // Zero or more is a surplus, as in chapter 05.
      label: message(messages, balance && balance.generalGovernmentBalanceGel >= 0 ? "landing.scale.surplus" : "landing.scale.deficit"),
      valueGel: balance ? Math.abs(balance.generalGovernmentBalanceGel) : null,
    },
    { id: "municipal", label: message(messages, "landing.scale.municipal"), valueGel: input.municipalTotals.get(year) ?? null },
    { id: "fdi", label: message(messages, "landing.scale.fdi"), valueGel: usdToGel(fdi, gelPerUsd) },
    { id: "remittances", label: message(messages, "landing.scale.remittances"), valueGel: usdToGel(transfer, gelPerUsd) },
  ];

  const measures: ScaleChapter["measures"] = [];
  for (const { id, label, valueGel, planned = false } of candidates) {
    if (valueGel === null) continue;
    measures.push({ id, label, valueGel, squares: Math.round(valueGel / GEL_PER_SQUARE), share: valueGel / gdpGel, planned });
  }

  return { year, gdpGel, squares: Math.round(gdpGel / GEL_PER_SQUARE), defaultId: "spending", measures };
}

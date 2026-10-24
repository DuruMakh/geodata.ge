import type { GlossaryEntry } from "../../data/glossary";
import { chooseActivePublicFacts } from "../../data/activeFacts";
import { isDerivedTotalItemId } from "../../explorer/explorerData";
import { publicLabel } from "../../i18n/labels";
import { message } from "../../i18n/messages";
import type { Presentation } from "../../i18n/types";
import type { ServedBudgetFact } from "../../servedRows";
import type { RevenueBandId, RevenueSeries, SpendingSeries } from "./types";

// Chapters 02 and 03: per-year series from the same active facts (actual wins
// over planned) that the explorer charts. Totals are sums of the plotted parts.

const OTHER_UNCLASSIFIED_ID = "spending.other_unclassified";

export const REVENUE_BANDS: Record<RevenueBandId, readonly string[]> = {
  vat: ["revenue.vat"],
  income: ["revenue.income_tax"],
  profit: ["revenue.profit_tax"],
  excise: ["revenue.excise_tax"],
  otherTaxes: ["revenue.import_tax", "revenue.property_tax", "revenue.other_taxes"],
  otherIncome: ["revenue.grants", "revenue.other_revenue", "revenue.asset_decrease"],
  liabilities: ["revenue.increase_liabilities"],
};

const TAX_BAND_IDS: readonly RevenueBandId[] = ["vat", "income", "profit", "excise", "otherTaxes"];

function activeDetailFacts(facts: ServedBudgetFact[], side: ServedBudgetFact["side"]): ServedBudgetFact[] {
  return chooseActivePublicFacts(facts).filter((fact) => fact.side === side && !isDerivedTotalItemId(fact.itemId));
}

function yearRange(facts: ServedBudgetFact[]): number[] {
  if (facts.length === 0) return [];
  const years = facts.map((fact) => fact.year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export function buildSpendingSeries(
  facts: ServedBudgetFact[],
  glossary: Map<string, GlossaryEntry>,
  presentation: Presentation,
): SpendingSeries {
  const active = activeDetailFacts(facts, "expenditure");
  const years = yearRange(active);
  const yearIndex = new Map(years.map((year, index) => [year, index]));

  const planned = years.map(() => false);
  const valuesById = new Map<string, number[]>();
  for (const fact of active) {
    const index = yearIndex.get(fact.year)!;
    if (fact.basis === "planned") planned[index] = true;
    const values = valuesById.get(fact.itemId) ?? years.map(() => 0);
    values[index] += fact.amountGel;
    valuesById.set(fact.itemId, values);
  }

  const latest = (values: number[]) => values.at(-1) ?? 0;
  const fields = Array.from(valuesById, ([id, values]) => ({
    id,
    label: publicLabel(presentation.locale, id, glossary.get(id)?.kaLabel ?? id, presentation.englishLabels),
    values,
  })).sort((left, right) => {
    if ((left.id === OTHER_UNCLASSIFIED_ID) !== (right.id === OTHER_UNCLASSIFIED_ID)) {
      return left.id === OTHER_UNCLASSIFIED_ID ? 1 : -1;
    }
    return latest(right.values) - latest(left.values) || left.id.localeCompare(right.id);
  });

  return {
    years,
    planned,
    totals: years.map((_, index) => fields.reduce((sum, field) => sum + field.values[index], 0)),
    fields,
  };
}

export function buildRevenueSeries(
  facts: ServedBudgetFact[],
  glossary: Map<string, GlossaryEntry>,
  presentation: Presentation,
): RevenueSeries {
  const active = activeDetailFacts(facts, "revenue");
  const bandOfItem = new Map<string, RevenueBandId>();
  for (const [bandId, itemIds] of Object.entries(REVENUE_BANDS) as [RevenueBandId, readonly string[]][]) {
    for (const itemId of itemIds) bandOfItem.set(itemId, bandId);
  }

  const years = yearRange(active);
  const yearIndex = new Map(years.map((year, index) => [year, index]));
  const bandIds = Object.keys(REVENUE_BANDS) as RevenueBandId[];
  const values = new Map<RevenueBandId, (number | null)[]>(bandIds.map((id) => [id, years.map(() => null)]));
  const planned = years.map(() => false);

  for (const fact of active) {
    const bandId = bandOfItem.get(fact.itemId);
    if (!bandId) throw new Error(`Revenue item ${fact.itemId} is not assigned to a homepage band`);
    const series = values.get(bandId)!;
    const index = yearIndex.get(fact.year)!;
    if (fact.basis === "planned") planned[index] = true;
    series[index] = (series[index] ?? 0) + fact.amountGel;
  }

  const amount = (bandId: RevenueBandId, index: number) => values.get(bandId)![index] ?? 0;
  const totals = years.map((_, index) => bandIds.reduce((sum, bandId) => sum + amount(bandId, index), 0));
  const taxShare = totals.map((total, index) =>
    total === 0 ? 0 : TAX_BAND_IDS.reduce((sum, bandId) => sum + amount(bandId, index), 0) / total,
  );

  let peakBorrowing: RevenueSeries["peakBorrowing"] = null;
  for (const [index, year] of years.entries()) {
    if (values.get("liabilities")![index] === null || totals[index] === 0) continue;
    const share = amount("liabilities", index) / totals[index];
    if (!peakBorrowing || share > peakBorrowing.share) peakBorrowing = { year, share };
  }

  return {
    years,
    planned,
    totals,
    taxShare,
    bands: bandIds.map((id) => ({
      id,
      label: message(presentation.messages, `landing.revBand.${id}`),
      values: values.get(id)!,
    })),
    peakBorrowing,
  };
}

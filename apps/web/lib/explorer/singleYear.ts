import { chooseActivePublicFacts } from "../data/activeFacts";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import type { Presentation } from "../i18n/types";
import kaAnalysis from "../i18n/messages/ka/analysis.json";
import type { AdminSpendingCategory } from "../data/adminSpending/types";
import type { GlossaryEntry } from "../data/glossary";
import type { ClientAdminFact, ClientBudgetFact } from "./clientData";
import { colorForItem, OTHER_COLOR } from "./colors";
import { formatAmountParts, formatShare, MISSING } from "./format";
import type {
  Every100Item,
  ExpenditureGrouping,
  ExplorerSide,
  SingleYearSnapshotModel,
  SnapshotHeadline,
  SnapshotItem,
} from "./types";

export type SingleYearSnapshotInput = {
  facts: ClientBudgetFact[];
  adminFacts?: ClientAdminFact[];
  adminCategories?: Map<string, AdminSpendingCategory>;
  grouping?: ExpenditureGrouping;
  glossary: Map<string, GlossaryEntry>;
  side: ExplorerSide;
  year: number;
};

type SnapshotFact = {
  year: number;
  itemId: string;
  amountGel: number;
  basis: "actual" | "planned";
};

function labelsFor(id: string, glossary: Map<string, GlossaryEntry>) {
  const entry = glossary.get(id);
  return {
    kaLabel: entry?.kaLabel ?? id,
    enLabel: entry?.enLabel ?? id,
  };
}

function totalIdFor(side: ExplorerSide): string {
  return side === "revenue" ? "revenue.total" : "expenditure.total";
}

function emptyReasonFor(side: ExplorerSide, presentation?: Presentation): string {
  return message(presentation?.messages ?? kaAnalysis, side === "revenue" ? "analysis.emptyRevenue" : "analysis.emptyExpenditure");
}

// Growth from a non-positive base (e.g. revenue.other_taxes 2019-2020) is not
// meaningful for display; treat it as missing.
function changeFromPrevious(amountGel: number, previousAmountGel: number | null): number | null {
  if (previousAmountGel === null || previousAmountGel <= 0) return null;
  return (amountGel - previousAmountGel) / previousAmountGel;
}

function wholeGelFrom100(items: SnapshotItem[]): Every100Item[] {
  // Normalize over the drawn (positive) items so the allocation always sums to
  // exactly 100, even when the true year total includes negative rows.
  const drawnTotal = items.reduce((sum, item) => sum + item.amountGel, 0);

  if (drawnTotal <= 0) {
    return items.map((item) => ({
      itemId: item.itemId,
      kaLabel: item.kaLabel,
      enLabel: item.enLabel,
      color: item.color,
      gelFrom100: 0,
      exactShare: 0,
    }));
  }

  const allocated = items.map((item, index) => {
    const exactShare = (item.amountGel / drawnTotal) * 100;
    const floorShare = Math.floor(exactShare);

    return {
      item,
      index,
      exactShare,
      floorShare,
      remainder: exactShare - floorShare,
    };
  });
  const sortedByRemainder = [...allocated].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const extrasByIndex = new Map<number, number>();
  let remainderToAllocate = 100 - allocated.reduce((sum, item) => sum + item.floorShare, 0);
  let cursor = 0;

  while (remainderToAllocate > 0 && sortedByRemainder.length > 0) {
    const index = sortedByRemainder[cursor % sortedByRemainder.length]?.index;
    if (index !== undefined) extrasByIndex.set(index, (extrasByIndex.get(index) ?? 0) + 1);
    remainderToAllocate -= 1;
    cursor += 1;
  }

  return allocated.map(({ item, index, exactShare, floorShare }) => ({
    itemId: item.itemId,
    kaLabel: item.kaLabel,
    enLabel: item.enLabel,
    color: item.color,
    gelFrom100: floorShare + (extrasByIndex.get(index) ?? 0),
    exactShare,
  }));
}

function buildRadarItems(items: SnapshotItem[], presentation?: Presentation): SnapshotItem[] {
  if (items.length <= 8) return items;

  const visible = items.slice(0, 7);
  const omitted = items.slice(7);
  const amountGel = omitted.reduce((sum, item) => sum + item.amountGel, 0);
  const previousAmounts = omitted.map((item) => item.previousAmountGel);
  const previousAmountGel = previousAmounts.every((amount): amount is number => amount !== null)
    ? previousAmounts.reduce((sum, amount) => sum + amount, 0)
    : null;

  return [
    ...visible,
    {
      itemId: "snapshot.other",
      kaLabel: "სხვა",
      enLabel: presentation ? publicLabel("en", "snapshot.other", "სხვა", presentation.englishLabels) : "Other",
      color: OTHER_COLOR,
      amountGel,
      shareOfTotal: omitted.reduce((sum, item) => sum + item.shareOfTotal, 0),
      previousAmountGel,
      changeFromPreviousYear: changeFromPrevious(amountGel, previousAmountGel),
      amountChangeFromPreviousYear: previousAmountGel === null ? null : amountGel - previousAmountGel,
      basis: omitted.some((item) => item.basis === "planned") ? "planned" : "actual",
    },
  ];
}

function headlineCards(totalGel: number, year: number, items: SnapshotItem[], presentation?: Presentation): SnapshotHeadline[] {
  const locale = presentation?.locale ?? "ka";
  const messages = presentation?.messages ?? kaAnalysis;
  const labelFor = (item: SnapshotItem) => publicLabel(locale, item.itemId, item.kaLabel, presentation?.englishLabels ?? {});
  const largest = items[0] ?? null;
  const fastestGrowth = [...items]
    .filter((item) => item.changeFromPreviousYear !== null)
    .sort((a, b) => (b.changeFromPreviousYear ?? -Infinity) - (a.changeFromPreviousYear ?? -Infinity))[0] ?? null;
  // Require a positive base (changeFromPreviousYear !== null): a delta measured
  // against a negative prior value is mostly the unwind of a correction, not a
  // real "largest increase" (e.g. revenue.other_taxes 2020→2021).
  const largestIncrease = [...items]
    .filter((item) => item.amountChangeFromPreviousYear !== null && item.changeFromPreviousYear !== null)
    .sort((a, b) => (b.amountChangeFromPreviousYear ?? -Infinity) - (a.amountChangeFromPreviousYear ?? -Infinity))[0] ?? null;
  const totalParts = formatAmountParts(items.length > 0 ? totalGel : null, false, locale);
  const largestParts = largest ? formatAmountParts(largest.amountGel, false, locale) : { num: MISSING, unit: "" };
  const increaseParts = largestIncrease ? formatAmountParts(largestIncrease.amountChangeFromPreviousYear, true, locale) : { num: MISSING, unit: "" };

  return [
    {
      id: "total",
      label: message(messages, "analysis.total"),
      value: totalParts.num,
      unit: totalParts.unit,
      detail: message(messages, "analysis.headlinePeriod", { count: items.length, year }),
      negative: false,
    },
    {
      id: "largest",
      label: message(messages, "analysis.largest"),
      value: largestParts.num,
      unit: largestParts.unit,
      detail: largest ? `${labelFor(largest)} · ${formatShare(largest.shareOfTotal)}` : MISSING,
      negative: false,
    },
    {
      id: "fastest_growth",
      label: message(messages, "analysis.fastestGrowth"),
      value: fastestGrowth ? formatShare(fastestGrowth.changeFromPreviousYear, true) : MISSING,
      unit: "",
      detail: fastestGrowth ? labelFor(fastestGrowth) : message(messages, "analysis.noPreviousYear"),
      negative: (fastestGrowth?.changeFromPreviousYear ?? 0) < 0,
    },
    {
      id: "largest_increase",
      label: message(messages, "analysis.largestIncrease"),
      value: increaseParts.num,
      unit: increaseParts.unit,
      detail: largestIncrease ? labelFor(largestIncrease) : message(messages, "analysis.noPreviousYear"),
      negative: false,
    },
  ];
}

export function buildSingleYearSnapshotModel(input: SingleYearSnapshotInput, presentation?: Presentation): SingleYearSnapshotModel {
  const grouping: ExpenditureGrouping = input.side === "expenditure" ? input.grouping ?? "fields" : "fields";
  const isMinistryGrouping = input.side === "expenditure" && grouping === "ministries";

  const active: SnapshotFact[] = isMinistryGrouping
    ? (input.adminFacts ?? [])
        .filter((fact) => fact.level === "admin_category")
        .map((fact) => ({ year: fact.year, itemId: fact.itemId, amountGel: fact.amountGel, basis: fact.basis }))
    : chooseActivePublicFacts(input.facts)
        .filter((fact) => fact.side === input.side)
        .map((fact) => ({ year: fact.year, itemId: fact.itemId, amountGel: fact.amountGel, basis: fact.basis }));

  const labelFor = (itemId: string) => {
    const category = input.adminCategories?.get(itemId);
    const labels = !isMinistryGrouping ? labelsFor(itemId, input.glossary) : category
      ? { kaLabel: category.kaLabel, enLabel: category.enLabel }
      : { kaLabel: itemId, enLabel: itemId };
    return presentation ? { ...labels, enLabel: publicLabel("en", itemId, labels.kaLabel, presentation.englishLabels) } : labels;
  };

  const yearFacts = active.filter((fact) => fact.year === input.year);
  const totalFact = yearFacts.find((fact) => fact.itemId === totalIdFor(input.side)) ?? null;
  const detailFacts = yearFacts.filter((fact) => fact.itemId !== totalIdFor(input.side));

  if (yearFacts.length === 0) {
    return {
      side: input.side,
      grouping,
      year: input.year,
      previousYear: null,
      totalGel: 0,
      basis: "actual",
      hasPlannedValues: false,
      headlineCards: headlineCards(0, input.year, [], presentation),
      items: [],
      every100: [],
      radarItems: [],
      rankingRows: [],
      hasGrowthData: false,
      emptyReason: emptyReasonFor(input.side, presentation),
    };
  }

  const previousYear = Array.from(new Set(active.filter((fact) => fact.year < input.year).map((fact) => fact.year))).sort((a, b) => b - a)[0] ?? null;
  const previousFacts = previousYear === null ? [] : active.filter((fact) => fact.year === previousYear && fact.itemId !== totalIdFor(input.side));
  const previousByItemId = new Map(previousFacts.map((fact) => [fact.itemId, fact.amountGel]));
  const totalGel = totalFact?.amountGel ?? detailFacts.reduce((sum, fact) => sum + fact.amountGel, 0);

  // Every official row is a model item — including zero and negative rows (e.g.
  // revenue.other_taxes 2019-2020) — so the ranking, category counts, and the
  // "სულ" headline all describe the same population and rows sum to the total.
  // Shares are of the true year total; geometry sections (treemap, every-100,
  // radar, field) draw only positive rows and normalize internally.
  const items = detailFacts
    .map((fact, index): SnapshotItem => {
      const previousAmountGel = previousByItemId.get(fact.itemId) ?? null;

      return {
        itemId: fact.itemId,
        ...labelFor(fact.itemId),
        color: colorForItem(fact.itemId, index),
        amountGel: fact.amountGel,
        shareOfTotal: totalGel > 0 ? fact.amountGel / totalGel : 0,
        previousAmountGel,
        changeFromPreviousYear: changeFromPrevious(fact.amountGel, previousAmountGel),
        amountChangeFromPreviousYear: previousAmountGel === null ? null : fact.amountGel - previousAmountGel,
        basis: fact.basis,
      };
    })
    .sort((a, b) => b.amountGel - a.amountGel);
  const drawnItems = items.filter((item) => item.amountGel > 0);

  return {
    side: input.side,
    grouping,
    year: input.year,
    previousYear,
    totalGel,
    basis: yearFacts.some((fact) => fact.basis === "planned") ? "planned" : "actual",
    hasPlannedValues: yearFacts.some((fact) => fact.basis === "planned"),
    headlineCards: headlineCards(totalGel, input.year, items, presentation),
    items,
    every100: wholeGelFrom100(drawnItems),
    radarItems: buildRadarItems(drawnItems, presentation),
    rankingRows: items,
    hasGrowthData: items.some((item) => item.changeFromPreviousYear !== null),
    emptyReason: null,
  };
}

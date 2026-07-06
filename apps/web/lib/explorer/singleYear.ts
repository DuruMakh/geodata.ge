import { chooseActivePublicFacts } from "../data/activeFacts";
import type { AdminSpendingCategory, AdminSpendingFact } from "../data/adminSpending/types";
import type { GlossaryEntry } from "../data/glossary";
import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import type { SourceDocumentRow } from "../data/sources";
import { colorForItem, OTHER_COLOR } from "./colors";
import { formatAmountParts, formatShare, MISSING } from "./format";
import type {
  Every100Item,
  ExpenditureGrouping,
  ExplorerSide,
  SingleYearSnapshotModel,
  SnapshotHeadline,
  SnapshotItem,
  SourceMetadata,
} from "./types";

export type SingleYearSnapshotInput = {
  facts: BudgetFactImportRow[];
  adminFacts?: AdminSpendingFact[];
  adminCategories?: Map<string, AdminSpendingCategory>;
  grouping?: ExpenditureGrouping;
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
  side: ExplorerSide;
  year: number;
};

type SnapshotFact = {
  year: number;
  itemId: string;
  amountGel: number;
  basis: "actual" | "planned";
  sourceId: string;
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

function sourceMetadataFor(sourceIds: string[], sources: Map<string, SourceDocumentRow>): SourceMetadata {
  const rows = sourceIds
    .map((sourceId) => sources.get(sourceId))
    .filter((source): source is SourceDocumentRow => Boolean(source));
  const uniqueNames = Array.from(new Set(rows.map((source) => source.sourceName)));
  const uniqueFiles = Array.from(new Set(rows.map((source) => source.sourceUrlOrFile)));

  return {
    sourceName: uniqueNames.length === 1 && uniqueFiles.length === 1 ? uniqueNames[0] ?? "" : "Multiple reviewed official sources",
    sourceUrlOrFile: uniqueFiles.join("; "),
    lastReviewedAt: rows.map((source) => source.lastReviewedAt).sort().at(-1) ?? "",
  };
}

function sourceMetadataFromItems(items: SnapshotItem[]): SourceMetadata {
  const uniqueNames = Array.from(new Set(items.map((item) => item.source.sourceName)));
  const uniqueFiles = Array.from(new Set(items.map((item) => item.source.sourceUrlOrFile)));

  return {
    sourceName: uniqueNames.length === 1 && uniqueFiles.length === 1 ? uniqueNames[0] ?? "" : "Multiple reviewed official sources",
    sourceUrlOrFile: uniqueFiles.join("; "),
    lastReviewedAt: items.map((item) => item.source.lastReviewedAt).sort().at(-1) ?? "",
  };
}

function emptyReasonFor(side: ExplorerSide): string {
  return side === "revenue"
    ? "ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული."
    : "ამ წლისთვის ხარჯების მონაცემები ჯერ არ არის ჩატვირთული.";
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

function buildRadarItems(items: SnapshotItem[]): SnapshotItem[] {
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
      enLabel: "Other",
      color: OTHER_COLOR,
      amountGel,
      shareOfTotal: omitted.reduce((sum, item) => sum + item.shareOfTotal, 0),
      previousAmountGel,
      changeFromPreviousYear: changeFromPrevious(amountGel, previousAmountGel),
      amountChangeFromPreviousYear: previousAmountGel === null ? null : amountGel - previousAmountGel,
      basis: omitted.some((item) => item.basis === "planned") ? "planned" : "actual",
      source: sourceMetadataFromItems(omitted),
    },
  ];
}

const NO_PREVIOUS_YEAR_NOTE = "წინა წლის მონაცემები არ არის";

function headlineCards(totalGel: number, year: number, items: SnapshotItem[]): SnapshotHeadline[] {
  const largest = items[0] ?? null;
  const fastestGrowth = [...items]
    .filter((item) => item.changeFromPreviousYear !== null)
    .sort((a, b) => (b.changeFromPreviousYear ?? -Infinity) - (a.changeFromPreviousYear ?? -Infinity))[0] ?? null;
  const largestIncrease = [...items]
    .filter((item) => item.amountChangeFromPreviousYear !== null)
    .sort((a, b) => (b.amountChangeFromPreviousYear ?? -Infinity) - (a.amountChangeFromPreviousYear ?? -Infinity))[0] ?? null;
  const totalParts = formatAmountParts(items.length > 0 ? totalGel : null);
  const largestParts = largest ? formatAmountParts(largest.amountGel) : { num: MISSING, unit: "" };
  const increaseParts = largestIncrease ? formatAmountParts(largestIncrease.amountChangeFromPreviousYear, true) : { num: MISSING, unit: "" };

  return [
    {
      id: "total",
      label: "სულ",
      value: totalParts.num,
      unit: totalParts.unit,
      detail: `${items.length} კატეგორია · ${year}`,
      negative: false,
    },
    {
      id: "largest",
      label: "ყველაზე დიდი",
      value: largestParts.num,
      unit: largestParts.unit,
      detail: largest ? `${largest.kaLabel} · ${formatShare(largest.shareOfTotal)}` : MISSING,
      negative: false,
    },
    {
      id: "fastest_growth",
      label: "ყველაზე სწრაფი ზრდა",
      value: fastestGrowth ? formatShare(fastestGrowth.changeFromPreviousYear, true) : MISSING,
      unit: "",
      detail: fastestGrowth?.kaLabel ?? NO_PREVIOUS_YEAR_NOTE,
      negative: (fastestGrowth?.changeFromPreviousYear ?? 0) < 0,
    },
    {
      id: "largest_increase",
      label: "ყველაზე დიდი მატება",
      value: increaseParts.num,
      unit: increaseParts.unit,
      detail: largestIncrease?.kaLabel ?? NO_PREVIOUS_YEAR_NOTE,
      negative: false,
    },
  ];
}

export function buildSingleYearSnapshotModel(input: SingleYearSnapshotInput): SingleYearSnapshotModel {
  const grouping: ExpenditureGrouping = input.side === "expenditure" ? input.grouping ?? "fields" : "fields";
  const isMinistryGrouping = input.side === "expenditure" && grouping === "ministries";
  const sourceDocuments = new Map(input.sourceDocuments.map((source) => [source.sourceId, source]));

  const active: SnapshotFact[] = isMinistryGrouping
    ? (input.adminFacts ?? [])
        .filter((fact) => fact.level === "admin_category")
        .map((fact) => ({ year: fact.year, itemId: fact.itemId, amountGel: fact.amountGel, basis: fact.basis, sourceId: fact.sourceId }))
    : chooseActivePublicFacts(input.facts)
        .filter((fact) => fact.side === input.side)
        .map((fact) => ({ year: fact.year, itemId: fact.itemId, amountGel: fact.amountGel, basis: fact.basis, sourceId: fact.sourceId }));

  const labelFor = (itemId: string) => {
    if (!isMinistryGrouping) return labelsFor(itemId, input.glossary);
    const category = input.adminCategories?.get(itemId);
    return category
      ? { kaLabel: category.kaLabel, enLabel: category.enLabel }
      : { kaLabel: itemId, enLabel: itemId };
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
      source: null,
      headlineCards: headlineCards(0, input.year, []),
      items: [],
      every100: [],
      radarItems: [],
      rankingRows: [],
      hasGrowthData: false,
      emptyReason: emptyReasonFor(input.side),
    };
  }

  const previousYear = Array.from(new Set(active.filter((fact) => fact.year < input.year).map((fact) => fact.year))).sort((a, b) => b - a)[0] ?? null;
  const previousFacts = previousYear === null ? [] : active.filter((fact) => fact.year === previousYear && fact.itemId !== totalIdFor(input.side));
  const previousByItemId = new Map(previousFacts.map((fact) => [fact.itemId, fact.amountGel]));
  const totalGel = totalFact?.amountGel ?? detailFacts.reduce((sum, fact) => sum + fact.amountGel, 0);
  const modelSource = sourceMetadataFor((totalFact ? [totalFact] : detailFacts).map((fact) => fact.sourceId), sourceDocuments);

  // Visual sections only show positive amounts (the reference prototype filters
  // value > 0): zero rows would render degenerate tiles and negative rows (e.g.
  // revenue.other_taxes 2019-2020) would break share geometry. The year total above
  // still includes every fact, so headline sums stay exact. Shares are normalized
  // over the drawn (positive) sum so tiles, cells, and share bars sum to 100%.
  const drawnFacts = detailFacts.filter((fact) => fact.amountGel > 0);
  const drawnTotal = drawnFacts.reduce((sum, fact) => sum + fact.amountGel, 0);
  const items = drawnFacts
    .map((fact, index): SnapshotItem => {
      const previousAmountGel = previousByItemId.get(fact.itemId) ?? null;

      return {
        itemId: fact.itemId,
        ...labelFor(fact.itemId),
        color: colorForItem(fact.itemId, index),
        amountGel: fact.amountGel,
        shareOfTotal: drawnTotal === 0 ? 0 : fact.amountGel / drawnTotal,
        previousAmountGel,
        changeFromPreviousYear: changeFromPrevious(fact.amountGel, previousAmountGel),
        amountChangeFromPreviousYear: previousAmountGel === null ? null : fact.amountGel - previousAmountGel,
        basis: fact.basis,
        source: sourceMetadataFor([fact.sourceId], sourceDocuments),
      };
    })
    .sort((a, b) => b.amountGel - a.amountGel);

  return {
    side: input.side,
    grouping,
    year: input.year,
    previousYear,
    totalGel,
    basis: yearFacts.some((fact) => fact.basis === "planned") ? "planned" : "actual",
    hasPlannedValues: yearFacts.some((fact) => fact.basis === "planned"),
    source: modelSource,
    headlineCards: headlineCards(totalGel, input.year, items),
    items,
    every100: wholeGelFrom100(items),
    radarItems: buildRadarItems(items),
    rankingRows: items,
    hasGrowthData: items.some((item) => item.changeFromPreviousYear !== null),
    emptyReason: null,
  };
}

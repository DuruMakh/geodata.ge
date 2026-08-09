import type { GlossaryEntry } from "../data/glossary";
import type { SourceDocumentRow } from "../data/sources";
import type { ServedAdminFact, ServedBudgetFact } from "../servedRows";
import type { AdminSpendingCategory } from "../data/adminSpending/types";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { colorForItem } from "./colors";
import type {
  ExpenditureGrouping,
  ExplorerItem,
  ExplorerItemLevel,
  ExplorerPoint,
  ExplorerSide,
  ExplorerTableRow,
  MeasureMode,
  PeriodSummary,
  SourceMetadata,
} from "./types";

const SERIES_ORDER_BASE_YEAR = 2025;
const DEFAULT_SELECTION_SIZE = 5;
const ADMIN_SPENDING_TOTAL_ID = "admin_spending.total";

type ModelFact = {
  year: number;
  side: ExplorerSide;
  itemId: string;
  parentItemId: string | null;
  level: ExplorerItemLevel;
  amountGel: number;
  basis: "actual" | "planned";
  sourceId: string;
  kaLabel: string | null;
  enLabel: string | null;
  detailLabel: string | null;
  officialInstitutionLabel: string | null;
};

export type ExplorerModelInput = {
  facts: ServedBudgetFact[];
  adminFacts?: ServedAdminFact[];
  adminCategories?: Map<string, AdminSpendingCategory>;
  expenditureGrouping?: ExpenditureGrouping;
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
  side: ExplorerSide;
  selectedItemIds: string[];
  startYear: number;
  endYear: number;
  measure: MeasureMode;
};

export type ExplorerModel = {
  years: number[];
  items: ExplorerItem[];
  selectedItems: ExplorerItem[];
  points: ExplorerPoint[];
  tableRows: ExplorerTableRow[];
  totalRow: ExplorerTableRow | null;
  comparisonRows: ExplorerTableRow[];
  summary: PeriodSummary;
  topGrowth: ExplorerTableRow[];
  bottomGrowth: ExplorerTableRow[];
  hasPlannedValues: boolean;
};

function totalIdFor(side: ExplorerSide): string {
  return side === "revenue" ? "revenue.total" : "expenditure.total";
}

function isPublicTotalFact(fact: ModelFact): boolean {
  return fact.itemId === totalIdFor(fact.side);
}

function sideForItemId(itemId: string): ExplorerSide {
  return itemId.startsWith("revenue.") ? "revenue" : "expenditure";
}

function labelsFor(id: string, side: ExplorerSide, glossary: Map<string, GlossaryEntry>) {
  if (id === totalIdFor(side)) {
    return side === "revenue"
      ? { kaLabel: "მთლიანი შემოსავლები", enLabel: "Total revenue" }
      : { kaLabel: "მთლიანი ხარჯი", enLabel: "Total expenditure" };
  }

  const entry = glossary.get(id);
  return {
    kaLabel: entry?.kaLabel ?? id,
    enLabel: entry?.enLabel ?? id,
  };
}

function adminLabelsFor(id: string, fact: ModelFact | undefined, categories: Map<string, AdminSpendingCategory>) {
  if (id === ADMIN_SPENDING_TOTAL_ID) {
    return labelsFor("expenditure.total", "expenditure", new Map());
  }

  const category = categories.get(id);
  if (category) return { kaLabel: category.kaLabel, enLabel: category.enLabel };

  return {
    kaLabel: fact?.kaLabel ?? id,
    enLabel: fact?.enLabel ?? fact?.kaLabel ?? id,
  };
}

function sourceIdsFor(sourceIds: string[]): string[] {
  return sourceIds.flatMap((sourceId) => sourceId.split(";").map((id) => id.trim()).filter(Boolean));
}

function sourceMetadataFor(sourceIds: string[], sources: Map<string, SourceDocumentRow>): SourceMetadata {
  const normalizedSourceIds = sourceIdsFor(sourceIds);
  const rows = normalizedSourceIds
    .map((sourceId) => sources.get(sourceId))
    .filter((source): source is SourceDocumentRow => Boolean(source));
  const uniqueRows = Array.from(
    new Map(rows.map((source) => [`${source.sourceName}\0${source.sourceUrlOrFile}\0${source.lastReviewedAt}`, source])).values(),
  );
  const uniqueNames = Array.from(new Set(rows.map((source) => source.sourceName)));
  const uniqueFiles = Array.from(new Set(rows.map((source) => source.sourceUrlOrFile)));

  return {
    sourceName: uniqueRows.length <= 1 ? uniqueNames[0] ?? "" : "Multiple reviewed official sources",
    sourceUrlOrFile: uniqueFiles.join("; "),
    lastReviewedAt: rows.map((source) => source.lastReviewedAt).sort().at(-1) ?? "",
  };
}

function valueForMeasure(amountGel: number, yearTotal: number, measure: MeasureMode) {
  if (measure === "share_of_total") return yearTotal === 0 ? null : amountGel / yearTotal;
  return amountGel;
}

// Percent change from a non-positive base is not meaningful for display.
function percentChangeFrom(amountGel: number, previousAmountGel: number | null): number | null {
  if (previousAmountGel === null || previousAmountGel <= 0) return null;
  return (amountGel - previousAmountGel) / previousAmountGel;
}

// Change from a non-positive base is not meaningful for display.
function changeBetween(startValue: number | null, endValue: number | null): number | null {
  if (startValue === null || endValue === null || startValue <= 0) return null;
  return (endValue - startValue) / startValue;
}

function absoluteIncrease(row: ExplorerTableRow, startYear: number, endYear: number): number | null {
  const start = row.valuesByYear[startYear];
  const end = row.valuesByYear[endYear];
  if (start === null || start === undefined || end === null || end === undefined) return null;
  return end - start;
}

function shareChangeFor(row: ExplorerTableRow, totalRow: ExplorerTableRow | null, startYear: number): number {
  return (row.shareEndYear ?? 0) - shareForYear(row, totalRow, startYear);
}

function buildSummary(rows: ExplorerTableRow[], totalRow: ExplorerTableRow | null, years: number[]): {
  summary: PeriodSummary;
  topGrowth: ExplorerTableRow[];
  bottomGrowth: ExplorerTableRow[];
} {
  const startYear = years[0];
  const endYear = years.at(-1);

  if (startYear === undefined || endYear === undefined) {
    return {
      summary: {
        totalChange: null,
        largestGelIncrease: null,
        fastestGrowth: null,
        lowestGrowth: null,
        biggestShareChange: null,
      },
      topGrowth: [],
      bottomGrowth: [],
    };
  }

  const comparableRows = rows.filter((row) => row.valuesByYear[startYear] !== undefined && row.valuesByYear[endYear] !== undefined);
  const growthRows = comparableRows.filter((row) => row.change !== null);
  const sortedGrowth = [...growthRows].sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));
  const sortedIncrease = [...comparableRows].sort(
    (a, b) => (absoluteIncrease(b, startYear, endYear) ?? -Infinity) - (absoluteIncrease(a, startYear, endYear) ?? -Infinity),
  );
  const sortedShareChange = [...comparableRows].sort(
    (a, b) => Math.abs(shareChangeFor(b, totalRow, startYear)) - Math.abs(shareChangeFor(a, totalRow, startYear)),
  );

  return {
    summary: {
      totalChange: totalRow?.change ?? null,
      largestGelIncrease: sortedIncrease[0] ?? null,
      fastestGrowth: sortedGrowth[0] ?? null,
      lowestGrowth: sortedGrowth.at(-1) ?? null,
      biggestShareChange: sortedShareChange[0] ?? null,
    },
    topGrowth: sortedGrowth.slice(0, 3),
    bottomGrowth: [...sortedGrowth].reverse().slice(0, 3),
  };
}

function shareForYear(row: ExplorerTableRow, totalRow: ExplorerTableRow | null, year: number): number {
  const amount = row.valuesByYear[year];
  const total = totalRow?.valuesByYear[year];
  if (amount === null || amount === undefined || total === null || total === undefined || total === 0) return 0;
  return amount / total;
}

// Default selection follows the editorial design: the applicable total plus the
// top categories by latest-year value.
export function getDefaultSelection(
  side: ExplorerSide,
  facts: ServedBudgetFact[],
  expenditureGrouping: ExpenditureGrouping = "fields",
  adminFacts: ServedAdminFact[] = [],
): string[] {
  const amountsByItem = new Map<string, { year: number; amountGel: number }>();
  const consider = (itemId: string, year: number, amountGel: number) => {
    const existing = amountsByItem.get(itemId);
    if (!existing || year > existing.year) amountsByItem.set(itemId, { year, amountGel });
  };

  if (side === "expenditure" && expenditureGrouping === "ministries") {
    for (const fact of adminFacts) {
      if (fact.level === "admin_category") consider(fact.itemId, fact.year, fact.amountGel);
    }
  } else {
    for (const fact of chooseActivePublicFacts(facts)) {
      if (fact.side === side && !isDerivedTotalItemId(fact.itemId)) consider(fact.itemId, fact.year, fact.amountGel);
    }
  }

  const latestYear = Math.max(...Array.from(amountsByItem.values()).map((entry) => entry.year), 0);

  const totalId =
    side === "revenue"
      ? "revenue.total"
      : expenditureGrouping === "ministries"
        ? ADMIN_SPENDING_TOTAL_ID
        : "expenditure.total";
  const categories = Array.from(amountsByItem.entries())
    .filter(([, entry]) => entry.year === latestYear)
    .sort((a, b) => b[1].amountGel - a[1].amountGel)
    .slice(0, DEFAULT_SELECTION_SIZE)
    .map(([itemId]) => itemId);

  return categories.length === 0 ? [] : [totalId, ...categories];
}

export function isDerivedTotalItemId(itemId: string): boolean {
  return itemId === "expenditure.total" || itemId === "revenue.total" || itemId === ADMIN_SPENDING_TOTAL_ID;
}

function compareBaselineAmountDesc(leftId: string, rightId: string, baselineAmounts: Map<string, number>): number {
  const leftAmount = baselineAmounts.get(leftId);
  const rightAmount = baselineAmounts.get(rightId);

  if (leftAmount !== undefined && rightAmount !== undefined && leftAmount !== rightAmount) return rightAmount - leftAmount;
  if (leftAmount !== undefined && rightAmount === undefined) return -1;
  if (leftAmount === undefined && rightAmount !== undefined) return 1;
  return leftId.localeCompare(rightId);
}

function publicFactForModel(fact: ServedBudgetFact): ModelFact {
  return {
    year: fact.year,
    side: fact.side,
    itemId: fact.itemId,
    parentItemId: null,
    level: "public_field",
    amountGel: fact.amountGel,
    basis: fact.basis,
    sourceId: fact.sourceId,
    kaLabel: null,
    enLabel: null,
    detailLabel: null,
    officialInstitutionLabel: null,
  };
}

function adminFactForModel(fact: ServedAdminFact): ModelFact {
  const label = fact.officialLabelKa ?? fact.itemId;

  return {
    year: fact.year,
    side: "expenditure",
    itemId: fact.itemId,
    parentItemId: fact.parentItemId,
    level: fact.level,
    amountGel: fact.amountGel,
    basis: fact.basis,
    sourceId: fact.sourceId,
    kaLabel: fact.level === "major_program" ? label : null,
    enLabel: fact.level === "major_program" ? label : null,
    // Drill-down programs are shown by NAME only — the official tavi-VI code (which fragments
    // across reorganizations, e.g. sport development moving 39 02→33 05→32 12→…) is intentionally
    // not surfaced in the explorer. officialCode stays in the facts CSV for provenance.
    detailLabel: null,
    officialInstitutionLabel: fact.level === "major_program" ? fact.officialInstitutionLabelKa : null,
  };
}

function ministryItemIds(active: ModelFact[], baselineAmounts: Map<string, number>): string[] {
  const categoryIds = Array.from(new Set(active.filter((fact) => fact.level === "admin_category").map((fact) => fact.itemId))).sort((left, right) =>
    compareBaselineAmountDesc(left, right, baselineAmounts),
  );
  const programIdsByParent = new Map<string, string[]>();

  for (const fact of active.filter((row) => row.level === "major_program")) {
    const parentItemId = fact.parentItemId ?? "";
    const programIds = programIdsByParent.get(parentItemId) ?? [];
    if (!programIds.includes(fact.itemId)) programIds.push(fact.itemId);
    programIdsByParent.set(parentItemId, programIds);
  }

  return [
    ADMIN_SPENDING_TOTAL_ID,
    ...categoryIds.flatMap((categoryId) => [
      categoryId,
      ...(programIdsByParent.get(categoryId) ?? []).sort((left, right) => compareBaselineAmountDesc(left, right, baselineAmounts)),
    ]),
  ];
}

// Largest entry strictly below `year` in an ascending, deduplicated array.
function latestYearBelow(years: number[], year: number): number | null {
  let low = 0;
  let high = years.length - 1;
  let found: number | null = null;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (years[mid] < year) {
      found = years[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}

export function buildExplorerModel(input: ExplorerModelInput): ExplorerModel {
  const isMinistryGrouping = input.side === "expenditure" && input.expenditureGrouping === "ministries";
  const active = isMinistryGrouping
    ? (input.adminFacts ?? []).map(adminFactForModel)
    : chooseActivePublicFacts(input.facts)
        .filter((fact) => fact.side === input.side)
        .map(publicFactForModel);
  const visibleFacts = active.filter((fact) => fact.year >= input.startYear && fact.year <= input.endYear);
  const visibleDetailFacts = visibleFacts.filter((fact) => !isPublicTotalFact(fact));
  const years = Array.from(new Set(visibleFacts.map((fact) => fact.year))).sort((a, b) => a - b);
  const totalId = isMinistryGrouping ? ADMIN_SPENDING_TOTAL_ID : totalIdFor(input.side);
  const sourceDocuments = new Map(input.sourceDocuments.map((source) => [source.sourceId, source]));
  const baselineAmounts = new Map<string, number>();

  for (const fact of active) {
    if (fact.year === SERIES_ORDER_BASE_YEAR) {
      baselineAmounts.set(fact.itemId, (baselineAmounts.get(fact.itemId) ?? 0) + fact.amountGel);
    }
  }

  const itemIds = isMinistryGrouping
    ? ministryItemIds(active, baselineAmounts)
    : [
        totalId,
        ...Array.from(new Set(active.map((fact) => fact.itemId).filter((itemId) => !isDerivedTotalItemId(itemId)))).sort((left, right) => compareBaselineAmountDesc(left, right, baselineAmounts)),
      ];
  // Facts are year-ascending, so keeping the LAST fact per item makes each series carry its
  // most recent official name. First-fact-wins would title a series by its oldest label — since
  // the pre-2012 legacy-join points (whose labels are old organizational lines, e.g. the 2006
  // Roads Department) sort first, that would mislabel every joined series for all viewed years.
  const factsByItem = new Map<string, ModelFact>();
  for (const fact of active) {
    factsByItem.set(fact.itemId, fact);
  }
  const items = itemIds.map((id, index) => ({
    id,
    side: sideForItemId(id),
    parentItemId: id === totalId ? null : factsByItem.get(id)?.parentItemId ?? null,
    level: id === totalId ? "total" : factsByItem.get(id)?.level ?? "public_field",
    detailLabel: id === totalId ? null : factsByItem.get(id)?.detailLabel ?? null,
    ...(isMinistryGrouping ? adminLabelsFor(id, factsByItem.get(id), input.adminCategories ?? new Map()) : labelsFor(id, input.side, input.glossary)),
    color: colorForItem(id, index),
    sortOrder: index + 1,
  }));
  const selectedItems = items.filter((item) => input.selectedItemIds.includes(item.id));
  const factsByItemYear = new Map<string, ModelFact>();
  const totalByYear = new Map<number, number>();
  const detailFactsForTotals = visibleDetailFacts.filter((fact) => !isMinistryGrouping || fact.level === "admin_category");
  const explicitTotalFactsByYear = new Map<number, ModelFact>();

  for (const fact of visibleFacts.filter(isPublicTotalFact)) {
    explicitTotalFactsByYear.set(fact.year, fact);
  }

  for (const fact of visibleDetailFacts) {
    factsByItemYear.set(`${fact.itemId}:${fact.year}`, fact);
  }

  for (const fact of detailFactsForTotals) {
    totalByYear.set(fact.year, (totalByYear.get(fact.year) ?? 0) + fact.amountGel);
  }
  for (const [year, fact] of explicitTotalFactsByYear) {
    totalByYear.set(year, fact.amountGel);
  }

  // Prior-year lookups are called once per (series, year) cell. Rescanning
  // `active` inside them made a table of S series over Y years cost S x Y x
  // |active| element visits, and |active| itself grows with items x years — so
  // the term was effectively cubic in dataset breadth. These indexes are built
  // once per model and make each lookup O(log n). Note they cover ALL active
  // years, not just the visible range: the prior year is often outside it.
  const detailFactsForTotalsByYear = new Map<number, ModelFact[]>();

  for (const fact of detailFactsForTotals) {
    const yearFacts = detailFactsForTotalsByYear.get(fact.year);
    if (yearFacts) yearFacts.push(fact);
    else detailFactsForTotalsByYear.set(fact.year, [fact]);
  }

  // First fact wins per item-year, matching the .find() this replaced.
  const activeYearsByItem = new Map<string, number[]>();
  const activeAmountByItemYear = new Map<string, number>();

  for (const fact of active) {
    const key = `${fact.itemId}:${fact.year}`;
    if (activeAmountByItemYear.has(key)) continue;
    activeAmountByItemYear.set(key, fact.amountGel);
    const itemYears = activeYearsByItem.get(fact.itemId);
    if (itemYears) itemYears.push(fact.year);
    else activeYearsByItem.set(fact.itemId, [fact.year]);
  }

  for (const itemYears of activeYearsByItem.values()) itemYears.sort((a, b) => a - b);

  const detailActive = active.filter((fact) => !isPublicTotalFact(fact) && (!isMinistryGrouping || fact.level === "admin_category"));
  const explicitTotalActive = new Map(active.filter(isPublicTotalFact).map((fact) => [fact.year, fact]));
  const detailActiveSumByYear = new Map<number, number>();

  for (const fact of detailActive) {
    detailActiveSumByYear.set(fact.year, (detailActiveSumByYear.get(fact.year) ?? 0) + fact.amountGel);
  }

  const totalActiveYears = Array.from(new Set([...detailActive.map((fact) => fact.year), ...explicitTotalActive.keys()])).sort((a, b) => a - b);

  // Returns a copy: the array in the index is shared across every call for the
  // same year, and the sibling branch hands back a fresh one, so returning the
  // live array would make the two paths differ in whether a caller may mutate
  // the result. The filter this replaced always allocated.
  const totalFactsForYear = (year: number): ModelFact[] => {
    const explicitTotalFact = explicitTotalFactsByYear.get(year);
    if (explicitTotalFact) return [explicitTotalFact];
    const yearFacts = detailFactsForTotalsByYear.get(year);
    return yearFacts ? [...yearFacts] : [];
  };

  const previousAmount = (itemId: string, year: number): number | null => {
    const itemYears = activeYearsByItem.get(itemId);
    if (!itemYears) return null;
    const previousYear = latestYearBelow(itemYears, year);
    if (previousYear === null) return null;
    return activeAmountByItemYear.get(`${itemId}:${previousYear}`) ?? null;
  };

  const totalPreviousAmount = (year: number): number | null => {
    const previousYear = latestYearBelow(totalActiveYears, year);
    if (previousYear === null) return null;
    return explicitTotalActive.get(previousYear)?.amountGel ?? detailActiveSumByYear.get(previousYear) ?? 0;
  };

  const pointFor = (item: ExplorerItem, year: number): ExplorerPoint | null => {
    const yearTotal = totalByYear.get(year) ?? 0;

    if (item.id === totalId) {
      const yearTotalFacts = totalFactsForYear(year);
      if (yearTotalFacts.length === 0) return null;
      const amountGel = yearTotal;

      return {
        year,
        itemId: item.id,
        kaLabel: item.kaLabel,
        enLabel: item.enLabel,
        amountGel,
        basis: yearTotalFacts.some((fact) => fact.basis === "planned") ? "planned" : "actual",
        value: valueForMeasure(amountGel, yearTotal, input.measure),
        shareOfTotal: yearTotal === 0 ? null : 1,
        percentChange: percentChangeFrom(amountGel, totalPreviousAmount(year)),
      };
    }

    const fact = factsByItemYear.get(`${item.id}:${year}`);
    if (!fact) return null;

    return {
      year,
      itemId: item.id,
      kaLabel: item.kaLabel,
      enLabel: item.enLabel,
      amountGel: fact.amountGel,
      basis: fact.basis,
      value: valueForMeasure(fact.amountGel, yearTotal, input.measure),
      shareOfTotal: yearTotal === 0 ? null : fact.amountGel / yearTotal,
      percentChange: percentChangeFrom(fact.amountGel, previousAmount(item.id, year)),
    };
  };

  const rowFor = (item: ExplorerItem): ExplorerTableRow | null => {
    const valuesByYear: Record<number, number | null> = {};
    const basisByYear: Record<number, "actual" | "planned"> = {};
    const sourceByYear: Record<number, SourceMetadata> = {};
    const officialInstitutionLabelByYear: Record<number, string | null> = {};

    for (const year of years) {
      if (item.id === totalId) {
        const yearFacts = totalFactsForYear(year);
        if (yearFacts.length === 0) continue;
        valuesByYear[year] = yearFacts.reduce((sum, fact) => sum + fact.amountGel, 0);
        basisByYear[year] = yearFacts.some((fact) => fact.basis === "planned") ? "planned" : "actual";
        sourceByYear[year] = sourceMetadataFor(yearFacts.map((fact) => fact.sourceId), sourceDocuments);
        continue;
      }

      const fact = factsByItemYear.get(`${item.id}:${year}`);
      if (!fact) continue;
      valuesByYear[year] = fact.amountGel;
      basisByYear[year] = fact.basis;
      sourceByYear[year] = sourceMetadataFor([fact.sourceId], sourceDocuments);
      officialInstitutionLabelByYear[year] = fact.officialInstitutionLabel;
    }

    if (Object.keys(valuesByYear).length === 0) return null;

    const startYear = years[0];
    const endYear = years.at(-1);

    return {
      itemId: item.id,
      parentItemId: item.parentItemId,
      level: item.level,
      detailLabel: item.detailLabel,
      officialInstitutionLabelByYear,
      kaLabel: item.kaLabel,
      enLabel: item.enLabel,
      color: item.color,
      basisByYear,
      sourceByYear,
      valuesByYear,
      change: startYear === undefined || endYear === undefined ? null : changeBetween(valuesByYear[startYear] ?? null, valuesByYear[endYear] ?? null),
      shareEndYear: endYear === undefined ? null : (() => {
        const amount = valuesByYear[endYear];
        const total = totalByYear.get(endYear) ?? 0;
        return amount === undefined || amount === null || total === 0 ? null : amount / total;
      })(),
    };
  };

  const selectedPoints = selectedItems.flatMap((item) => years.map((year) => pointFor(item, year)).filter((point): point is ExplorerPoint => Boolean(point)));
  const selectedRows = selectedItems.map(rowFor).filter((row): row is ExplorerTableRow => Boolean(row));
  const allItemRows = items
    .filter((item) => item.id !== totalId)
    .map(rowFor)
    .filter((row): row is ExplorerTableRow => Boolean(row));
  const totalItem = items.find((item) => item.id === totalId);
  const totalRow = totalItem ? rowFor(totalItem) : null;
  // Movers and summary rank top-level scope items only; ministry major programs
  // stay selectable series but must not compete with their own parent categories.
  const summaryRows = allItemRows.filter((row) => row.level !== "major_program");
  const { summary, topGrowth, bottomGrowth } = buildSummary(summaryRows, totalRow, years);

  return {
    years,
    items,
    selectedItems,
    points: selectedPoints,
    tableRows: selectedRows,
    totalRow,
    comparisonRows: allItemRows,
    summary,
    topGrowth,
    bottomGrowth,
    hasPlannedValues: selectedPoints.some((point) => point.basis === "planned"),
  };
}


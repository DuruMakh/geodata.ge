import type { GlossaryEntry } from "../data/glossary";
import type {
  ClientAdminFact,
  ClientBudgetFact,
  ClientNationalGdpFact,
} from "./clientData";
import type { AdminSpendingCategory } from "../data/adminSpending/types";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { colorForItem, colorForProgram, OTHER_COLOR } from "./colors";
import type {
  ExpenditureGrouping,
  GdpMetadata,
  ExplorerItem,
  ExplorerItemLevel,
  ExplorerPoint,
  ExplorerSide,
  ExplorerTableRow,
  MeasureMode,
} from "./types";

const SERIES_ORDER_BASE_YEAR = 2025;
const ADMIN_SPENDING_TOTAL_ID = "admin_spending.total";

type ModelFact = {
  year: number;
  side: ExplorerSide;
  itemId: string;
  parentItemId: string | null;
  level: ExplorerItemLevel;
  amountGel: number;
  basis: "actual" | "planned";
  kaLabel: string | null;
  enLabel: string | null;
};

export type ExplorerModelInput = {
  facts: ClientBudgetFact[];
  adminFacts?: ClientAdminFact[];
  adminCategories?: Map<string, AdminSpendingCategory>;
  expenditureGrouping?: ExpenditureGrouping;
  glossary: Map<string, GlossaryEntry>;
  gdpFacts?: ClientNationalGdpFact[];
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
  topGrowth: ExplorerTableRow[];
  bottomGrowth: ExplorerTableRow[];
  hasPlannedValues: boolean;
  gdpByYear: Record<number, GdpMetadata>;
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

function valueForMeasure(
  amountGel: number,
  year: number,
  measure: MeasureMode,
  gdpFactsByYear: Map<number, ClientNationalGdpFact>,
) {
  if (measure === "share_of_gdp") {
    const denominator = gdpFactsByYear.get(year)?.gdpCurrentPricesGel;
    return denominator === undefined || denominator <= 0 ? null : amountGel / denominator;
  }
  return amountGel;
}

// Change from a non-positive base is not meaningful for display.
function changeBetween(startValue: number | null, endValue: number | null): number | null {
  if (startValue === null || endValue === null || startValue <= 0) return null;
  return (endValue - startValue) / startValue;
}

// The movers boards are all this ever fed the UI. The PeriodSummary that used to
// sit beside them — totalChange, largestGelIncrease, fastestGrowth, lowestGrowth,
// biggestShareChange — had no consumer outside its own tests, and computing
// biggestShareChange meant two extra sorts of every comparable row per rebuild.
function buildGrowthBoards(rows: ExplorerTableRow[], years: number[]): {
  topGrowth: ExplorerTableRow[];
  bottomGrowth: ExplorerTableRow[];
} {
  const startYear = years[0];
  const endYear = years.at(-1);

  if (startYear === undefined || endYear === undefined) return { topGrowth: [], bottomGrowth: [] };

  const sortedGrowth = rows
    .filter(
      (row) =>
        row.valuesByYear[startYear] !== undefined && row.valuesByYear[endYear] !== undefined && row.change !== null,
    )
    .sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));

  return {
    topGrowth: sortedGrowth.slice(0, 3),
    bottomGrowth: [...sortedGrowth].reverse().slice(0, 3),
  };
}

// Every populated explorer starts with its reviewed total only. The total is
// still removable; this function decides the pristine fallback, not a required
// selection.
export function getDefaultSelection(
  side: ExplorerSide,
  facts: ClientBudgetFact[],
  expenditureGrouping: ExpenditureGrouping = "fields",
  adminFacts: ClientAdminFact[] = [],
): string[] {
  const totalId =
    side === "revenue"
      ? "revenue.total"
      : expenditureGrouping === "ministries"
        ? ADMIN_SPENDING_TOTAL_ID
        : "expenditure.total";

  const hasSelectableRows =
    side === "expenditure" && expenditureGrouping === "ministries"
      ? adminFacts.some((fact) => fact.level === "admin_category")
      : chooseActivePublicFacts(facts).some(
          (fact) => fact.side === side && !isDerivedTotalItemId(fact.itemId),
        );

  return hasSelectableRows ? [totalId] : [];
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

function publicFactForModel(fact: ClientBudgetFact): ModelFact {
  return {
    year: fact.year,
    side: fact.side,
    itemId: fact.itemId,
    parentItemId: null,
    level: "public_field",
    amountGel: fact.amountGel,
    basis: fact.basis,
    kaLabel: null,
    enLabel: null,
  };
}

function adminFactForModel(fact: ClientAdminFact): ModelFact {
  const label = fact.officialLabelKa ?? fact.itemId;

  return {
    year: fact.year,
    side: "expenditure",
    itemId: fact.itemId,
    parentItemId: fact.parentItemId,
    level: fact.level,
    amountGel: fact.amountGel,
    basis: fact.basis,
    // Drill-down programs are shown by NAME only — the official tavi-VI code (which fragments
    // across reorganizations, e.g. sport development moving 39 02→33 05→32 12→…) is intentionally
    // not surfaced in the explorer. officialCode stays in the facts CSV for provenance.
    kaLabel: fact.level === "major_program" ? label : null,
    enLabel: fact.level === "major_program" ? label : null,
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
  const gdpFactsByYear = new Map((input.gdpFacts ?? []).map((fact) => [fact.year, fact]));
  const gdpByYear = Object.fromEntries(
    (input.gdpFacts ?? []).map((fact) => [
      fact.year,
      {
        gdpCurrentPricesGel: fact.gdpCurrentPricesGel,
        accountingStandard: fact.accountingStandard,
        status: fact.status,
      } satisfies GdpMetadata,
    ]),
  );
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
  // A program is coloured from its ministry's hue, so it needs its position among
  // its own siblings — not its position in the flat item list.
  const programOrdinals = new Map<string, number>();
  const programsPerParent = new Map<string, number>();
  for (const id of itemIds) {
    const fact = factsByItem.get(id);
    if (fact?.level !== "major_program" || !fact.parentItemId) continue;
    const seen = programsPerParent.get(fact.parentItemId) ?? 0;
    programOrdinals.set(id, seen);
    programsPerParent.set(fact.parentItemId, seen + 1);
  }
  const baseColorsByItemId = new Map(itemIds.map((id, index) => [id, colorForItem(id, index)]));

  const items = itemIds.map((id, index) => {
    const fact = factsByItem.get(id);
    const parentItemId = id === totalId ? null : fact?.parentItemId ?? null;
    const programOrdinal = programOrdinals.get(id);

    return {
      id,
      side: sideForItemId(id),
      parentItemId,
      level: id === totalId ? "total" : fact?.level ?? "public_field",
      ...(isMinistryGrouping ? adminLabelsFor(id, fact, input.adminCategories ?? new Map()) : labelsFor(id, input.side, input.glossary)),
      color:
        parentItemId !== null && programOrdinal !== undefined
          ? colorForProgram(baseColorsByItemId.get(parentItemId) ?? OTHER_COLOR, programOrdinal)
          : baseColorsByItemId.get(id) ?? colorForItem(id, index),
      sortOrder: index + 1,
    };
  });
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

  // Indexed once per model: totalFactsForYear is called once per (series, year)
  // cell, and rescanning `active` inside it made a table of S series over Y
  // years cost S x Y x |active| element visits.
  //
  // The prior-year indexes that used to sit beside this one went with
  // ExplorerPoint.percentChange — they existed only to serve it, and no
  // component ever read it.
  const detailFactsForTotalsByYear = new Map<number, ModelFact[]>();

  for (const fact of detailFactsForTotals) {
    const yearFacts = detailFactsForTotalsByYear.get(fact.year);
    if (yearFacts) yearFacts.push(fact);
    else detailFactsForTotalsByYear.set(fact.year, [fact]);
  }

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

  const pointFor = (item: ExplorerItem, year: number): ExplorerPoint | null => {
    if (item.id === totalId) {
      const yearTotalFacts = totalFactsForYear(year);
      if (yearTotalFacts.length === 0) return null;

      return {
        year,
        itemId: item.id,
        basis: yearTotalFacts.some((fact) => fact.basis === "planned") ? "planned" : "actual",
        value: valueForMeasure(totalByYear.get(year) ?? 0, year, input.measure, gdpFactsByYear),
      };
    }

    const fact = factsByItemYear.get(`${item.id}:${year}`);
    if (!fact) return null;

    return {
      year,
      itemId: item.id,
      basis: fact.basis,
      value: valueForMeasure(fact.amountGel, year, input.measure, gdpFactsByYear),
    };
  };

  const rowFor = (item: ExplorerItem): ExplorerTableRow | null => {
    const valuesByYear: Record<number, number | null> = {};
    const shareByYear: Record<number, number | null> = {};
    const basisByYear: Record<number, "actual" | "planned"> = {};

    for (const year of years) {
      if (item.id === totalId) {
        const yearFacts = totalFactsForYear(year);
        if (yearFacts.length === 0) continue;
        valuesByYear[year] = yearFacts.reduce((sum, fact) => sum + fact.amountGel, 0);
        shareByYear[year] = valueForMeasure(
          valuesByYear[year] ?? 0,
          year,
          "share_of_gdp",
          gdpFactsByYear,
        );
        basisByYear[year] = yearFacts.some((fact) => fact.basis === "planned") ? "planned" : "actual";
        continue;
      }

      const fact = factsByItemYear.get(`${item.id}:${year}`);
      if (!fact) continue;
      valuesByYear[year] = fact.amountGel;
      shareByYear[year] = valueForMeasure(
        fact.amountGel,
        year,
        "share_of_gdp",
        gdpFactsByYear,
      );
      basisByYear[year] = fact.basis;
    }

    if (Object.keys(valuesByYear).length === 0) return null;

    const startYear = years[0];
    const endYear = years.at(-1);

    return {
      itemId: item.id,
      parentItemId: item.parentItemId,
      level: item.level,
      kaLabel: item.kaLabel,
      enLabel: item.enLabel,
      color: item.color,
      basisByYear,
      valuesByYear,
      shareByYear,
      change: startYear === undefined || endYear === undefined ? null : changeBetween(valuesByYear[startYear] ?? null, valuesByYear[endYear] ?? null),
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
  const { topGrowth, bottomGrowth } = buildGrowthBoards(summaryRows, years);

  return {
    years,
    items,
    selectedItems,
    points: selectedPoints,
    tableRows: selectedRows,
    totalRow,
    comparisonRows: allItemRows,
    topGrowth,
    bottomGrowth,
    hasPlannedValues: selectedPoints.some((point) => point.basis === "planned"),
    gdpByYear,
  };
}

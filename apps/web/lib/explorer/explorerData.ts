import type { GlossaryEntry } from "../data/glossary";
import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import type { SourceDocumentRow } from "../data/sources";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { MAX_CHART_SERIES } from "./types";
import type {
  ExplorerItem,
  ExplorerPoint,
  ExplorerSide,
  ExplorerTableRow,
  MeasureMode,
  PeriodSummary,
  SourceMetadata,
} from "./types";

const palette = [
  "#22d3ee",
  "#a3e635",
  "#f97316",
  "#f472b6",
  "#c084fc",
  "#facc15",
  "#38bdf8",
  "#fb7185",
  "#14b8a6",
  "#e879f9",
  "#84cc16",
  "#f43f5e",
];

export type ExplorerModelInput = {
  facts: BudgetFactImportRow[];
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
  unavailableReason: string | null;
};

function totalIdFor(side: ExplorerSide): string {
  return side === "revenue" ? "revenue.total" : "expenditure.total";
}

function sideForItemId(itemId: string): ExplorerSide {
  return itemId.startsWith("revenue.") ? "revenue" : "expenditure";
}

function labelsFor(id: string, side: ExplorerSide, glossary: Map<string, GlossaryEntry>) {
  if (id === totalIdFor(side)) {
    return side === "revenue"
      ? { kaLabel: "შემოსავლები სულ", enLabel: "Total revenue" }
      : { kaLabel: "ხარჯები სულ", enLabel: "Total expenditure" };
  }

  const entry = glossary.get(id);
  return {
    kaLabel: entry?.kaLabel ?? id,
    enLabel: entry?.enLabel ?? id,
  };
}

function sourceMetadataFor(sourceIds: string[], sources: Map<string, SourceDocumentRow>): SourceMetadata {
  const rows = sourceIds
    .map((sourceId) => sources.get(sourceId))
    .filter((source): source is SourceDocumentRow => Boolean(source));
  const uniqueNames = Array.from(new Set(rows.map((source) => source.sourceName)));
  const uniqueFiles = Array.from(new Set(rows.map((source) => source.sourceUrlOrFile)));

  return {
    sourceName: sourceIds.length === 1 ? uniqueNames[0] ?? "" : "Multiple reviewed official sources",
    sourceUrlOrFile: uniqueFiles.join("; "),
    lastReviewedAt: rows.map((source) => source.lastReviewedAt).sort().at(-1) ?? "",
  };
}

function valueForMeasure(amountGel: number, previousAmountGel: number | null, yearTotal: number, measure: MeasureMode) {
  if (measure === "nominal") return amountGel;
  if (measure === "share_of_total") return yearTotal === 0 ? null : amountGel / yearTotal;
  if (measure === "percent_change") {
    if (previousAmountGel === null || previousAmountGel === 0) return null;
    return (amountGel - previousAmountGel) / previousAmountGel;
  }
  return null;
}

function changeBetween(startValue: number | null, endValue: number | null): number | null {
  if (startValue === null || endValue === null || startValue === 0) return null;
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

export function getDefaultSelection(side: ExplorerSide, facts: BudgetFactImportRow[]): string[] {
  return chooseActivePublicFacts(facts).some((fact) => fact.side === side) ? [totalIdFor(side)] : [];
}

export function isDerivedTotalItemId(itemId: string): boolean {
  return itemId === "expenditure.total" || itemId === "revenue.total";
}

export function getDefaultStackedSelection(side: ExplorerSide, facts: BudgetFactImportRow[]): string[] {
  return Array.from(
    new Set(
      chooseActivePublicFacts(facts)
        .filter((fact) => fact.side === side)
        .map((fact) => fact.itemId)
        .filter((itemId) => !isDerivedTotalItemId(itemId)),
    ),
  )
    .sort()
    .slice(0, MAX_CHART_SERIES);
}

export function buildExplorerModel(input: ExplorerModelInput): ExplorerModel {
  const active = chooseActivePublicFacts(input.facts).filter((fact) => fact.side === input.side);
  const visibleFacts = active.filter((fact) => fact.year >= input.startYear && fact.year <= input.endYear);
  const years = Array.from(new Set(visibleFacts.map((fact) => fact.year))).sort((a, b) => a - b);
  const totalId = totalIdFor(input.side);
  const sourceDocuments = new Map(input.sourceDocuments.map((source) => [source.sourceId, source]));
  const itemIds = [totalId, ...Array.from(new Set(active.map((fact) => fact.itemId))).sort()];
  const items = itemIds.map((id, index) => ({
    id,
    side: sideForItemId(id),
    ...labelsFor(id, input.side, input.glossary),
    color: palette[index % palette.length] ?? "#22d3ee",
    sortOrder: index + 1,
  }));
  const selectedItems = items.filter((item) => input.selectedItemIds.includes(item.id));
  const factsByItemYear = new Map<string, BudgetFactImportRow>();
  const totalByYear = new Map<number, number>();

  for (const fact of visibleFacts) {
    factsByItemYear.set(`${fact.itemId}:${fact.year}`, fact);
    totalByYear.set(fact.year, (totalByYear.get(fact.year) ?? 0) + fact.amountGel);
  }

  const previousAmount = (itemId: string, year: number): number | null => {
    const previousYear = active
      .filter((fact) => fact.itemId === itemId && fact.year < year)
      .map((fact) => fact.year)
      .sort((a, b) => b - a)[0];

    if (previousYear === undefined) return null;
    return active.find((fact) => fact.itemId === itemId && fact.year === previousYear)?.amountGel ?? null;
  };

  const totalPreviousAmount = (year: number): number | null => {
    const previousYear = Array.from(new Set(active.filter((fact) => fact.year < year).map((fact) => fact.year))).sort((a, b) => b - a)[0];
    if (previousYear === undefined) return null;
    return active.filter((fact) => fact.year === previousYear).reduce((sum, fact) => sum + fact.amountGel, 0);
  };

  const pointFor = (item: ExplorerItem, year: number): ExplorerPoint | null => {
    const yearTotal = totalByYear.get(year) ?? 0;

    if (item.id === totalId) {
      const sourceIds = visibleFacts.filter((fact) => fact.year === year).map((fact) => fact.sourceId);
      if (sourceIds.length === 0) return null;
      const amountGel = yearTotal;

      return {
        year,
        itemId: item.id,
        kaLabel: item.kaLabel,
        enLabel: item.enLabel,
        amountGel,
        basis: visibleFacts.some((fact) => fact.year === year && fact.basis === "planned") ? "planned" : "actual",
        value: valueForMeasure(amountGel, totalPreviousAmount(year), yearTotal, input.measure),
        shareOfTotal: yearTotal === 0 ? null : 1,
        percentChange: valueForMeasure(amountGel, totalPreviousAmount(year), yearTotal, "percent_change"),
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
      value: valueForMeasure(fact.amountGel, previousAmount(item.id, year), yearTotal, input.measure),
      shareOfTotal: yearTotal === 0 ? null : fact.amountGel / yearTotal,
      percentChange: valueForMeasure(fact.amountGel, previousAmount(item.id, year), yearTotal, "percent_change"),
    };
  };

  const rowFor = (item: ExplorerItem): ExplorerTableRow | null => {
    const valuesByYear: Record<number, number | null> = {};
    const basisByYear: Record<number, "actual" | "planned"> = {};
    const sourceByYear: Record<number, SourceMetadata> = {};

    for (const year of years) {
      if (item.id === totalId) {
        const yearFacts = visibleFacts.filter((fact) => fact.year === year);
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
    }

    if (Object.keys(valuesByYear).length === 0) return null;

    const startYear = years[0];
    const endYear = years.at(-1);

    return {
      itemId: item.id,
      kaLabel: item.kaLabel,
      enLabel: item.enLabel,
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
  const { summary, topGrowth, bottomGrowth } = buildSummary(allItemRows, totalRow, years);

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
    unavailableReason: input.measure === "share_of_gdp" ? "მშპ-სთან წილის საჩვენებლად საჭიროა სანდო მშპ მონაცემები." : null,
  };
}

import type { DebtFamily, DebtSeriesId, ServedGovernmentDebtFact, ServedNationalGdpFact } from "../servedRows";
import { INK } from "./colors";

export const DEBT_FAMILIES = ["stock", "service", "rate"] as const satisfies readonly DebtFamily[];

const SERIES_BY_FAMILY: Record<DebtFamily, readonly DebtSeriesId[]> = {
  stock: ["debt.stock.total", "debt.stock.domestic", "debt.stock.external"],
  service: ["debt.service.total", "debt.service.principal", "debt.service.interest"],
  rate: ["debt.rate.total", "debt.rate.domestic", "debt.rate.external"],
};

type DebtExplorerItem = {
  id: DebtSeriesId;
  family: DebtFamily;
  parentItemId: DebtSeriesId | null;
  kaLabel: string;
  enLabel: string;
  color: string;
  sortOrder: number;
};

type DebtExplorerPoint = {
  year: number;
  itemId: DebtSeriesId;
  value: number | null;
  status: ServedGovernmentDebtFact["status"];
};

export type DebtExplorerTableRow = {
  itemId: DebtSeriesId;
  parentItemId: DebtSeriesId | null;
  kaLabel: string;
  enLabel: string;
  color: string;
  valuesByYear: Record<number, number | null>;
  shareByYear?: Record<number, number | null>;
  statusByYear: Record<number, ServedGovernmentDebtFact["status"]>;
};

export type GovernmentDebtExplorerModel = {
  family: DebtFamily;
  years: number[];
  items: DebtExplorerItem[];
  expandedParentIds: DebtSeriesId[];
  selectedItems: DebtExplorerItem[];
  points: DebtExplorerPoint[];
  tableRows: DebtExplorerTableRow[];
  totalRow: DebtExplorerTableRow | null;
  forecastStartYear: number | null;
};

const DEBT_ITEMS: DebtExplorerItem[] = [
  { id: "debt.stock.total", family: "stock", parentItemId: null, kaLabel: "მთლიანი ვალი", enLabel: "Total Government Debt", color: INK, sortOrder: 1 },
  { id: "debt.stock.domestic", family: "stock", parentItemId: "debt.stock.total", kaLabel: "საშინაო ვალი", enLabel: "Domestic debt", color: "#A5822B", sortOrder: 2 },
  { id: "debt.stock.external", family: "stock", parentItemId: "debt.stock.total", kaLabel: "საგარეო ვალი", enLabel: "External debt", color: "#496F83", sortOrder: 3 },
  { id: "debt.service.total", family: "service", parentItemId: null, kaLabel: "ვალის გადახდა", enLabel: "Debt service", color: "#1F6E56", sortOrder: 4 },
  { id: "debt.service.principal", family: "service", parentItemId: "debt.service.total", kaLabel: "ძირი თანხა", enLabel: "Principal", color: "#725B8F", sortOrder: 5 },
  { id: "debt.service.interest", family: "service", parentItemId: "debt.service.total", kaLabel: "პროცენტი", enLabel: "Interest", color: "#B3402A", sortOrder: 6 },
  { id: "debt.rate.total", family: "rate", parentItemId: null, kaLabel: "საპროცენტო განაკვეთი", enLabel: "Weighted-average interest rate", color: INK, sortOrder: 7 },
  { id: "debt.rate.domestic", family: "rate", parentItemId: "debt.rate.total", kaLabel: "საშინაო განაკვეთი", enLabel: "Domestic rate", color: "#A5822B", sortOrder: 8 },
  { id: "debt.rate.external", family: "rate", parentItemId: "debt.rate.total", kaLabel: "საგარეო განაკვეთი", enLabel: "External rate", color: "#496F83", sortOrder: 9 },
];

export const DEFAULT_DEBT_FAMILY: DebtFamily = "stock";
export const DEBT_EXPANDED_PARENT_IDS: DebtSeriesId[] = [
  "debt.stock.total",
  "debt.service.total",
  "debt.rate.total",
];

const ITEM_BY_ID = new Map(DEBT_ITEMS.map((item) => [item.id, item]));

export function isDebtSeriesId(value: string): value is DebtSeriesId {
  return ITEM_BY_ID.has(value as DebtSeriesId);
}

export function familyForDebtSeries(seriesId: DebtSeriesId): DebtFamily {
  return ITEM_BY_ID.get(seriesId)!.family;
}

export function getDefaultDebtSelection(family: DebtFamily): DebtSeriesId[] {
  return [SERIES_BY_FAMILY[family][0]!];
}

export function normalizeDebtSelection(values: readonly string[], family: DebtFamily): DebtSeriesId[] {
  const seen = new Set<DebtSeriesId>();
  const result: DebtSeriesId[] = [];

  for (const value of values) {
    if (!isDebtSeriesId(value) || familyForDebtSeries(value) !== family || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

export function selectDebtSeries(current: DebtSeriesId[], next: DebtSeriesId): DebtSeriesId[] {
  const currentFamily = current.find((seriesId) => isDebtSeriesId(seriesId));
  const nextFamily = familyForDebtSeries(next);

  if (!currentFamily || familyForDebtSeries(currentFamily) !== nextFamily) return [next];

  const normalized = normalizeDebtSelection(current, nextFamily);
  return normalized.includes(next) ? normalized.filter((seriesId) => seriesId !== next) : [...normalized, next];
}

export function debtRangeForFamily(
  facts: readonly Pick<ServedGovernmentDebtFact, "family" | "year">[],
  family: DebtFamily,
): { start: number; end: number } {
  const years = facts.filter((fact) => fact.family === family).map((fact) => fact.year);
  return { start: Math.min(...years), end: Math.max(...years) };
}

function shareOfGdp(value: number | null, year: number, gdpByYear: Map<number, ServedNationalGdpFact>): number | null {
  if (value === null) return null;
  const gdp = gdpByYear.get(year)?.gdpCurrentPricesGel;
  return gdp === undefined || gdp <= 0 ? null : value / gdp;
}

function tableRowFor(
  item: DebtExplorerItem,
  factsBySeriesYear: Map<string, ServedGovernmentDebtFact>,
  years: number[],
  gdpByYear: Map<number, ServedNationalGdpFact>,
): DebtExplorerTableRow | null {
  const valuesByYear: Record<number, number | null> = {};
  const statusByYear: Record<number, ServedGovernmentDebtFact["status"]> = {};
  const shareByYear: Record<number, number | null> = {};

  for (const year of years) {
    const fact = factsBySeriesYear.get(`${item.id}:${year}`);
    if (!fact) continue;
    valuesByYear[year] = fact.value;
    statusByYear[year] = fact.status;
    if (item.family === "stock") shareByYear[year] = shareOfGdp(fact.value, year, gdpByYear);
  }

  if (Object.keys(valuesByYear).length === 0) return null;

  return {
    itemId: item.id,
    parentItemId: item.parentItemId,
    kaLabel: item.kaLabel,
    enLabel: item.enLabel,
    color: item.color,
    valuesByYear,
    ...(item.family === "stock" ? { shareByYear } : {}),
    statusByYear,
  };
}

export function buildDebtExplorerModel(input: {
  facts: ServedGovernmentDebtFact[];
  gdpFacts: ServedNationalGdpFact[];
  family: DebtFamily;
  selectedIds: DebtSeriesId[];
  range: { start: number; end: number };
  shareOfGdp: boolean;
}): GovernmentDebtExplorerModel {
  const activeFacts = input.facts.filter(
    (fact) => fact.family === input.family && fact.year >= input.range.start && fact.year <= input.range.end,
  );
  const years = Array.from(new Set(activeFacts.map((fact) => fact.year))).sort((left, right) => left - right);
  const factsBySeriesYear = new Map(activeFacts.map((fact) => [`${fact.seriesId}:${fact.year}`, fact]));
  const gdpByYear = new Map(input.gdpFacts.map((fact) => [fact.year, fact]));
  const selectedIds = normalizeDebtSelection(input.selectedIds, input.family);
  const selectedItems = DEBT_ITEMS.filter((item) => selectedIds.includes(item.id));
  const points = selectedItems.flatMap((item) =>
    years.flatMap((year) => {
      const fact = factsBySeriesYear.get(`${item.id}:${year}`);
      if (!fact) return [];
      return [{
        year,
        itemId: item.id,
        value: input.shareOfGdp && input.family === "stock" ? shareOfGdp(fact.value, year, gdpByYear) : fact.value,
        status: fact.status,
      }];
    }),
  );
  const tableRows = selectedItems
    .map((item) => tableRowFor(item, factsBySeriesYear, years, gdpByYear))
    .filter((row): row is DebtExplorerTableRow => row !== null);
  const totalItem = DEBT_ITEMS.find(
    (item) => item.family === input.family && item.parentItemId === null,
  )!;
  const totalRow = tableRowFor(totalItem, factsBySeriesYear, years, gdpByYear);
  const forecastStartYear = activeFacts
    .filter((fact) => fact.status === "projection_existing_portfolio")
    .map((fact) => fact.year)
    .sort((left, right) => left - right)[0] ?? null;

  return {
    family: input.family,
    years,
    items: DEBT_ITEMS,
    expandedParentIds: DEBT_EXPANDED_PARENT_IDS,
    selectedItems,
    points,
    tableRows,
    totalRow,
    forecastStartYear,
  };
}

import type { DebtFamily, DebtSeriesId, ClientGovernmentDebtFact } from "../servedRows";
import type { ClientNationalGdpFact } from "./clientData";
import type { Presentation } from "../i18n/types";
import { publicLabel } from "../i18n/labels";
import { INK } from "./colors";
import { formatShare } from "./format";

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
  status: ClientGovernmentDebtFact["status"];
};

export type DebtExplorerTableRow = {
  itemId: DebtSeriesId;
  parentItemId: DebtSeriesId | null;
  kaLabel: string;
  enLabel: string;
  color: string;
  valuesByYear: Record<number, number | null>;
  shareByYear?: Record<number, number | null>;
  statusByYear: Record<number, ClientGovernmentDebtFact["status"]>;
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

// English names come from the reviewed glossary (presentation.englishLabels), the one source the page shows.
const DEBT_ITEMS: Omit<DebtExplorerItem, "enLabel">[] = [
  { id: "debt.stock.total", family: "stock", parentItemId: null, kaLabel: "მთლიანი ვალი", color: INK, sortOrder: 1 },
  { id: "debt.stock.domestic", family: "stock", parentItemId: "debt.stock.total", kaLabel: "საშინაო ვალი", color: "#A5822B", sortOrder: 2 },
  { id: "debt.stock.external", family: "stock", parentItemId: "debt.stock.total", kaLabel: "საგარეო ვალი", color: "#496F83", sortOrder: 3 },
  { id: "debt.service.total", family: "service", parentItemId: null, kaLabel: "ვალის გადახდა", color: "#1F6E56", sortOrder: 4 },
  { id: "debt.service.principal", family: "service", parentItemId: "debt.service.total", kaLabel: "ძირი თანხა", color: "#725B8F", sortOrder: 5 },
  { id: "debt.service.interest", family: "service", parentItemId: "debt.service.total", kaLabel: "პროცენტი", color: "#B3402A", sortOrder: 6 },
  { id: "debt.rate.total", family: "rate", parentItemId: null, kaLabel: "საპროცენტო განაკვეთი", color: INK, sortOrder: 7 },
  { id: "debt.rate.domestic", family: "rate", parentItemId: "debt.rate.total", kaLabel: "საშინაო განაკვეთი", color: "#A5822B", sortOrder: 8 },
  { id: "debt.rate.external", family: "rate", parentItemId: "debt.rate.total", kaLabel: "საგარეო განაკვეთი", color: "#496F83", sortOrder: 9 },
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
  facts: readonly Pick<ClientGovernmentDebtFact, "family" | "year">[],
  family: DebtFamily,
): { start: number; end: number } {
  const years = facts.filter((fact) => fact.family === family).map((fact) => fact.year);
  return { start: Math.min(...years), end: Math.max(...years) };
}

// Interest rates keep the decimals the Ministry printed (DESIGN.md §11): the monthly report's
// chart labels and the 2019-2021 strategy show one ("3.1%", "8.3%"), the 2022-2025, 2023-2026
// and 2025-2029 strategy tables two ("8.21%", "9.20%"). A rate is never padded to a decimal its
// source does not print; a source missing here falls back to one.
export const DEBT_RATE_SOURCE_DECIMALS: Readonly<Record<string, 1 | 2>> = {
  mof_monthly_debt_report_2026_07: 1,
  mof_debt_strategy_2019_2021: 1,
  mof_debt_strategy_2022_2025: 2,
  mof_debt_strategy_2023_2026: 2,
  mof_debt_strategy_2025_2029: 2,
};

/** Decimals a rate from this source is shown with; takes the bare or the registry (`source.`) id. */
export function debtRateDecimals(sourceId: string | null): 1 | 2 {
  return DEBT_RATE_SOURCE_DECIMALS[(sourceId ?? "").replace(/^source\./, "")] ?? 1;
}

type RateCellFact = Pick<ClientGovernmentDebtFact, "seriesId" | "year" | "sourceId">;

/** Decimals of each rate cell, by series and year, from the source of its fact. */
export function debtRateDecimalsFor(facts: readonly RateCellFact[]): (seriesId: string, year: number) => 1 | 2 {
  const sourceByCell = new Map(facts.map((fact) => [`${fact.seriesId}:${fact.year}`, fact.sourceId]));
  return (seriesId, year) => debtRateDecimals(sourceByCell.get(`${seriesId}:${year}`) ?? null);
}

/** Formats a rate (percent, e.g. 9.2) for its series and year at its source's decimals. */
export function formatDebtRate(facts: readonly RateCellFact[]): (value: number, seriesId: string, year: number) => string {
  const decimals = debtRateDecimalsFor(facts);
  return (value, seriesId, year) => formatShare(value / 100, false, decimals(seriesId, year));
}

export type DebtDeckChange =
  | { kind: "relative"; value: number }
  | { kind: "points"; value: number };

export type DebtDeck = { year: number; value: number; change: DebtDeckChange | null };

/**
 * The deck line under the page title: the family total's latest actual year and
 * its change against the previous actual year. A projection never leads the page,
 * and an interest rate moves in percentage points rather than as a relative change
 * of a rate — the rule lib/factQuery/compare.ts applies to rate_percent.
 */
export function buildDebtDeck(facts: readonly ClientGovernmentDebtFact[], family: DebtFamily): DebtDeck | null {
  const totalId = SERIES_BY_FAMILY[family][0]!;
  const actual = facts
    .filter((fact): fact is ClientGovernmentDebtFact & { value: number } =>
      fact.seriesId === totalId && fact.status === "actual" && fact.value !== null)
    .sort((left, right) => left.year - right.year);
  const latest = actual.at(-1);
  if (!latest) return null;
  const previous = actual.find((fact) => fact.year === latest.year - 1);
  let change: DebtDeckChange | null = null;
  if (previous) {
    if (family === "rate") change = { kind: "points", value: latest.value - previous.value };
    else if (previous.value !== 0) change = { kind: "relative", value: (latest.value - previous.value) / previous.value };
  }
  return { year: latest.year, value: latest.value, change };
}

/** An amount as a share (0–1) of national GDP at current prices for its year; null without GDP. Money supply's % of GDP view reuses it. */
export function shareOfGdp(value: number | null, year: number, gdpByYear: Map<number, ClientNationalGdpFact>): number | null {
  if (value === null) return null;
  const gdp = gdpByYear.get(year)?.gdpCurrentPricesGel;
  return gdp === undefined || gdp <= 0 ? null : value / gdp;
}

function tableRowFor(
  item: DebtExplorerItem,
  factsBySeriesYear: Map<string, ClientGovernmentDebtFact>,
  years: number[],
  gdpByYear: Map<number, ClientNationalGdpFact>,
): DebtExplorerTableRow | null {
  const valuesByYear: Record<number, number | null> = {};
  const statusByYear: Record<number, ClientGovernmentDebtFact["status"]> = {};
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
  facts: ClientGovernmentDebtFact[];
  gdpFacts: ClientNationalGdpFact[];
  family: DebtFamily;
  selectedIds: DebtSeriesId[];
  range: { start: number; end: number };
  shareOfGdp: boolean;
}, presentation?: Presentation): GovernmentDebtExplorerModel {
  // Without a presentation (the workbook, which names rows itself) the English name falls back to the Georgian one.
  const items: DebtExplorerItem[] = DEBT_ITEMS.map(item => ({
    ...item,
    enLabel: presentation ? publicLabel("en", item.id, item.kaLabel, presentation.englishLabels) : item.kaLabel,
  }));
  const activeFacts = input.facts.filter(
    (fact) => fact.family === input.family && fact.year >= input.range.start && fact.year <= input.range.end,
  );
  const years = Array.from(new Set(activeFacts.map((fact) => fact.year))).sort((left, right) => left - right);
  const factsBySeriesYear = new Map(activeFacts.map((fact) => [`${fact.seriesId}:${fact.year}`, fact]));
  const gdpByYear = new Map(input.gdpFacts.map((fact) => [fact.year, fact]));
  const selectedIds = normalizeDebtSelection(input.selectedIds, input.family);
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
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
  const totalItem = items.find(
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
    items,
    expandedParentIds: DEBT_EXPANDED_PARENT_IDS,
    selectedItems,
    points,
    tableRows,
    totalRow,
    forecastStartYear,
  };
}

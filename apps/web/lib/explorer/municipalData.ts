import {
  ADJARA_REGION_ID,
  MUNICIPAL_COUNTRY_ID,
  type AdjaraBudgetAdjustment,
  type Municipality,
  type MunicipalFunction,
  type MunicipalFunctionFact,
  type MunicipalPopulationFact,
  type MunicipalTotalFact,
} from "../data/municipal/types";
import type { SourceDocumentRow } from "../data/sources";
import type { ExplorerTableRow } from "./types";
import { colorForItem, INK } from "./colors";
import { formatAmount, formatAmountParts, formatPerResidentGel, formatShare, MISSING } from "./format";
import { georgianOrdinal } from "./municipalLabels";
import { shareOfTotal } from "./share";

// Model layer for the municipalities section.
//
// It produces the SAME shapes the budget explorer's chart and table already
// consume (ExplorerTableRow, and ChartSeries built from it), so those components
// are reused untouched. It deliberately does not go through buildExplorerModel:
// that model is built around sides, groupings and a national item×year grain,
// while this one is municipality×function×year.

export const MUNICIPAL_TOTAL_ITEM_ID = "municipal.total";
export const MUNICIPAL_PER_RESIDENT_YEAR = 2025;

// Municipal budget-unit counts. 64 municipalities get a public page; five
// occupied-territory bodies (codes 05, 42, 43, 46, 64 — see
// lib/data/municipal/generateMunicipalFacts.ts) are excluded from the public
// list because their budgets are not territorially attributable spending, and
// appear only inside the Georgia total. Every Georgian string that states one
// of these numbers interpolates it from here.
export const MUNICIPAL_PUBLIC_PAGE_COUNT = 64;
export const MUNICIPAL_AGGREGATE_ONLY_COUNT = 5;
export const MUNICIPAL_COUNTRY_BUDGET_COUNT = MUNICIPAL_PUBLIC_PAGE_COUNT + MUNICIPAL_AGGREGATE_ONLY_COUNT;

export type MunicipalEntityModel = {
  years: number[];
  rows: ExplorerTableRow[];
  totalRow: ExplorerTableRow;
};

export type MunicipalEntityInput = {
  functions: MunicipalFunction[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
  startYear: number;
  endYear: number;
};

export {
  aggregateFactsForEntity,
  applyAdjaraBudgetAdjustment,
  MIXED_PUBLIC_TOTAL_MEASURE,
  MIXED_SOURCE_ID,
} from "../data/municipal/aggregateMunicipalFacts";

export function latestReviewedAtForMunicipalFacts(
  sourceDocuments: SourceDocumentRow[],
  functionFacts: MunicipalFunctionFact[],
  totalFacts: MunicipalTotalFact[],
): string {
  const referencedSourceIds = new Set([...functionFacts, ...totalFacts].map((row) => row.sourceId));

  return sourceDocuments.reduce(
    (latest, source) =>
      referencedSourceIds.has(source.sourceId) && source.lastReviewedAt > latest ? source.lastReviewedAt : latest,
    "",
  );
}

function changeBetween(start: number | null, end: number | null): number | null {
  if (start === null || end === null || start === 0) return null;
  return (end - start) / start;
}

export function buildMunicipalEntityModel(input: MunicipalEntityInput): MunicipalEntityModel {
  const { functions, functionFacts, totalFacts, startYear, endYear } = input;

  const years = Array.from(new Set(totalFacts.map((row) => row.year)))
    .filter((year) => year >= startYear && year <= endYear)
    .sort((a, b) => a - b);
  const inRange = new Set(years);

  const amounts = new Map<string, number>();
  for (const row of functionFacts) {
    if (!inRange.has(row.year)) continue;
    amounts.set(`${row.categoryId}|${row.year}`, (amounts.get(`${row.categoryId}|${row.year}`) ?? 0) + row.amountGel);
  }

  const officialTotalByYear: Record<number, number> = {};
  for (const row of totalFacts) {
    if (!inRange.has(row.year)) continue;
    officialTotalByYear[row.year] = (officialTotalByYear[row.year] ?? 0) + row.publicTotalGel;
  }

  const firstYear = years[0];
  const lastYear = years.at(-1);

  const ordered = functions.slice().sort((left, right) => left.sortOrder - right.sortOrder);

  const rows: ExplorerTableRow[] = ordered.map((fn, index) => {
    const valuesByYear: Record<number, number | null> = {};
    const basisByYear: Record<number, "actual" | "planned"> = {};

    for (const year of years) {
      const key = `${fn.id}|${year}`;
      // The dataset is dense, so a missing key means the year is genuinely
      // outside coverage — null, not zero. A served zero stays zero.
      valuesByYear[year] = amounts.has(key) ? amounts.get(key)! : null;
      basisByYear[year] = "actual";
    }

    const endValue = lastYear === undefined ? null : valuesByYear[lastYear] ?? null;

    return {
      itemId: fn.id,
      parentItemId: null,
      level: "municipal_function",
      kaLabel: fn.kaLabel,
      enLabel: "",
      color: colorForItem(fn.id, index),
      basisByYear,
      valuesByYear,
      change: changeBetween(
        firstYear === undefined ? null : valuesByYear[firstYear] ?? null,
        endValue,
      ),
    };
  });

  const totalValuesByYear: Record<number, number | null> = {};
  const totalBasisByYear: Record<number, "actual" | "planned"> = {};
  for (const year of years) {
    totalValuesByYear[year] = officialTotalByYear[year] ?? null;
    totalBasisByYear[year] = "actual";
  }

  const totalRow: ExplorerTableRow = {
    itemId: MUNICIPAL_TOTAL_ITEM_ID,
    parentItemId: null,
    level: "total",
    kaLabel: "მთლიანი ბიუჯეტი",
    enLabel: "Total",
    color: INK,
    basisByYear: totalBasisByYear,
    valuesByYear: totalValuesByYear,
    change: changeBetween(
      firstYear === undefined ? null : totalValuesByYear[firstYear] ?? null,
      lastYear === undefined ? null : totalValuesByYear[lastYear] ?? null,
    ),
  };

  return { years, rows, totalRow };
}

/** The official total is the only pristine municipal selection. */
export function getDefaultMunicipalSelection(model: MunicipalEntityModel): string[] {
  return model.years.length === 0 ? [] : [model.totalRow.itemId];
}

/**
 * A municipal row's share of the official MoF total for that year.
 *
 * One definition for the three surfaces that render a share from a model row:
 * the table column, the chart series, and the Excel workbook. Returns a
 * fraction; the chart multiplies by 100 at its own call site because its axis
 * is in percentage points.
 *
 * The two municipality route summaries share the same arithmetic but call
 * shareOfTotal directly — they hold raw facts, not model rows, so there is no
 * model for them to pass here.
 *
 * The functions do not cover the whole official total, so these shares
 * deliberately do not sum to 1 — the uncovered gap is real and stays visible.
 */
export function municipalShareValueForYear(
  model: MunicipalEntityModel,
  row: ExplorerTableRow,
  year: number,
): number | null {
  return shareOfTotal(row.valuesByYear[year], model.totalRow.valuesByYear[year]);
}

export type MunicipalListRow = {
  id: string;
  kind: "municipality" | "region" | "country";
  nameKa: string;
  subtitleKa: string;
  regionId: string | null;
  valueGel: number;
  budgetPerResidentGel: number | null;
  rank: number | null;
};

export type MunicipalListInput = {
  municipalities: Municipality[];
  regionLabels: Map<string, string>;
  totalFacts: MunicipalTotalFact[];
  populationFacts?: MunicipalPopulationFact[];
  adjaraBudgetAdjustments?: AdjaraBudgetAdjustment[];
  year: number;
};

/**
 * Index rows for both grains. Both rank on public_total_gel, the official
 * headline — the measure the index shows everywhere (the functional sum is a
 * property of an entity's own page, not of a ranking).
 */
export function buildMunicipalListRows(input: MunicipalListInput): {
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
} {
  const { municipalities, regionLabels, totalFacts, populationFacts, adjaraBudgetAdjustments = [], year } = input;

  const totalByCode = new Map<string, number>();
  for (const row of totalFacts) {
    if (row.year !== year) continue;
    if (populationFacts && totalByCode.has(row.municipalityCode)) {
      throw new Error(`Duplicate ${year} total for municipality ${row.municipalityCode}`);
    }
    totalByCode.set(row.municipalityCode, (totalByCode.get(row.municipalityCode) ?? 0) + row.publicTotalGel);
  }

  const populationByCode = new Map<string, number>();
  if (populationFacts) {
    if (year !== MUNICIPAL_PER_RESIDENT_YEAR) {
      throw new Error(`Population is only available for ${MUNICIPAL_PER_RESIDENT_YEAR}, not ${year}`);
    }
    const municipalityCodes = new Set(municipalities.map((row) => row.code));
    for (const row of populationFacts) {
      if (!municipalityCodes.has(row.municipalityCode)) {
        throw new Error(`Population has unknown municipality ${row.municipalityCode}`);
      }
      if (populationByCode.has(row.municipalityCode)) {
        throw new Error(`Duplicate population for municipality ${row.municipalityCode}`);
      }
      if (!Number.isFinite(row.populationPersons) || row.populationPersons <= 0) {
        throw new Error(`Population must be positive for municipality ${row.municipalityCode}`);
      }
      populationByCode.set(row.municipalityCode, row.populationPersons);
    }
    for (const municipality of municipalities) {
      if (!populationByCode.has(municipality.code)) {
        throw new Error(`Missing population for municipality ${municipality.code}`);
      }
      if (!totalByCode.has(municipality.code)) {
        throw new Error(`Missing ${year} total for municipality ${municipality.code}`);
      }
    }
  }

  const municipalityRows = municipalities
    .map((municipality) => ({
      id: municipality.code,
      kind: "municipality" as const,
      nameKa: municipality.displayNameKa,
      subtitleKa: regionLabels.get(municipality.regionId) ?? "",
      regionId: municipality.regionId,
      valueGel: totalByCode.get(municipality.code) ?? 0,
      budgetPerResidentGel: populationFacts
        ? (totalByCode.get(municipality.code) ?? 0) / populationByCode.get(municipality.code)!
        : null,
      rank: 0,
    }))
    .sort((left, right) => right.valueGel - left.valueGel)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const byRegion = new Map<string, { valueGel: number; populationPersons: number; members: number }>();
  for (const municipality of municipalities) {
    const bucket = byRegion.get(municipality.regionId) ?? { valueGel: 0, populationPersons: 0, members: 0 };
    bucket.valueGel += totalByCode.get(municipality.code) ?? 0;
    bucket.populationPersons += populationByCode.get(municipality.code) ?? 0;
    bucket.members += 1;
    byRegion.set(municipality.regionId, bucket);
  }

  const adjaraAdjustment = adjaraBudgetAdjustments.find((row) => row.year === year);
  const adjaraBucket = byRegion.get(ADJARA_REGION_ID);
  if (adjaraAdjustment && adjaraBucket) {
    adjaraBucket.valueGel =
      (Math.round(adjaraBucket.valueGel * 100) +
        Math.round(adjaraAdjustment.netRepublicPaymentsGel * 100)) /
      100;
  }

  const regionRows = Array.from(byRegion.entries())
    .map(([regionId, bucket]) => ({
      id: regionId,
      kind: "region" as const,
      nameKa: regionLabels.get(regionId) ?? regionId,
      subtitleKa: `${bucket.members} მუნიციპალიტეტი`,
      regionId,
      valueGel: bucket.valueGel,
      budgetPerResidentGel: populationFacts ? bucket.valueGel / bucket.populationPersons : null,
      rank: 0,
    }))
    .sort((left, right) => right.valueGel - left.valueGel)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return { municipalities: municipalityRows, regions: regionRows };
}

export function buildCountryListRow(totalFacts: MunicipalTotalFact[], year: number): MunicipalListRow {
  const totalByYear = buildCountryTotalByYear(totalFacts);

  return {
    id: MUNICIPAL_COUNTRY_ID,
    kind: "country",
    nameKa: "საქართველო",
    subtitleKa: `${MUNICIPAL_COUNTRY_BUDGET_COUNT} მუნიციპალური ბიუჯეტი`,
    regionId: null,
    valueGel: totalByYear[year] ?? 0,
    budgetPerResidentGel: null,
    rank: null,
  };
}

export function buildMedianMunicipalBudgetPerResident(rows: MunicipalListRow[]): number | null {
  const values = rows
    .map((row) => row.budgetPerResidentGel)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1
    ? values[middle]!
    : (values[middle - 1]! + values[middle]!) / 2;
}

/** Narrow the corpus to one region's members, for a region page. */
export function regionFactsFor(
  regionId: string,
  municipalities: Municipality[],
  functionFacts: MunicipalFunctionFact[],
  totalFacts: MunicipalTotalFact[],
): { functionFacts: MunicipalFunctionFact[]; totalFacts: MunicipalTotalFact[]; memberCodes: string[] } {
  const memberCodes = municipalities.filter((row) => row.regionId === regionId).map((row) => row.code);
  const members = new Set(memberCodes);

  return {
    memberCodes,
    functionFacts: functionFacts.filter((row) => members.has(row.municipalityCode)),
    totalFacts: totalFacts.filter((row) => members.has(row.municipalityCode)),
  };
}

export type MunicipalKpi = { label: string; value: string; unit?: string; detail: string };

export type MunicipalIndexKpiInput = {
  municipalities: Municipality[];
  totalFacts: MunicipalTotalFact[];
  populationFacts: MunicipalPopulationFact[];
  countryTotalFacts: MunicipalTotalFact[];
  countryFunctionFacts: MunicipalFunctionFact[];
  functions: MunicipalFunction[];
  firstYear: number;
  comparisonYear: number;
  latestYear: number;
};

export function buildCountryTotalByYear(totalFacts: MunicipalTotalFact[]): Record<number, number> {
  const totals: Record<number, number> = {};
  for (const row of totalFacts) {
    if (totals[row.year] !== undefined) {
      throw new Error(`Duplicate country total for year ${row.year}`);
    }
    totals[row.year] = row.publicTotalGel;
  }
  return totals;
}

/**
 * The four index KPIs. The third uses the reviewed 2025 population panel.
 */
export function buildIndexKpis(input: MunicipalIndexKpiInput): MunicipalKpi[] {
  const { municipalities, totalFacts, populationFacts, countryTotalFacts, countryFunctionFacts, functions, firstYear, comparisonYear, latestYear } = input;
  const countryTotalByYear = buildCountryTotalByYear(countryTotalFacts);

  const latestTotal = countryTotalByYear[latestYear] ?? 0;
  const firstTotal = countryTotalByYear[firstYear] ?? 0;
  const growth = firstTotal === 0 ? null : (latestTotal - firstTotal) / firstTotal;

  const municipalRows = buildMunicipalListRows({
    municipalities,
    regionLabels: new Map(),
    totalFacts,
    populationFacts,
    year: comparisonYear,
  }).municipalities;
  const medianPerResident = buildMedianMunicipalBudgetPerResident(municipalRows);

  const byFunction = new Map<string, number>();
  for (const row of countryFunctionFacts) {
    if (row.year !== latestYear) continue;
    byFunction.set(row.categoryId, (byFunction.get(row.categoryId) ?? 0) + row.amountGel);
  }
  const topFunction = Array.from(byFunction.entries()).sort((left, right) => right[1] - left[1])[0];
  const topFunctionLabel = functions.find((fn) => fn.id === topFunction?.[0])?.kaLabel ?? "";

  return [
    {
      label: "მუნიციპალური ხარჯი",
      value: formatAmount(latestTotal),
      detail: `${latestYear} · ${MUNICIPAL_COUNTRY_BUDGET_COUNT} მუნიციპალური საბიუჯეტო ერთეული`,
    },
    {
      label: `ზრდა ${firstYear}-დან`,
      value: growth === null ? MISSING : formatShare(growth, true, 0),
      detail: `${formatAmount(firstTotal)} → ${formatAmount(latestTotal)}`,
    },
    {
      label: "მედიანური ბიუჯეტი ერთ მოსახლეზე",
      value: formatPerResidentGel(medianPerResident),
      detail: `${comparisonYear} · ${municipalities.length} მუნიციპალიტეტი`,
    },
    {
      label: "უმსხვილესი სფერო",
      value: latestTotal > 0 && topFunction ? formatShare(topFunction[1] / latestTotal) : MISSING,
      detail: topFunctionLabel,
    },
  ];
}

export type MunicipalMover = { rank: number; kaLabel: string; growth: number | null; color: string };

export type MunicipalComparisonRow = {
  kaLabel: string;
  color: string;
  isTotal: boolean;
  fromGel: number | null;
  toGel: number | null;
  changeShare: number | null;
  changeGel: number | null;
};

export type MunicipalEntityKpiInput = {
  model: MunicipalEntityModel;
  /** Sum of every served municipality's public total, keyed by year. */
  nationalTotalByYear: Record<number, number>;
  rankByYear: Record<number, number>;
  rankOutOf: number;
};

export type MunicipalIndicatorPresentationMetrics =
  | { kind: "ranked"; nationalTotalByYear: Record<number, number> }
  | { kind: "country"; budgetCount: number };

export type MunicipalIndicatorPresentation = {
  headline: { start: number | null; end: number | null; change: number | null; cagr: number | null };
  sideSeries: Array<Array<number | null>>;
};

/**
 * Rows ordered by end-year value, descending, missing/undefined treated as 0.
 * Shared by `buildEntityKpis` (finding the largest row) and
 * `buildComparisonRows` (ordering the period-comparison table) so the two
 * never drift apart. `.slice()` so the caller's array is never mutated.
 */
function sortedByEndYear(rows: ExplorerTableRow[], endYear: number | undefined): ExplorerTableRow[] {
  return rows
    .slice()
    .sort(
      (left, right) =>
        (endYear === undefined ? 0 : right.valuesByYear[endYear] ?? 0) -
        (endYear === undefined ? 0 : left.valuesByYear[endYear] ?? 0),
    );
}

/** Raw values for the municipal indicators' headline and three side trends. */
export function buildMunicipalIndicatorPresentation(
  model: MunicipalEntityModel,
  metrics: MunicipalIndicatorPresentationMetrics,
): MunicipalIndicatorPresentation {
  const startYear = model.years[0];
  const endYear = model.years.at(-1);
  const start = startYear === undefined ? null : model.totalRow.valuesByYear[startYear] ?? null;
  const end = endYear === undefined ? null : model.totalRow.valuesByYear[endYear] ?? null;
  const largest = sortedByEndYear(model.rows, endYear)[0];
  const largestShare = model.years.map((year) => {
    const value = largest?.valuesByYear[year] ?? null;
    const total = model.totalRow.valuesByYear[year] ?? null;
    return value === null || total === null || total <= 0 ? null : value / total;
  });
  const thirdSeries =
    metrics.kind === "country"
      ? model.years.map(() => metrics.budgetCount)
      : model.years.map((year) => {
          const total = model.totalRow.valuesByYear[year] ?? null;
          const nationalTotal = metrics.nationalTotalByYear[year] ?? null;
          return total === null || nationalTotal === null || nationalTotal <= 0 ? null : total / nationalTotal;
        });

  return {
    headline: {
      start,
      end,
      change: changeBetween(start, end),
      cagr: start !== null && end !== null && start > 0 && end > 0 && endYear !== undefined && startYear !== undefined && endYear > startYear
        ? (end / start) ** (1 / (endYear - startYear)) - 1
        : null,
    },
    sideSeries: [model.years.map((year) => model.totalRow.valuesByYear[year] ?? null), largestShare, thirdSeries],
  };
}

export type MunicipalKpiSet = {
  official: MunicipalKpi;
  growth: MunicipalKpi;
  largestField: MunicipalKpi;
  standing: MunicipalKpi;
};

/**
 * The three cards every municipal view shares. Only the fourth — standing —
 * differs: entity pages show rank, the country page shows the budget count.
 */
function buildSharedMunicipalKpis(model: MunicipalEntityModel): Omit<MunicipalKpiSet, "standing"> {
  const startYear = model.years[0];
  const endYear = model.years.at(-1);
  const officialStart = startYear === undefined ? null : model.totalRow.valuesByYear[startYear] ?? null;
  const officialEnd = endYear === undefined ? null : model.totalRow.valuesByYear[endYear] ?? null;
  const officialEndParts = formatAmountParts(officialEnd);
  const growth = changeBetween(officialStart, officialEnd);
  const largest = sortedByEndYear(model.rows, endYear)[0];
  const largestValue = largest && endYear !== undefined ? largest.valuesByYear[endYear] ?? 0 : 0;

  return {
    official: {
      label: "ოფიციალური ბიუჯეტი",
      value: officialEndParts.num,
      unit: officialEndParts.unit,
      detail: `${endYear ?? ""} · ფინანსთა სამინისტროს ჯამი`,
    },
    growth: {
      label: `ზრდა ${startYear ?? ""}-დან`,
      // MISSING and the U+2212 minus come from format.ts — never hand-write
      // either (Global Constraints). formatShare's third argument is the
      // decimal count, so a 0-decimal signed percent does not have to build its
      // own sign. Zero growth renders "0%", not "+0%".
      value: growth === null ? MISSING : formatShare(growth, true, 0),
      detail: `${formatAmount(officialStart)} → ${formatAmount(officialEnd)}`,
    },
    largestField: {
      label: "უმსხვილესი სფერო",
      value: officialEnd ? formatShare(largestValue / officialEnd) : MISSING,
      detail: largest?.kaLabel ?? "",
    },
  };
}

/** The four entity KPIs, for both municipality and region pages. */
export function buildEntityKpis(input: MunicipalEntityKpiInput): MunicipalKpiSet {
  const { model, nationalTotalByYear } = input;
  const endYear = model.years.at(-1);
  const officialEnd = endYear === undefined ? null : model.totalRow.valuesByYear[endYear] ?? null;
  const nationalEnd = endYear === undefined ? 0 : nationalTotalByYear[endYear] ?? 0;
  const rank = endYear === undefined ? 0 : input.rankByYear[endYear] ?? 0;

  return {
    ...buildSharedMunicipalKpis(model),
    standing: {
      label: "წილი მუნიციპალურ ხარჯებში",
      value: nationalEnd > 0 && officialEnd !== null ? formatShare(officialEnd / nationalEnd) : MISSING,
      // `detail` is this municipality's ordinal rank for the selected period.
      // The index has a separate fixed-2025 per-resident comparison, so this
      // selected-range KPI remains rank rather than implying population
      // coverage across every year in the range.
      detail: `${georgianOrdinal(rank)} ადგილი ${input.rankOutOf}-დან`,
    },
  };
}

/** The country view has no rank because it is the aggregate denominator itself. */
export function buildCountryKpis(model: MunicipalEntityModel, budgetCount: number): MunicipalKpiSet {
  return {
    ...buildSharedMunicipalKpis(model),
    standing: {
      label: "მუნიციპალური ბიუჯეტები",
      value: String(budgetCount),
      detail: `${MUNICIPAL_PUBLIC_PAGE_COUNT} საჯარო გვერდი · ${MUNICIPAL_AGGREGATE_ONLY_COUNT} მხოლოდ საქართველოს ჯამში`,
    },
  };
}

/**
 * Growth board (DESIGN.md §7.13). The bottom column is ყველაზე ნელი ზრდა even
 * when a row is shrinking — never call growth a loss.
 */
export function buildMovers(model: MunicipalEntityModel): { up: MunicipalMover[]; down: MunicipalMover[] } {
  const startYear = model.years[0];
  const endYear = model.years.at(-1);

  const growth = model.rows
    .map((row) => ({
      kaLabel: row.kaLabel,
      color: row.color,
      growth: changeBetween(
        startYear === undefined ? null : row.valuesByYear[startYear] ?? null,
        endYear === undefined ? null : row.valuesByYear[endYear] ?? null,
      ),
    }))
    .filter((row) => row.growth !== null)
    .sort((left, right) => (right.growth ?? -Infinity) - (left.growth ?? -Infinity));

  const rank = (rows: typeof growth) => rows.map((row, index) => ({ ...row, rank: index + 1 }));

  return { up: rank(growth.slice(0, 3)), down: rank(growth.slice(-3).reverse()) };
}

/** პერიოდის შედარება: the total, then every function by end-year size. */
export function buildComparisonRows(model: MunicipalEntityModel): MunicipalComparisonRow[] {
  const startYear = model.years[0];
  const endYear = model.years.at(-1);

  const rowFor = (source: ExplorerTableRow, isTotal: boolean): MunicipalComparisonRow => {
    const fromGel = startYear === undefined ? null : source.valuesByYear[startYear] ?? null;
    const toGel = endYear === undefined ? null : source.valuesByYear[endYear] ?? null;

    return {
      kaLabel: source.kaLabel,
      color: source.color,
      isTotal,
      fromGel,
      toGel,
      changeShare: changeBetween(fromGel, toGel),
      changeGel: fromGel === null || toGel === null ? null : toGel - fromGel,
    };
  };

  const functions = sortedByEndYear(model.rows, endYear).map((row) => rowFor(row, false));

  return [rowFor(model.totalRow, true), ...functions];
}

export type EntityPickerGroupModel = {
  regionId: string;
  nameKa: string;
  valueGel: number;
  members: Array<{ code: string; nameKa: string; valueGel: number }>;
};

/** Picker groups: regions in value order, each with its members in value order. */
export function buildPickerGroups(input: MunicipalListInput): EntityPickerGroupModel[] {
  const { municipalities, regions } = buildMunicipalListRows(input);
  const membersByRegion = new Map<string, Array<{ code: string; nameKa: string; valueGel: number }>>();

  for (const row of municipalities) {
    if (row.regionId === null) continue;
    const bucket = membersByRegion.get(row.regionId) ?? [];
    bucket.push({ code: row.id, nameKa: row.nameKa, valueGel: row.valueGel });
    membersByRegion.set(row.regionId, bucket);
  }

  return regions.map((region) => ({
    regionId: region.id,
    nameKa: region.nameKa,
    valueGel: region.valueGel,
    members: membersByRegion.get(region.id) ?? [],
  }));
}

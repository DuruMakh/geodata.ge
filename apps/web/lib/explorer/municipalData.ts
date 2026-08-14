import {
  MUNICIPAL_COUNTRY_ID,
  type Municipality,
  type MunicipalFunction,
  type MunicipalFunctionFact,
  type MunicipalTotalFact,
} from "../data/municipal/types";
import type { SourceDocumentRow } from "../data/sources";
import { MIXED_SOURCE_ID } from "../data/municipal/aggregateMunicipalFacts";
import type { ExplorerTableRow, SourceMetadata } from "./types";
import { colorForItem, INK } from "./colors";
import { formatAmount, formatShare, MISSING } from "./format";
import { georgianOrdinal } from "./municipalLabels";

// Model layer for the municipalities section.
//
// It produces the SAME shapes the budget explorer's chart and table already
// consume (ExplorerTableRow, and ChartSeries built from it), so those components
// are reused untouched. It deliberately does not go through buildExplorerModel:
// that model is built around sides, groupings and a national item×year grain,
// while this one is municipality×function×year.

export const MUNICIPAL_TOTAL_ITEM_ID = "municipal.total";

export type MunicipalEntityModel = {
  years: number[];
  rows: ExplorerTableRow[];
  totalRow: ExplorerTableRow;
};

export type MunicipalEntityInput = {
  functions: MunicipalFunction[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
  sourceDocuments: SourceDocumentRow[];
  startYear: number;
  endYear: number;
};

/**
 * Carry a string field through only when every constituent agrees; otherwise
 * collapse to `mixedMarker` so no single constituent's value can be mistaken
 * for the group's. Idempotent across a fold: once a group is marked mixed,
 * `current` is the marker itself, which never equals a real incoming value,
 * so it stays mixed.
 */
function agreeOrMixed(current: string, incoming: string, mixedMarker: string): string {
  return current === incoming ? current : mixedMarker;
}

export { aggregateFactsForEntity, MIXED_PUBLIC_TOTAL_MEASURE, MIXED_SOURCE_ID } from "../data/municipal/aggregateMunicipalFacts";

function sourceMetadataFor(sourceId: string, sources: Map<string, SourceDocumentRow>): SourceMetadata {
  const source = sources.get(sourceId);
  return {
    sourceName: source?.sourceName ?? "",
    sourceUrlOrFile: source?.sourceUrlOrFile ?? "",
    lastReviewedAt: source?.lastReviewedAt ?? "",
  };
}

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
  const { functions, functionFacts, totalFacts, sourceDocuments, startYear, endYear } = input;

  const sources = new Map(sourceDocuments.map((source) => [source.sourceId, source]));
  const years = Array.from(new Set(totalFacts.map((row) => row.year)))
    .filter((year) => year >= startYear && year <= endYear)
    .sort((a, b) => a - b);
  const inRange = new Set(years);

  const amounts = new Map<string, number>();
  const sourceIds = new Map<string, string>();
  for (const row of functionFacts) {
    if (!inRange.has(row.year)) continue;
    const key = `${row.categoryId}|${row.year}`;
    amounts.set(key, (amounts.get(key) ?? 0) + row.amountGel);
    sourceIds.set(key, row.sourceId);
  }

  const officialTotalByYear: Record<number, number> = {};
  const officialSourceIdByYear = new Map<number, string>();
  for (const row of totalFacts) {
    if (!inRange.has(row.year)) continue;
    officialTotalByYear[row.year] = (officialTotalByYear[row.year] ?? 0) + row.publicTotalGel;
    const currentSourceId = officialSourceIdByYear.get(row.year);
    officialSourceIdByYear.set(
      row.year,
      currentSourceId === undefined ? row.sourceId : agreeOrMixed(currentSourceId, row.sourceId, MIXED_SOURCE_ID),
    );
  }

  const firstYear = years[0];
  const lastYear = years.at(-1);

  const ordered = functions.slice().sort((left, right) => left.sortOrder - right.sortOrder);

  const rows: ExplorerTableRow[] = ordered.map((fn, index) => {
    const valuesByYear: Record<number, number | null> = {};
    const basisByYear: Record<number, "actual" | "planned"> = {};
    const sourceByYear: Record<number, SourceMetadata> = {};

    for (const year of years) {
      const key = `${fn.id}|${year}`;
      // The dataset is dense, so a missing key means the year is genuinely
      // outside coverage — null, not zero. A served zero stays zero.
      valuesByYear[year] = amounts.has(key) ? amounts.get(key)! : null;
      basisByYear[year] = "actual";
      sourceByYear[year] = sourceMetadataFor(sourceIds.get(key) ?? "", sources);
    }

    const endValue = lastYear === undefined ? null : valuesByYear[lastYear] ?? null;
    const endTotal = lastYear === undefined ? null : officialTotalByYear[lastYear] ?? null;

    return {
      itemId: fn.id,
      parentItemId: null,
      level: "municipal_function",
      detailLabel: null,
      kaLabel: fn.kaLabel,
      enLabel: "",
      color: colorForItem(fn.id, index),
      basisByYear,
      sourceByYear,
      valuesByYear,
      change: changeBetween(
        firstYear === undefined ? null : valuesByYear[firstYear] ?? null,
        endValue,
      ),
      shareEndYear: endValue !== null && endTotal ? endValue / endTotal : null,
    };
  });

  const totalValuesByYear: Record<number, number | null> = {};
  const totalBasisByYear: Record<number, "actual" | "planned"> = {};
  const totalSourceByYear: Record<number, SourceMetadata> = {};
  for (const year of years) {
    totalValuesByYear[year] = officialTotalByYear[year] ?? null;
    totalBasisByYear[year] = "actual";
    totalSourceByYear[year] = sourceMetadataFor(officialSourceIdByYear.get(year) ?? "", sources);
  }

  const totalRow: ExplorerTableRow = {
    itemId: MUNICIPAL_TOTAL_ITEM_ID,
    parentItemId: null,
    level: "total",
    detailLabel: null,
    kaLabel: "მთლიანი ბიუჯეტი",
    enLabel: "Total",
    color: INK,
    basisByYear: totalBasisByYear,
    sourceByYear: totalSourceByYear,
    valuesByYear: totalValuesByYear,
    change: changeBetween(
      firstYear === undefined ? null : totalValuesByYear[firstYear] ?? null,
      lastYear === undefined ? null : totalValuesByYear[lastYear] ?? null,
    ),
    shareEndYear: 1,
  };

  return { years, rows, totalRow };
}

/** The official total is the only pristine municipal selection. */
export function getDefaultMunicipalSelection(model: MunicipalEntityModel): string[] {
  return model.years.length === 0 ? [] : [model.totalRow.itemId];
}

export type MunicipalListRow = {
  id: string;
  kind: "municipality" | "region" | "country";
  nameKa: string;
  subtitleKa: string;
  regionId: string | null;
  valueGel: number;
  rank: number | null;
};

export type MunicipalListInput = {
  municipalities: Municipality[];
  regionLabels: Map<string, string>;
  totalFacts: MunicipalTotalFact[];
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
  const { municipalities, regionLabels, totalFacts, year } = input;

  const totalByCode = new Map<string, number>();
  for (const row of totalFacts) {
    if (row.year !== year) continue;
    totalByCode.set(row.municipalityCode, (totalByCode.get(row.municipalityCode) ?? 0) + row.publicTotalGel);
  }

  const municipalityRows = municipalities
    .map((municipality) => ({
      id: municipality.code,
      kind: "municipality" as const,
      nameKa: municipality.displayNameKa,
      subtitleKa: regionLabels.get(municipality.regionId) ?? "",
      regionId: municipality.regionId,
      valueGel: totalByCode.get(municipality.code) ?? 0,
      rank: 0,
    }))
    .sort((left, right) => right.valueGel - left.valueGel)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const byRegion = new Map<string, { valueGel: number; members: number }>();
  for (const municipality of municipalities) {
    const bucket = byRegion.get(municipality.regionId) ?? { valueGel: 0, members: 0 };
    bucket.valueGel += totalByCode.get(municipality.code) ?? 0;
    bucket.members += 1;
    byRegion.set(municipality.regionId, bucket);
  }

  const regionRows = Array.from(byRegion.entries())
    .map(([regionId, bucket]) => ({
      id: regionId,
      kind: "region" as const,
      nameKa: regionLabels.get(regionId) ?? regionId,
      subtitleKa: `${bucket.members} მუნიციპალიტეტი`,
      regionId,
      valueGel: bucket.valueGel,
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
    subtitleKa: "69 მუნიციპალური ბიუჯეტი",
    regionId: null,
    valueGel: totalByYear[year] ?? 0,
    rank: null,
  };
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

export type MunicipalKpi = { label: string; value: string; detail: string };

export type MunicipalIndexKpiInput = {
  municipalities: Municipality[];
  totalFacts: MunicipalTotalFact[];
  functionFacts: MunicipalFunctionFact[];
  countryTotalFacts: MunicipalTotalFact[];
  countryFunctionFacts: MunicipalFunctionFact[];
  functions: MunicipalFunction[];
  firstYear: number;
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
 * The four index KPIs. Per-capita is not available (no reviewed population
 * dataset), so the third is concentration and the fourth is composition —
 * both size-independent and both derivable from served facts.
 */
export function buildIndexKpis(input: MunicipalIndexKpiInput): MunicipalKpi[] {
  const { municipalities, totalFacts, countryTotalFacts, countryFunctionFacts, functions, firstYear, latestYear } = input;
  const countryTotalByYear = buildCountryTotalByYear(countryTotalFacts);

  const latestTotal = countryTotalByYear[latestYear] ?? 0;
  const firstTotal = countryTotalByYear[firstYear] ?? 0;
  const growth = firstTotal === 0 ? null : (latestTotal - firstTotal) / firstTotal;

  const largest = municipalities
    .map((municipality) => ({
      nameKa: municipality.displayNameKa,
      valueGel: totalFacts
        .filter((row) => row.year === latestYear && row.municipalityCode === municipality.code)
        .reduce((sum, row) => sum + row.publicTotalGel, 0),
    }))
    .sort((left, right) => right.valueGel - left.valueGel)[0];
  const concentration = largest && latestTotal > 0 ? largest.valueGel / latestTotal : null;

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
      detail: `${latestYear} · ${municipalities.length} მუნიციპალიტეტი`,
    },
    {
      label: `ზრდა ${firstYear}-დან`,
      value: growth === null ? MISSING : formatShare(growth, true, 0),
      detail: `${formatAmount(firstTotal)} → ${formatAmount(latestTotal)}`,
    },
    {
      label: largest ? `${largest.nameKa}ს წილი` : "კონცენტრაცია",
      value: formatShare(concentration),
      detail:
        concentration === null
          ? ""
          : `დანარჩენი ${municipalities.length - 1} ერთეული — ${formatShare(1 - concentration)}`,
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

/** The four entity KPIs, for both municipality and region pages. */
export function buildEntityKpis(input: MunicipalEntityKpiInput): MunicipalKpi[] {
  const { model, nationalTotalByYear } = input;
  const startYear = model.years[0];
  const endYear = model.years.at(-1);

  const officialStart = startYear === undefined ? null : model.totalRow.valuesByYear[startYear] ?? null;
  const officialEnd = endYear === undefined ? null : model.totalRow.valuesByYear[endYear] ?? null;
  const nationalEnd = endYear === undefined ? 0 : nationalTotalByYear[endYear] ?? 0;
  const growth = changeBetween(officialStart, officialEnd);
  const rank = endYear === undefined ? 0 : input.rankByYear[endYear] ?? 0;

  const largest = sortedByEndYear(model.rows, endYear)[0];
  const largestValue = largest && endYear !== undefined ? largest.valuesByYear[endYear] ?? 0 : 0;

  return [
    {
      label: "ოფიციალური ბიუჯეტი",
      value: formatAmount(officialEnd),
      detail: `${endYear ?? ""} · ფინანსთა სამინისტროს ჯამი`,
    },
    {
      label: `ზრდა ${startYear ?? ""}-დან`,
      // MISSING and the U+2212 minus come from format.ts — never hand-write
      // either (Global Constraints). formatShare's third argument is the
      // decimal count; Task 6 added it so a 0-decimal signed percent does not
      // have to build its own sign. Zero growth renders "0%", not "+0%".
      value: growth === null ? MISSING : formatShare(growth, true, 0),
      detail: `${formatAmount(officialStart)} → ${formatAmount(officialEnd)}`,
    },
    {
      label: "უმსხვილესი სფერო",
      value: officialEnd ? formatShare(largestValue / officialEnd) : MISSING,
      detail: largest?.kaLabel ?? "",
    },
    {
      label: "წილი მუნიციპალურ ხარჯებში",
      value: nationalEnd > 0 && officialEnd !== null ? formatShare(officialEnd / nationalEnd) : MISSING,
      // `detail` is this municipality's ordinal RANK among all municipalities —
      // not a per-capita figure. It stands in for the per-capita KPI the
      // reference design used (§6.4): rank is size-independent without needing
      // the population data this project does not have. Per-capita is an
      // explicit v1 exclusion; do not reintroduce it here.
      detail: `${georgianOrdinal(rank)} ადგილი ${input.rankOutOf}-დან`,
    },
  ];
}

/** The country view has no rank because it is the aggregate denominator itself. */
export function buildCountryKpis(model: MunicipalEntityModel, budgetCount: number): MunicipalKpi[] {
  const startYear = model.years[0];
  const endYear = model.years.at(-1);
  const officialStart = startYear === undefined ? null : model.totalRow.valuesByYear[startYear] ?? null;
  const officialEnd = endYear === undefined ? null : model.totalRow.valuesByYear[endYear] ?? null;
  const growth = changeBetween(officialStart, officialEnd);
  const largest = sortedByEndYear(model.rows, endYear)[0];
  const largestValue = largest && endYear !== undefined ? largest.valuesByYear[endYear] ?? 0 : 0;

  return [
    {
      label: "ოფიციალური ბიუჯეტი",
      value: formatAmount(officialEnd),
      detail: `${endYear ?? ""} · ფინანსთა სამინისტროს ჯამი`,
    },
    {
      label: `ზრდა ${startYear ?? ""}-დან`,
      value: growth === null ? MISSING : formatShare(growth, true, 0),
      detail: `${formatAmount(officialStart)} → ${formatAmount(officialEnd)}`,
    },
    {
      label: "უმსხვილესი სფერო",
      value: officialEnd ? formatShare(largestValue / officialEnd) : MISSING,
      detail: largest?.kaLabel ?? "",
    },
    {
      label: "მუნიციპალური ბიუჯეტები",
      value: String(budgetCount),
      detail: "64 საჯარო გვერდი · 5 მხოლოდ საქართველოს ჯამში",
    },
  ];
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

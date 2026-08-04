import type {
  Municipality,
  MunicipalFunction,
  MunicipalFunctionFact,
  MunicipalTotalFact,
  MunicipalWarningType,
} from "../data/municipal/types";
import type { SourceDocumentRow } from "../data/sources";
import type { ExplorerTableRow, SourceMetadata } from "./types";
import { MAX_CHART_SERIES } from "./types";
import { colorForItem, INK } from "./colors";
import { formatAmount, formatShare, MISSING } from "./format";

// Model layer for the municipalities section.
//
// It produces the SAME shapes the budget explorer's chart and table already
// consume (ExplorerTableRow, and ChartSeries built from it), so those components
// are reused untouched. It deliberately does not go through buildExplorerModel:
// that model is built around sides, groupings and a national item×year grain,
// while this one is municipality×function×year with two separate totals.

export const MUNICIPAL_TOTAL_ITEM_ID = "municipal.total";

export type MunicipalWarning = {
  year: number;
  type: MunicipalWarningType;
  amountGel: number | null;
};

export type MunicipalEntityModel = {
  years: number[];
  rows: ExplorerTableRow[];
  totalRow: ExplorerTableRow;
  /**
   * public_total_gel by year — the official MoF headline. Kept apart from
   * totalRow (the sum of the ten served functions) because they are different
   * measures and must never be reconciled by adjusting a category.
   */
  officialTotalByYear: Record<number, number>;
  warnings: MunicipalWarning[];
};

export type MunicipalEntityInput = {
  functions: MunicipalFunction[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
  sourceDocuments: SourceDocumentRow[];
  startYear: number;
  endYear: number;
};

// Sentinels for a group field that disagrees across the municipalities being
// rolled up. Real ids/measures never contain a colon (source ids are
// "source.snake_case", measures are bare "snake_case" — checked against the
// full served 2015-2025 dataset), so a "mixed:" prefix cannot collide with a
// real value and cannot be mistaken for one downstream.
export const MIXED_SOURCE_ID = "mixed:source_id";
export const MIXED_PUBLIC_TOTAL_MEASURE = "mixed:public_total_measure";

/**
 * Sum two nullable component fields. A missing constituent makes the whole
 * group null rather than being silently counted as zero.
 */
function sumNullable(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}

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

/**
 * Collapse many municipalities' facts into one entity's, for a region roll-up.
 * Called on the SERVER so a region page ships ~110 function rows like a
 * municipality page does, rather than up to twelve times that.
 *
 * What an aggregated row carries, and how, so a later caller never reaches
 * for a field by reflex and gets one arbitrary constituent's value back:
 * - `amountGel`, `publicTotalGel`, `functionalSumGel`: summed. The two
 *   totals are summed independently — never reconcile one against the other.
 * - `totalPaymentsGel`, `expensesGel`, `nonfinancialAssetGrowthGel`,
 *   `financialAssetGrowthGel`, `liabilityDecreaseGel`, and
 *   `reconciliationDifferenceGel`: summed only when every constituent has a
 *   value; if any constituent is null (e.g. a municipality on the
 *   functional-total fallback measure, which has no payment breakdown), the
 *   group's value is null rather than a sum that treats the gap as zero.
 * - `publicTotalMeasure` and `sourceId` (on both fact types): carried
 *   through only when every constituent agrees; otherwise replaced with a
 *   `mixed:` marker (`MIXED_PUBLIC_TOTAL_MEASURE` / `MIXED_SOURCE_ID`) so a
 *   caller can never read one arbitrary constituent's value as the group's.
 *   `sourceMetadataFor` does not recognise the marker and falls back to
 *   blank source fields — blank, not silently wrong.
 * - `functionalCode` and `basis` on function facts are carried from
 *   whichever row lands first: safe, because `functionalCode` is a 1:1
 *   property of `categoryId` (part of the group key) and `basis` is always
 *   the literal `"actual"` — neither can vary within a group.
 * - `showWarning` / `warningType` / `warningAmountGel` are always reset, not
 *   aggregated: a roll-up's warning state describes one municipality's
 *   reconciliation, not the group's, and region pages suppress the callout
 *   anyway (see the UI spec §8.2).
 */
export function aggregateFactsForEntity(
  entityId: string,
  functionFacts: MunicipalFunctionFact[],
  totalFacts: MunicipalTotalFact[],
): { functionFacts: MunicipalFunctionFact[]; totalFacts: MunicipalTotalFact[] } {
  const functionByKey = new Map<string, MunicipalFunctionFact>();
  for (const row of functionFacts) {
    const key = `${row.year}|${row.categoryId}`;
    const existing = functionByKey.get(key);
    if (existing) {
      existing.amountGel += row.amountGel;
      existing.sourceId = agreeOrMixed(existing.sourceId, row.sourceId, MIXED_SOURCE_ID);
      continue;
    }
    functionByKey.set(key, { ...row, municipalityCode: entityId });
  }

  const totalByYear = new Map<number, MunicipalTotalFact>();
  for (const row of totalFacts) {
    const existing = totalByYear.get(row.year);
    if (existing) {
      existing.publicTotalGel += row.publicTotalGel;
      existing.functionalSumGel += row.functionalSumGel;
      existing.totalPaymentsGel = sumNullable(existing.totalPaymentsGel, row.totalPaymentsGel);
      existing.expensesGel = sumNullable(existing.expensesGel, row.expensesGel);
      existing.nonfinancialAssetGrowthGel = sumNullable(existing.nonfinancialAssetGrowthGel, row.nonfinancialAssetGrowthGel);
      existing.financialAssetGrowthGel = sumNullable(existing.financialAssetGrowthGel, row.financialAssetGrowthGel);
      existing.liabilityDecreaseGel = sumNullable(existing.liabilityDecreaseGel, row.liabilityDecreaseGel);
      existing.reconciliationDifferenceGel = sumNullable(existing.reconciliationDifferenceGel, row.reconciliationDifferenceGel);
      existing.publicTotalMeasure = agreeOrMixed(existing.publicTotalMeasure, row.publicTotalMeasure, MIXED_PUBLIC_TOTAL_MEASURE);
      existing.sourceId = agreeOrMixed(existing.sourceId, row.sourceId, MIXED_SOURCE_ID);
      // A roll-up's own two totals reconcile, so it carries no warning of its
      // own; region pages suppress the callout anyway (see the UI spec §8.2).
      continue;
    }
    totalByYear.set(row.year, {
      ...row,
      municipalityCode: entityId,
      showWarning: false,
      warningType: "none",
      warningAmountGel: null,
    });
  }

  return {
    functionFacts: Array.from(functionByKey.values()),
    totalFacts: Array.from(totalByYear.values()),
  };
}

function sourceMetadataFor(sourceId: string, sources: Map<string, SourceDocumentRow>): SourceMetadata {
  const source = sources.get(sourceId);
  return {
    sourceName: source?.sourceName ?? "",
    sourceUrlOrFile: source?.sourceUrlOrFile ?? "",
    lastReviewedAt: source?.lastReviewedAt ?? "",
  };
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

  const functionalSumByYear: Record<number, number> = {};
  const officialTotalByYear: Record<number, number> = {};
  // Per-year, like sourceIds above — source_id genuinely varies by year (a
  // municipality's early years come from the portal archive, later ones from
  // MoF workbooks), so this cannot collapse to a single totalFacts[0] lookup.
  const totalSourceIdByYear = new Map<number, string>();
  const warnings: MunicipalWarning[] = [];
  for (const row of totalFacts) {
    if (!inRange.has(row.year)) continue;
    functionalSumByYear[row.year] = (functionalSumByYear[row.year] ?? 0) + row.functionalSumGel;
    officialTotalByYear[row.year] = (officialTotalByYear[row.year] ?? 0) + row.publicTotalGel;
    totalSourceIdByYear.set(row.year, row.sourceId);
    if (row.showWarning) {
      warnings.push({ year: row.year, type: row.warningType, amountGel: row.warningAmountGel });
    }
  }
  warnings.sort((left, right) => left.year - right.year);

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
    const endTotal = lastYear === undefined ? null : functionalSumByYear[lastYear] ?? null;

    return {
      itemId: fn.id,
      parentItemId: null,
      level: "municipal_function",
      detailLabel: null,
      kaLabel: fn.kaLabel,
      enLabel: fn.kaLabel,
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
    totalValuesByYear[year] = functionalSumByYear[year] ?? null;
    totalBasisByYear[year] = "actual";
    totalSourceByYear[year] = sourceMetadataFor(totalSourceIdByYear.get(year) ?? "", sources);
  }

  const totalRow: ExplorerTableRow = {
    itemId: MUNICIPAL_TOTAL_ITEM_ID,
    parentItemId: null,
    level: "total",
    detailLabel: null,
    kaLabel: "სულ",
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

  return { years, rows, totalRow, officialTotalByYear, warnings };
}

/**
 * Top five functions by latest-year value. Derived totals are never selectable
 * series (AGENTS.md "UX and Visual Guardrails") — the total lives in the table's
 * სულ row and the KPI, which is why the design file's pinned __total entry is
 * deliberately not reproduced.
 */
export function getDefaultMunicipalSelection(model: MunicipalEntityModel): string[] {
  const lastYear = model.years.at(-1);
  if (lastYear === undefined) return [];

  return model.rows
    .slice()
    .sort((left, right) => (right.valuesByYear[lastYear] ?? 0) - (left.valuesByYear[lastYear] ?? 0))
    .slice(0, Math.min(5, MAX_CHART_SERIES))
    .map((row) => row.itemId);
}

export type MunicipalListRow = {
  id: string;
  kind: "municipality" | "region";
  nameKa: string;
  subtitleKa: string;
  regionId: string | null;
  valueGel: number;
  rank: number;
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
  functions: MunicipalFunction[];
  firstYear: number;
  latestYear: number;
};

function sumPublicTotal(totalFacts: MunicipalTotalFact[], year: number): number {
  return totalFacts.filter((row) => row.year === year).reduce((sum, row) => sum + row.publicTotalGel, 0);
}

/**
 * The four index KPIs. Per-capita is not available (no reviewed population
 * dataset), so the third is concentration and the fourth is composition —
 * both size-independent and both derivable from served facts.
 */
export function buildIndexKpis(input: MunicipalIndexKpiInput): MunicipalKpi[] {
  const { municipalities, totalFacts, functionFacts, functions, firstYear, latestYear } = input;

  const latestTotal = sumPublicTotal(totalFacts, latestYear);
  const firstTotal = sumPublicTotal(totalFacts, firstYear);
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
  for (const row of functionFacts) {
    if (row.year !== latestYear) continue;
    byFunction.set(row.categoryId, (byFunction.get(row.categoryId) ?? 0) + row.amountGel);
  }
  const functionalSum = Array.from(byFunction.values()).reduce((sum, value) => sum + value, 0);
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
      value: functionalSum > 0 && topFunction ? formatShare(topFunction[1] / functionalSum) : MISSING,
      detail: topFunctionLabel,
    },
  ];
}

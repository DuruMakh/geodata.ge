import type {
  DebtFamily,
  DebtSeriesId,
  ClientGovernmentDebtFact,
} from "../servedRows";
import type { ClientNationalGdpFact } from "./clientData";
import { GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS } from "../data/governmentDebt/types";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import { publicLabel } from "../i18n/labels";
import { buildDebtExplorerModel } from "./debtExplorer";
import {
  buildWorkbookExportModel,
  type WorkbookExportModel,
  type WorkbookPublicSource,
  type WorkbookSeries,
} from "./workbookModel";

export type DebtWorkbookInput = {
  facts: readonly ClientGovernmentDebtFact[];
  gdpFacts: readonly ClientNationalGdpFact[];
  family: DebtFamily;
  selectedIds: readonly DebtSeriesId[];
  range: { start: number; end: number };
  shareOfGdp: boolean;
  sources: readonly WorkbookPublicSource[];
  gdpSources: readonly WorkbookPublicSource[];
  siteOrigin: string;
};

const FAMILY_LABEL = { stock: "workbook.debtStock", service: "workbook.debtService", rate: "workbook.debtRate" } as const;

const SOURCE_FILENAME_BY_ID: Readonly<Record<string, string>> = {
  mof_public_debt_bulletin_n7: "public-debt-bulletin-n7",
  mof_public_debt_bulletin_n13: "public-debt-bulletin-n13",
  mof_public_debt_bulletin_n19: "public-debt-bulletin-n19",
  mof_public_debt_bulletin_n25: "public-debt-bulletin-n25",
  mof_monthly_debt_report_2026_07: "monthly-debt-report-2026-07",
  mof_debt_strategy_2019_2021: "debt-management-strategy-2019-2021",
  mof_debt_strategy_2022_2025: "debt-management-strategy-2022-2025",
  mof_debt_strategy_2023_2026: "debt-management-strategy-2023-2026",
  mof_debt_strategy_2025_2029: "debt-management-strategy-2025-2029",
};

function externalServiceSourceId(year: number): string | null {
  if (year >= 2013 && year <= 2016) return "mof_public_debt_bulletin_n7";
  if (year <= 2019) return "mof_public_debt_bulletin_n13";
  if (year <= 2022) return "mof_public_debt_bulletin_n19";
  if (year <= 2025) return "mof_public_debt_bulletin_n25";
  return null;
}

function debtSourcesFor(input: DebtWorkbookInput): WorkbookPublicSource[] {
  const selected = new Set(input.selectedIds);
  const yearsBySourceId = new Map<string, Set<number>>();
  const add = (sourceId: string | null, year: number) => {
    if (!sourceId) return;
    const years = yearsBySourceId.get(sourceId) ?? new Set<number>();
    years.add(year);
    yearsBySourceId.set(sourceId, years);
  };

  for (const fact of input.facts) {
    if (
      fact.family !== input.family ||
      !selected.has(fact.seriesId) ||
      fact.year < input.range.start ||
      fact.year > input.range.end
    ) continue;
    add(fact.sourceId, fact.year);
    if (fact.family === "rate" && fact.status === "not_available" && !fact.sourceId) {
      for (const sourceId of GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS) add(sourceId, fact.year);
    }
    if (fact.family === "service" && fact.status === "actual") {
      add(externalServiceSourceId(fact.year), fact.year);
    }
  }

  return [...yearsBySourceId].flatMap(([sourceId, years]) => {
    const filename = SOURCE_FILENAME_BY_ID[sourceId];
    const source = filename
      ? input.sources.find((candidate) => candidate.downloadHref.includes(filename))
      : undefined;
    return source ? [{ ...source, years: [...years].sort((left, right) => left - right) }] : [];
  });
}

function workbookStatus(status: ClientGovernmentDebtFact["status"]) {
  if (status === "projection_existing_portfolio") return "forecast" as const;
  if (status === "not_available") return "not_available" as const;
  return "actual" as const;
}

export function buildDebtWorkbookExportModel(input: DebtWorkbookInput, presentation?: Presentation): WorkbookExportModel {
  const locale = presentation?.locale ?? "ka";
  const englishLabels = presentation?.englishLabels ?? {};
  const model = buildDebtExplorerModel({
    facts: [...input.facts],
    gdpFacts: [...input.gdpFacts],
    family: input.family,
    selectedIds: [...input.selectedIds],
    range: input.range,
    shareOfGdp: input.shareOfGdp,
  });
  const factsBySeriesYear = new Map(
    input.facts.map((fact) => [`${fact.seriesId}:${fact.year}`, fact]),
  );
  const rowsById = new Map(model.tableRows.map((row) => [row.itemId, row]));
  const itemsById = new Map(model.items.map((item) => [item.id, item]));
  const series = model.selectedItems.map<WorkbookSeries>((item) => {
    const row = rowsById.get(item.id);
    const pointsByYear: WorkbookSeries["pointsByYear"] = {};
    for (const year of model.years) {
      const fact = factsBySeriesYear.get(`${item.id}:${year}`);
      if (!fact) continue;
      pointsByYear[year] = {
        amountGel: fact.valueKind === "amount_gel" ? fact.value : null,
        ...(input.family === "rate"
          ? { measureValue: fact.value === null ? null : fact.value / 100 }
          : input.family === "stock" && input.shareOfGdp
            ? { measureValue: row?.shareByYear?.[year] ?? null }
            : {}),
        basis: workbookStatus(fact.status),
      };
    }
    const parent = item.parentItemId === null ? undefined : itemsById.get(item.parentItemId);
    return {
      id: item.id,
      kind: item.parentItemId === null ? "total" : "item",
      parentLabel: parent ? publicLabel(locale, parent.id, parent.kaLabel, englishLabels) : null,
      label: publicLabel(locale, item.id, item.kaLabel, englishLabels),
      pointsByYear,
    };
  });
  const percentage = input.family === "rate" || (input.family === "stock" && input.shareOfGdp);

  return buildWorkbookExportModel({
    locale,
    filenameBase: `government-debt-${input.family}`,
    title: workbookMessage(locale, FAMILY_LABEL[input.family]),
    groupLabel: workbookMessage(locale, FAMILY_LABEL[input.family]),
    years: model.years,
    measure: percentage
      ? {
          kind: "percentage",
          unitLabel: input.family === "rate" ? "%" : workbookMessage(locale, "workbook.percentGdp"),
          analysisHeader: workbookMessage(locale, input.family === "rate" ? "workbook.rateHeader" : "workbook.gdpHeader"),
        }
      : { kind: "amount", unitLabel: workbookMessage(locale, "workbook.billionGel"), readableScale: 1_000_000_000 },
    totalId: model.items.find((item) => item.family === input.family && item.parentItemId === null)?.id ?? null,
    series,
    includeTotalsInAnalysis: input.family === "rate",
    sources: [
      ...debtSourcesFor(input),
      ...(input.family === "stock" && input.shareOfGdp ? input.gdpSources : []),
    ],
    siteOrigin: input.siteOrigin,
  });
}

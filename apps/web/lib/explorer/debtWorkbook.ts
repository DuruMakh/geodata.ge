import type {
  DebtFamily,
  DebtSeriesId,
  ClientGovernmentDebtFact,
} from "../servedRows";
import type { ClientNationalGdpFact } from "./clientData";
import { sourcesForDebtFact } from "../data/governmentDebt/sourceLineage";
import type { SourcedWorkbookPublicSource } from "../methodology/workbookSources";
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
  sources: readonly SourcedWorkbookPublicSource[];
  gdpSources: readonly WorkbookPublicSource[];
  siteOrigin: string;
};

const FAMILY_LABEL = { stock: "workbook.debtStock", service: "workbook.debtService", rate: "workbook.debtRate" } as const;

function debtSourcesFor(input: DebtWorkbookInput): WorkbookPublicSource[] {
  const selected = new Set(input.selectedIds);
  const yearsBySourceId = new Map<string, Set<number>>();

  for (const fact of input.facts) {
    if (
      fact.family !== input.family ||
      !selected.has(fact.seriesId) ||
      fact.year < input.range.start ||
      fact.year > input.range.end
    ) continue;
    for (const sourceId of sourcesForDebtFact(fact)) {
      const years = yearsBySourceId.get(sourceId) ?? new Set<number>();
      years.add(fact.year);
      yearsBySourceId.set(sourceId, years);
    }
  }

  return [...yearsBySourceId].flatMap(([sourceId, years]) => {
    const source = input.sources.find((candidate) => candidate.sourceId === sourceId);
    return source
      ? [{
          years: [...years].sort((left, right) => left - right),
          title: source.title,
          organization: source.organization,
          downloadHref: source.downloadHref,
          retrievedAt: source.retrievedAt,
        }]
      : [];
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
    ...(percentage ? { showChangeColumn: false } : {}),
    sources: [
      ...debtSourcesFor(input),
      ...(input.family === "stock" && input.shareOfGdp ? input.gdpSources : []),
    ],
    siteOrigin: input.siteOrigin,
  });
}

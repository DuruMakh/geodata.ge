import type {
  DebtFamily,
  DebtSeriesId,
  ServedGovernmentDebtFact,
  ServedNationalGdpFact,
} from "../servedRows";
import { buildDebtExplorerModel } from "./debtExplorer";
import {
  buildWorkbookExportModel,
  type WorkbookExportModel,
  type WorkbookPublicSource,
  type WorkbookSeries,
} from "./workbookModel";

export type DebtWorkbookInput = {
  facts: readonly ServedGovernmentDebtFact[];
  gdpFacts: readonly ServedNationalGdpFact[];
  family: DebtFamily;
  selectedIds: readonly DebtSeriesId[];
  range: { start: number; end: number };
  shareOfGdp: boolean;
  sources: readonly WorkbookPublicSource[];
  gdpSources: readonly WorkbookPublicSource[];
  siteOrigin: string;
};

const FAMILY_LABEL: Record<DebtFamily, string> = {
  stock: "მთავრობის ვალი",
  service: "ვალის გადახდა",
  rate: "საპროცენტო განაკვეთი",
};

const SOURCE_FILENAME_TOKENS: Record<DebtFamily, readonly string[]> = {
  stock: ["public-debt-bulletin-n13", "public-debt-bulletin-n25"],
  service: ["public-debt-bulletin-n7", "public-debt-bulletin-n13", "public-debt-bulletin-n19", "public-debt-bulletin-n25"],
  rate: ["monthly-debt-report", "debt-management-strategy"],
};

function workbookStatus(status: ServedGovernmentDebtFact["status"]) {
  if (status === "projection_existing_portfolio") return "forecast" as const;
  if (status === "not_available") return "not_available" as const;
  return "actual" as const;
}

export function buildDebtWorkbookExportModel(input: DebtWorkbookInput): WorkbookExportModel {
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
    return {
      id: item.id,
      kind: item.parentItemId === null ? "total" : "item",
      parentLabelKa: item.parentItemId === null ? null : itemsById.get(item.parentItemId)?.kaLabel ?? null,
      labelKa: item.kaLabel,
      pointsByYear,
    };
  });
  const percentage = input.family === "rate" || (input.family === "stock" && input.shareOfGdp);

  return buildWorkbookExportModel({
    filenameBase: `government-debt-${input.family}`,
    titleKa: FAMILY_LABEL[input.family],
    groupLabelKa: FAMILY_LABEL[input.family],
    years: model.years,
    measure: percentage
      ? {
          kind: "percentage",
          unitLabelKa: input.family === "rate" ? "%" : "% მშპ-ში",
          analysisHeaderKa: input.family === "rate" ? "საპროცენტო განაკვეთი (%)" : "მშპ-ის წილი (%)",
        }
      : { kind: "amount", unitLabelKa: "მლრდ ₾", readableScale: 1_000_000_000 },
    totalId: model.items.find((item) => item.family === input.family && item.parentItemId === null)?.id ?? null,
    series,
    sources: [
      ...input.sources.filter((source) => SOURCE_FILENAME_TOKENS[input.family].some((token) => source.downloadHref.includes(token))),
      ...(input.family === "stock" && input.shareOfGdp ? input.gdpSources : []),
    ],
    siteOrigin: input.siteOrigin,
  });
}

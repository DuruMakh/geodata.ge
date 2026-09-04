import type { ServedGeneralGovernmentBalanceFact } from "../servedRows";
import { DEFICIT_ITEM } from "./deficitExplorer";
import {
  buildWorkbookExportModel,
  type WorkbookExportModel,
  type WorkbookPublicSource,
} from "./workbookModel";

export function buildDeficitWorkbookExportModel(input: {
  facts: readonly ServedGeneralGovernmentBalanceFact[];
  range: { start: number; end: number };
  percentage: boolean;
  sources: readonly WorkbookPublicSource[];
  siteOrigin: string;
}): WorkbookExportModel {
  const activeFacts = input.facts.filter(
    (fact) => fact.year >= input.range.start && fact.year <= input.range.end,
  );
  const years = activeFacts.map((fact) => fact.year);

  return buildWorkbookExportModel({
    filenameBase: "general-government-deficit",
    titleKa: "ზოგადი მთავრობის ბალანსი",
    groupLabelKa: "ზოგადი მთავრობის ბალანსი",
    years,
    measure: input.percentage
      ? {
          kind: "percentage",
          unitLabelKa: "% მშპ-ში",
          analysisHeaderKa: "მშპ-ის წილი (%)",
        }
      : { kind: "amount", unitLabelKa: "მლრდ ₾", readableScale: 1_000_000_000 },
    totalId: DEFICIT_ITEM.id,
    includeTotalsInAnalysis: true,
    series: [{
      id: DEFICIT_ITEM.id,
      kind: "total",
      parentLabelKa: null,
      labelKa: DEFICIT_ITEM.kaLabel,
      pointsByYear: Object.fromEntries(activeFacts.map((fact) => [
        fact.year,
        {
          amountGel: fact.generalGovernmentBalanceGel,
          ...(input.percentage
            ? { measureValue: fact.generalGovernmentBalancePctGdp / 100 }
            : {}),
          basis: fact.status === "projection" ? "forecast" : "actual",
        },
      ])),
    }],
    sources: [...input.sources],
    siteOrigin: input.siteOrigin,
  });
}

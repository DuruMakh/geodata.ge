import type { ClientGeneralGovernmentBalanceFact } from "./clientData";
import { DEFICIT_ITEM } from "./deficitExplorer";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import { publicLabel } from "../i18n/labels";
import {
  buildWorkbookExportModel,
  type WorkbookExportModel,
  type WorkbookPublicSource,
} from "./workbookModel";

export function buildDeficitWorkbookExportModel(input: {
  facts: readonly ClientGeneralGovernmentBalanceFact[];
  range: { start: number; end: number };
  percentage: boolean;
  sources: readonly WorkbookPublicSource[];
  siteOrigin: string;
}, presentation?: Presentation): WorkbookExportModel {
  const locale = presentation?.locale ?? "ka";
  const activeFacts = input.facts.filter(
    (fact) => fact.year >= input.range.start && fact.year <= input.range.end,
  );
  const years = activeFacts.map((fact) => fact.year);

  return buildWorkbookExportModel({
    locale,
    filenameBase: "general-government-deficit",
    title: workbookMessage(locale, "workbook.balance"),
    groupLabel: workbookMessage(locale, "workbook.balance"),
    years,
    measure: input.percentage
      ? {
          kind: "percentage",
          unitLabel: workbookMessage(locale, "workbook.percentGdp"),
          analysisHeader: workbookMessage(locale, "workbook.gdpHeader"),
        }
      : { kind: "amount", unitLabel: workbookMessage(locale, "workbook.billionGel"), readableScale: 1_000_000_000 },
    totalId: DEFICIT_ITEM.id,
    includeTotalsInAnalysis: true,
    series: [{
      id: DEFICIT_ITEM.id,
      kind: "total",
      parentLabel: null,
      label: publicLabel(locale, DEFICIT_ITEM.id, DEFICIT_ITEM.kaLabel, presentation?.englishLabels ?? {}),
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

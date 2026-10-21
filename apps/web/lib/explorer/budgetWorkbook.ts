import { publicLabel } from "../i18n/labels";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ExplorerModel } from "./explorerData";
import type { ExplorerScope } from "./types";
import type { WorkbookExportInput, WorkbookPublicSource, WorkbookSeries } from "./workbookModel";

export type BudgetWorkbookInput = {
  model: ExplorerModel;
  presentation: Pick<Presentation, "locale" | "englishLabels">;
  scope: ExplorerScope;
  /** True when the explorer shows shares of GDP instead of GEL amounts. */
  share: boolean;
  title: string;
  /** Budget sources for fields and revenue, admin sources for ministries; GDP sources join either for shares. */
  sources: {
    budget: readonly WorkbookPublicSource[];
    admin: readonly WorkbookPublicSource[];
    gdp: readonly WorkbookPublicSource[];
  };
  siteOrigin: string;
};

const GROUP_LABEL = { revenue: "workbook.receipts", ministries: "workbook.institutions", fields: "workbook.expenditure" } as const;

/** The expenditure and revenue explorer's Excel input: the visible table rows, their basis per year and the sources the scope rests on. */
export function buildBudgetWorkbookInput({ model, presentation, scope, share, title, sources, siteOrigin }: BudgetWorkbookInput): WorkbookExportInput {
  const { locale, englishLabels } = presentation;
  const labelById = new Map(model.items.map((item) => [item.id, publicLabel(locale, item.id, item.kaLabel, englishLabels)]));
  const series = model.tableRows.map<WorkbookSeries>((row) => {
    const pointsByYear: WorkbookSeries["pointsByYear"] = {};
    for (const year of model.years) {
      const amountGel = row.valuesByYear[year];
      const basis = row.basisByYear[year];
      pointsByYear[year] = amountGel === null || amountGel === undefined || basis === undefined
        ? null
        : {
            amountGel,
            measureValue: share ? row.shareByYear?.[year] : undefined,
            basis,
          };
    }

    return {
      id: row.itemId,
      kind: row.itemId === model.totalRow?.itemId ? "total" : row.level === "admin_category" ? "group" : "item",
      parentLabel: row.parentItemId ? labelById.get(row.parentItemId) ?? null : null,
      label: publicLabel(locale, row.itemId, row.kaLabel, englishLabels),
      pointsByYear,
    };
  });

  const scopeSources = scope === "ministries" ? sources.admin : sources.budget;
  return {
    locale,
    filenameBase: scope,
    title,
    groupLabel: workbookMessage(locale, GROUP_LABEL[scope]),
    years: model.years,
    measure: share
      ? { kind: "percentage", unitLabel: workbookMessage(locale, "workbook.percentGdp"), analysisHeader: workbookMessage(locale, "workbook.gdpHeader") }
      : { kind: "amount", unitLabel: workbookMessage(locale, "workbook.millionGel"), readableScale: 1_000_000 },
    totalId: model.totalRow?.itemId ?? null,
    series,
    sources: share ? [...scopeSources, ...sources.gdp] : [...scopeSources],
    siteOrigin,
  };
}

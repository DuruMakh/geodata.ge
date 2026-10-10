import type { ClientWagesFact } from "../data/wages/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildWagesModel, type WagesSectionId, type WagesState } from "./wages";
import { SHEET_NAMES, mergeSourcesByHref, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

export function buildWagesWorkbookExportModel(input: { section: WagesSectionId; facts: readonly ClientWagesFact[]; state: WagesState; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title?: string }, presentation: Presentation): WorkbookExportModel {
  const { section, facts, state, labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `wages.${key}`);
  const model = buildWagesModel(section, facts, state);
  const byCell = new Map(facts.map(f => [`${f.indicatorId}:${f.dimension}:${f.groupId}:${f.sectorId}:${f.year}`, f]));
  const cell = (series: typeof model.selected[number], year: number) => byCell.get(`${series.indicatorId}:${series.dimension}:${series.groupId}:${series.sectorId}:${year}`);
  const neededYears = new Map<string, Set<number>>();
  for (const series of model.selected) for (const year of model.years) {
    const fact = cell(series, year);
    if (fact) neededYears.set(fact.sourceId, (neededYears.get(fact.sourceId) ?? new Set<number>()).add(year));
  }
  const originals = mergeSourcesByHref(input.sources, source => source.years.filter(year => neededYears.get(source.sourceId)?.has(year)));
  const numberFormat = model.decimals ? "#,##0.0" : "#,##0";
  const status = (fact: ClientWagesFact | undefined) => fact ? t(`status.${fact.valueStatus}`) : workbookMessage(locale, "workbook.unavailable");
  const view = state.view === "main" ? "" : ` · ${t(`group.${state.view}`)}`;
  return {
    locale, filename: workbookFilename(`wages-${section}${state.view === "main" ? "" : `-${state.view}`}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${input.title ?? t(`page.${section}.title`)}${view}`, subtitle: `${model.range.start}–${model.range.end} · ${t("unitMonthly")} · ${t("nominalNote")}`,
      unitLabel: t("unit"), amountDecimals: model.decimals, years: model.years, showChangeColumn: false, numberFormat,
      rows: model.selected.map(series => ({ kind: series.reference ? "total" : "item", parentLabel: null, label: labels[series.id], change: null,
        valuesByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year]])),
        basisByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year] === null ? null : "actual"])),
      })),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t("series"), t("amountHeader"), workbookMessage(locale, "workbook.status")],
      rows: model.years.flatMap(year => model.selected.map(series => [year, labels[series.id], series.valuesByYear[year], status(cell(series, year))])),
      numericFormats: { 2: numberFormat },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}

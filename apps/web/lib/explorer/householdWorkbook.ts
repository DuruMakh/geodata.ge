import { householdSourceId, type ClientHouseholdFact } from "../data/household/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildHouseholdModel, type HouseholdSectionId, type HouseholdState } from "./household";
import { SHEET_NAMES, mergeSourcesByHref, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource, type WorkbookReadableRow } from "./workbookModel";

const NUMBER_FORMAT = "0.0";

export function buildHouseholdWorkbookExportModel(input: { section: HouseholdSectionId; facts: readonly ClientHouseholdFact[]; state: HouseholdState; labels: Readonly<Record<string, string>>; areaLabel: string; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title?: string }, presentation: Presentation): WorkbookExportModel {
  const { section, facts, state, labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `household.${key}`);
  const model = buildHouseholdModel(section, facts, state);
  const byCell = new Set(facts.map(f => `${f.indicatorId}:${f.areaId}:${f.measure}:${f.year}`));
  const neededYears = new Map<string, Set<number>>();
  for (const series of model.selected) for (const year of model.years) {
    if (!byCell.has(`${series.indicatorId}:${series.areaId}:${state.measure}:${year}`)) continue;
    const sourceId = householdSourceId(series.indicatorId, series.areaId, state.measure);
    neededYears.set(sourceId, (neededYears.get(sourceId) ?? new Set<number>()).add(year));
  }
  const originals = mergeSourcesByHref(input.sources, source => source.years.filter(year => neededYears.get(source.sourceId)?.has(year)));
  const status = (value: number | null) => value === null ? workbookMessage(locale, "workbook.unavailable") : t("status.survey_estimate");
  const parts = state.view === "parts";
  const tab = t(parts ? `tab.parts.${section}` : "tab.areas");
  const title = [input.title ?? t(`page.${section}.title`), tab, ...(parts ? [input.areaLabel] : []), t(`measure.${state.measure}`)].join(" · ");
  const areaSlug = parts ? state.area.replace(/\./g, "-") : "all";
  const kind = (series: typeof model.selected[number]): WorkbookReadableRow["kind"] => series.reference ? "total" : series.parentId ? "item" : parts ? "group" : "item";
  return {
    locale, filename: workbookFilename(`household-${section}-${state.view}-${areaSlug}-${state.measure}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title, subtitle: `${model.range.start}–${model.range.end} · ${t(`unitLong.${state.measure}`)}`,
      unitLabel: t("unitGel"), amountDecimals: 1, years: model.years, showChangeColumn: false, numberFormat: NUMBER_FORMAT,
      rows: model.selected.map(series => ({ kind: kind(series), parentLabel: series.parentId ? labels[series.parentId] ?? null : null, label: labels[series.id], change: null,
        valuesByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year]])),
        basisByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year] === null ? null : "actual"])),
      })),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t("series"), t("amountHeader"), workbookMessage(locale, "workbook.status")],
      rows: model.years.flatMap(year => model.selected.map(series => [year, labels[series.id], series.valuesByYear[year], status(series.valuesByYear[year])])),
      // The value is the third column (1-based).
      numericFormats: { 3: NUMBER_FORMAT },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}

import type { ClientPovertyFact } from "../data/poverty/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildPovertyModel, type PovertySectionId, type PovertyState } from "./poverty";
import { SHEET_NAMES, mergeSourcesByHref, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

export function buildPovertyWorkbookExportModel(input: { section: PovertySectionId; facts: readonly ClientPovertyFact[]; state: PovertyState; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title?: string }, presentation: Presentation): WorkbookExportModel {
  const { section, facts, state, labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `poverty.${key}`);
  const model = buildPovertyModel(section, facts, state);
  const byCell = new Map(facts.map(f => [`${f.indicatorId}:${f.groupId}:${f.year}`, f]));
  const neededYears = new Map<string, Set<number>>();
  for (const series of model.selected) for (const year of model.years) {
    const fact = byCell.get(`${series.indicatorId}:${series.groupId}:${year}`);
    if (fact) neededYears.set(fact.sourceId, (neededYears.get(fact.sourceId) ?? new Set<number>()).add(year));
  }
  const originals = mergeSourcesByHref(input.sources, source => source.years.filter(year => neededYears.get(source.sourceId)?.has(year)));
  const unit = section === "inequality" ? "index" : "percent";
  const numberFormat = model.decimals === 2 ? "0.00" : "0.0";
  const status = (value: number | null) => value === null ? workbookMessage(locale, "workbook.unavailable") : t("status.survey_estimate");
  const view = state.view === "main" ? "" : ` · ${t(`tab.${state.view}`)}`;
  return {
    locale, filename: workbookFilename(`poverty-${section}${state.view === "main" ? "" : `-${state.view}`}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${input.title ?? t(`page.${section}.title`)}${view}`, subtitle: `${model.range.start}–${model.range.end} · ${t(unit === "index" ? "unitIndex" : "unitPercentLong")}`,
      unitLabel: t(unit === "index" ? "unitIndex" : "unitPercent"), amountDecimals: model.decimals, years: model.years, showChangeColumn: false, numberFormat,
      rows: model.selected.map(series => ({ kind: series.reference ? "total" : "item", parentLabel: null, label: labels[series.id], change: null,
        valuesByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year]])),
        basisByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year] === null ? null : "actual"])),
      })),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t("series"), t(`amountHeader.${unit}`), workbookMessage(locale, "workbook.status")],
      rows: model.years.flatMap(year => model.selected.map(series => [year, labels[series.id], series.valuesByYear[year], status(series.valuesByYear[year])])),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}

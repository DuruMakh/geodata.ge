import { HOUSEHOLD_SOURCES, householdFactKey, householdSourceId, type ClientHouseholdFact, type HouseholdArea, type HouseholdMeasure } from "../data/household/types";
import { sourcedWorkbookSources, type PublicSourceManifestRow } from "../methodology/publicSources";
import type { ValidatedSourceManifestRow } from "../methodology/sourceManifest";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildHouseholdModel, type HouseholdSectionId, type HouseholdState } from "./household";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource, type WorkbookReadableRow } from "./workbookModel";

const NUMBER_FORMAT = "0.0";
// File names share one English stem in both languages, in words rather than ids.
const MEASURE_FILE_WORDS: Record<HouseholdMeasure, string> = { per_household: "per-household", per_capita: "per-capita" };

/** The twelve served workbooks of the validated archive; the population totals, page captures and metadata are not data sources of any value shown. */
export const isHouseholdWorkbookSource = (source: ValidatedSourceManifestRow) => HOUSEHOLD_SOURCES.includes(source.source_id);

/** The served workbooks as the Sources sheet lists them. */
export function householdWorkbookSources(manifest: readonly ValidatedSourceManifestRow[], publicSources: readonly PublicSourceManifestRow[]): (WorkbookPublicSource & { sourceId: string })[] {
  return sourcedWorkbookSources(manifest, publicSources, isHouseholdWorkbookSource);
}

export function buildHouseholdWorkbookExportModel(input: { section: HouseholdSectionId; area: HouseholdArea; facts: readonly ClientHouseholdFact[]; state: HouseholdState; labels: Readonly<Record<string, string>>; areaLabel: string; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title?: string }, presentation: Presentation): WorkbookExportModel {
  const { section, area, facts, state, labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `household.${key}`);
  const model = buildHouseholdModel(section, area, facts, state);
  const byCell = new Set(facts.map(householdFactKey));
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) =>
    byCell.has(householdFactKey({ indicatorId: series.indicatorId, areaId: series.areaId, measure: state.measure, year })) ? householdSourceId(series.indicatorId, series.areaId, state.measure) : undefined));
  const status = (value: number | null) => value === null ? workbookMessage(locale, "workbook.unavailable") : t("status.survey_estimate");
  const title = [input.title ?? t(`page.${section}.title`), t(`tab.parts.${section}`), input.areaLabel, t(`measure.${state.measure}`)].join(" · ");
  const kind = (series: typeof model.selected[number]): WorkbookReadableRow["kind"] => series.reference ? "total" : series.parentId ? "item" : "group";
  return {
    locale, filename: workbookFilename(`household-${section}-${area.replace(/\./g, "-")}-${MEASURE_FILE_WORDS[state.measure]}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
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

import type { ClientExternalPositionFact } from "../data/externalPosition/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import type { CurrentAccountGdp } from "./currentAccount";
import { buildExternalPositionModel, externalPositionViewFacts, type ExternalPositionSectionId, type ExternalPositionState } from "./externalPosition";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

const MILLION = 1_000_000;

/**
 * Amounts export in million USD (the facts hold dollars), rounded to the one decimal NBG prints so the conversion's float
 * noise never reaches a cell. On % of GDP, `gdp` is the nominal GDP the shares divide by and `gdpSources` (its Geostat files)
 * join the NBG workbooks on the Sources sheet. `latestLabel` names the latest-period column, for example `2026 (Sep)`.
 */
export function buildExternalPositionWorkbookExportModel(input: {
  section: ExternalPositionSectionId; facts: readonly ClientExternalPositionFact[]; state: ExternalPositionState; labels: Readonly<Record<string, string>>;
  sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title?: string;
  gdp: readonly CurrentAccountGdp[]; gdpSources?: readonly WorkbookPublicSource[]; latestLabel?: string;
}, presentation: Presentation): WorkbookExportModel {
  const { section, state, labels } = input, { locale, messages } = presentation;
  const key = section === "foreign-debt" ? "debt" : "reserves";
  const t = (suffix: string) => message(messages, `external.${suffix}`);
  const model = buildExternalPositionModel(section, input.facts, state, input.gdp);
  const byCell = new Map(externalPositionViewFacts(state.view, input.facts, input.gdp).map(f => [`${f.indicatorId}:${f.year}`, f]));
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) => byCell.get(`${series.id}:${year}`)?.sourceId));
  const isGdp = state.view === "gdp";
  const unitLabel = isGdp ? workbookMessage(locale, "workbook.percentGdp") : t("position.unitMlnUsd");
  const numberFormat = isGdp ? "0.0" : "#,##0.0";
  const toExport = (value: number | null) => value === null ? null : isGdp ? value : Math.round(value / MILLION * 10) / 10;
  const status = (id: string, year: number) => {
    const fact = byCell.get(`${id}:${year}`);
    return !fact ? workbookMessage(locale, "workbook.unavailable") : fact.latestPeriod ? t("position.latestMark") : workbookMessage(locale, "workbook.published");
  };
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  return {
    locale, filename: workbookFilename(`${section}${isGdp ? "-gdp" : ""}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${input.title ?? t(`${key}.title`)} · ${t(`position.tab.${state.view}`)}`, subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel, amountDecimals: 1, years: model.years, showChangeColumn: false, numberFormat,
      headerLabels: { category: t("position.series"), columns: model.years.map(year => model.latestYears.includes(year) && input.latestLabel ? input.latestLabel : String(year)), wrap: true },
      rows: model.selected.map(series => {
        const values = Object.fromEntries(model.years.map(year => [year, toExport(series.valuesByYear[year])]));
        return {
          kind: series.reference ? "total" : "item", parentLabel: null, label: labels[series.id], change: null, valuesByYear: values,
          basisByYear: Object.fromEntries(model.years.map(year => [year, values[year] === null ? null : "actual"])),
        };
      }),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t("position.series"), isGdp ? workbookMessage(locale, "workbook.gdpHeader") : unitLabel, workbookMessage(locale, "workbook.status")],
      rows: cells.map(({ year, series }) => [year, labels[series.id], toExport(series.valuesByYear[year]), status(series.id, year)]),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls([...originals, ...(isGdp ? input.gdpSources ?? [] : [])], input.siteOrigin),
  };
}

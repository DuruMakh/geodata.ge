import type { ClientUnemploymentObservation, UnemploymentGroupDefinition } from "../data/unemployment/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildUnemploymentModel } from "./unemployment";
import { unemploymentFactSeriesId, unemploymentSeriesLabel, unemploymentUsesIndicatorSeries } from "./unemploymentOverview";
import type { UnemploymentState } from "./unemploymentState";
import { SHEET_NAMES, mergeSourcesByHref, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

export function buildUnemploymentWorkbookExportModel(facts: ClientUnemploymentObservation[], registry: UnemploymentGroupDefinition[], state: UnemploymentState, presentation: Presentation, sources: (WorkbookPublicSource & { sourceId: string })[], siteOrigin: string): WorkbookExportModel {
  const model = buildUnemploymentModel(facts, registry, state), { locale, messages } = presentation;
  const t = (key: string) => message(messages, `unemployment.${key}`);
  const definitions = model.definitions.filter(group => model.rows.some(row => row.itemId === group.id));
  const byCell = new Map(model.activeFacts.map(f => [`${unemploymentFactSeriesId(f, state)}:${f.year}`, f]));
  const name = (group: typeof definitions[number]) => unemploymentSeriesLabel(group, state, presentation);
  const neededYears = new Map<string, Set<number>>();
  for (const fact of model.activeFacts) {
    const years = neededYears.get(fact.sourceId) ?? new Set<number>(); years.add(fact.year); neededYears.set(fact.sourceId, years);
  }
  const originals = mergeSourcesByHref(sources, source => source.years.filter(year => neededYears.get(source.sourceId)?.has(year)));
  const indicators = [...new Set(definitions.map(group => group.indicatorId))];
  const indicator = (indicators.length ? indicators : [state.indicator]).map(id => t(`indicator.${id}`)).join(" · "), unitLabel = model.percent ? "%" : t("thousandPersons");
  const region = state.regionId ? registry.find(group => group.id === state.regionId)! : null;
  const breakdown = region ? locale === "en" ? region.labelEn : region.labelKa : t(`breakdown.${state.breakdown}`) + (state.breakdown === "education" ? ` · ${t(`sex.${state.educationSex}`)}` : "");
  const valueAt = (id: string, year: number) => { const fact = byCell.get(`${id}:${year}`); return fact ? fact.value / (model.percent ? 100 : 1) : null; };
  const numberFormat = model.percent ? "0.0%" : "#,##0.0";
  return {
    locale, filename: workbookFilename(`unemployment-${state.regionId?.replace(/^region\./, "") ?? state.breakdown}-${indicators.length > 1 ? model.percent ? "rates" : "people" : indicators[0] ?? state.indicator}${state.breakdown === "education" ? `-${state.educationSex}` : ""}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: message(messages, "unemployment.workbookTitle", { indicator, breakdown }),
      subtitle: `${model.range.start}–${model.range.end} · ${unitLabel} · ${t("surveyEstimate")}`,
      unitLabel, amountDecimals: 1, years: model.years, showChangeColumn: false, numberFormat,
      rows: definitions.map(group => ({ kind: group.id === model.referenceId ? "total" : "item", parentLabel: null, label: name(group), change: null,
        valuesByYear: Object.fromEntries(model.years.map(year => [year, valueAt(group.id, year)])),
        basisByYear: Object.fromEntries(model.years.map(year => [year, byCell.has(`${group.id}:${year}`) ? "actual" : null])),
      })),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t(unemploymentUsesIndicatorSeries(state) ? "series" : "group"), model.percent ? state.breakdown === "long_term" && indicators.length === 1 ? indicator : t("rateHeader") : t("countHeader"), workbookMessage(locale, "workbook.status")],
      rows: model.years.flatMap(year => definitions.map(group => [year, name(group), valueAt(group.id, year), workbookMessage(locale, byCell.has(`${group.id}:${year}`) ? "workbook.actual" : "workbook.unavailable")])),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls(originals, siteOrigin),
  };
}

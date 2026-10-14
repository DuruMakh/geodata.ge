import type { ClientUnemploymentObservation, UnemploymentBreakdown, UnemploymentGroupDefinition, UnemploymentIndicator, UnemploymentSex } from "../data/unemployment/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildUnemploymentModel } from "./unemployment";
import { unemploymentFactSeriesId, unemploymentSeriesLabel } from "./unemploymentOverview";
import type { UnemploymentState } from "./unemploymentState";
import { SHEET_NAMES, filenameWords, mergeSourcesByHref, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

// File names share one English stem in both languages (only the English edition adds "-en"), in words rather than ids.
const BREAKDOWN_FILE_WORDS: Record<UnemploymentBreakdown, string> = {
  national: "national", sex: "sex", settlement: "urban-rural", age: "age", region: "regions", education: "education", long_term: "long-term",
};
const INDICATOR_FILE_WORDS: Record<UnemploymentIndicator, string> = {
  unemployment_rate: "unemployment-rate", unemployed: "unemployed", employment_rate: "employment-rate", employed: "employed", hired: "hired-employees",
  self_employed: "self-employed", participation_rate: "participation-rate", labour_force: "labour-force", outside_labour_force: "outside-labour-force",
  population_15_plus: "population-15-plus", long_term_unemployed: "long-term-unemployed", long_term_unemployment_rate: "long-term-unemployment-rate",
  long_term_unemployed_share: "long-term-unemployed-share",
};
const SEX_FILE_WORDS: Record<UnemploymentSex, string> = { total: "total", women: "women", men: "men" };

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
    // A region is named by its English label; several indicators by their unit, as rates or people.
    locale, filename: workbookFilename(`unemployment-${region ? filenameWords(region.labelEn) : BREAKDOWN_FILE_WORDS[state.breakdown]}-${indicators.length > 1 ? model.percent ? "rates" : "people" : INDICATOR_FILE_WORDS[indicators[0] ?? state.indicator]}${state.breakdown === "education" ? `-${SEX_FILE_WORDS[state.educationSex]}` : ""}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
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
      headers: [workbookMessage(locale, "workbook.year"), workbookMessage(locale, "workbook.category"), model.percent ? state.breakdown === "long_term" && indicators.length === 1 ? indicator : t("rateHeader") : t("countHeader"), workbookMessage(locale, "workbook.status")],
      rows: model.years.flatMap(year => definitions.map(group => [year, name(group), valueAt(group.id, year), workbookMessage(locale, byCell.has(`${group.id}:${year}`) ? "workbook.actual" : "workbook.unavailable")])),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls(originals, siteOrigin),
  };
}

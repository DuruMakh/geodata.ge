import { healthFactKey, type ClientHealthFact, type HealthArea, type HealthUnit } from "../data/health/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildHealthSeriesModel, healthCoverage, healthViewSeries, type HealthNationalSectionId, type HealthSectionId, type HealthState } from "./health";
import { buildHealthDeathsModel, healthDeathsAreaHref, type HealthDeathsState } from "./healthDeaths";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

/** The Data sheet's columns in order; the numeric format is keyed by the 1-based position of the `value` column. */
const ANALYSIS_COLUMNS = ["year", "series", "value", "unit", "status"] as const;
const VALUE_COLUMN = ANALYSIS_COLUMNS.indexOf("value") + 1;

/** The workbook names the unit a figure is stored in, which is not always the unit the page shows it in. */
const UNIT_KEYS: Record<HealthUnit, string> = {
  persons: "unitPersons", persons_thousand: "unitThousandPersons", units: "unitUnits", units_thousand: "unitThousandBeds",
  visits_thousand: "unitThousandVisits", per_1000_population: "unitPerThousand",
};

/** A figure is shown to the decimals it is published with. */
const numberFormatOf = (decimals: number) => decimals ? `#,##0.${"0".repeat(decimals)}` : "#,##0";

type Shared = {
  facts: readonly ClientHealthFact[]; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title: string;
};
/** National pages read Georgia; a causes-of-death workbook is one area's page. */
export type HealthWorkbookInput = Shared & (
  | { section: HealthNationalSectionId; area?: undefined; state: HealthState }
  | { section: Extract<HealthSectionId, "causes-of-death">; area: HealthArea; state: HealthDeathsState }
);

export function buildHealthWorkbookExportModel(input: HealthWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { facts, labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `health.${key}`);
  const area: HealthArea = input.section === "causes-of-death" ? input.area : "georgia";
  // The values are the published ones, in the unit they are stored in: no display multiplier.
  const model = input.section === "causes-of-death"
    ? buildHealthDeathsModel(input.area, facts, input.state)
    : buildHealthSeriesModel({
      facts, area, range: input.state.range, coverage: healthCoverage(input.section, input.state.view, facts), definitions: healthViewSeries(input.section, input.state.view),
      selectedIds: input.state.selectedIds, scale: () => ({ multiplier: 1 }),
    });
  const byCell = new Map(facts.filter(f => f.areaId === area).map(f => [healthFactKey(f), f]));
  const cell = (id: string, year: number) => byCell.get(healthFactKey({ indicatorId: id as ClientHealthFact["indicatorId"], areaId: area, year }));
  const neededYears = neededSourceYears(model.selected, model.years, (series, year) => cell(series.id, year)?.sourceId);
  // A value without its source link would leave the workbook uncited.
  const known = new Set(input.sources.map(source => source.sourceId));
  for (const sourceId of neededYears.keys()) if (!known.has(sourceId)) throw new Error(`Missing public source for health source ${sourceId}`);
  const originals = sourcesForNeededYears(input.sources, neededYears);
  const unitLabel = (id: string) => t(UNIT_KEYS[facts.find(f => f.indicatorId === id)!.unit]);
  const unitLabels = [...new Set(model.selected.map(series => unitLabel(series.id)))].join(" · ");
  // A series' decimals vary by year (beds are published to 1, 2 or 3), so the Data sheet formats each cell by its own fact and the Summary sheet each row by its most precise one.
  const decimalsOf = (id: string, years: readonly number[]) => Math.max(0, ...years.flatMap(year => { const fact = cell(id, year); return fact ? [fact.decimals] : []; }));
  const sheetDecimals = Math.max(0, ...model.selected.map(series => decimalsOf(series.id, model.years)));
  const numberFormat = numberFormatOf(sheetDecimals);
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series, fact: cell(series.id, year) })));
  const stem = input.section === "causes-of-death"
    ? `health-causes-of-death-${healthDeathsAreaHref(input.area).split("/").pop()}`
    : `health-${input.section}${input.state.view !== "staff" && input.state.view !== "main" ? `-${input.state.view}` : ""}`;
  const header: Record<typeof ANALYSIS_COLUMNS[number], string> = {
    year: workbookMessage(locale, "workbook.year"), series: t("series"), value: t("value"), unit: t("unit"), status: workbookMessage(locale, "workbook.status"),
  };
  return {
    locale, filename: workbookFilename(`${stem}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: `${model.range.start}–${model.range.end} · ${unitLabels}`,
      unitLabel: unitLabels, amountDecimals: sheetDecimals, years: model.years, showChangeColumn: false, numberFormat,
      rows: model.selected.map(series => ({
        kind: series.reference ? "total" : "item", parentLabel: null, label: labels[series.id], change: null, numberFormat: numberFormatOf(decimalsOf(series.id, model.years)),
        valuesByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year]])),
        basisByYear: Object.fromEntries(model.years.map(year => [year, series.valuesByYear[year] === null ? null : "published"])),
      })),
    },
    analysis: {
      headers: ANALYSIS_COLUMNS.map(column => header[column]),
      rows: cells.map(({ year, series, fact }) => [year, labels[series.id], series.valuesByYear[year], unitLabel(series.id), fact ? workbookMessage(locale, "workbook.published") : workbookMessage(locale, "workbook.unavailable")]),
      numericFormats: { [VALUE_COLUMN]: numberFormat },
      rowNumberFormats: Object.fromEntries(cells.flatMap(({ fact }, index) => fact ? [[index, numberFormatOf(fact.decimals)]] : [])),
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}

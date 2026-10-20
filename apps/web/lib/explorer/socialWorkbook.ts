import type { ClientSocialFact } from "../data/social/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { educationFullLabel } from "./education";
import { buildSocialModel, socialTopicFacts, type SocialModel, type SocialPlaceSet, type SocialState, type SocialTopicId, type SocialUnit } from "./social";
import { buildSocialPlaceModel, socialPlaceFacts, type SocialPlaceExtras } from "./socialPlaces";
import type { ClientNationalGdpFact } from "./clientData";
import type { TopicState } from "./topicSeries";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

type SocialWorkbookInput = {
  facts: readonly ClientSocialFact[];
  /** A label for every series the page lists. */
  labels: Readonly<Record<string, string>>;
  /** A label for each heading the page lists; a row sits under its heading's name, so the same row name under two headings stays apart. */
  headingLabels: Readonly<Record<string, string>>;
  /** The SSA tables, each with the id the served facts name it by. */
  sources: readonly (WorkbookPublicSource & { sourceId: string })[];
  /** Geostat's files behind the calculated rows: each joins the Sources sheet only when a calculated row of that kind is exported. */
  populationSources: readonly WorkbookPublicSource[];
  cpiSources: readonly WorkbookPublicSource[];
  gdpSources: readonly WorkbookPublicSource[];
  siteOrigin: string;
  title: string;
} & (
  | { section: SocialTopicId; state: SocialState; gdpFacts: readonly ClientNationalGdpFact[] }
  /** `scope` is the place's slug in the file name, such as `region-guria` or `georgia`. */
  | { set: SocialPlaceSet; placeId: string; scope: string; state: TopicState; extras: SocialPlaceExtras }
);

const UNIT_KEYS: Record<SocialUnit, string> = { persons: "unitPersons", families: "unitFamilies", gel_million: "unitMlnGel", gel: "unitGel", percent: "unitPercent" };
const numberFormatOf = (decimals: number) => decimals ? `#,##0.${"0".repeat(decimals)}` : "#,##0";

/**
 * A topic page's or a place page's selection as a workbook, in the page's unit and to the decimals it shows. A year without
 * a value is an empty cell, never zero. A figure whose fact is calculated (a 12-month sum, an average, a share of residents,
 * an average at 2025 prices, Social payments as % of GDP) is written to the decimals shown and marked calculated, and the
 * Summary sheet carries the note; the rows that divide by Geostat's population, price index or GDP cite that file. Every
 * figure's SSA table is on the Sources sheet.
 */
export function buildSocialWorkbookExportModel(input: SocialWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels, headingLabels } = input, { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `social.${key}`, values);
  const place = "set" in input;
  // The workbook holds the page's shown facts: served rows, and the rows calculated from them.
  const shown = place ? socialPlaceFacts(input.set, input.placeId, input.facts, input.extras) : socialTopicFacts(input.section, input.state.view, input.facts, input.gdpFacts);
  const model: SocialModel = place
    ? buildSocialPlaceModel(input.set, input.placeId, shown, input.state, [])
    : buildSocialModel(input.section, input.facts, input.state, { breaks: [], gdpFacts: input.gdpFacts });
  const byCell = new Map(shown.map(f => [`${f.indicatorId}:${f.year}`, f]));
  const cell = (id: string, year: number) => byCell.get(`${id}:${year}`);
  const hasValue = (series: { id: string }) => model.years.some(year => cell(series.id, year));
  const gdpView = !place && input.state.view === "gdp";
  // A figure is calculated by fiscal.ge when its fact says so: a 12-month sum or an average of SSA's rows, a share of residents, a value at 2025 prices or a % of GDP.
  const isCalculated = (id: string, year: number) => cell(id, year)?.valueStatus === "calculated";
  const neededYears = neededSourceYears(model.selected, model.years, (series, year) => cell(series.id, year)?.sourceId);
  // A value without its source link would leave the workbook uncited.
  const known = new Set(input.sources.map(source => source.sourceId));
  for (const sourceId of neededYears.keys()) if (!known.has(sourceId)) throw new Error(`Missing public source for social source ${sourceId}`);
  // Geostat's files join only for the rows that divide by them.
  const geostatRows = model.selected.filter(hasValue);
  const geostat = [
    ...(geostatRows.some(series => series.calculated === "share") ? input.populationSources : []),
    ...(geostatRows.some(series => series.calculated === "real") ? input.cpiSources : []),
    ...(gdpView && geostatRows.length ? input.gdpSources : []),
  ];
  const anyCalculated = model.selected.some(series => model.years.some(year => isCalculated(series.id, year)));
  const lead = model.selected[0] ?? model.series[0];
  const unitLabel = t(gdpView ? "unitPercentGdp" : UNIT_KEYS[model.unit]);
  const numberFormat = numberFormatOf(lead.decimals);
  // A calculated figure is written to the decimals the page shows it with, so the cell holds the figure the reader sees.
  const valueOf = (id: string, year: number, value: number | null) => value === null ? null : isCalculated(id, year) ? Number(value.toFixed(lead.decimals)) : value;
  // A programme that ran part of a year says how many months its money or average covers.
  const status = (series: { id: string; partialMonths: Record<number, number> }, year: number) => {
    if (!cell(series.id, year)) return workbookMessage(locale, "workbook.unavailable");
    const base = isCalculated(series.id, year) ? t("status.calculated") : t("status.official");
    const months = series.partialMonths[year];
    return months === undefined ? base : `${base} · ${t("months.partial", { n: months })}`;
  };
  // A row whose name is its heading's is named alone, never "Money paid — Money paid".
  const headingOf = (series: { id: string; heading: string }) => {
    const heading = headingLabels[series.heading];
    return heading === undefined || heading === labels[series.id] ? null : heading;
  };
  const labelled = (series: { id: string; heading: string }) => {
    const heading = headingOf(series);
    return heading === null ? labels[series.id] : educationFullLabel(heading, labels[series.id]);
  };
  // `social-payments` and `social-package` already say social; Pensions and Subsistence allowance get the prefix.
  const part = place ? `${input.set}-${input.scope}` : input.section;
  const stem = `${part.startsWith("social-") ? "" : "social-"}${part}-${model.range.start}-${model.range.end}`;
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  return {
    locale, filename: workbookFilename(stem, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: [`${model.range.start}–${model.range.end} · ${unitLabel}`, ...(anyCalculated ? [t("workbook.calculatedNote")] : [])].join(" · "),
      unitLabel, amountDecimals: lead.decimals, years: model.years, showChangeColumn: false, numberFormat, ...(anyCalculated ? { fitSubtitle: true } : {}),
      rows: model.selected.map(series => {
        const values = Object.fromEntries(model.years.map(year => [year, valueOf(series.id, year, series.valuesByYear[year])]));
        return {
          kind: series.reference ? "total" : "item", parentLabel: headingOf(series), label: labels[series.id], change: null, valuesByYear: values,
          basisByYear: Object.fromEntries(model.years.map(year => [year, values[year] === null ? null : "actual"])),
        };
      }),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), workbookMessage(locale, "workbook.category"), unitLabel, workbookMessage(locale, "workbook.status")],
      rows: cells.map(({ year, series }) => [year, labelled(series), valueOf(series.id, year, series.valuesByYear[year]), status(series, year)]),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls([...sourcesForNeededYears(input.sources, neededYears), ...geostat], input.siteOrigin),
  };
}

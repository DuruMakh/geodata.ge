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
 * a value is an empty cell, never zero. A row fiscal.ge calculates (a share of residents, an average at 2025 prices, Social
 * payments as % of GDP) is written to the decimals shown, is marked calculated, carries the Summary note and cites the
 * Geostat file it divides by; every other figure is SSA's, from the tables the Sources sheet lists.
 */
export function buildSocialWorkbookExportModel(input: SocialWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels, headingLabels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `social.${key}`);
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
  const isCalculated = (series: { calculated?: "share" | "real" }) => series.calculated !== undefined || gdpView;
  const neededYears = neededSourceYears(model.selected, model.years, (series, year) => cell(series.id, year)?.sourceId);
  // A value without its source link would leave the workbook uncited.
  const known = new Set(input.sources.map(source => source.sourceId));
  for (const sourceId of neededYears.keys()) if (!known.has(sourceId)) throw new Error(`Missing public source for social source ${sourceId}`);
  const calculatedRows = model.selected.filter(series => isCalculated(series) && hasValue(series));
  const geostat = [
    ...(calculatedRows.some(series => series.calculated === "share") ? input.populationSources : []),
    ...(calculatedRows.some(series => series.calculated === "real") ? input.cpiSources : []),
    ...(calculatedRows.length && gdpView ? input.gdpSources : []),
  ];
  const lead = model.selected[0] ?? model.series[0];
  const unitLabel = t(gdpView ? "unitPercentGdp" : UNIT_KEYS[model.unit]);
  const numberFormat = numberFormatOf(lead.decimals);
  // A calculated figure is written to the decimals the page shows it with, so the cell holds the figure the reader sees.
  const valueOf = (series: { calculated?: "share" | "real" }, value: number | null) =>
    value === null ? null : isCalculated(series) ? Number(value.toFixed(lead.decimals)) : value;
  const status = (series: { id: string; calculated?: "share" | "real" }, year: number) =>
    !cell(series.id, year) ? workbookMessage(locale, "workbook.unavailable") : isCalculated(series) ? t("status.calculated") : t("status.official");
  // A row whose name is its heading's is named alone, never "Money paid — Money paid".
  const headingOf = (series: { id: string; heading: string }) => {
    const heading = headingLabels[series.heading];
    return heading === undefined || heading === labels[series.id] ? null : heading;
  };
  const labelled = (series: { id: string; heading: string }) => {
    const heading = headingOf(series);
    return heading === null ? labels[series.id] : educationFullLabel(heading, labels[series.id]);
  };
  const stem = `social-${place ? `${input.set}-${input.scope}` : input.section}-${model.range.start}-${model.range.end}`;
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  return {
    locale, filename: workbookFilename(stem, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: [`${model.range.start}–${model.range.end} · ${unitLabel}`, ...(calculatedRows.length ? [t("workbook.calculatedNote")] : [])].join(" · "),
      unitLabel, amountDecimals: lead.decimals, years: model.years, showChangeColumn: false, numberFormat, ...(calculatedRows.length ? { fitSubtitle: true } : {}),
      rows: model.selected.map(series => {
        const values = Object.fromEntries(model.years.map(year => [year, valueOf(series, series.valuesByYear[year])]));
        return {
          kind: series.reference ? "total" : "item", parentLabel: headingOf(series), label: labels[series.id], change: null, valuesByYear: values,
          basisByYear: Object.fromEntries(model.years.map(year => [year, values[year] === null ? null : "actual"])),
        };
      }),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), workbookMessage(locale, "workbook.category"), unitLabel, workbookMessage(locale, "workbook.status")],
      rows: cells.map(({ year, series }) => [year, labelled(series), valueOf(series, series.valuesByYear[year]), status(series, year)]),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls([...sourcesForNeededYears(input.sources, neededYears), ...geostat], input.siteOrigin),
  };
}

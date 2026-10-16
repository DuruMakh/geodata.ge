import Decimal from "decimal.js";
import { EDUCATION_GEORGIA, educationFactKey, type ClientEducationFact } from "../data/education/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildEducationModel, educationFullLabel, educationPeriodLabel, type EducationModel, type EducationState, type EducationTopicId } from "./education";
import { buildEducationPlaceModel, type EducationPlaceSet } from "./educationPlaces";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

type EducationWorkbookInput = {
  facts: readonly ClientEducationFact[];
  /** A label for every series the page lists. */
  labels: Readonly<Record<string, string>>;
  /** A label for each heading (measure) the page lists; a row sits under its heading's name, so "Total" under Students and under Graduates stay apart. */
  headingLabels: Readonly<Record<string, string>>;
  sources: readonly (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  title: string;
} & ({ section: EducationTopicId; state: EducationState } | { set: EducationPlaceSet; placeId: string; /** The place's slug in the file name, such as `guria` or `georgia`. */ scope: string; state: EducationState });

/** A school year in a file name: `2025-26` (the slash is not allowed there). */
const fileSafe = (label: string) => label.replace("/", "-");

/**
 * A topic page's or a place page's selection as a workbook. Persons and institutions are whole numbers; Georgia's pupils,
 * which Geostat publishes in thousands to one decimal, are exported as that published figure. A year Geostat left blank is
 * an empty cell, never zero. The Sources sheet lists only the Geostat workbooks the exported values come from.
 */
export function buildEducationWorkbookExportModel(input: EducationWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels, headingLabels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `education.${key}`);
  const place = "set" in input;
  const section = place ? input.set : input.section;
  const geographyId = place ? input.placeId : EDUCATION_GEORGIA;
  const model: EducationModel = place ? buildEducationPlaceModel(input.set, input.placeId, input.facts, input.state) : buildEducationModel(input.section, input.facts, input.state);
  const period = educationPeriodLabel(section);
  const stem = `education-${place ? `${input.set}-${input.scope}` : input.section}-${fileSafe(period(model.range.start))}-${fileSafe(period(model.range.end))}`;
  const byCell = new Map(input.facts.map(f => [educationFactKey(f), f]));
  const cellOf = (id: string, year: number) => byCell.get(`${id}:${geographyId}:${year}`);
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) => cellOf(series.id, year)?.sourceId));
  // Georgia's pupils are the only one-decimal rows: the client holds them as whole persons, the workbook shows Geostat's thousands.
  const lead = model.selected[0] ?? model.series[0];
  const inThousands = lead.decimals === 1;
  const unitLabel = t(inThousands ? "unitThousandPupils" : model.unit === "institutions" ? "unitInstitutions" : "unitPersons");
  const numberFormat = inThousands ? "#,##0.0" : "#,##0";
  const toExport = (value: number | null) => value === null ? null : inThousands ? new Decimal(value).dividedBy(1000).toNumber() : value;
  const status = (id: string, year: number) => cellOf(id, year) ? t("status.official") : workbookMessage(locale, "workbook.unavailable");
  // A row whose name is its heading's ("Teachers" under Teachers) is named alone, never "Teachers — Teachers".
  const headingOf = (series: { id: string; heading: string }) => {
    const heading = headingLabels[series.heading];
    return heading === undefined || heading === labels[series.id] ? null : heading;
  };
  const labelled = (series: { id: string; heading: string }) => {
    const heading = headingOf(series);
    return heading === null ? labels[series.id] : educationFullLabel(heading, labels[series.id]);
  };
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  return {
    locale, filename: workbookFilename(stem, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: input.title, subtitle: `${period(model.range.start)}–${period(model.range.end)} · ${unitLabel}`,
      unitLabel, amountDecimals: inThousands ? 1 : 0, years: model.years, showChangeColumn: false, numberFormat,
      headerLabels: { category: workbookMessage(locale, "workbook.category"), columns: model.years.map(period) },
      rows: model.selected.map(series => {
        const values = Object.fromEntries(model.years.map(year => [year, toExport(series.valuesByYear[year])]));
        return {
          kind: series.reference ? "total" : "item", parentLabel: headingOf(series), label: labels[series.id], change: null, valuesByYear: values,
          basisByYear: Object.fromEntries(model.years.map(year => [year, values[year] === null ? null : "actual"])),
        };
      }),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), workbookMessage(locale, "workbook.category"), unitLabel, workbookMessage(locale, "workbook.status")],
      rows: cells.map(({ year, series }) => [period(year), labelled(series), toExport(series.valuesByYear[year]), status(series.id, year)]),
      numericFormats: { 3: numberFormat },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
    periodLabel: period,
  };
}

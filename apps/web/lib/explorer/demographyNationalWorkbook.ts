import { CENSUS_STEP, SERIES, SOURCE_ID } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ClientNationalFact } from "../servedRows";
import { AGE_GROUPS, LIFE_SERIES, nationalYears, seriesByYear } from "./demographyNational";
import { SHEET_NAMES, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource, type WorkbookReadableRow } from "./workbookModel";

type Input = { facts: readonly ClientNationalFact[]; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string };
type Line = { label: string; unit: string; values: Record<number, number | null> };

function nationalWorkbook(input: Input, presentation: Presentation, spec: { slug: string; titleKey: string; sourceId: string; lines: Line[]; decimals: number; format: string; numberFormat?: string }): WorkbookExportModel {
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `demography.${key}`);
  const w = (key: Parameters<typeof workbookMessage>[1]) => workbookMessage(locale, key);
  const years = nationalYears(input.facts);
  const [first, last] = [years[0]!, years.at(-1)!];
  const yearLabel = (year: number) => (year === CENSUS_STEP.toYear ? `${year} · ${t("breakLabel")}` : String(year));
  const row = (line: Line): WorkbookReadableRow => ({
    kind: "item",
    parentLabel: null,
    label: line.label,
    change: null,
    valuesByYear: Object.fromEntries(years.map((year) => [year, line.values[year] ?? null])),
    basisByYear: Object.fromEntries(years.map((year) => [year, line.values[year] === null ? null : ("published" as const)])),
  });
  const originals = input.sources
    .filter((source) => source.sourceId === spec.sourceId)
    .map(({ sourceId: _sourceId, ...source }) => ({ ...source, years: source.years.filter((year) => years.includes(year)) }))
    .filter((source) => source.years.length > 0);
  return {
    locale,
    filename: workbookFilename(`demography-${spec.slug}-${first}-${last}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t(spec.titleKey),
      subtitle: `${first}–${last}`,
      unitLabel: "",
      amountDecimals: spec.decimals,
      ...(spec.numberFormat ? { numberFormat: spec.numberFormat } : {}),
      showChangeColumn: false,
      years,
      // The re-base year says so in its column header: these rates use population denominators.
      headerLabels: { category: t("seriesHeader"), columns: years.map(yearLabel), wrap: true },
      rows: spec.lines.map(row),
    },
    analysis: {
      headers: [t("seriesHeader"), w("workbook.year"), t("valueHeader"), t("unitHeader"), t("basisHeader"), w("workbook.status")],
      rows: spec.lines.flatMap((line) =>
        years.map((year) => [line.label, year, line.values[year] ?? null, line.unit, t("vitalBasis"), w(line.values[year] === null ? "workbook.unavailable" : "workbook.published")]),
      ),
      numericFormats: { 3: spec.format },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}

export function buildFertilityWorkbookExportModel(input: Input, presentation: Presentation): WorkbookExportModel {
  const t = (key: string) => message(presentation.messages, `demography.${key}`);
  const [tfrUnit, asfrUnit] = [t("tfrUnit"), t("asfrUnit")];
  return nationalWorkbook(input, presentation, {
    slug: "fertility",
    titleKey: "fertilityWorkbookTitle",
    sourceId: SOURCE_ID.fertility,
    decimals: 2,
    // The total rate prints as 2.31 and the age rates as 51.5, each as Geostat publishes it.
    format: "0.0#",
    numberFormat: "0.0#",
    lines: [
      { label: `${t("tfrLabel")} (${tfrUnit})`, unit: tfrUnit, values: seriesByYear(input.facts, SERIES.totalFertilityRate) },
      ...AGE_GROUPS.map((group) => ({
        label: `${t(`ageGroup.${group}`)} (${asfrUnit})`,
        unit: asfrUnit,
        values: seriesByYear(input.facts, SERIES.ageSpecificFertilityRate, group),
      })),
    ],
  });
}

export function buildLifeWorkbookExportModel(input: Input, presentation: Presentation): WorkbookExportModel {
  const t = (key: string) => message(presentation.messages, `demography.${key}`);
  return nationalWorkbook(input, presentation, {
    slug: "life-expectancy",
    titleKey: "lifeWorkbookTitle",
    sourceId: SOURCE_ID.lifeExpectancy,
    decimals: 1,
    format: "0.0",
    lines: LIFE_SERIES.map((line) => ({ label: t(line.key), unit: t("lifeUnit"), values: seriesByYear(input.facts, line.seriesId) })),
  });
}

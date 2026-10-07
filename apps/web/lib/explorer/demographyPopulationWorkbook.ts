import { CENSUS_STEP, SERIES, SOURCE_ID } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ClientDemographyObservation } from "../servedRows";
import { placeLabel, type DemographyPlace } from "./demographyAreas";
import { buildPopulationModel, populationBasisKey, type PopulationState } from "./demographyPopulation";
import {
  SHEET_NAMES,
  withAbsoluteUrls,
  workbookFilename,
  type WorkbookExportModel,
  type WorkbookPublicSource,
} from "./workbookModel";

const LEVEL_KEYS = { country: "levelCountry", region: "levelRegion", municipality: "levelMunicipality" } as const;

export function buildPopulationWorkbookExportModel(
  facts: readonly ClientDemographyObservation[],
  places: readonly DemographyPlace[],
  state: PopulationState,
  presentation: Presentation,
  sources: readonly (WorkbookPublicSource & { sourceId: string })[],
  siteOrigin: string,
): WorkbookExportModel {
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `demography.${key}`);
  const w = (key: Parameters<typeof workbookMessage>[1]) => workbookMessage(locale, key);
  const model = buildPopulationModel({ facts, places, state, locale });
  const densityByCell = new Map<string, number>();
  for (const fact of facts) {
    if (fact.seriesId === SERIES.populationDensity) densityByCell.set(`${fact.geographyId}:${fact.year}`, fact.value);
  }
  // Density is published for Georgia and the regions only.
  const densityAt = (place: DemographyPlace, year: number): number | null =>
    place.level === "municipality" ? null : (densityByCell.get(`${place.id}:${year}`) ?? null);

  const needed = new Set<string>();
  if (model.selected.length > 0) needed.add(SOURCE_ID.populationUnits);
  if (model.selected.some((place) => model.years.some((year) => densityAt(place, year) !== null))) needed.add(SOURCE_ID.density);
  const originals = sources
    .filter((source) => needed.has(source.sourceId))
    .map((source) => ({ ...source, years: source.years.filter((year) => model.years.includes(year)) }))
    .filter((source) => source.years.length > 0);

  const unitLabel = t("unitPersons");
  return {
    locale,
    filename: workbookFilename(`demography-population-${model.range.start}-${model.range.end}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t("workbookTitle"),
      subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel,
      amountDecimals: 0,
      showChangeColumn: false,
      years: model.years,
      // The re-base year says so in its column header, so the Summary table is never read straight across the break.
      // That label is longer than a year column, so the header row wraps rather than losing the start of the text.
      headerLabels: {
        category: t("placeHeader"),
        columns: model.years.map((year) => (year === CENSUS_STEP.toYear ? `${year} · ${t("breakLabel")}` : String(year))),
        wrap: true,
      },
      rows: model.selected.map((place) => ({
        kind: place.level === "country" ? "total" : "item",
        parentLabel: null,
        label: placeLabel(place, locale),
        change: null,
        valuesByYear: Object.fromEntries(model.years.map((year) => [year, model.valueAt(place.id, year)])),
        basisByYear: Object.fromEntries(
          model.years.map((year) => [year, model.valueAt(place.id, year) === null ? null : ("published" as const)]),
        ),
      })),
    },
    analysis: {
      headers: [
        t("placeHeader"),
        t("levelHeader"),
        w("workbook.year"),
        t("populationHeader"),
        t("densityHeader"),
        t("basisHeader"),
        w("workbook.status"),
      ],
      rows: model.years.flatMap((year) =>
        model.selected.map((place) => {
          const persons = model.valueAt(place.id, year);
          const basis = message(messages, populationBasisKey(year));
          return [
            placeLabel(place, locale),
            t(LEVEL_KEYS[place.level]),
            year,
            persons,
            densityAt(place, year),
            // The re-base year is flagged in words, so a reader of the data sheet alone is warned.
            year === CENSUS_STEP.toYear ? `${basis} · ${t("breakLabel")}` : basis,
            w(persons === null ? "workbook.unavailable" : "workbook.published"),
          ];
        }),
      ),
      // Column numbers, counted from 1: Population and Density.
      numericFormats: { 4: "#,##0", 5: "#,##0.0" },
      // Place, Level, Year, Population, Density, Basis, Status. Chosen from a character count weighted for Georgian
      // script, whose letters run wider than Excel's column unit, so they are approximate, not exact. A test checks
      // each column against the longest text in both languages: body cells weighted, header cells (which wrap) plain.
      columnWidths: [36, 18, 8, 21, 28, 60, 26],
    },
    sources: withAbsoluteUrls(originals.map(({ sourceId: _sourceId, ...source }) => source), siteOrigin),
  };
}

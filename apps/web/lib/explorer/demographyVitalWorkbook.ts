import { SOURCE_ID } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ClientDemographyObservation } from "../servedRows";
import { placeLabel, type DemographyPlace } from "./demographyAreas";
import { buildVitalPlaceModel } from "./demographyVital";
import { SHEET_NAMES, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource, type WorkbookReadableRow } from "./workbookModel";

const LEVEL_KEYS = { country: "levelCountry", region: "levelRegion", municipality: "levelMunicipality" } as const;
const ORIGINALS = new Set<string>([SOURCE_ID.births, SOURCE_ID.deaths, SOURCE_ID.naturalIncrease]);

export function buildVitalWorkbookExportModel(
  input: {
    facts: readonly ClientDemographyObservation[];
    place: DemographyPlace;
    sources: readonly (WorkbookPublicSource & { sourceId: string })[];
    siteOrigin: string;
    /** The place named in the file name, as the population workbook names it (`batumi`, `region-adjara`, `georgia`). */
    scope: string;
  },
  presentation: Presentation,
): WorkbookExportModel {
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `demography.${key}`);
  const w = (key: Parameters<typeof workbookMessage>[1]) => workbookMessage(locale, key);
  const model = buildVitalPlaceModel(input.facts, input.place.id);
  if (!model) throw new Error(`No births and deaths for ${input.place.id}`);
  const [first, last] = [model.years[0]!, model.years.at(-1)!];
  const row = (kind: WorkbookReadableRow["kind"], label: string, values: Record<number, number | null>): WorkbookReadableRow => ({
    kind,
    parentLabel: null,
    label,
    change: null,
    valuesByYear: Object.fromEntries(model.years.map((year) => [year, values[year] ?? null])),
    basisByYear: Object.fromEntries(model.years.map((year) => [year, values[year] === null || values[year] === undefined ? null : ("published" as const)])),
  });
  const originals = input.sources
    .filter((source) => ORIGINALS.has(source.sourceId))
    .map(({ sourceId: _sourceId, ...source }) => ({ ...source, years: source.years.filter((year) => model.years.includes(year)) }))
    .filter((source) => source.years.length > 0);
  const unitLabel = t("personsHeader");
  const name = placeLabel(input.place, locale);
  return {
    locale,
    filename: workbookFilename(`demography-births-deaths-${input.scope}-${first}-${last}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${t("vitalWorkbookTitle")} · ${name}`,
      subtitle: `${first}–${last} · ${unitLabel}`,
      unitLabel,
      amountDecimals: 0,
      showChangeColumn: false,
      years: model.years,
      // Natural increase is signed; its sign is neither good nor bad, so it is not shown in red.
      numberFormat: "#,##0;−#,##0",
      rows: [row("item", t("vitalBirths"), model.births), row("item", t("vitalDeaths"), model.deaths), row("total", t("vitalNatural"), model.natural)],
    },
    analysis: {
      headers: [t("placeHeader"), t("levelHeader"), w("workbook.year"), t("vitalBirths"), t("vitalDeaths"), t("vitalNatural"), t("basisHeader"), w("workbook.status")],
      rows: model.years.map((year) => [
        name,
        t(LEVEL_KEYS[input.place.level]),
        year,
        model.births[year] ?? null,
        model.deaths[year] ?? null,
        model.natural[year] ?? null,
        t("vitalBasis"),
        w(model.births[year] === null || model.births[year] === undefined ? "workbook.unavailable" : "workbook.published"),
      ]),
      // Column numbers, counted from 1: Births, Deaths, Natural increase.
      numericFormats: { 4: "#,##0", 5: "#,##0", 6: "#,##0;−#,##0" },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}

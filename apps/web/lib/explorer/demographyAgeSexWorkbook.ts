import { CENSUS_STEP, SOURCE_ID } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ClientAgeFact } from "../servedRows";
import {
  AGE_SEX_GROUPS,
  ageGroupLabel,
  ageYears,
  annualPyramid,
  censusPyramid,
  crossesBreak,
  heatmapRows,
  shareOf,
  type Pyramid,
} from "./demographyAgeSex";
import { placeLabel, type DemographyPlace } from "./demographyAreas";
import { populationBasisKey } from "./demographyPopulation";
import {
  SHEET_NAMES,
  withAbsoluteUrls,
  workbookFilename,
  type WorkbookExportModel,
  type WorkbookPublicSource,
  type WorkbookReadableRow,
} from "./workbookModel";

type Source = WorkbookPublicSource & { sourceId: string };
type Input = { facts: readonly ClientAgeFact[]; sources: readonly Source[]; siteOrigin: string };
type Settlement = ClientAgeFact["settlement"];

const SETTLEMENT_KEYS = { total: "settlementAll", urban: "settlementUrban", rural: "settlementRural" } as const;
// Group order on every table: the oldest group first, as the pyramid is read from the top.
const OLDEST_FIRST = [...AGE_SEX_GROUPS].reverse();
const SEXES = ["male", "female"] as const;
// The Data sheet stores a share to the one decimal it shows; the persons beside it keep the exact count.
const shareToShow = (share: number) => Math.round(share * 10) / 10;

function helpers(presentation: Presentation) {
  const { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `demography.${key}`, values);
  const w = (key: Parameters<typeof workbookMessage>[1]) => workbookMessage(locale, key);
  // A year's lineage in words; the re-base year is flagged as in the Population workbook, so a reader of the data sheet alone is warned.
  const annualBasis = (year: number) => {
    const basis = message(messages, populationBasisKey(year));
    return year === CENSUS_STEP.toYear ? `${basis} · ${t("breakLabel")}` : basis;
  };
  const yearLabel = (year: number) => (year === CENSUS_STEP.toYear ? `${year} · ${t("breakLabel")}` : String(year));
  return { locale, t, w, annualBasis, yearLabel };
}

/** The workbook's own source only, cut to the years it describes. */
function ownSources(input: Input, sourceId: string, years: readonly number[], override?: number[]) {
  const originals = input.sources
    .filter((source) => source.sourceId === sourceId)
    .map(({ sourceId: _sourceId, ...source }) => ({ ...source, years: override ?? source.years.filter((year) => years.includes(year)) }))
    .filter((source) => source.years.length > 0);
  return withAbsoluteUrls(originals, input.siteOrigin);
}

type Part = { pyramid: Pyramid; year: number; basis: string };

function pyramidWorkbook(
  presentation: Presentation,
  spec: { title: string; subtitle: string; unitLabel: string; stem: string; parts: Part[]; sourceYears: number[]; sources: WorkbookExportModel["sources"] },
): WorkbookExportModel {
  const { locale, t, w } = helpers(presentation);
  const labelled = spec.parts.length > 1;
  const columns = spec.parts.flatMap((part) =>
    (["sexMale", "sexFemale", "totalHeader"] as const).map((key) => (labelled ? `${t(key)} ${part.year}` : t(key))),
  );
  const indexes = columns.map((_, index) => index);
  const byGroup = (group: (typeof AGE_SEX_GROUPS)[number]) =>
    spec.parts.flatMap((part) => {
      const row = part.pyramid.rows[AGE_SEX_GROUPS.indexOf(group)]!;
      return [row.male, row.female, row.male + row.female];
    });
  const readableRow = (label: string, values: number[], kind: WorkbookReadableRow["kind"]): WorkbookReadableRow => ({
    kind,
    parentLabel: null,
    label,
    change: null,
    valuesByYear: Object.fromEntries(indexes.map((index) => [index, values[index]!])),
    basisByYear: Object.fromEntries(indexes.map((index) => [index, "published" as const])),
  });
  return {
    locale,
    filename: workbookFilename(spec.stem, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: spec.title,
      subtitle: spec.subtitle,
      unitLabel: spec.unitLabel,
      amountDecimals: 0,
      showChangeColumn: false,
      // Columns are men, women and total (twice with a comparison), so they are keyed by position, not by year.
      years: indexes,
      headerLabels: { category: t("ageGroupHeader"), columns, wrap: true },
      rows: [
        ...OLDEST_FIRST.map((group) => readableRow(ageGroupLabel(group), byGroup(group), "item")),
        readableRow(t("totalHeader"), spec.parts.flatMap((part) => [part.pyramid.male, part.pyramid.female, part.pyramid.total]), "total"),
      ],
    },
    analysis: {
      headers: [w("workbook.year"), t("sexHeader"), t("ageGroupHeader"), t("personsHeader"), t("sharePercentHeader"), t("basisHeader")],
      rows: spec.parts.flatMap((part) =>
        SEXES.flatMap((sex) =>
          OLDEST_FIRST.map((group) => {
            const persons = part.pyramid.rows[AGE_SEX_GROUPS.indexOf(group)]![sex];
            return [part.year, t(sex === "male" ? "sexMale" : "sexFemale"), ageGroupLabel(group), persons, shareToShow(shareOf(persons, part.pyramid.total)), part.basis];
          }),
        ),
      ),
      numericFormats: { 4: "#,##0", 5: "0.0" },
      columnWidths: [8, 14, 10, 14, 10, 56],
    },
    sources: spec.sources,
    sourceYears: spec.sourceYears,
  };
}

export function buildPyramidWorkbookExportModel(input: Input & { year: number; compare: number | null }, presentation: Presentation): WorkbookExportModel {
  const { t, annualBasis } = helpers(presentation);
  const years = input.compare === null ? [input.year] : [input.year, input.compare];
  return pyramidWorkbook(presentation, {
    title: t("pyramidWorkbookTitle"),
    // Counts are not comparable across the 2025 re-base, so the readable sheet says so beside the years.
    subtitle: `${years.join(" · ")} · ${t("unitPersons")}${input.compare !== null && crossesBreak(input.year, input.compare) ? ` · ${t("breakLabel")}` : ""}`,
    unitLabel: t("unitPersons"),
    stem: `demography-age-sex-georgia-${years.join("-")}`,
    parts: years.map((year) => ({ pyramid: annualPyramid(input.facts, year), year, basis: annualBasis(year) })),
    sourceYears: years,
    sources: ownSources(input, SOURCE_ID.ageSex, years),
  });
}

export function buildCensusPlaceWorkbookExportModel(
  input: Input & { place: DemographyPlace; settlement: Settlement; scope: string },
  presentation: Presentation,
): WorkbookExportModel {
  const { locale, t } = helpers(presentation);
  const year = CENSUS_STEP.fromYear;
  return pyramidWorkbook(presentation, {
    title: t("censusWorkbookTitle", { place: placeLabel(input.place, locale) }),
    subtitle: `${t(SETTLEMENT_KEYS[input.settlement])} · ${t("censusDate")}`,
    unitLabel: t("personsHeader"),
    stem: `demography-age-sex-${input.scope}-census-${year}-${input.settlement}`,
    parts: [{ pyramid: censusPyramid(input.facts, input.settlement), year, basis: t("censusBasis") }],
    sourceYears: [year],
    // The census file describes one date; its archive row is cited whatever years that row lists.
    sources: ownSources(input, SOURCE_ID.censusAge, [year], [year]),
  });
}

/** Years as columns, one row per line, every value a percent of that year's population. */
function percentByYearWorkbook(
  input: Input,
  presentation: Presentation,
  spec: { title: string; stem: string; years: number[]; lines: { label: string; values: Record<number, number> }[]; headers: string[]; dataRows: Array<Array<string | number | null>>; numericFormats: Record<number, string>; columnWidths: number[] },
): WorkbookExportModel {
  const { locale, t, yearLabel } = helpers(presentation);
  const [first, last] = [spec.years[0]!, spec.years.at(-1)!];
  return {
    locale,
    filename: workbookFilename(`${spec.stem}-${first}-${last}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: spec.title,
      subtitle: `${first}–${last} · ${t("unitShare")}`,
      unitLabel: t("unitShare"),
      amountDecimals: 1,
      numberFormat: "0.0",
      showChangeColumn: false,
      years: spec.years,
      // The re-base year says so in its column header: shares before and after it rest on different population bases.
      headerLabels: { category: t("ageGroupHeader"), columns: spec.years.map(yearLabel), wrap: true },
      rows: spec.lines.map((line) => ({
        kind: "item" as const,
        parentLabel: null,
        label: line.label,
        change: null,
        valuesByYear: Object.fromEntries(spec.years.map((year) => [year, line.values[year] ?? null])),
        basisByYear: Object.fromEntries(spec.years.map((year) => [year, "published" as const])),
      })),
    },
    analysis: { headers: spec.headers, rows: spec.dataRows, numericFormats: spec.numericFormats, columnWidths: spec.columnWidths },
    sources: ownSources(input, SOURCE_ID.ageSex, spec.years),
  };
}

export function buildAgeYearWorkbookExportModel(input: Input, presentation: Presentation): WorkbookExportModel {
  const { t, w, annualBasis } = helpers(presentation);
  const years = ageYears(input.facts);
  const heat = heatmapRows(input.facts, years);
  const pyramids = years.map((year) => annualPyramid(input.facts, year));
  const lines = heat.rows.map((row) => ({ label: row.label, values: Object.fromEntries(years.map((year, index) => [year, row.values[index]!])) as Record<number, number> }));
  return percentByYearWorkbook(input, presentation, {
    title: t("heatWorkbookTitle"),
    stem: "demography-age-by-year",
    years,
    lines,
    headers: [w("workbook.year"), t("ageGroupHeader"), t("personsHeader"), t("sharePercentHeader"), t("basisHeader")],
    dataRows: years.flatMap((year, yearIndex) =>
      heat.rows.map((row) => {
        const pyramidRow = pyramids[yearIndex]!.rows[AGE_SEX_GROUPS.indexOf(row.id)]!;
        return [year, row.label, pyramidRow.male + pyramidRow.female, shareToShow(row.values[yearIndex]!), annualBasis(year)];
      }),
    ),
    numericFormats: { 3: "#,##0", 4: "0.0" },
    columnWidths: [8, 10, 14, 10, 56],
  });
}

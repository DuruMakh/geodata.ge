import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SOURCE_ID } from "../../lib/data/demography/series";
import { annualAgeFacts, censusAgeFactsForPlace } from "../../lib/explorer/demographyAgeSex";
import {
  buildAgeYearWorkbookExportModel,
  buildCensusPlaceWorkbookExportModel,
  buildPyramidWorkbookExportModel,
} from "../../lib/explorer/demographyAgeSexWorkbook";
import type { DemographyPlace } from "../../lib/explorer/demographyAreas";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import type { Locale } from "../../lib/i18n/types";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { loadPopulationBasics } from "../../lib/pages/demography-population";
import type { ClientAgeFact } from "../../lib/servedRows";

type Presentation = Awaited<ReturnType<typeof getPresentation>>;

const source = (sourceId: string) => ({
  sourceId,
  years: Array.from({ length: 23 }, (_, index) => 2004 + index),
  title: `Title of ${sourceId}`,
  organization: "Geostat",
  downloadHref: `/downloads/methodology/${sourceId}.csv` as const,
  retrievedAt: "2026-10-01",
});
// Two of the dataset's own sources and one that belongs to another page: each workbook must keep only its own.
const sources = [source(SOURCE_ID.ageSex), source(SOURCE_ID.censusAge), source("source.geostat_demography_births")];

let annual: ClientAgeFact[];
let imereti: ClientAgeFact[];
let place: DemographyPlace;
const presentations = {} as Record<Locale, Presentation>;

beforeAll(async () => {
  const [{ facts }, basics] = await Promise.all([loadServedDemographyData(), loadPopulationBasics("en")]);
  annual = annualAgeFacts(facts);
  imereti = censusAgeFactsForPlace(facts, "region.imereti");
  place = basics.places.find((candidate) => candidate.id === "region.imereti")!;
  for (const locale of ["en", "ka"] as const) presentations[locale] = await getPresentation(locale, ["demography", "workbook"], []);
});

const input = () => ({ facts: annual, sources, siteOrigin: "https://fiscal.ge" });
const forbidden = ["sourceLocator", "estimateBasis", "lastReviewedAt"];
const noInternalColumns = (model: WorkbookExportModel) => {
  const headers = [...model.analysis.headers, ...(model.readable.headerLabels?.columns ?? []), model.readable.headerLabels?.category ?? ""];
  for (const header of headers) for (const word of forbidden) expect(header).not.toContain(word);
};
const sourceIds = (model: WorkbookExportModel) => model.sources.map((entry) => entry.title);

describe.each(["en", "ka"] as const)("the age and sex workbooks (%s)", (locale) => {
  const presentation = () => presentations[locale];

  it("pyramid: 18 groups with the oldest first, then the total", () => {
    const model = buildPyramidWorkbookExportModel({ ...input(), year: 2026, compare: null }, presentation());
    expect(model.readable.rows).toHaveLength(19);
    expect(model.readable.rows[0]!.label).toBe("85+");
    expect(model.readable.rows[17]!.label).toBe("0–4");
    const total = model.readable.rows.at(-1)!;
    expect(total.kind).toBe("total");
    expect(model.readable.years.map((column) => total.valuesByYear[column])).toEqual([1_887_646, 2_053_457, 3_941_103]);
    expect(model.readable.headerLabels!.columns).toHaveLength(3);
    expect(model.filename).toContain("2026");
    expect(model.sourceYears).toEqual([2026]);
    noInternalColumns(model);
  });

  it("pyramid: the data sheet has a row per sex and group, with the share to one decimal", () => {
    const model = buildPyramidWorkbookExportModel({ ...input(), year: 2026, compare: null }, presentation());
    expect(model.analysis.rows).toHaveLength(36);
    expect(model.analysis.headers).toHaveLength(6);
    expect(model.analysis.numericFormats![5]).toBe("0.0");
    for (const row of model.analysis.rows) expect(row[5]).toEqual(expect.any(String));
    const oldest = model.analysis.rows.filter((row) => row[2] === "85+");
    expect(oldest).toHaveLength(2);
    expect(oldest.map((row) => row[1])).toEqual([presentation().messages["demography.sexMale" as never], presentation().messages["demography.sexFemale" as never]]);
    for (const row of oldest) {
      expect(row[0]).toBe(2026);
      expect(row[3]).toEqual(expect.any(Number));
      // U26-14: the share is stored to the one decimal it shows, not as a long float.
      expect(row[4]).toBe(Math.round(((row[3] as number) / 3_941_103) * 1000) / 10);
    }
    expect(sourceIds(model)).toEqual([`Title of ${SOURCE_ID.ageSex}`]);
    expect(model.sources[0]!.absoluteUrl.startsWith("https://fiscal.ge/")).toBe(true);
  });

  it("pyramid: a comparison year adds three columns and its rows", () => {
    const model = buildPyramidWorkbookExportModel({ ...input(), year: 2026, compare: 2004 }, presentation());
    expect(model.readable.headerLabels!.columns).toHaveLength(6);
    expect(model.readable.headerLabels!.columns.filter((label) => label.includes("2004"))).toHaveLength(3);
    const total = model.readable.rows.at(-1)!;
    expect(total.valuesByYear[2]).toBe(3_941_103);
    expect(total.valuesByYear[5]).toBe(3_937_716);
    expect(model.analysis.rows).toHaveLength(72);
    expect(model.sourceYears).toEqual([2026, 2004]);
    expect(model.filename).toContain("2026-2004");
  });

  it("pyramid: each year prints its own lineage, and the re-base year says so", () => {
    const model = buildPyramidWorkbookExportModel({ ...input(), year: 2025, compare: 2004 }, presentation());
    const basisOf = (year: number) => model.analysis.rows.find((row) => row[0] === year)![5] as string;
    expect(basisOf(2025)).not.toBe(basisOf(2004));
    expect(basisOf(2025)).toContain(presentation().messages["demography.breakLabel" as never] as string);
  });

  it("pyramid: the subtitle carries the re-base label only when the two years straddle it", () => {
    const label = presentation().messages["demography.breakLabel" as never] as string;
    const across = buildPyramidWorkbookExportModel({ ...input(), year: 2026, compare: 2004 }, presentation());
    const within = buildPyramidWorkbookExportModel({ ...input(), year: 2010, compare: 2004 }, presentation());
    expect(across.readable.subtitle).toContain(label);
    expect(within.readable.subtitle).not.toContain(label);
  });

  it("age by year: 18 group rows with the oldest first, as percents", () => {
    const model = buildAgeYearWorkbookExportModel(input(), presentation());
    expect(model.readable.rows).toHaveLength(18);
    expect(model.readable.rows[0]!.label).toBe("85+");
    const row = model.readable.rows.find((candidate) => candidate.label === "15–19")!;
    expect(row.valuesByYear[2004]!.toFixed(3)).toBe("8.232");
    expect(model.analysis.rows).toHaveLength(18 * 23);
    expect(model.analysis.headers).toHaveLength(5);
    expect(model.analysis.headers[3]).toBe(locale === "en" ? "Share, %" : "წილი, %");
    for (const dataRow of model.analysis.rows) expect(Math.round((dataRow[3] as number) * 10) / 10).toBe(dataRow[3]);
    expect(model.filename).toContain("demography-age-by-year-2004-2026");
    expect(sourceIds(model)).toEqual([`Title of ${SOURCE_ID.ageSex}`]);
    noInternalColumns(model);
  });

  it("census: an Imereti pyramid with the census date, one source and the census basis", () => {
    const model = buildCensusPlaceWorkbookExportModel(
      { facts: imereti, sources, siteOrigin: "https://fiscal.ge", place, settlement: "total", scope: "region-imereti" },
      presentation(),
    );
    const total = model.readable.rows.at(-1)!;
    expect(model.readable.years.map((column) => total.valuesByYear[column])).toEqual([245_599, 265_142, 510_741]);
    expect(model.readable.subtitle).toContain(presentation().messages["demography.censusDate" as never] as string);
    expect(model.readable.title).toContain(locale === "en" ? place.nameEn : place.nameKa);
    expect(sourceIds(model)).toEqual([`Title of ${SOURCE_ID.censusAge}`]);
    expect(model.sourceYears).toEqual([2024]);
    expect(model.analysis.rows).toHaveLength(36);
    const censusBasis = presentation().messages["demography.censusBasis" as never] as string;
    expect(model.analysis.rows.every((row) => row[5] === censusBasis && row[0] === 2024)).toBe(true);
    // U26-14: the share column names its unit, and holds the one decimal it shows.
    expect(model.analysis.headers[4]).toBe(locale === "en" ? "Share, %" : "წილი, %");
    expect(model.analysis.numericFormats![5]).toBe("0.0");
    for (const row of model.analysis.rows) expect(Math.round((row[4] as number) * 10) / 10).toBe(row[4]);
    expect(model.filename).toContain("demography-age-sex-region-imereti-census-2024-total");
    noInternalColumns(model);
  });

  it("census: the urban part has its own count and names the settlement", () => {
    const total = buildCensusPlaceWorkbookExportModel(
      { facts: imereti, sources, siteOrigin: "https://fiscal.ge", place, settlement: "total", scope: "region-imereti" },
      presentation(),
    );
    const urban = buildCensusPlaceWorkbookExportModel(
      { facts: imereti, sources, siteOrigin: "https://fiscal.ge", place, settlement: "urban", scope: "region-imereti" },
      presentation(),
    );
    const sum = urban.readable.rows.at(-1)!.valuesByYear[2];
    expect(sum).toBe(273_742);
    expect(urban.readable.subtitle).not.toBe(total.readable.subtitle);
    expect(urban.filename).toContain("census-2024-urban");
  });
});

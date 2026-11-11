// apps/web/tests/factQuery/topics/unemployment.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedLabourData } from "../../../lib/data/labour/importLabour";
import { LABOUR_SOURCES, type LabourFact } from "../../../lib/data/labour/types";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS, UNEMPLOYMENT_REGISTRY } from "../../../lib/data/unemployment/importUnemployment";
import type { ServedUnemploymentObservation } from "../../../lib/data/unemployment/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { labourCrawlStates, labourFullLabel, type LabourSectionId } from "../../../lib/explorer/labour";
import { labourPageData } from "../../../lib/explorer/labourPageData";
import { buildLabourWorkbookExportModel } from "../../../lib/explorer/labourWorkbook";
import { buildUnemploymentModel } from "../../../lib/explorer/unemployment";
import { unemploymentSeriesLabel, type UnemploymentSeriesDefinition } from "../../../lib/explorer/unemploymentOverview";
import { unemploymentPageFacts, unemploymentWorkbookSources } from "../../../lib/explorer/unemploymentPageData";
import { UNEMPLOYMENT_REGIONS } from "../../../lib/explorer/unemploymentRegionMap";
import type { UnemploymentSectionId } from "../../../lib/explorer/unemploymentSections";
import { unemploymentCrawlStates, type UnemploymentState } from "../../../lib/explorer/unemploymentState";
import { buildUnemploymentWorkbookExportModel } from "../../../lib/explorer/unemploymentWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import type { Observation } from "../../../lib/factQuery/observations";
import { queryIndicators } from "../../../lib/factQuery/queryIndicators";
import { rank } from "../../../lib/factQuery/rank";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import { breakBetween } from "../../../lib/factQuery/topics/store";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import { lfsEpochBreaks, unemploymentTopicAdapter } from "../../../lib/factQuery/topics/unemployment";
import type { FactQueryResponse, FactQuerySnapshot } from "../../../lib/factQuery/types";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale } from "../../../lib/i18n/types";
import { loadSourcedWorkbookSources } from "../../../lib/methodology/workbookSources";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ADJARA = "region.adjara";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const COMBINED = ["region.imereti_racha_lechkhumi_kvemo_svaneti", "region.samtskhe_javakheti_guria_mtskheta_mtianeti"];

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let labourCsv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: ServedUnemploymentObservation[];
let labour: LabourFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const readCsv = (name: string) => readFile(path.resolve(process.cwd(), "../../data/imports", name)).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]);
const rowOf = (dimension: string, groupId: string, indicatorId: string, year: number, sex = "") =>
  csv.find((row) => row.dimension === dimension && row.group_id === groupId && row.indicator_id === indicatorId && Number(row.year) === year && (row.sex ?? "") === sex)!;

beforeAll(async () => {
  const files = ["unemployment-annual.csv", "unemployment-education-annual.csv", "unemployment-long-term-annual.csv", "unemployment-employment-status-annual.csv"];
  let csvs: CsvRow[][];
  [builds, { facts: served }, { facts: labour }, labourCsv, ...csvs] = await Promise.all([
    unemploymentTopicAdapter.build(), loadServedUnemploymentData(), loadServedLabourData(), readCsv("labour-annual.csv"), ...files.map(readCsv),
  ]) as [TopicDatasetBuild[], { facts: ServedUnemploymentObservation[] }, { facts: LabourFact[] }, CsvRow[], ...CsvRow[][]];
  csv = csvs.flat();
}, 60_000);

describe("unemployment topic adapter", () => {
  it("is registered, reads the unemployment source archive and builds the eight Unemployment pages", () => {
    expect(TOPIC_ADAPTERS).toContain(unemploymentTopicAdapter);
    expect(unemploymentTopicAdapter).toMatchObject({ family: "unemployment", sourceArchive: ["unemployment"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "unemployment"));
    expect(builds.map((build) => build.page.datasetId)).toEqual([
      "unemployment-overview", "unemployment-regions", "unemployment-age", "unemployment-gender",
      "unemployment-industries", "unemployment-hours", "unemployment-informal", "unemployment-young-people",
    ]);
  });

  it("serves Georgia on every page, and on Regions also the 11 regions and the two historical groups its comparison lists", () => {
    for (const build of builds.filter((entry) => entry.page.datasetId !== "unemployment-regions")) expect(build.entities.map((entity) => entity.entityId), build.page.datasetId).toEqual([GEORGIA_PLACE_ID]);
    const regions = dataset("unemployment-regions").entities;
    expect(regions).toHaveLength(14);
    expect(regions[0]).toMatchObject({ entityId: GEORGIA_PLACE_ID, entityType: "country", labelEn: "Georgia", labelKa: "საქართველო", parentEntityId: null });
    expect(regions.filter((entity) => entity.entityType === "region").map((entity) => entity.entityId).sort()).toEqual([...UNEMPLOYMENT_REGIONS.map((region) => region.id), ...COMBINED].sort());
    expect(regions.find((entity) => entity.entityId === ADJARA)).toMatchObject({ entityType: "region", labelEn: "Adjara", labelKa: "აჭარა", parentEntityId: GEORGIA_PLACE_ID });
    expect(builds.map((build) => [build.page.datasetId, build.series.length])).toEqual([
      ["unemployment-overview", 50], ["unemployment-regions", 9], ["unemployment-age", 88], ["unemployment-gender", 17],
      ["unemployment-industries", 60], ["unemployment-hours", 84], ["unemployment-informal", 5], ["unemployment-young-people", 6],
    ]);
  });

  it("serves the survey estimate the pages' models carry: the stored value, a rate in %, a count in thousand persons", () => {
    const rate = rowOf("national", "georgia", "unemployment_rate", 2025);
    expect(factOf("unemployment-overview", GEORGIA_PLACE_ID, "unemployment_rate", 2025)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "unemployment_rate", year: 2025, value: Number(rate.value), basis: "actual", status: "survey_estimate", sourceIds: [rate.source_id],
    });
    expect(dataset("unemployment-overview").series.find((series) => series.seriesId === "unemployment_rate")).toMatchObject({ unit: "percent", isTotal: true, labelEn: "Unemployment rate" });
    const adjara = rowOf("region", ADJARA, "unemployed", 2024);
    expect(factOf("unemployment-regions", ADJARA, "unemployed", 2024)).toMatchObject({ value: Number(adjara.value), status: "survey_estimate", sourceIds: [adjara.source_id] });
    expect(dataset("unemployment-regions").series.find((series) => series.seriesId === "unemployed")).toMatchObject({ unit: "thousand_persons", labelEn: "Unemployed people", headingEn: null });
    // A group is a suffix of the indicator: towns, an education level with its sex, an age band.
    const higherWomen = rowOf("education", "education.higher", "unemployment_rate", 2024, "women");
    expect(factOf("unemployment-overview", GEORGIA_PLACE_ID, "unemployment_rate.education.higher.women", 2024)).toMatchObject({ value: Number(higherWomen.value), sourceIds: [higherWomen.source_id] });
    expect(dataset("unemployment-overview").series.find((series) => series.seriesId === "unemployment_rate.education.higher.women")).toMatchObject({ headingEn: "Education · Women", labelEn: "Higher · Unemployment rate" });
    expect(factOf("unemployment-overview", GEORGIA_PLACE_ID, "unemployment_rate.urban", 2010)!.value).toBe(Number(rowOf("settlement", "urban", "unemployment_rate", 2010).value));
    expect(factOf("unemployment-age", GEORGIA_PLACE_ID, "employed.age.25_29", 2022)!.value).toBe(Number(rowOf("age", "age.25_29", "employed", 2022).value));
    // Hired and self-employed people are parts of the employed.
    expect(dataset("unemployment-overview").series.find((series) => series.seriesId === "hired.rural")).toMatchObject({ parentSeriesId: "employed.rural" });
    // The detail pages print Geostat's one-decimal figure.
    const informal = labourCsv.find((row) => row.indicator_id === "labour.informal.total" && row.year === "2025")!;
    expect(factOf("unemployment-informal", GEORGIA_PLACE_ID, "labour.informal.total", 2025)).toMatchObject({ value: Number(informal.published_value), basis: "actual", status: "survey_estimate", sourceIds: [informal.source_id] });
    expect(dataset("unemployment-industries").series.find((series) => series.seriesId === "labour.jobs.women.sector_f")).toMatchObject({ parentSeriesId: "labour.jobs.women.total", headingEn: "Women", labelEn: "Construction", unit: "thousand_persons" });
  });

  it("serves nothing the pages do not show: no age bands before 2020, no employment rate on the Overview, no underutilisation rates", () => {
    const age = dataset("unemployment-age");
    expect(Math.min(...age.facts.map((fact) => fact.year))).toBe(2020);
    expect(age.series.filter((series) => /age\.(15_24|25_34|35_44|45_54|55_64)$/.test(series.seriesId))).toEqual([]);
    expect(dataset("unemployment-overview").series.filter((series) => series.seriesId.startsWith("employment_rate"))).toEqual([]);
    expect(builds.flatMap((build) => build.series.map((series) => series.seriesId)).filter((id) => id.startsWith("labour.underuse."))).toEqual([]);
    // A region's years before it was published are missing, never zero; the combined groups stop when the regions split.
    expect(factOf("unemployment-regions", "region.guria", "unemployment_rate", 2016)).toMatchObject({ value: null, sourceIds: [] });
    expect(factOf("unemployment-regions", COMBINED[0]!, "unemployment_rate", 2019)).toMatchObject({ value: null });
    // Self-employed and hired people by region start in 2020, as the page prints them.
    expect(factOf("unemployment-regions", ADJARA, "hired", 2019)).toMatchObject({ value: null });
    expect(factOf("unemployment-regions", ADJARA, "hired", 2020)!.value).not.toBeNull();
  });

  it("serves one Labour Force Survey methodology: no break today, and a later methodology_epoch becomes an lfs_<epoch> break", () => {
    expect([...new Set(csv.map((row) => row.methodology_epoch))]).toEqual(["ilo19_20"]);
    for (const build of builds) expect(build.breaks, build.page.datasetId).toEqual([]);
    const breaks = lfsEpochBreaks([
      ...[2008, 2009].map((year) => ({ seriesId: "unemployment_rate", year, epoch: "ilo13" })),
      ...[2010, 2011].map((year) => ({ seriesId: "unemployment_rate", year, epoch: "ilo19_20" })),
      ...[2009, 2010].map((year) => ({ seriesId: "unemployment_rate.urban", year, epoch: year < 2010 ? "ilo13" : "ilo19_20" })),
      ...[2009, 2010].map((year) => ({ seriesId: "employed", year, epoch: "ilo19_20" })),
    ]);
    expect(breaks).toEqual([{ breakId: "lfs_ilo19_20", seriesIds: ["unemployment_rate", "unemployment_rate.urban"], referenceDate: "2010-01-01", reasonEn: expect.stringContaining("ilo13 to ilo19_20") }]);
    expect(breakBetween(breaks, "unemployment_rate", 2009, 2010, "year")?.breakId).toBe("lfs_ilo19_20");
    expect(breakBetween(breaks, "unemployment_rate", 2010, 2011, "year")).toBeNull();
    expect(breakBetween(breaks, "employed", 2009, 2010, "year")).toBeNull();
  });

  it("names its units with the site's own unit words", () => {
    expect([...new Set(builds.flatMap((build) => build.series.map((series) => series.unit)))].sort()).toEqual(["hours", "percent", "thousand_persons"]);
    const names = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units;
    expect(names.thousand_persons).toEqual(names.persons_thousand);
    expect(names.thousand_persons!.labelEn).toBe("thousand persons");
    expect(names.hours).toEqual({ labelKa: "საათი კვირაში", labelEn: "hours per week" });
    expect(names.percent!.labelEn).toBe("%");
  });
});

describe("query, compare and rank on the unemployment datasets", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const comparisons = (target: FactQuerySnapshot, datasetId: string, seriesId: string, fromYear: number, toYear: number, entityIds?: string[]): Comparison => {
    const response = compare(target, { target: { dataset: "topic", datasetId, seriesIds: [seriesId], ...(entityIds ? { entityIds } : {}) }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };

  it("marks every observation a survey estimate", () => {
    const response = queryIndicators(snapshot, { datasetId: "unemployment-overview", seriesIds: ["unemployment_rate"], years: [2025] });
    const [observation] = (response as { data: { observations: Observation[] } }).data.observations;
    expect(observation).toMatchObject({ entityId: GEORGIA_PLACE_ID, unit: "percent", value: Number(rowOf("national", "georgia", "unemployment_rate", 2025).value), caveatIds: ["topic_survey_estimate"] });
    expect(response.meta.caveats.find((caveat) => caveat.code === "topic_survey_estimate")).toMatchObject({ severity: "note" });
    const hours = queryIndicators(snapshot, { datasetId: "unemployment-hours", seriesIds: ["labour.hours.all.total"], years: [2025] }) as FactQueryResponse & { data: { observations: Observation[] } };
    expect(hours.data.observations[0]).toMatchObject({ unit: "hours", caveatIds: ["topic_survey_estimate"] });
  });

  it("gives a rate a percentage-point change and no percentage change, and a count a percentage change (R19)", () => {
    const from = Number(rowOf("national", "georgia", "unemployment_rate", 2015).value), to = Number(rowOf("national", "georgia", "unemployment_rate", 2025).value);
    const rate = comparisons(snapshot, "unemployment-overview", "unemployment_rate", 2015, 2025);
    expect(rate).toMatchObject({ unit: "percent", comparability: "comparable", absoluteChange: null, percentageChange: null });
    expect(rate.percentagePointChange).toBeCloseTo(to - from, 9);
    expect(rate.caveatIds).toContain("topic_survey_estimate");
    const informal = comparisons(snapshot, "unemployment-informal", "labour.informal.total", 2020, 2025);
    expect(informal).toMatchObject({ percentageChange: null, absoluteChange: null });
    expect(informal.percentagePointChange).not.toBeNull();
    const unemployed = comparisons(snapshot, "unemployment-overview", "unemployed", 2015, 2025);
    expect(unemployed.percentagePointChange).toBeNull();
    expect(unemployed.percentageChange).not.toBeNull();
  });

  it("refuses a change across an LFS methodology break and compares within one methodology", () => {
    // The served data has one methodology; a break of the shape a later one makes is placed on the Overview.
    const epochs = dataset("unemployment-overview").facts.filter((fact) => fact.seriesId === "unemployment_rate").map(({ seriesId, year }) => ({ seriesId, year, epoch: year < 2015 ? "ilo13" : "ilo19_20" }));
    const withBreak: FactQuerySnapshot = { ...snapshot, topics: { ...snapshot.topics, datasets: snapshot.topics.datasets.map((entry) => entry.page.datasetId === "unemployment-overview" ? { ...entry, breaks: lfsEpochBreaks(epochs) } : entry) } };
    const across = comparisons(withBreak, "unemployment-overview", "unemployment_rate", 2014, 2015);
    expect(across).toMatchObject({ comparability: "not_comparable", percentagePointChange: null });
    expect(across.caveatIds).toContain("topic_series_break");
    expect(across.reasonsEn[0]).toContain("2015-01-01: ");
    expect(comparisons(withBreak, "unemployment-overview", "unemployment_rate", 2015, 2025).comparability).toBe("comparable");
    expect(comparisons(withBreak, "unemployment-overview", "unemployment_rate", 2010, 2014).comparability).toBe("comparable");
    expect(comparisons(withBreak, "unemployment-overview", "unemployed", 2010, 2025).comparability).toBe("comparable");
  });

  it("ranks regions by the points their unemployment rate moved, leaving out the groups with no value at both ends", () => {
    const ranked = rank(snapshot, { datasetId: "unemployment-regions", dimension: "entities", entityType: "region", seriesId: "unemployment_rate", metric: "percentage_point_change", fromYear: 2019, toYear: 2025, measure: "value", limit: 20 });
    if (ranked.kind !== "ranking") throw new Error(JSON.stringify(ranked));
    const { entries, exclusions } = ranked.data as { entries: { entityId: string; unit: string }[]; exclusions: { ids: string[]; reasonEn: string }[] };
    expect(entries.map((entry) => entry.entityId).sort()).toEqual(UNEMPLOYMENT_REGIONS.map((region) => region.id).sort());
    expect(entries.every((entry) => entry.unit === "percentage_points")).toBe(true);
    expect(exclusions.flatMap((entry) => entry.ids).sort()).toEqual(COMBINED);
    expect(exclusions.every((entry) => entry.reasonEn.length > 0)).toBe(true);
    const refused = rank(snapshot, { datasetId: "unemployment-regions", dimension: "entities", entityType: "region", seriesId: "unemployment_rate", metric: "percentage_change", fromYear: 2019, toYear: 2025, measure: "value" });
    expect(refused.kind === "error" && refused.error.code).toBe("unsupported_measure");
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/unemployment.tsx, labour.tsx; components/unemployment/*-explorer.tsx's useCrawlModels). A rate's
// workbook cell is a fraction formatted as a percent; the parity check compares the percent it shows.

type Reader = (row: WorkbookReadableRow) => ParityTarget | null;
function matcher() {
  const readers = new Map<WorkbookExportModel, Reader>();
  const add = (model: WorkbookExportModel, reader: Reader) => {
    readers.set(model, reader);
    return model;
  };
  return { add, match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.(row) ?? null };
}
type Matcher = ReturnType<typeof matcher>;

/** The served id contract: on Regions a group is a place and the indicator its series; elsewhere a group suffixes Georgia's indicator. */
function expectedTarget(section: UnemploymentSectionId, state: UnemploymentState, definition: { groupId: string; indicatorId: string }): ParityTarget {
  if (section === "regions") return { entityId: definition.groupId === "georgia" ? GEORGIA_PLACE_ID : definition.groupId, seriesId: definition.indicatorId };
  if (definition.groupId === "georgia") return { entityId: GEORGIA_PLACE_ID, seriesId: definition.indicatorId };
  const sex = definition.groupId.startsWith("education.") && state.educationSex !== "total" ? `.${state.educationSex}` : "";
  return { entityId: GEORGIA_PLACE_ID, seriesId: `${definition.indicatorId}.${definition.groupId}${sex}` };
}

const unemploymentPresentation = (locale: Locale) =>
  getPresentation(locale, ["unemployment", "regionalEconomies", "format", "main", "workbook"], UNEMPLOYMENT_GROUPS.map((group) => group.id), UNEMPLOYMENT_REGIONS.map((region) => region.id));

/** Each page's crawl tables (a region page's when `regionId` is given), every row read back by its printed label. */
async function unemploymentModels(locale: Locale, section: UnemploymentSectionId, regionIds: readonly (string | undefined)[], m: Matcher) {
  const [presentation, sources] = await Promise.all([unemploymentPresentation(locale), unemploymentWorkbookSources(locale)]);
  return regionIds.flatMap((regionId) => {
    const { facts } = unemploymentPageFacts(served, section, regionId);
    return unemploymentCrawlStates(facts, UNEMPLOYMENT_REGISTRY, section, regionId).map((state) => {
      const definitions = buildUnemploymentModel(facts, UNEMPLOYMENT_REGISTRY, state).definitions;
      const byLabel = new Map(definitions.map((definition) => [unemploymentSeriesLabel(definition as UnemploymentSeriesDefinition, state, presentation), definition]));
      if (byLabel.size !== definitions.length) throw new Error(`Two rows of ${section} ${state.breakdown} share a label`);
      return m.add(buildUnemploymentWorkbookExportModel(facts, UNEMPLOYMENT_REGISTRY, state, presentation, sources, ORIGIN), (row) => {
        const definition = byLabel.get(row.label);
        return definition ? expectedTarget(section, state, definition) : null;
      });
    });
  });
}

/** A detail page's crawl table: a row is named by its heading (the page total by its full name) and its label. */
async function labourModels(locale: Locale, section: LabourSectionId, m: Matcher) {
  const [presentation, sources] = await Promise.all([
    getPresentation(locale, ["labour", "format", "main", "workbook"], []), loadSourcedWorkbookSources("unemployment", locale, (row) => LABOUR_SOURCES.includes(row.source_id)),
  ]);
  const page = labourPageData(labour, presentation.messages, section);
  const keyOf = (parent: string | null, label: string) => `${parent ?? ""}\u0000${label}`;
  const ids = new Map(page.series.map((series) => [series.reference
    ? keyOf(null, labourFullLabel(series.heading, page.headingLabels[series.heading]!, page.labels[series.id]!))
    : keyOf(series.heading === "all" ? null : page.headingLabels[series.heading]!, page.labels[series.id]!), series.id]));
  return labourCrawlStates(section, page.facts).map((state) =>
    m.add(buildLabourWorkbookExportModel({ section, facts: page.facts, state, labels: page.labels, headingLabels: page.headingLabels, sources, siteOrigin: ORIGIN, title: section }, presentation), (row) => {
      const id = ids.get(keyOf(row.parentLabel, row.label));
      return id ? { entityId: GEORGIA_PLACE_ID, seriesId: id } : null;
    }));
}

describe("unemployment parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of ["overview", "age", "gender"] as const) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`unemployment-${section}`), await unemploymentModels(locale, section, [undefined], m), m.match);
      });
    }
    it(`regions (${locale}): the index's comparison, and Adjara's page`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("unemployment-regions"), await unemploymentModels(locale, "regions", [undefined], m), m.match);
      const n = matcher();
      expectWorkbookParity(dataset("unemployment-regions"), await unemploymentModels(locale, "regions", [ADJARA], n), n.match, [ADJARA]);
    });
    for (const section of ["industries", "hours", "informal", "young-people"] as const) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`unemployment-${section}`), await labourModels(locale, section, m), m.match);
      });
    }
  }

  it("regions (en): the index and every region page", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("unemployment-regions"), await unemploymentModels("en", "regions", [undefined, ...UNEMPLOYMENT_REGIONS.map((region) => region.id)], m), m.match);
  });

  it("fails when a served rate is not the one the page prints", async () => {
    const overview = dataset("unemployment-overview");
    const facts = overview.facts.map((fact): TopicFact => (fact.year === 2020 && fact.seriesId === "unemployment_rate" ? { ...fact, value: fact.value! / 100 } : fact));
    const m = matcher();
    const models = await unemploymentModels("en", "overview", [undefined], m);
    expect(() => expectWorkbookParity({ ...overview, facts }, models, m.match)).toThrow(/2020: the page prints [\d.]+, country.georgia unemployment_rate serves/);
  });
});

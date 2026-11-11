// apps/web/tests/factQuery/topics/social.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedExplorerData } from "../../../lib/data/servedData";
import { loadServedSocialData } from "../../../lib/data/social/importSocial";
import { FUNDED_PENSION_SOURCES, SOCIAL_GEORGIA, type SocialFact } from "../../../lib/data/social/types";
import { projectGdpFact, type ClientNationalGdpFact } from "../../../lib/explorer/clientData";
import { socialCrawlStates, socialTopicSeries, type SocialPlaceSet, type SocialTopicId } from "../../../lib/explorer/social";
import { loadSocialPlaceBasics, loadSocialWorkbookSources, socialPlacePageData, socialTopicPageData } from "../../../lib/explorer/socialPageData";
import { socialPlaceCrawlStates, socialPlaceFacts, socialPlaceSeries } from "../../../lib/explorer/socialPlaces";
import { buildSocialWorkbookExportModel } from "../../../lib/explorer/socialWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { rank } from "../../../lib/factQuery/rank";
import { socialTopicAdapter } from "../../../lib/factQuery/topics/social";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { FactQueryResponse, FactQuerySnapshot } from "../../../lib/factQuery/types";
import type { Locale } from "../../../lib/i18n/types";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const SHUAKHEVI = "10";
const ADJARA = "region.adjara";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const FUNDED = "social.funded_pension.";

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: SocialFact[];
let gdpFacts: ClientNationalGdpFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, geographyId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && row.geography_id === geographyId && Number(row.year) === year)!;

beforeAll(async () => {
  [builds, { facts: served }, gdpFacts, csv] = await Promise.all([
    socialTopicAdapter.build(), loadServedSocialData(), loadServedExplorerData().then((explorer) => explorer.gdpFacts.map(projectGdpFact)),
    readFile(path.resolve(process.cwd(), "../../data/imports/social-protection-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("social topic adapter", () => {
  it("is registered, reads the social protection source archive and builds the five pages", () => {
    expect(TOPIC_ADAPTERS).toContain(socialTopicAdapter);
    expect(socialTopicAdapter).toMatchObject({ family: "social", sourceArchive: ["social-protection"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "social"));
    expect(builds.map((build) => build.page.datasetId)).toEqual(["health-social-payments", "health-pensions", "health-subsistence-allowance", "health-social-package", "health-funded-pension"]);
  });

  it("serves Georgia, the 11 regions and the 63 municipalities on Pensions and Subsistence allowance, and Georgia on the other three", async () => {
    const { places } = await loadSocialPlaceBasics("en");
    expect(places).toHaveLength(75);
    for (const id of ["health-pensions", "health-subsistence-allowance"]) {
      expect(dataset(id).entities.map((entity) => entity.entityId)).toEqual(places.map((place) => place.id));
      expect(dataset(id).entities.find((entity) => entity.entityId === SHUAKHEVI)).toMatchObject({ entityType: "municipality", parentEntityId: ADJARA, labelEn: "Shuakhevi" });
      expect(dataset(id).entities.find((entity) => entity.entityId === "region.tbilisi")).toMatchObject({ entityType: "region", parentEntityId: SOCIAL_GEORGIA });
    }
    for (const id of ["health-social-payments", "health-social-package", "health-funded-pension"]) expect(dataset(id).entities.map((entity) => entity.entityId)).toEqual([SOCIAL_GEORGIA]);
    // Tbilisi is one place, the region; SSA's own rows for Akhalgori and Upper Abkhazia have no page.
    for (const build of builds) expect(build.entities.filter((entity) => entity.entityId === "04" || entity.entityId.startsWith("unit."))).toEqual([]);
    // Codes 05, 42, 43, 46 and 64 are budgets not attributable to spending inside one place: never an entity (AGENTS.md).
    for (const build of builds) expect(build.entities.filter((entity) => ["05", "42", "43", "46", "64"].includes(entity.entityId)), build.page.datasetId).toEqual([]);
  });

  it("serves the CSV's rows as the pages carry them: counts as they are, money in million GEL, an average in GEL", () => {
    const pensioners = rowOf("social.pension.recipients", SHUAKHEVI, 2025);
    expect(factOf("health-pensions", SHUAKHEVI, "social.pension.recipients", 2025)).toEqual({
      entityId: SHUAKHEVI, seriesId: "social.pension.recipients", year: 2025, value: Number(pensioners.value), basis: "actual", status: "official", sourceIds: [pensioners.source_id],
    });
    const money = rowOf("social.pension.amount", SOCIAL_GEORGIA, 2025);
    expect(factOf("health-pensions", SOCIAL_GEORGIA, "social.pension.amount", 2025)).toMatchObject({ value: Number(money.value) / 1e6, status: "derived", sourceIds: [money.source_id] });
    const average = rowOf("social.pension.avg_monthly", SOCIAL_GEORGIA, 2025);
    expect(factOf("health-pensions", SOCIAL_GEORGIA, "social.pension.avg_monthly", 2025)).toMatchObject({ value: Number(average.value), status: "derived" });
    const units = Object.fromEntries(dataset("health-pensions").series.map((series) => [series.seriesId, series.unit]));
    expect(units).toMatchObject({ "social.pension.recipients": "persons", "social.pension.amount": "gel_million", "social.pension.avg_monthly": "gel" });
    expect(dataset("health-funded-pension").series.find((series) => series.seriesId === `${FUNDED}return`)).toMatchObject({ unit: "percent", headingEn: "Return", isTotal: false });
  });

  it("serves money a programme paid for part of a year as a part of a year, with its months", () => {
    const covid = rowOf("social.payments.covid_vulnerable_compensation.amount", SOCIAL_GEORGIA, 2020);
    expect(Number(covid.months)).toBeLessThan(12);
    expect(factOf("health-social-payments", SOCIAL_GEORGIA, "social.payments.covid_vulnerable_compensation.amount", 2020)).toMatchObject({ status: "partial", monthsReported: Number(covid.months), value: Number(covid.value) / 1e6 });
    // The programme ran in 2020 and 2021 only: the money heading's other years are missing, never zero.
    expect(factOf("health-social-payments", SOCIAL_GEORGIA, "social.payments.covid_vulnerable_compensation.amount", 2019)).toMatchObject({ value: null, sourceIds: [] });
    expect(dataset("health-social-payments").series.find((series) => series.seriesId === "social.payments.pension.amount")).toMatchObject({ parentSeriesId: "social.payments.total.amount", isTotal: false });
    expect(dataset("health-social-payments").series[0]).toMatchObject({ seriesId: "social.payments.total.amount", isTotal: true, parentSeriesId: null });
  });

  it("serves nothing Fiscal.ge divides out in the browser: no share of residents, 2025 prices or % of GDP", () => {
    const seriesIds = builds.flatMap((build) => build.series.map((series) => series.seriesId));
    expect(seriesIds.filter((id) => id.includes("#"))).toEqual([]);
    expect(builds.flatMap((build) => build.series.map((series) => series.unit)).filter((unit) => unit.includes("gdp"))).toEqual([]);
    // Every row the lists show, the calculated ones aside.
    expect(dataset("health-pensions").series.map((series) => series.seriesId)).toEqual(socialPlaceSeries("pensions").filter((series) => series.calculated === undefined).map((series) => series.id));
    expect(dataset("health-funded-pension").series.map((series) => series.seriesId)).toEqual(socialTopicSeries("funded-pension").map((series) => series.id));
  });

  it("carries the 2022 subsistence and 2025 social package breaks onto their served series", () => {
    expect(dataset("health-subsistence-allowance").breaks.map((entry) => [entry.breakId, entry.seriesIds.length])).toEqual([["subsistence_employment_2022", 10]]);
    expect(dataset("health-social-package").breaks.map((entry) => [entry.breakId, entry.seriesIds.length])).toEqual([["social_package_groups_2025", 6]]);
    expect(dataset("health-pensions").breaks).toEqual([]);
  });

  it("names its units with the site's own unit words; the fund's return is the one percent", () => {
    const units = new Set(builds.flatMap((build) => build.series.map((series) => series.unit)));
    expect([...units].sort()).toEqual(["employers", "families", "gel", "gel_million", "percent", "persons"]);
    expect(builds.flatMap((build) => build.series.filter((series) => series.unit === "percent").map((series) => series.seriesId))).toEqual([`${FUNDED}return`]);
  });
});

describe("compare and rank on the social datasets", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const pairs = (response: FactQueryResponse) => {
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons;
  };
  const pair = (datasetId: string, seriesId: string, fromYear: number, toYear: number, entityIds?: string[]) =>
    pairs(compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds: [seriesId], ...(entityIds ? { entityIds } : {}) }, fromYear, toYear, measure: "value" }))[0]!;

  it("gives the fund's return, a percent, a percentage-point change and no percentage change (R19)", () => {
    const from = rowOf(`${FUNDED}return`, SOCIAL_GEORGIA, 2020), to = rowOf(`${FUNDED}return`, SOCIAL_GEORGIA, 2025);
    const change = pair("health-funded-pension", `${FUNDED}return`, 2020, 2025);
    expect(change).toMatchObject({ unit: "percent", comparability: "comparable", absoluteChange: null, percentageChange: null });
    expect(change.percentagePointChange).toBeCloseTo(Number(to.value) - Number(from.value), 9);
    // Members are a count: an absolute and a percentage change, no points.
    const members = pair("health-funded-pension", `${FUNDED}members`, 2020, 2025);
    expect(members.percentagePointChange).toBeNull();
    expect(members.percentageChange).not.toBeNull();
  });

  it("ranks the return by points and refuses a percentage of it, and refuses points for a count", () => {
    const ranked = rank(snapshot, { datasetId: "health-funded-pension", dimension: "series", seriesId: `${FUNDED}return`, metric: "percentage_point_change", fromYear: 2020, toYear: 2025, measure: "value" });
    if (ranked.kind !== "ranking") throw new Error(JSON.stringify(ranked));
    const from = rowOf(`${FUNDED}return`, SOCIAL_GEORGIA, 2020), to = rowOf(`${FUNDED}return`, SOCIAL_GEORGIA, 2025);
    const [entry] = (ranked.data as { entries: { seriesId: string; value: number; unit: string }[] }).entries;
    expect(entry).toMatchObject({ seriesId: `${FUNDED}return`, unit: "percentage_points" });
    expect(entry!.value).toBeCloseTo(Number(to.value) - Number(from.value), 9);
    for (const metric of ["percentage_change", "absolute_change"] as const) {
      const refused = rank(snapshot, { datasetId: "health-funded-pension", dimension: "series", seriesId: `${FUNDED}return`, metric, fromYear: 2020, toYear: 2025, measure: "value" });
      expect(refused.kind === "error" && refused.error.code, metric).toBe("unsupported_measure");
    }
    const counts = rank(snapshot, { datasetId: "health-pensions", dimension: "entities", entityType: "region", seriesId: "social.pension.recipients", metric: "percentage_point_change", fromYear: 2015, toYear: 2025, measure: "value" });
    expect(counts.kind === "error" && counts.error.code).toBe("unsupported_measure");
    expect(rank(snapshot, { datasetId: "health-pensions", dimension: "entities", entityType: "region", seriesId: "social.pension.recipients", metric: "percentage_change", fromYear: 2015, toYear: 2025, measure: "value" }).kind).toBe("ranking");
  });

  it("refuses the subsistence families across 2022 and the social package groups across 2025", () => {
    expect(pair("health-subsistence-allowance", "social.subsistence.families", 2021, 2022, [SHUAKHEVI])).toMatchObject({ comparability: "not_comparable" });
    expect(pair("health-subsistence-allowance", "social.subsistence.families", 2022, 2025, [SHUAKHEVI]).comparability).toBe("comparable");
    expect(pair("health-social-package", "social.social_package.disability.recipients", 2024, 2025).comparability).toBe("not_comparable");
    expect(pair("health-social-package", "social.social_package.total.recipients", 2024, 2025).comparability).toBe("comparable");
  });

  it("resolves the funded pension's figures to the Pension Fund's documents through get_sources", () => {
    const funded = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "health-funded-pension")!;
    const cited = [...new Set(funded.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!);
    expect(cited.length).toBeGreaterThan(0);
    expect(cited.every((id) => FUNDED_PENSION_SOURCES.map((source) => `source.${source}`).includes(id))).toBe(true);
    const response = getSources(snapshot, { sourceIds: cited, datasetId: "health-funded-pension", years: [funded.lastYear] });
    expect(response.kind).toBe("sources");
    const { sources } = (response as { data: { sources: { sourceId: string; documents: { documentId: string; officialUrl: string; publisherEn: string }[] }[] } }).data;
    expect(sources.map((source) => source.sourceId).sort()).toEqual([...cited].sort());
    for (const source of sources) {
      expect(source.documents.length, source.sourceId).toBeGreaterThan(0);
      expect(source.documents.every((document) => document.documentId.startsWith("pension_fund_") && document.officialUrl.startsWith("https://")), source.sourceId).toBe(true);
    }
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages
// feed them (lib/pages/social.tsx, social-places.tsx; components/social/*-explorer.tsx's useCrawlModels). The models'
// % of GDP states and calculated rows (shares of residents, 2025 prices) are Fiscal.ge's browser views: not served, so
// they are left out here, and the test asserts the page has them.

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
/** A crawl table's rows, read back by their labels to the state's series; a calculated row is dropped (and counted). */
function stateReader(labels: Readonly<Record<string, string>>, selectedIds: readonly string[], entityId: string) {
  const ids = new Map(selectedIds.map((id) => [labels[id]!, id]));
  if (ids.size !== selectedIds.length) throw new Error(`Two rows of ${selectedIds.join(", ")} share a label`);
  return { reader: ((row) => (ids.has(row.label) ? { entityId, seriesId: ids.get(row.label)! } : null)) as Reader, calculated: (row: WorkbookReadableRow) => ids.get(row.label)?.includes("#") ?? false };
}
const withoutCalculated = (model: WorkbookExportModel, calculated: (row: WorkbookReadableRow) => boolean): WorkbookExportModel => ({ ...model, readable: { ...model.readable, rows: model.readable.rows.filter((row) => !calculated(row)) } });

async function topicModels(locale: Locale, section: SocialTopicId, m: Matcher) {
  const [basics, sources] = await Promise.all([loadSocialPlaceBasics(locale), loadSocialWorkbookSources(locale)]);
  const page = socialTopicPageData(served, basics.presentation.messages, section);
  const states = socialCrawlStates(section, page.facts, gdpFacts);
  if (section !== "social-package") expect(states.some((state) => state.view === "gdp")).toBe(true);
  return states.filter((state) => state.view === "amount").map((state) => {
    const { reader } = stateReader(page.labels, state.selectedIds, SOCIAL_GEORGIA);
    return m.add(buildSocialWorkbookExportModel({
      section, facts: page.facts, state, gdpFacts, labels: page.labels, headingLabels: page.headingLabels, sources: section === "funded-pension" ? sources.pensionFund : sources.ssa,
      populationSources: [], cpiSources: [], gdpSources: [], siteOrigin: ORIGIN, title: section,
    }, basics.presentation), reader);
  });
}

let droppedCalculated = 0;
async function placeModels(locale: Locale, set: SocialPlaceSet, placeIds: readonly string[], m: Matcher) {
  const [basics, sources] = await Promise.all([loadSocialPlaceBasics(locale), loadSocialWorkbookSources(locale)]);
  return placeIds.flatMap((placeId) => {
    const page = socialPlacePageData(basics, basics.presentation.messages, set, placeId);
    const extras = { population: page.population, cpi: basics.cpi };
    const shown = socialPlaceFacts(set, placeId, page.facts, extras);
    return socialPlaceCrawlStates(set, shown).flatMap((state) => {
      const { reader, calculated } = stateReader(page.labels, state.selectedIds, placeId);
      const model = buildSocialWorkbookExportModel({
        set, placeId, scope: placeId, facts: page.facts, state, extras, labels: page.labels, headingLabels: page.headingLabels,
        sources: sources.ssa, populationSources: sources.population, cpiSources: sources.cpi, gdpSources: [], siteOrigin: ORIGIN, title: set,
      }, basics.presentation);
      const kept = withoutCalculated(model, calculated);
      droppedCalculated += model.readable.rows.length - kept.readable.rows.length;
      return kept.readable.rows.length ? [m.add(kept, reader)] : [];
    });
  });
}

describe("social parity with the pages' workbook models", () => {
  const places = [SOCIAL_GEORGIA, ADJARA, SHUAKHEVI];
  for (const locale of LOCALES) {
    for (const section of ["social-payments", "social-package", "funded-pension"] as const) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`health-${section}`), await topicModels(locale, section, m), m.match);
      });
    }
    for (const set of ["pensions", "subsistence-allowance"] as const) {
      it(`${set} (${locale}): Georgia, Adjara and Shuakhevi`, async () => {
        const m = matcher();
        droppedCalculated = 0;
        expectWorkbookParity(dataset(`health-${set}`), await placeModels(locale, set, places, m), m.match, places);
        // The share of residents (and on Pensions the 2025 prices) are on the page, not served.
        expect(droppedCalculated).toBeGreaterThan(0);
      });
    }
  }

  it("Pensions and Subsistence allowance (en): every place the pages list", async () => {
    const all = (await loadSocialPlaceBasics("en")).places.map((place) => place.id);
    const m = matcher();
    expectWorkbookParity(dataset("health-pensions"), await placeModels("en", "pensions", all, m), m.match);
    expectWorkbookParity(dataset("health-subsistence-allowance"), await placeModels("en", "subsistence-allowance", all, m), m.match);
  }, 60_000);

  it("fails when a served value differs from the page's", async () => {
    const pensions = dataset("health-pensions");
    const facts = pensions.facts.map((fact): TopicFact => (fact.entityId === SHUAKHEVI && fact.year === 2020 && fact.seriesId === "social.pension.amount" ? { ...fact, value: fact.value! * 1e6 } : fact));
    const m = matcher();
    const models = await placeModels("en", "pensions", [SHUAKHEVI], m);
    expect(() => expectWorkbookParity({ ...pensions, facts }, models, m.match, [SHUAKHEVI])).toThrow(/2020: the page prints [\d.]+, 10 social.pension.amount serves/);
  });
});

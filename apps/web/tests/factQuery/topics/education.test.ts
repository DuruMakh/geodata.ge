// apps/web/tests/factQuery/topics/education.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { EDUCATION_GEORGIA, EDUCATION_MUNICIPALITIES, EDUCATION_REGIONS, EDUCATION_SOURCES } from "../../../lib/data/education/types";
import { placeLabel } from "../../../lib/explorer/demographyAreas";
import { educationCrawlStates, educationSeriesLabel, type EducationTopicId } from "../../../lib/explorer/education";
import { educationPlaceListData, educationPlacePageData, educationTopicPageData } from "../../../lib/explorer/educationPageData";
import { educationPlaceCrawlStates, type EducationPlaceSet } from "../../../lib/explorer/educationPlaces";
import { buildEducationWorkbookExportModel } from "../../../lib/explorer/educationWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { loadTopicBreaks } from "../../../lib/factQuery/topics/breaks";
import { breakBetween } from "../../../lib/factQuery/topics/store";
import { educationTopicAdapter } from "../../../lib/factQuery/topics/education";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import type { TopicDatasetBuild } from "../../../lib/factQuery/topics/types";
import { message } from "../../../lib/i18n/messages";
import { getMessages } from "../../../lib/i18n/messages.server";
import type { Locale } from "../../../lib/i18n/types";
import { loadSourcedWorkbookSources } from "../../../lib/methodology/workbookSources";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const SHUAKHEVI = "10";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];

type CsvRow = Record<string, string>;
const cellKey = (entityId: string, seriesId: string, year: number) => `${entityId}:${seriesId}:${year}`;

let builds: TopicDatasetBuild[];
let csv: CsvRow[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;

beforeAll(async () => {
  [builds, csv] = await Promise.all([
    educationTopicAdapter.build(),
    readFile(path.resolve(process.cwd(), "../../data/imports/education-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("education topic adapter", () => {
  it("is registered, reads the education source archive and builds the four Education pages", () => {
    expect(TOPIC_ADAPTERS).toContain(educationTopicAdapter);
    expect(educationTopicAdapter).toMatchObject({ family: "education", sourceArchive: ["education"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "education"));
    expect(builds.map((build) => build.page.datasetId)).toEqual(["education-schools", "education-kindergartens", "education-universities", "education-vocational"]);
  });

  it("Schools and Kindergartens serve Georgia, the 11 regions and the 63 municipalities; Universities and Vocational colleges Georgia only", () => {
    const places = [EDUCATION_GEORGIA, ...EDUCATION_REGIONS, ...Object.values(EDUCATION_MUNICIPALITIES).flat()].sort();
    for (const id of ["education-schools", "education-kindergartens"]) {
      const { entities } = dataset(id);
      expect(entities.map((entity) => entity.entityId).sort()).toEqual(places);
      expect(entities).toHaveLength(75);
      expect(entities.filter((entity) => entity.entityType === "region").every((entity) => entity.parentEntityId === EDUCATION_GEORGIA)).toBe(true);
      expect(entities.find((entity) => entity.entityId === SHUAKHEVI)).toMatchObject({ entityType: "municipality", parentEntityId: "region.adjara", labelEn: "Shuakhevi" });
    }
    for (const id of ["education-universities", "education-vocational"]) expect(dataset(id).entities.map((entity) => entity.entityId)).toEqual([EDUCATION_GEORGIA]);
  });

  it("never serves the kept units, the old vocational fields or a hidden row", () => {
    const hidden = new Set(csv.filter((row) => row.shown === "false").map((row) => cellKey(row.geography_id!, row.indicator_id!, Number(row.year))));
    expect(hidden.size).toBeGreaterThan(0);
    for (const build of builds) {
      expect(build.entities.some((entity) => entity.entityId.startsWith("unit."))).toBe(false);
      expect(build.series.some((series) => series.seriesId.split(".")[2]!.startsWith("old_"))).toBe(false);
      expect(build.facts.some((fact) => fact.entityId.startsWith("unit.") || hidden.has(cellKey(fact.entityId, fact.seriesId, fact.year)))).toBe(false);
    }
  });

  it("Shuakhevi's pupils in 2015/16 and 2025/26 are the reviewed CSV rows", () => {
    const schools = dataset("education-schools");
    for (const year of [2015, 2025]) {
      const row = csv.find((candidate) => candidate.geography_id === SHUAKHEVI && candidate.indicator_id === "education.pupils.total" && Number(candidate.year) === year)!;
      const fact = schools.facts.find((candidate) => candidate.entityId === SHUAKHEVI && candidate.seriesId === "education.pupils.total" && candidate.year === year);
      expect(fact).toEqual({ entityId: SHUAKHEVI, seriesId: "education.pupils.total", year, value: Number(row.value), basis: "actual", status: "official", sourceIds: [row.source_id] });
    }
    expect(schools.series.find((series) => series.seriesId === "education.pupils.total")).toMatchObject({ unit: "persons", isTotal: true, parentSeriesId: null });
  });

  it("serves every shown CSV row of a page's place once, at its published value; a year the page shows without a row is missing, never zero", () => {
    const shown = new Map(csv.filter((row) => row.shown === "true" && !row.geography_id!.startsWith("unit.")).map((row) => [cellKey(row.geography_id!, row.indicator_id!, Number(row.year)), row]));
    const servedKeys = new Set<string>();
    for (const build of builds) for (const fact of build.facts) {
      const key = cellKey(fact.entityId, fact.seriesId, fact.year);
      expect(servedKeys.has(key), key).toBe(false);
      servedKeys.add(key);
      const row = shown.get(key);
      if (row) expect(fact.value, key).toBe(Number(row.published_value));
      else expect(fact, key).toMatchObject({ value: null, sourceIds: [] });
    }
    expect([...shown.keys()].filter((key) => !servedKeys.has(key))).toEqual([]);
    // Geostat's table 06 has no private teachers for 2010/11; the page draws a gap there.
    expect(shown.has(cellKey(EDUCATION_GEORGIA, "education.teachers.private", 2010))).toBe(false);
    expect(dataset("education-schools").facts.find((fact) => fact.entityId === EDUCATION_GEORGIA && fact.seriesId === "education.teachers.private" && fact.year === 2010)).toMatchObject({ value: null });
  });

  it("labels series with the pages' label functions in Georgian and English, under the pages' headings", async () => {
    const [ka, en] = await Promise.all([getMessages("ka", ["education"]), getMessages("en", ["education"])]);
    for (const build of builds) for (const series of build.series) {
      const heading = series.seriesId.split(".")[1] === "pupils_national" ? "pupils" : series.seriesId.split(".")[1];
      expect(series).toMatchObject({
        labelKa: educationSeriesLabel(ka, series.seriesId), labelEn: educationSeriesLabel(en, series.seriesId),
        headingKa: message(ka, `education.heading.${heading}`), headingEn: message(en, `education.heading.${heading}`),
      });
    }
    expect(dataset("education-schools").series.find((series) => series.seriesId === "education.pupils_national.total")).toMatchObject({ unit: "persons_thousand" });
    expect(dataset("education-schools").titleEn).toBe(message(en, "education.page.schools.title"));
  });

  it("carries the reviewed breaks; kindergarten staff 2019/20 → 2020/21 crosses one, 2020/21 → 2021/22 none", async () => {
    const breaks = await loadTopicBreaks("education-series-breaks.csv");
    expect(breakBetween(breaks, "education.kg_staff.total", 2019, 2020, "school_year")?.breakId).toBe("kindergarten_staff_2020");
    expect(breakBetween(breaks, "education.kg_staff.total", 2020, 2021, "school_year")).toBeNull();
    expect(breakBetween(breaks, "education.kg_staff.total", 2015, 2025, "school_year")?.breakId).toBe("kindergarten_staff_2020");
    expect(breakBetween(breaks, "education.kg_children.total", 2019, 2020, "school_year")).toBeNull();
    // Dated 2020-09-01: as calendar years it starts in 2020.
    expect(breakBetween(breaks, "education.kg_staff.total", 2019, 2020, "year")?.breakId).toBe("kindergarten_staff_2020");
    expect(dataset("education-kindergartens").breaks.map((entry) => entry.breakId)).toEqual(["kindergarten_staff_2020"]);
    expect(dataset("education-universities").breaks.map((entry) => entry.breakId)).toEqual(["he_levels_2015", "he_levels_2015_graduates"]);
    expect(dataset("education-schools").breaks).toEqual([]);
  });
});

/** A row's identity in an education workbook: its heading's name (none where the row bears it) and its own. */
const rowKey = (parentLabel: string | null, label: string) => `${parentLabel ?? ""}\u0000${label}`;

/** Education's `match`: a model's rows name series by label under their heading, so each model carries its place and list's names. */
function educationMatcher() {
  const lookup = new Map<WorkbookExportModel, { entityId: string; ids: Map<string, string> }>();
  const add = (model: WorkbookExportModel, entityId: string, series: readonly { id: string; heading: string }[], labels: Record<string, string>, headingLabels: Record<string, string>) => {
    const ids = new Map<string, string>();
    for (const { id, heading } of series) {
      const parent = headingLabels[heading] === labels[id] ? null : headingLabels[heading]!;
      const key = rowKey(parent, labels[id]!);
      if (ids.has(key)) throw new Error(`Two education rows read ${key}`);
      ids.set(key, id);
    }
    lookup.set(model, { entityId, ids });
  };
  const match = (row: WorkbookReadableRow, model: WorkbookExportModel): ParityTarget | null => {
    const entry = lookup.get(model);
    const seriesId = entry?.ids.get(rowKey(row.parentLabel, row.label));
    return entry && seriesId ? { entityId: entry.entityId, seriesId } : null;
  };
  return { add, match };
}

const sourcesFor = (locale: Locale) => loadSourcedWorkbookSources("education", locale, (row) => EDUCATION_SOURCES.includes(row.source_id));

/** A place page's crawl models, as education-place-explorer.tsx builds them in useCrawlModels, from the props the place page passes. */
async function placeModels(locale: Locale, set: EducationPlaceSet, placeIds: readonly string[], matcher: ReturnType<typeof educationMatcher>) {
  const [data, sources] = await Promise.all([educationPlacePageData(locale), sourcesFor(locale)]);
  const { messages } = data.presentation;
  const title = message(messages, `education.place.headingLead.${set}`);
  return placeIds.flatMap((placeId) => {
    const place = data.places.find((candidate) => candidate.id === placeId)!;
    const { series, facts, labels, headingLabels } = educationPlaceListData(messages, set, place.id, data.facts);
    return educationPlaceCrawlStates(set, place.id, facts).map((crawl) => {
      const model = buildEducationWorkbookExportModel({
        set, placeId: place.id, scope: place.id, facts, state: crawl, labels, headingLabels, sources, siteOrigin: ORIGIN, title: `${title} ${placeLabel(place, locale)}`,
      }, data.presentation);
      matcher.add(model, place.id, series, labels, headingLabels);
      return model;
    });
  });
}

/** A topic page's crawl models, as education-explorer.tsx builds them in useCrawlModels, from the props the topic page passes. */
async function topicModels(locale: Locale, section: EducationTopicId, matcher: ReturnType<typeof educationMatcher>) {
  const [{ presentation, series, facts, labels, headingLabels }, sources] = await Promise.all([educationTopicPageData(locale, section), sourcesFor(locale)]);
  const title = message(presentation.messages, `education.page.${section}.title`);
  return educationCrawlStates(section, facts).map((crawl) => {
    const model = buildEducationWorkbookExportModel({ section, facts, state: crawl, labels, headingLabels, sources, siteOrigin: ORIGIN, title }, presentation);
    matcher.add(model, EDUCATION_GEORGIA, series, labels, headingLabels);
    return model;
  });
}

describe("education parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const set of ["schools", "kindergartens"] as const) {
      it(`${set} (${locale}): Georgia, Adjara and Shuakhevi`, async () => {
        const matcher = educationMatcher();
        const places = [EDUCATION_GEORGIA, "region.adjara", SHUAKHEVI];
        expectWorkbookParity(dataset(`education-${set}`), await placeModels(locale, set, places, matcher), matcher.match, places);
      });
    }
    for (const section of ["universities", "vocational"] as const) {
      it(`${section} (${locale}): Georgia`, async () => {
        const matcher = educationMatcher();
        expectWorkbookParity(dataset(`education-${section}`), await topicModels(locale, section, matcher), matcher.match);
      });
    }
  }

  it("Schools and Kindergartens (en): every place the pages list", async () => {
    for (const set of ["schools", "kindergartens"] as const) {
      const matcher = educationMatcher();
      const build = dataset(`education-${set}`);
      expectWorkbookParity(build, await placeModels("en", set, build.entities.map((entity) => entity.entityId), matcher), matcher.match);
    }
  });

  it("the harness fails on a changed value, a served year no row prints, an unmatched row, a served series without a row, no match at all and an uncovered place", async () => {
    const matcher = educationMatcher();
    const models = await placeModels("en", "schools", [SHUAKHEVI], matcher);
    const build = dataset("education-schools");
    const at = build.facts.findIndex((fact) => fact.entityId === SHUAKHEVI && fact.seriesId === "education.pupils.total" && fact.year === 2015);
    const changed = { ...build, facts: build.facts.map((fact, index) => index === at ? { ...fact, value: fact.value! + 1 } : fact) };
    const only = [SHUAKHEVI];
    expectWorkbookParity(build, models, matcher.match, only);
    expect(() => expectWorkbookParity(changed, models, matcher.match, only)).toThrow(/serves/);
    const extraYear = { ...build, facts: [...build.facts, { ...build.facts[at]!, year: 1990 }] };
    expect(() => expectWorkbookParity(extraYear, models, matcher.match, only)).toThrow(/no workbook row prints the year/);
    expect(() => expectWorkbookParity(build, models, () => null, only)).toThrow(/no served series matches the row/);
    // Nothing to compare is a failure, never a pass: no models, or no row that matches.
    expect(() => expectWorkbookParity(build, [], matcher.match, only)).toThrow(/no workbook row matched/);
    expect(() => expectWorkbookParity(build, models, () => null, only)).toThrow(/no workbook row matched/);
    // A place the test expects (by default every entity the dataset serves) that no row covers, as when its crawl states are empty.
    expect(() => expectWorkbookParity(build, models, matcher.match, [SHUAKHEVI, "region.adjara"])).toThrow(/region\.adjara: no workbook row covers the entity/);
    expect(() => expectWorkbookParity(build, models, matcher.match)).toThrow(/country\.georgia: no workbook row covers the entity/);
    const withoutTeachers = models.filter((model) => !model.readable.rows.some((row) => matcher.match(row, model)?.seriesId.startsWith("education.teachers.")));
    expect(() => expectWorkbookParity(build, withoutTeachers, matcher.match, only)).toThrow(/no workbook row prints it/);
  });
});

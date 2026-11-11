// apps/web/lib/factQuery/topics/registry.ts
//
// Every topic adapter, one per family; each adapter task adds its entry. Build-time only: the snapshot build and tests
// import it, runtime code never does (tests/factQuery/purity.test.ts), so no loader or source file reaches /mcp.
import path from "node:path";
import { loadSourceDocuments } from "../../data/sources";
import { SERVED_DATA_FILES } from "../../data/servedData";
import { message } from "../../i18n/messages";
import { getMessages } from "../../i18n/messages.server";
import { pageHref } from "../../i18n/routes";
import type { Locale, MessageScope } from "../../i18n/types";
import { loadReviewedSourceManifest } from "../../methodology/sourceManifest";
import { groupOfTopic, NAV_TREE } from "../../navigation/navTree";
import { methodologyManifestDocument, PUBLIC_SITE_ORIGIN } from "../manifestDocuments";
import { findSourceProvenanceFailures, resolvePublicSources } from "../sources";
import type { Basis, RawResolvedSource } from "../types";
import { demographyTopicAdapter } from "./demography";
import { educationTopicAdapter } from "./education";
import { healthTopicAdapter } from "./health";
import { TOPIC_PAGES } from "./pages";
import { socialTopicAdapter } from "./social";
import { packTopicFacts } from "./store";
import type { TopicAdapter, TopicDataset, TopicDatasetBuild, TopicsSnapshot, TopicValueStatus } from "./types";

export const TOPIC_ADAPTERS: readonly TopicAdapter[] = [educationTopicAdapter, demographyTopicAdapter, healthTopicAdapter, socialTopicAdapter];

/**
 * The site's own message for each unit token the topic CSVs use (R7: unit ids are the CSVs' tokens). One name per
 * token across every topic, so a shared token takes the family-neutral wording (`persons_thousand` is "thousand
 * persons", not Education's "thousand pupils"). A token missing here stops the build.
 */
const TOPIC_UNIT_MESSAGES: Readonly<Record<string, string>> = {
  persons: "education.unitPersons",
  persons_thousand: "health.unitThousandPersons",
  institutions: "education.unitInstitutions",
  persons_per_km2: "demography.densityUnitLong",
  children_per_woman: "demography.tfrUnit",
  births_per_1000_women: "demography.asfrUnit",
  years: "demography.lifeUnit",
  marriages: "demography.marriageLatestMarriages",
  divorces: "demography.marriageLatestDivorces",
  units: "health.unitUnits",
  units_thousand: "health.unitThousandUnits",
  visits_thousand: "health.unitThousandVisits",
  per_1000_population: "health.unitPerThousand",
  families: "social.unitFamilies",
  employers: "social.unitEmployers",
  gel: "social.unitGel",
  gel_million: "social.unitMlnGel",
  percent: "social.unitReturn",
};

/** The source registry's id (data/sources/source-documents.csv) of an archive's source id: the registry adds `source.`, which some archives already carry. */
function registrySourceId(id: string): string {
  return id.startsWith("source.") ? id : `source.${id}`;
}

const sorted = <T>(values: Iterable<T>) => [...new Set(values)].sort();

/** The navigation group a topic page sits under: the group of the hub whose sidebar lists it. */
function groupIdOf(pagePath: string): string {
  const hub = NAV_TREE.find((entry) => entry.sections.some((section) => section.href === pagePath));
  if (!hub) throw new Error(`Topic page ${pagePath} is not in the navigation`);
  return groupOfTopic(hub.id).id;
}

/** One fact per entity, series and year, and a value somewhere for every listed series. */
function checkDataset(build: TopicDatasetBuild): void {
  const { datasetId } = build.page;
  const cells = new Set<string>();
  for (const fact of build.facts) {
    const cell = `${fact.entityId}:${fact.seriesId}:${fact.year}`;
    if (cells.has(cell)) throw new Error(`${datasetId}: two facts for ${cell}`);
    cells.add(cell);
  }
  const valued = new Set(build.facts.filter((fact) => fact.value !== null).map((fact) => fact.seriesId));
  for (const series of build.series) if (!valued.has(series.seriesId)) throw new Error(`${datasetId}: series ${series.seriesId} has no value`);
}

/** Each used unit's Georgian and English name, from the site's unit messages. */
async function unitNames(units: readonly string[]): Promise<TopicsSnapshot["units"]> {
  const keys = units.map((unit) => {
    const key = TOPIC_UNIT_MESSAGES[unit];
    if (!key) throw new Error(`Topic unit ${unit} has no name`);
    return key;
  });
  const scopes = keys.map((key) => key.split(".")[0] as MessageScope);
  const [ka, en] = await Promise.all((["ka", "en"] as const satisfies readonly Locale[]).map((locale) => getMessages(locale, scopes)));
  return Object.fromEntries(units.map((unit, index) => [unit, { labelKa: message(ka!, keys[index]!), labelEn: message(en!, keys[index]!) }]));
}

/**
 * The sources the topic facts cite, as the core datasets' are resolved: each cited id's source-documents.csv row,
 * joined by repository path to the documents of the adapters' reviewed source archives. An id with no registry row or
 * no archived document stops the build. Untranslated: the snapshot build adds the Georgian and English names.
 */
async function topicSources(sourceIds: readonly string[], archives: readonly TopicAdapter["sourceArchive"][number][]): Promise<RawResolvedSource[]> {
  if (!sourceIds.length) return [];
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [registry, ...manifests] = await Promise.all([
    loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments),
    ...archives.map((archive) => loadReviewedSourceManifest(repositoryRoot, archive)),
  ]);
  const rows = sourceIds.map((id) => {
    const row = registry.find((entry) => entry.sourceId === id);
    if (!row) throw new Error(`Topic source ${id} is not in the source registry`);
    return row;
  });
  const sources = resolvePublicSources({ sourceDocuments: rows, manifestDocuments: manifests.flat().map(methodologyManifestDocument) });
  const failures = findSourceProvenanceFailures(sources);
  if (failures.length) throw new Error(`Topic source ${failures.map((failure) => failure.sourceId).join(", ")} resolves to no archived document`);
  return sources.map((source) => ({ ...source, documents: [...source.documents].sort((a, b) => (a.documentId < b.documentId ? -1 : 1)) }));
}

/**
 * The snapshot's topics section and the sources its facts cite. Datasets follow TOPIC_PAGES; a page built twice, two
 * facts for one cell, a listed series with no value, a unit with no name or a source no archive resolves stops the build.
 */
export async function buildTopicsSnapshot(adapters: readonly TopicAdapter[] = TOPIC_ADAPTERS): Promise<{ topics: TopicsSnapshot; sources: RawResolvedSource[] }> {
  const builds = (await Promise.all(adapters.map((adapter) => adapter.build()))).flat();
  const seen = new Set<string>();
  for (const build of builds) {
    if (seen.has(build.page.datasetId)) throw new Error(`Topic dataset ${build.page.datasetId} is built twice`);
    seen.add(build.page.datasetId);
    checkDataset(build);
  }
  builds.sort((a, b) => TOPIC_PAGES.findIndex((page) => page.datasetId === a.page.datasetId) - TOPIC_PAGES.findIndex((page) => page.datasetId === b.page.datasetId));

  const facts = builds.flatMap((build) => build.facts);
  const sourceIds = sorted(facts.flatMap((fact) => fact.sourceIds.map(registrySourceId)));
  const sourceIndex = new Map(facts.flatMap((fact) => fact.sourceIds).map((id) => [id, sourceIds.indexOf(registrySourceId(id))]));
  const basisCodes: Basis[] = sorted(facts.map((fact) => fact.basis));
  const statusCodes: TopicValueStatus[] = sorted(facts.map((fact) => fact.status));
  const [units, sources] = await Promise.all([
    unitNames(sorted(builds.flatMap((build) => build.series.map((series) => series.unit)))),
    topicSources(sourceIds, sorted(adapters.flatMap((adapter) => adapter.sourceArchive))),
  ]);

  const datasets = builds.map((build): TopicDataset => {
    const { facts: _facts, ...dataset } = build;
    // Not Math.min(...years): a large dataset's year column overflows the call's argument limit.
    const years = build.facts.reduce((span, { year }) => ({ min: Math.min(span.min, year), max: Math.max(span.max, year) }), { min: Infinity, max: -Infinity });
    return {
      ...dataset,
      urlKa: `${PUBLIC_SITE_ORIGIN}${pageHref(build.page.pagePath, "ka")}`, urlEn: `${PUBLIC_SITE_ORIGIN}${pageHref(build.page.pagePath, "en")}`,
      groupId: groupIdOf(build.page.pagePath), firstYear: years.min, lastYear: years.max,
      columns: packTopicFacts(build, sourceIndex, basisCodes, statusCodes),
    };
  });
  return { topics: { datasets, sourceIds, basisCodes, statusCodes, units }, sources };
}

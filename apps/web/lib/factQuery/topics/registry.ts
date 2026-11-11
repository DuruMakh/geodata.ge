// apps/web/lib/factQuery/topics/registry.ts
//
// Every topic adapter, one per family; each adapter task adds its entry. Build-time only: the snapshot build and tests
// import it, runtime code never does (tests/factQuery/purity.test.ts), so no loader or source file reaches /mcp.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadSourceDocuments } from "../../data/sources";
import { SERVED_DATA_FILES } from "../../data/servedData";
import { message } from "../../i18n/messages";
import { getMessages } from "../../i18n/messages.server";
import { pageHref } from "../../i18n/routes";
import type { Locale, MessageScope } from "../../i18n/types";
import { serviceMessagesSchema } from "../../i18n/validation";
import { loadReviewedSourceManifest } from "../../methodology/sourceManifest";
import { groupOfTopic, NAV_TREE, type NavHub } from "../../navigation/navTree";
import { methodologyManifestDocument, PUBLIC_SITE_ORIGIN } from "../manifestDocuments";
import { findSourceProvenanceFailures, resolvePublicSources } from "../sources";
import type { Basis, RawResolvedSource } from "../types";
import { budgetExtrasTopicAdapter } from "./budgetExtras";
import { businessTopicAdapter } from "./business";
import { crimeTopicAdapter } from "./crime";
import { demographyTopicAdapter } from "./demography";
import { educationTopicAdapter } from "./education";
import { energyFoodTopicAdapter } from "./energyFood";
import { environmentTopicAdapter } from "./environment";
import { externalTopicAdapter } from "./external";
import { healthTopicAdapter } from "./health";
import { housingTopicAdapter } from "./housing";
import { internetTopicAdapter } from "./internet";
import { livingStandardsTopicAdapter } from "./livingStandards";
import { moneyBanksTopicAdapter } from "./moneyBanks";
import { TOPIC_PAGES } from "./pages";
import { scienceCultureTopicAdapter } from "./scienceCulture";
import { socialTopicAdapter } from "./social";
import { packTopicFacts } from "./store";
import { tradeTopicAdapter } from "./trade";
import { transportTopicAdapter } from "./transport";
import { unemploymentTopicAdapter } from "./unemployment";
import { wagesTopicAdapter } from "./wages";
import type { TopicAdapter, TopicDataset, TopicDatasetBuild, TopicsSnapshot, TopicValueStatus } from "./types";

export const TOPIC_ADAPTERS: readonly TopicAdapter[] = [educationTopicAdapter, demographyTopicAdapter, healthTopicAdapter, socialTopicAdapter, unemploymentTopicAdapter, wagesTopicAdapter, businessTopicAdapter, moneyBanksTopicAdapter, livingStandardsTopicAdapter, housingTopicAdapter, internetTopicAdapter, transportTopicAdapter, tradeTopicAdapter, externalTopicAdapter, budgetExtrasTopicAdapter, scienceCultureTopicAdapter, crimeTopicAdapter, energyFoodTopicAdapter, environmentTopicAdapter];

/**
 * The site's own message for each unit token the topic CSVs use (R7: unit ids are the CSVs' tokens). One name per
 * token across every topic, so a shared token takes the family-neutral wording (`persons_thousand` is "thousand
 * persons", not Education's "thousand pupils"). A `units.` key is a service message (data/localization/{ka,en}/
 * service-messages.json): a name no page prints, kept out of the pages' message bundles. A token missing here stops the build.
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
  units_thousand: "units.thousandUnits",
  visits_thousand: "health.unitThousandVisits",
  per_1000_population: "health.unitPerThousand",
  families: "social.unitFamilies",
  employers: "social.unitEmployers",
  gel: "format.gel",
  gel_million: "social.unitMlnGel",
  percent: "social.unitReturn",
  thousand_persons: "health.unitThousandPersons",
  hours: "labour.unit.hours",
  enterprises: "business.unitFirms",
  gel_month: "social.unitGel",
  index: "units.index",
  count: "housing.unitCount",
  square_metres: "housing.unitSquareMetres",
  index_2020: "housing.unitIndex",
  gel_per_square_metre: "housing.unitGelPerSquareMetre",
  thousand_units: "units.thousandUnits",
  million_passenger_km: "transport.unitMillionPkm",
  passenger_km_per_person: "transport.unitPkmPerPerson",
  thousand_passengers: "transport.unitThousandPassengers",
  million_tonne_km: "transport.unitMillionTkm",
  thousand_tonnes: "transport.unitThousandTonnes",
  km: "transport.unitKm",
  usd: "gdp.usd",
  usd_million: "external.position.unitMlnUsd",
  count_thousand: "scienceCulture.unit.thousand",
  crimes: "crime.unitCrimes",
  accidents: "crime.unitAccidents",
  ktoe: "energyFood.unit.ktoe",
  gwh: "energyFood.unit.gwh",
  million_gel: "social.unitMlnGel",
  thousand_head: "energyFood.unit.thousand_head",
  million_litres: "energyFood.unit.million_litres",
  million_pieces: "units.millionPieces",
  gel_per_kg: "units.gelPerKg",
  gel_per_litre: "units.gelPerLitre",
  gel_per_piece: "units.gelPerPiece",
  mt_co2e: "environment.unit.mt_co2e",
  kt_co2e: "environment.unit.kt_co2e",
  t_co2e_per_person: "environment.unit.t_co2e_per_person",
  ug_m3: "environment.unit.ug_m3",
  days: "environment.unit.days",
  celsius: "environment.unit.celsius",
  mm: "environment.unit.mm",
  million_m3: "environment.unit.million_m3",
  million_persons: "environment.unit.million_persons",
  m3_per_person: "environment.unit.m3_per_person",
  kg_per_person: "environment.unit.kg_per_person",
  m3: "environment.unit.m3",
  fires: "environment.unit.fires",
  hectares: "environment.unit.hectares",
};

/** The source registry's id (data/sources/source-documents.csv) of an archive's source id: the registry adds `source.`, which some archives already carry. */
function registrySourceId(id: string): string {
  return id.startsWith("source.") ? id : `source.${id}`;
}

const sorted = <T>(values: Iterable<T>) => [...new Set(values)].sort();

/** The hub whose sidebar lists a topic page. */
function hubOf(pagePath: string): NavHub {
  const hub = NAV_TREE.find((entry) => entry.sections.some((section) => section.href === pagePath));
  if (!hub) throw new Error(`Topic page ${pagePath} is not in the navigation`);
  return hub;
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

/** A locale's service messages, as the snapshot build reads them. */
async function serviceMessages(locale: Locale) {
  const file = path.resolve(/* turbopackIgnore: true */ process.cwd(), `../../data/localization/${locale}/service-messages.json`);
  return serviceMessagesSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

/** Each used unit's Georgian and English name, from the site's unit messages or a `units.` service message. */
async function unitNames(units: readonly string[]): Promise<TopicsSnapshot["units"]> {
  const keys = units.map((unit) => {
    const key = TOPIC_UNIT_MESSAGES[unit];
    if (!key) throw new Error(`Topic unit ${unit} has no name`);
    return key;
  });
  const scopes = keys.filter((key) => !key.startsWith("units.")).map((key) => key.split(".")[0] as MessageScope);
  const [ka, en] = await Promise.all((["ka", "en"] as const satisfies readonly Locale[]).map(async (locale) => ({ ...(await getMessages(locale, scopes)), ...(await serviceMessages(locale)) })));
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
  const documents = manifests.flat().map(methodologyManifestDocument);
  // A registry row that names its workbook's official URL rather than the archived file (four Trade workbooks) is the
  // archived document of that URL.
  const archivedAt = new Map(documents.flatMap((document) => (document.officialUrl ? [[document.officialUrl, document.repositoryPath] as const] : [])));
  const rows = sourceIds.map((id) => {
    const row = registry.find((entry) => entry.sourceId === id);
    if (!row) throw new Error(`Topic source ${id} is not in the source registry`);
    const archived = archivedAt.get(row.sourceUrlOrFile);
    return archived ? { ...row, sourceUrlOrFile: archived } : row;
  });
  const sources = resolvePublicSources({ sourceDocuments: rows, manifestDocuments: documents });
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
  const [units, sources, commonKa, commonEn] = await Promise.all([
    unitNames(sorted(builds.flatMap((build) => build.series.map((series) => series.unit)))),
    topicSources(sourceIds, sorted(adapters.flatMap((adapter) => adapter.sourceArchive))),
    getMessages("ka", ["common"]), getMessages("en", ["common"]),
  ]);

  const datasets = builds.map((build): TopicDataset => {
    const { facts: _facts, ...dataset } = build;
    // Not Math.min(...years): a large dataset's year column overflows the call's argument limit.
    const years = build.facts.reduce((span, { year }) => ({ min: Math.min(span.min, year), max: Math.max(span.max, year) }), { min: Infinity, max: -Infinity });
    const hub = hubOf(build.page.pagePath);
    return {
      ...dataset,
      urlKa: `${PUBLIC_SITE_ORIGIN}${pageHref(build.page.pagePath, "ka")}`, urlEn: `${PUBLIC_SITE_ORIGIN}${pageHref(build.page.pagePath, "en")}`,
      groupId: groupOfTopic(hub.id).id,
      // The search name: the sidebar's topic name, then the page title (R26).
      searchKa: `${message(commonKa, hub.labelKey)} — ${build.titleKa}`, searchEn: `${message(commonEn, hub.labelKey)} — ${build.titleEn}`,
      firstYear: years.min, lastYear: years.max,
      columns: packTopicFacts(build, sourceIndex, basisCodes, statusCodes),
    };
  });
  return { topics: { datasets, sourceIds, basisCodes, statusCodes, units }, sources };
}

import path from "node:path";
import type { ServedDemographyObservation } from "../data/demography/types";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import type { Locale, Messages } from "../i18n/types";
import { projectPublicSources } from "../methodology/publicSources";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectMigrationObservation, projectNationalObservation } from "./clientData";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { MARRIAGE_SERIES, marriageFactsForPlace } from "./demographyMarriage";
import { MIGRATION_SERIES } from "./demographyMigration";
import { NATIONAL_SERIES } from "./demographyNational";
import type { WorkbookPublicSource } from "./workbookModel";

/*
 * What the Demography pages hand their explorers beyond the shared population basics (populationBasics.server.ts): the
 * national, migration and marriage rows they ship and the originals they cite. Shared by the pages (lib/pages/demography-*.tsx)
 * and the MCP snapshot build (lib/factQuery/topics/demography.ts), which cannot import the pages (they pull in React).
 */

/** The reviewed originals the workbook and the source note name, in the page's language. */
export async function loadPopulationSources(locale: Locale): Promise<(WorkbookPublicSource & { sourceId: string })[]> {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [manifest, catalogue] = await Promise.all([loadReviewedSourceManifest(repositoryRoot, "demography"), loadEnglishCatalogue(repositoryRoot)]);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  return manifest.map((source) => {
    const translated = publicSources.find((candidate) => candidate.source_id === source.source_id)!;
    return {
      sourceId: source.source_id,
      years: source.years,
      title: translated.title,
      organization: translated.publisher,
      downloadHref: source.downloadHref,
      retrievedAt: source.retrieved_at,
    };
  });
}

/** The national series the Births and deaths page's charts read, as the browser receives them. */
export function birthsDeathsNationalFacts(served: readonly ServedDemographyObservation[]) {
  return served.filter((fact) => NATIONAL_SERIES.includes(fact.seriesId)).map(projectNationalObservation);
}

/** The three series the Migration page reads, as the browser receives them, never the whole mirrored file. */
export function migrationPageFacts(served: readonly ServedDemographyObservation[]) {
  return served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
}

/** The Marriages and divorces page's list: its series ids, Georgia's rows of them and their full and list names. */
export function marriagePageData(messages: Messages, served: readonly ServedDemographyObservation[]) {
  const t = (key: string) => message(messages, `demography.${key}`);
  const ids = MARRIAGE_SERIES.map((series) => series.id);
  return {
    ids,
    // Only Georgia's nine series and its mid-year population go to the browser; the places block is drawn from server-built rows.
    georgia: marriageFactsForPlace(served, GEORGIA_PLACE_ID, ids),
    labels: Object.fromEntries(ids.map((id) => [id, t(`marriageSeries.${id}`)])),
    listLabels: Object.fromEntries(ids.map((id) => [id, t(`marriageList.${id}`)])),
  };
}

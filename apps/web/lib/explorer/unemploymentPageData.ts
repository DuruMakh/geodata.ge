import path from "node:path";
import type { ClientUnemploymentObservation, ServedUnemploymentObservation } from "../data/unemployment/types";
import { unemploymentIndicators } from "../data/unemployment/types";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import type { Locale } from "../i18n/types";
import { projectPublicSources } from "../methodology/publicSources";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { UNEMPLOYMENT_AGE_FIRST_YEAR } from "./unemploymentAge";
import { unemploymentOverviewIndicators } from "./unemploymentOverview";
import { UNEMPLOYMENT_SECTIONS, unemploymentBreakdownsForSection, type UnemploymentSectionId } from "./unemploymentSections";

/*
 * What the Unemployment pages hand their explorers: the served observations a section (or a region page) shows and the
 * archived originals its workbooks cite. Shared by the pages (lib/pages/unemployment.tsx) and the MCP snapshot build
 * (lib/factQuery/topics/unemployment.ts), which cannot import the pages (they pull in `server-only` and React).
 */

/** A section's served observations: its breakdowns' indicators (the Overview adds the sexes' rates), a region page only its region's. */
export function unemploymentPageFacts(all: readonly ServedUnemploymentObservation[], section: UnemploymentSectionId, regionId?: string) {
  const dimensions = new Set([...unemploymentBreakdownsForSection(section), "national", ...(section === "overview" ? ["sex"] : [])]);
  const mainBreakdown = UNEMPLOYMENT_SECTIONS.find(item => item.id === section)!.breakdown;
  const served = all.filter(fact => (section !== "age" || fact.dimension === "age" && fact.year >= UNEMPLOYMENT_AGE_FIRST_YEAR) && (!regionId || fact.dimension === "region" && fact.groupId === regionId) && dimensions.has(fact.dimension) && (section === "overview" ? (fact.dimension === "sex" ? fact.indicatorId === "unemployment_rate" : unemploymentOverviewIndicators(fact.dimension).includes(fact.indicatorId)) : section === "regions" ? unemploymentOverviewIndicators("region").includes(fact.indicatorId) : unemploymentIndicators(mainBreakdown).includes(fact.indicatorId)));
  const facts: ClientUnemploymentObservation[] = served.map(({ dimension, groupId, sex, indicatorId, year, value, sourceId }) => ({ dimension, groupId, sex, indicatorId, year, value, sourceId }));
  return { served, facts };
}

/** The archived Geostat workbooks the pages' downloads cite, named in the page's language. */
export async function unemploymentWorkbookSources(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [manifest, catalogue] = await Promise.all([loadReviewedSourceManifest(root, "unemployment"), loadEnglishCatalogue(root)]);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  return manifest.map(source => {
    const translated = publicSources.find(row => row.source_id === source.source_id)!;
    return { sourceId: source.source_id, years: source.years, title: translated.title, organization: translated.publisher, downloadHref: source.downloadHref, retrievedAt: source.retrieved_at };
  });
}

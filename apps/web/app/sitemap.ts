import type { MetadataRoute } from "next";
import { loadServedLandingData, loadServedMunicipalData } from "../lib/data/servedData";
import { LIVE_METHODOLOGY_IDS, METHODOLOGY_CONTENT } from "../lib/methodology/catalog";
import { MUNICIPALITY_ROUTES } from "../lib/explorer/municipalityRoutes";
import { resolveSiteUrl } from "../lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  const { sourceDocuments } = await loadServedLandingData();
  const { regions } = await loadServedMunicipalData();
  const lastReviewedAt = sourceDocuments
    .map((source) => source.lastReviewedAt)
    .sort()
    .at(-1);
  const lastModified = lastReviewedAt ? new Date(lastReviewedAt) : undefined;
  const methodologyLastModified = LIVE_METHODOLOGY_IDS.map(
    (id) => METHODOLOGY_CONTENT[id].reviewedAt,
  )
    .sort()
    .at(-1);

  return [
    { url: `${siteUrl}/`, lastModified },
    { url: `${siteUrl}/about`, lastModified },
    { url: `${siteUrl}/explorer`, lastModified },
    { url: `${siteUrl}/explorer/expenditure`, lastModified },
    { url: `${siteUrl}/explorer/revenue`, lastModified },
    { url: `${siteUrl}/explorer/analysis`, lastModified },
    { url: `${siteUrl}/explorer/municipalities`, lastModified },
    { url: `${siteUrl}/explorer/municipalities/georgia`, lastModified },
    {
      url: `${siteUrl}/methodology`,
      lastModified: methodologyLastModified ? new Date(methodologyLastModified) : undefined,
    },
    ...LIVE_METHODOLOGY_IDS.map((id) => ({
      url: `${siteUrl}/methodology/${id}`,
      lastModified: new Date(METHODOLOGY_CONTENT[id].reviewedAt),
    })),
    // The 64 municipality pages and 11 region roll-ups are complete, closed
    // sets. Municipality public identities are stable slugs; numeric codes
    // remain source-data identities only.
    ...MUNICIPALITY_ROUTES.map(({ slug }) => ({
      url: `${siteUrl}/explorer/municipalities/${slug}`,
      lastModified,
    })),
    ...regions.map((region) => ({
      // Region ids carry a "region." prefix (e.g. "region.tbilisi"); the route
      // strips it, the same way .../region/[id]/page.tsx's own
      // generateStaticParams and prev/next hrefs already do.
      url: `${siteUrl}/explorer/municipalities/region/${region.id.replace("region.", "")}`,
      lastModified,
    })),
  ];
}

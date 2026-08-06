import type { MetadataRoute } from "next";
import { loadServedLandingData, loadServedMunicipalData } from "../lib/data/servedData";
import { resolveSiteUrl } from "../lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  const { sourceDocuments } = await loadServedLandingData();
  const { municipalities, regions } = await loadServedMunicipalData();
  const lastReviewedAt = sourceDocuments
    .map((source) => source.lastReviewedAt)
    .sort()
    .at(-1);
  const lastModified = lastReviewedAt ? new Date(lastReviewedAt) : undefined;

  return [
    { url: `${siteUrl}/`, lastModified },
    { url: `${siteUrl}/explorer`, lastModified },
    { url: `${siteUrl}/explorer/expenditure`, lastModified },
    { url: `${siteUrl}/explorer/revenue`, lastModified },
    { url: `${siteUrl}/explorer/analysis`, lastModified },
    { url: `${siteUrl}/explorer/municipalities`, lastModified },
    // The 64 municipality pages and 11 region roll-ups: the same complete,
    // closed sets app/explorer/municipalities/[code]/page.tsx and
    // .../region/[id]/page.tsx build generateStaticParams from, never a
    // hardcoded list.
    ...municipalities.map((municipality) => ({
      url: `${siteUrl}/explorer/municipalities/${municipality.code}`,
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

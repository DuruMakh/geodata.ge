import type { MetadataRoute } from "next";
import { loadServedLandingData } from "../lib/data/servedData";
import { resolveSiteUrl } from "../lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  const { sourceDocuments } = await loadServedLandingData();
  const lastReviewedAt = sourceDocuments
    .map((source) => source.lastReviewedAt)
    .sort()
    .at(-1);
  const lastModified = lastReviewedAt ? new Date(lastReviewedAt) : undefined;

  return [
    { url: `${siteUrl}/`, lastModified },
    { url: `${siteUrl}/explorer`, lastModified },
  ];
}

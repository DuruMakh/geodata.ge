import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "../lib/siteUrl";

// Written to out/robots.txt at build time: the static export only accepts metadata routes declared static.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${resolveSiteUrl()}/sitemap.xml`,
  };
}

// The site's redirects and response headers. Vercel applies them from vercel.json, which
// scripts/prepare-vercel-config.ts generates from this module; scripts/serve-static.ts applies the
// same file locally and in CI.
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { LEGACY_TOPIC_FORWARDS } from "../navigation/navTree";

export type SiteRedirect = { source: string; destination: string; permanent: boolean };
export type SiteHeaderRule = { source: string; headers: { key: string; value: string }[] };

// Report-only for now (docs/deployment.md, "SEO and headers"): browsers log what the
// policy would block without blocking it. Pages are prerendered, so Next.js's inline
// scripts cannot carry a per-request nonce and script-src needs 'unsafe-inline'; React
// needs 'unsafe-eval' only in development. The outside hosts are the two analytics
// services components/site/site-analytics.tsx loads and the endpoints they report to.
export const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://*.clarity.ms https://c.bing.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com https://*.clarity.ms https://c.bing.com",
  "font-src 'self'",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.clarity.ms https://c.bing.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function siteRedirects(): SiteRedirect[] {
  return [
    ...MUNICIPALITY_ROUTES.flatMap(({ code, slug }) => ["", "/en"].map((prefix) => ({
      source: `${prefix}/explorer/municipalities/${code}`,
      destination: `${prefix}/explorer/municipalities/${slug}`,
      permanent: true,
    }))),
    // The Poverty and inequality hub became Living standards, whose section is on the Living standards and health page now;
    // the part after # carries over in the browser.
    ...[["/explorer/poverty", LEGACY_TOPIC_FORWARDS.find(({ topic }) => topic === "living-standards")!.to], ["/explorer/poverty/rates", "/explorer/living-standards/poverty"], ["/explorer/poverty/inequality", "/explorer/living-standards/inequality"]]
      .flatMap(([source, destination]) => ["", "/en"].map((prefix) => ({ source: `${prefix}${source}`, destination: `${prefix}${destination}`, permanent: true }))),
    // The topic hubs a group page replaced: the group page, with the topic in the query and no #, so the browser keeps the
    // old link's # (spec 2026-10-24-explorer-regroup §3.1); the page's GroupTopicScroll turns it into the section's anchor.
    ...LEGACY_TOPIC_FORWARDS.flatMap(({ from, to }) => ["", "/en"].map((prefix) => ({ source: `${prefix}${from}`, destination: `${prefix}${to}`, permanent: true }))),
  ];
}

export function siteHeaders(): SiteHeaderRule[] {
  return [
    {
      source: "/downloads/methodology/:dataset/files/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
    },
    // PDFs are left out: a sandboxed document cannot run the browser's PDF viewer in every browser.
    {
      source: "/downloads/methodology/:dataset/files/:path((?!.*\\.pdf$).*)",
      headers: [{ key: "Content-Security-Policy", value: "sandbox; default-src 'none'" }],
    },
    // Page data (lib/data/pageDataFiles.ts) is named by a hash of its content, so a published file never changes.
    {
      source: "/page-data/:file*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        { key: "X-Robots-Tag", value: "noindex" },
      ],
    },
    // The place index All data's search fetches (app/explorer-places.{ka,en}.json): data for the page, not a page to list.
    {
      source: "/explorer-places.:locale(ka|en).json",
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
      ],
    },
  ];
}

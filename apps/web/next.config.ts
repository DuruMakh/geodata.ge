import type { NextConfig } from "next";
import { MUNICIPALITY_ROUTES } from "./lib/explorer/municipalityRoutes";

// Report-only for now (docs/deployment.md, "SEO and headers"): browsers log what the
// policy would block without blocking it. Pages are prerendered, so Next.js's inline
// scripts cannot carry a per-request nonce and script-src needs 'unsafe-inline'; React
// needs 'unsafe-eval' only in development. The outside hosts are the two analytics
// services components/site/site-analytics.tsx loads and the endpoints they report to.
const contentSecurityPolicy = [
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

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  experimental: { globalNotFound: true },
  // CI's build job sets GEODATA_TYPECHECK_GATED=1: its checks job runs `npm run typecheck` on the same commit, and
  // CI must pass before a merge, so the build skips its own second TypeScript pass there. Everywhere else, local
  // builds and the production deploy included, `next build` still type-checks.
  typescript: { ignoreBuildErrors: process.env.GEODATA_TYPECHECK_GATED === "1" },
  // The /mcp route reads the build-time snapshot at request time. Next traces
  // only what it can see statically, and this artifact is written by `prebuild`
  // rather than imported, so it must be included explicitly or the deployed
  // function has no data to answer from.
  outputFileTracingIncludes: {
    "/mcp": ["./lib/factQuery/generated/snapshot.json"],
  },
  // Methodology pages read the generated archives under public/downloads at
  // build time, so the tracer bundles all of them (over Vercel's 250 MB
  // function limit). Every page is prerendered and the CDN serves public/
  // directly, so no function needs these files at request time.
  outputFileTracingExcludes: {
    "*": ["./public/downloads/**"],
  },
  async redirects() {
    return [
      ...MUNICIPALITY_ROUTES.flatMap(({ code, slug }) => ["", "/en"].map((prefix) => ({
        source: `${prefix}/explorer/municipalities/${code}`,
        destination: `${prefix}/explorer/municipalities/${slug}`,
        permanent: true,
      }))),
      // The Poverty and inequality hub became Living standards; the part after # carries over in the browser.
      ...[["/explorer/poverty", "/explorer/living-standards"], ["/explorer/poverty/rates", "/explorer/living-standards/poverty"], ["/explorer/poverty/inequality", "/explorer/living-standards/inequality"]]
        .flatMap(([source, destination]) => ["", "/en"].map((prefix) => ({ source: `${prefix}${source}`, destination: `${prefix}${destination}`, permanent: true }))),
    ];
  },
  async headers() {
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
  },
};

export default nextConfig;

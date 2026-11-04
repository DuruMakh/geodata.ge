import type { NextConfig } from "next";
import { siteHeaders, siteRedirects } from "./lib/site/routing";

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
  redirects: async () => siteRedirects(),
  headers: async () => siteHeaders(),
};

export default nextConfig;

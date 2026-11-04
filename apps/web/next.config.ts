import type { NextConfig } from "next";
import { siteHeaders, siteRedirects } from "./lib/site/routing";

// Every page is written to out/ as a static file. Vercel serves them and applies the redirects and headers from
// vercel.json (generated from lib/site/routing.ts); /mcp is the one function (api/mcp.ts).
const nextConfig: NextConfig = {
  output: "export",
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  experimental: { globalNotFound: true },
  // CI's build job sets GEODATA_TYPECHECK_GATED=1: its checks job runs `npm run typecheck` on the same commit, and
  // CI must pass before a merge, so the build skips its own second TypeScript pass there. Everywhere else, local
  // builds and the production deploy included, `next build` still type-checks.
  typescript: { ignoreBuildErrors: process.env.GEODATA_TYPECHECK_GATED === "1" },
  // The export ignores these (Vercel applies them from vercel.json); `next dev` still serves them, so local work and
  // the browser specs that check forwards and headers behave as in production. Dev prints a warning about it.
  ...(process.env.NODE_ENV === "development" ? { redirects: async () => siteRedirects(), headers: async () => siteHeaders() } : {}),
};

export default nextConfig;

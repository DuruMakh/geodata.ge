import type { NextConfig } from "next";

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
};

export default nextConfig;

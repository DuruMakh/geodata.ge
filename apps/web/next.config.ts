import type { NextConfig } from "next";
import { MUNICIPALITY_ROUTES } from "./lib/explorer/municipalityRoutes";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  experimental: { globalNotFound: true },
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
    return MUNICIPALITY_ROUTES.flatMap(({ code, slug }) => ["", "/en"].map((prefix) => ({
      source: `${prefix}/explorer/municipalities/${code}`,
      destination: `${prefix}/explorer/municipalities/${slug}`,
      permanent: true,
    })));
  },
  async headers() {
    return [
      {
        source: "/downloads/methodology/:dataset/files/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
      ...["external_trade_methodology.html.txt", "metadata-en.html.txt"].map(filename => ({
        source: `/downloads/methodology/trade/files/${filename}`,
        headers: [
          { key: "Content-Disposition", value: "attachment" },
          { key: "Content-Security-Policy", value: "sandbox; default-src 'none'" },
        ],
      })),
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

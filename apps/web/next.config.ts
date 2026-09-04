import type { NextConfig } from "next";
import { MUNICIPALITY_ROUTES } from "./lib/explorer/municipalityRoutes";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  // The /mcp route reads the build-time snapshot at request time. Next traces
  // only what it can see statically, and this artifact is written by `prebuild`
  // rather than imported, so it must be included explicitly or the deployed
  // function has no data to answer from.
  outputFileTracingIncludes: {
    "/mcp": ["./lib/factQuery/generated/snapshot.json"],
  },
  async redirects() {
    return MUNICIPALITY_ROUTES.map(({ code, slug }) => ({
      source: `/explorer/municipalities/${code}`,
      destination: `/explorer/municipalities/${slug}`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/downloads/methodology/:dataset/files/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
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

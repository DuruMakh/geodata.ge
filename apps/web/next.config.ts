import type { NextConfig } from "next";
import { MUNICIPALITY_ROUTES } from "./lib/explorer/municipalityRoutes";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
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

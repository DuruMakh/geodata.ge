// Canonical site origin for build-time metadata (Open Graph URLs, canonical
// links, robots.txt, sitemap.xml).
//
// Resolution order:
// 1. NEXT_PUBLIC_SITE_URL — explicit override, wins everywhere.
// 2. VERCEL_PROJECT_PRODUCTION_URL — set by Vercel builds to the project's
//    shortest production domain (the custom domain once one is attached,
//    geodata-ge.vercel.app until then). Preview builds also get the
//    production domain here, so preview canonicals point at production.
// 3. http://localhost:3000 — local dev fallback.
export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionHost) {
    return `https://${vercelProductionHost.replace(/\/+$/, "")}`;
  }
  return "http://localhost:3000";
}

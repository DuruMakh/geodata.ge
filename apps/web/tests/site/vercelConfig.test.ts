import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildVercelConfig } from "../../scripts/prepare-vercel-config";
import { siteHeaders, siteRedirects } from "../../lib/site/routing";

// vercel.json is generated (npm run site:prepare-vercel-config) from lib/site/routing.ts; this keeps the committed
// file and the rules it is made from from drifting apart.
describe("vercel.json", () => {
  const config = buildVercelConfig();

  it("on disk equals what the script generates", () => {
    expect(JSON.parse(readFileSync("vercel.json", "utf8"))).toEqual(config);
  });

  it("keeps every site redirect as a permanent redirect", () => {
    expect(config.redirects).toEqual(siteRedirects());
    expect(config.redirects).toHaveLength(166);
    expect(config.redirects.every(rule => rule.permanent)).toBe(true);
  });

  it("serves the static export with clean URLs and no trailing slash", () => {
    expect(config.framework).toBeNull();
    expect(config.buildCommand).toBe("npm run build");
    expect(config.outputDirectory).toBe("out");
    expect(config.cleanUrls).toBe(true);
    expect(config.trailingSlash).toBe(false);
    expect(config.git).toEqual({ deploymentEnabled: { main: false } });
  });

  it("routes /mcp to its function, with the snapshot it answers from", () => {
    expect(config.rewrites).toEqual([{ source: "/mcp", destination: "/api/mcp" }]);
    expect(config.functions).toEqual({ "api/mcp.ts": { maxDuration: 10, includeFiles: "lib/factQuery/generated/snapshot.json" } });
  });

  it("sends the site headers, then static-asset caching and the og-image type", () => {
    const rules = siteHeaders();
    expect(config.headers.slice(0, rules.length)).toEqual(rules);
    expect(config.headers.slice(rules.length)).toEqual([
      { source: "/_next/static/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/opengraph-image", headers: [{ key: "Content-Type", value: "image/png" }] },
      { source: "/en/opengraph-image", headers: [{ key: "Content-Type", value: "image/png" }] },
    ]);
  });

  it("stays under Vercel's 2,048 routes", () => {
    expect(config.redirects.length + config.headers.length + config.rewrites.length).toBeLessThan(2048);
  });
});

import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { ALL_DATA_PATH, LEGACY_TOPIC_FORWARDS, NAV_GROUPS } from "../../lib/navigation/navTree";

// Review Focus 3 at config level (spec 2026-10-24-explorer-regroup §3.1): every old topic hub address, in both languages,
// forwards permanently to its group page with the topic in the query; the browser keeps any `#…` the old link had.
describe("old topic hub forwards", async () => {
  const redirects = (await nextConfig.redirects?.()) ?? [];
  const prefixes = ["", "/en"] as const;

  it.each(LEGACY_TOPIC_FORWARDS.flatMap((row) => prefixes.map((prefix) => ({ ...row, prefix }))))(
    "$from forwards to $to (language prefix '$prefix')",
    ({ from, to, prefix }) => {
      expect(redirects).toContainEqual({ source: `${prefix}${from}`, destination: `${prefix}${to}`, permanent: true });
    },
  );

  it("forwards the sixteen topic hubs, and the wages hub to the Labour market page's Wages section", () => {
    expect(LEGACY_TOPIC_FORWARDS).toHaveLength(16);
    expect(redirects).toContainEqual({ source: "/en/explorer/wages", destination: "/en/explorer/labour?topic=wages", permanent: true });
    expect(redirects).toContainEqual({ source: "/explorer/wages", destination: "/explorer/labour?topic=wages", permanent: true });
  });

  it("never forwards a group page or All data", () => {
    const kept = new Set(prefixes.flatMap((prefix) => [ALL_DATA_PATH, ...NAV_GROUPS.map((group) => group.href)].map((href) => `${prefix}${href}`)));
    expect(redirects.filter((rule) => kept.has(rule.source))).toEqual([]);
  });

  it("forwards only the exact old addresses: pages below them stay", () => {
    for (const { from } of LEGACY_TOPIC_FORWARDS) {
      expect(redirects.some((rule) => rule.source.startsWith(`${from}/`) || rule.source.startsWith(`/en${from}/`)), from).toBe(false);
    }
  });

  it("sends the old Poverty hub straight to the Living standards section, and keeps its two page forwards", () => {
    for (const prefix of prefixes) {
      expect(redirects).toContainEqual({ source: `${prefix}/explorer/poverty`, destination: `${prefix}/explorer/living?topic=living-standards`, permanent: true });
      expect(redirects).toContainEqual({ source: `${prefix}/explorer/poverty/rates`, destination: `${prefix}/explorer/living-standards/poverty`, permanent: true });
      expect(redirects).toContainEqual({ source: `${prefix}/explorer/poverty/inequality`, destination: `${prefix}/explorer/living-standards/inequality`, permanent: true });
    }
  });

  // `/explorer/wages/` reaches the forward through Next.js's own trailing-slash redirect, which stays on.
  it("keeps the trailing-slash redirect that sends /explorer/wages/ to /explorer/wages", () => {
    expect(nextConfig.trailingSlash).not.toBe(true);
    expect(nextConfig.skipTrailingSlashRedirect).not.toBe(true);
  });
});

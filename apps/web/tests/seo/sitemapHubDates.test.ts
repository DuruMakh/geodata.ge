import { describe, expect, it, vi } from "vitest";
import sitemap from "../../lib/seo/sitemap";

// Both hubs' rows carry the same review date today, so the real data cannot tell their dates apart. Give each a
// date of its own and check every URL takes its own hub's date, not the other's.
vi.mock("../../lib/data/transport/importTransport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/data/transport/importTransport")>()),
  loadServedTransportData: async () => ({ facts: [{ lastReviewedAt: "2026-01-11" }] }),
}));
vi.mock("../../lib/data/internet/importInternet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/data/internet/importInternet")>()),
  loadServedInternetData: async () => ({ facts: [{ lastReviewedAt: "2026-02-22" }] }),
}));

describe("sitemap hub dates", () => {
  it("dates the Transport and Internet pages by their own data", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const entries = await sitemap();
      const dateOf = (prefix: string) =>
        new Set(entries
          .filter((entry) => new URL(entry.url).pathname.replace(/^\/en/, "").startsWith(prefix))
          .map((entry) => new Date(entry.lastModified!).toISOString().slice(0, 10)));
      expect(dateOf("/explorer/transport")).toEqual(new Set(["2026-01-11"]));
      expect(dateOf("/explorer/internet")).toEqual(new Set(["2026-02-22"]));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

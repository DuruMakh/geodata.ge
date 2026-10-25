import { describe, expect, it, vi } from "vitest";
import sitemap from "../../lib/seo/sitemap";
import { loadTopicHubs } from "../../lib/pages/topicHubs.server";

// deep-review routing M2 and groups M6: the Budget group is dated by every dataset its cards read, Tax breaks and refunds
// included, and only by the source documents its own rows cite. The real data gives every one of these the same date, so
// Tax breaks and refunds gets a later one, and an uncited source document a later one still.
const { TAX_BREAKS_REVIEWED, UNRELATED_REVIEWED } = vi.hoisted(() => ({ TAX_BREAKS_REVIEWED: "2027-01-05", UNRELATED_REVIEWED: "2027-03-03" }));

vi.mock("../../lib/data/taxBreaksRefunds/importTaxBreaksRefunds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/data/taxBreaksRefunds/importTaxBreaksRefunds")>();
  return {
    ...actual,
    loadServedTaxBreaksRefundsData: async () => {
      const data = await actual.loadServedTaxBreaksRefundsData();
      return { ...data, facts: data.facts.map((fact, index) => (index === 0 ? { ...fact, lastReviewedAt: TAX_BREAKS_REVIEWED } : fact)) };
    },
  };
});
vi.mock("../../lib/data/servedData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/data/servedData")>();
  const unrelated = { sourceId: "source.unrelated_test_document", sourceName: "Not a budget source", sourceUrlOrFile: "test", lastReviewedAt: UNRELATED_REVIEWED };
  return {
    ...actual,
    loadServedExplorerData: async () => {
      const data = await actual.loadServedExplorerData();
      return { ...data, sourceDocuments: [...data.sourceDocuments, unrelated] };
    },
  };
});

describe("the Budget group's date", () => {
  it("takes Tax breaks and refunds' review in the sitemap, for the group and All data, and not an uncited source's", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const entries = await sitemap();
      const dateOf = (path: string) => new Date(entries.find((entry) => new URL(entry.url).pathname === path)!.lastModified!).toISOString().slice(0, 10);
      expect(dateOf("/explorer/budget")).toBe(TAX_BREAKS_REVIEWED);
      expect(dateOf("/en/explorer/budget")).toBe(TAX_BREAKS_REVIEWED);
      expect(dateOf("/explorer/tax-breaks-refunds")).toBe(TAX_BREAKS_REVIEWED);
      expect(dateOf("/explorer")).toBe(TAX_BREAKS_REVIEWED);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("is the same date in the group page's header", async () => {
    const [budget] = await loadTopicHubs("ka", ["budget"]);
    expect(budget.lastReviewedAt).toBe(TAX_BREAKS_REVIEWED);
  });
});

import { describe, expect, it } from "vitest";
import { englishCatalogueSchema } from "../../lib/i18n/validation";

const entry = { text: "Education", reviewedAt: "2026-09-05" };
const input = { labels: { education: entry }, programmeHistory: {}, sources: {}, documents: {} };

describe("reviewed English catalogue input", () => {
  it("accepts a real review date", () => {
    expect(englishCatalogueSchema.parse(input).labels.education.text).toBe("Education");
  });

  it.each(["2026-02-30", "2026-13-01", "2026-09-5", "not reviewed"])("rejects invalid review date %s", (reviewedAt) => {
    expect(englishCatalogueSchema.safeParse({ ...input, labels: { education: { ...entry, reviewedAt } } }).success).toBe(false);
  });

  it.each(["", " ", "განათლება"])("rejects an empty or untranslated English label %j", (value) => {
    expect(englishCatalogueSchema.safeParse({ ...input, labels: { education: { ...entry, text: value } } }).success).toBe(false);
  });

  it("rejects unknown fields instead of silently accepting misspelled metadata", () => {
    expect(englishCatalogueSchema.safeParse({ ...input, labels: { education: { ...entry, reveiwedAt: "2026-09-05" } } }).success).toBe(false);
  });
});

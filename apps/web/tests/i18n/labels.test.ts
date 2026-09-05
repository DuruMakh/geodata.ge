import { describe, expect, it } from "vitest";
import { pickEnglishLabels, publicLabel } from "../../lib/i18n/labels";
import type { EnglishCatalogue } from "../../lib/i18n/types";

describe("public display labels", () => {
  it("keeps reviewed Georgian text and selects the English name by stable identity", () => {
    const english = { "spending.education": "Education" };
    expect(publicLabel("ka", "spending.education", "განათლება", english)).toBe("განათლება");
    expect(publicLabel("en", "spending.education", "განათლება", english)).toBe("Education");
    expect(() => publicLabel("en", "spending.health", "ჯანდაცვა", english)).toThrow("spending.health");
  });

  it("sends only requested display strings to the browser", () => {
    const catalogue: EnglishCatalogue = {
      labels: { education: { text: "Education", reviewedAt: "2026-09-05" }, health: { text: "Health", reviewedAt: "2026-09-05" } },
      programmeHistory: {}, sources: {}, documents: {},
    };
    expect(pickEnglishLabels(catalogue, ["education", "education"])).toEqual({ education: "Education" });
    expect(() => pickEnglishLabels(catalogue, ["missing"])).toThrow("missing");
  });
});

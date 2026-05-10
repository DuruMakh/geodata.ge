import { describe, expect, it } from "vitest";
import { loadGlossary } from "../../lib/data/glossary";

describe("glossary validation", () => {
  it("loads Georgian-first labels for public categories", async () => {
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");

    expect(glossary.get("revenue.excise_tax")?.kaLabel).toBe("აქციზის გადასახადი");
    expect(glossary.get("spending.agriculture_environment")?.enLabel).toBe(
      "Agriculture and environment",
    );
  });

  it("keeps labels separate from stable IDs", async () => {
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const health = glossary.get("spending.health");

    expect(health?.id).toBe("spending.health");
    expect(health?.kaLabel).toBe("ჯანდაცვა");
  });
});

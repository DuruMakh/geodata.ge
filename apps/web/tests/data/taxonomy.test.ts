import { describe, expect, it } from "vitest";
import { loadTaxonomyFiles, validateStableId } from "../../lib/data/taxonomy";

describe("taxonomy validation", () => {
  it("loads v1 revenue and spending taxonomy files", async () => {
    const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");

    expect(taxonomy.map((item) => item.id)).toContain("revenue.vat");
    expect(taxonomy.map((item) => item.id)).toContain("spending.health");
  });

  it("accepts stable dot-namespaced ASCII IDs", () => {
    expect(validateStableId("revenue.excise_tax")).toBe(true);
    expect(validateStableId("spending.social_protection")).toBe(true);
  });

  it("rejects labels or invalid IDs as identifiers", () => {
    expect(validateStableId("ჯანდაცვა")).toBe(false);
    expect(validateStableId("Revenue VAT")).toBe(false);
    expect(validateStableId("revenue-vat")).toBe(false);
  });
});

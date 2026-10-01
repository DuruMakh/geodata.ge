import { describe, expect, it } from "vitest";
import { getMethodologyContent } from "../../lib/methodology/catalog";

describe("public product inflation methodology", () => {
  it("explains published annual and Fiscal.ge-derived cumulative rates in both languages", () => {
    for (const locale of ["en", "ka"] as const) {
      const content = getMethodologyContent("inflation", locale);
      const text = JSON.stringify(content);
      expect(text).toContain("p0179");
      expect(text).toContain("p0269");
      expect(text).toContain("p0148");
      expect(text).toMatch(/2015/);
      expect(text).toMatch(/100/);
      expect(text).toMatch(/December|დეკემბრ/);
      expect(text).toMatch(/Fiscal\.ge/);
      expect(text).toMatch(/missing|გამოტოვებ/);
      expect(text).toMatch(/current basket|მოქმედი კალათ/);
      expect(text).toMatch(/GEL|ლარ/);
      expect(content.canonicalDocuments).toContain("docs/data-methodology/inflation-products.md");
    }
    expect(getMethodologyContent("inflation", "en").disclosure).not.toContain("Nothing else is computed");
  });
});

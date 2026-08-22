import { describe, expect, it } from "vitest";
import { municipalEntityHref } from "../../lib/seo/internalLinks";

describe("municipal SEO destinations", () => {
  it("builds canonical destinations for every entity kind", () => {
    expect(municipalEntityHref("country", "country.georgia")).toBe(
      "/explorer/municipalities/georgia",
    );
    expect(municipalEntityHref("region", "region.imereti")).toBe(
      "/explorer/municipalities/region/imereti",
    );
    expect(municipalEntityHref("municipality", "04")).toBe("/explorer/municipalities/04");
  });

  it("rejects malformed region IDs instead of publishing a plausible broken link", () => {
    expect(() => municipalEntityHref("region", "imereti")).toThrow(/region\./);
  });
});

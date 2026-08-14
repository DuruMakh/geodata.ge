import { describe, expect, it } from "vitest";
import { MIXED_SOURCE_ID } from "../../../lib/data/municipal/aggregateMunicipalFacts";
import { assertMunicipalAggregateSourceIds } from "../../../lib/data/municipal/sourceValidation";

describe("municipal aggregate source validation", () => {
  const registeredSourceIds = new Set(["source.municipal_official"]);

  it("accepts registered source IDs and the deliberate mixed-source sentinel", () => {
    expect(() =>
      assertMunicipalAggregateSourceIds(
        "Georgia municipal facts",
        ["source.municipal_official", MIXED_SOURCE_ID],
        registeredSourceIds,
      ),
    ).not.toThrow();
  });

  it("rejects every other unknown source ID", () => {
    expect(() =>
      assertMunicipalAggregateSourceIds(
        "Georgia municipal facts",
        ["source.municipal_official", "source.not_registered"],
        registeredSourceIds,
      ),
    ).toThrow("Georgia municipal facts reference unknown source documents: source.not_registered");
  });
});

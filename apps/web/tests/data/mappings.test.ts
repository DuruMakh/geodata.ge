import { describe, expect, it } from "vitest";
import { loadSpendingMappings } from "../../lib/data/mappings";

describe("spending mapping validation", () => {
  it("loads reviewed mappings with confidence and notes", async () => {
    const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");

    expect(mappings[0]).toMatchObject({
      year: 2025,
      publicSpendingFieldId: "spending.health",
      mappingConfidence: "high",
    });
  });

  it("requires rows to map to spending.* IDs", async () => {
    await expect(
      loadSpendingMappings("../../data/mappings/spending-field-mapping.csv"),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ publicSpendingFieldId: "spending.education" }),
      ]),
    );
  });
});

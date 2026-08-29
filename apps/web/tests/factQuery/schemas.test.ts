// apps/web/tests/factQuery/schemas.test.ts
import { describe, expect, it } from "vitest";
import { envelopeSchema, queryNationalInput } from "../../lib/factQuery/schemas";

describe("query input schemas", () => {
  it("normalizes years to unique ascending order", () => {
    const parsed = queryNationalInput.parse({
      side: "revenue",
      seriesIds: ["revenue.vat", "revenue.vat"],
      years: [2020, 2018, 2020],
      measure: "amount_gel",
    });
    expect(parsed.years).toEqual([2018, 2020]);
    expect(parsed.seriesIds).toEqual(["revenue.vat"]);
  });

  it("rejects an empty year list", () => {
    expect(() => queryNationalInput.parse({ side: "revenue", seriesIds: ["revenue.vat"], years: [], measure: "amount_gel" })).toThrow();
  });

  it("rejects gel_per_resident for national data", () => {
    expect(() =>
      queryNationalInput.parse({ side: "revenue", seriesIds: ["revenue.vat"], years: [2020], measure: "gel_per_resident" }),
    ).toThrow();
  });
});

describe("envelope schema", () => {
  it("requires an error when status is error", () => {
    expect(() => envelopeSchema.parse({ kind: "error", status: "error", meta: null })).toThrow();
  });
});

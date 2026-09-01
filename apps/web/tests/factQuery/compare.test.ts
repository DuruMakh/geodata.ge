// apps/web/tests/factQuery/compare.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare } from "../../lib/factQuery/compare";
import { envelopeSchema } from "../../lib/factQuery/schemas";
import type { Comparison } from "../../lib/factQuery/compare";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

const data = (result: ReturnType<typeof compare>) => (result as { data: { comparisons: Comparison[] } }).data;
const errorOf = (result: ReturnType<typeof compare>) => (result as { error: { code: string } }).error;
const only = (result: ReturnType<typeof compare>) => data(result).comparisons[0]!;

describe("compare", () => {
  it("returns a conforming comparisons envelope", () => {
    const result = compare(snapshot, {
      target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat"] },
      fromYear: 2020,
      toYear: 2024,
      measure: "amount_gel",
    });

    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("comparisons");
  });

  describe("arithmetic", () => {
    it("computes GEL change and percentage change from the endpoints", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat"] },
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
      });

      const row = only(result);
      const from = row.from.value!;
      const to = row.to.value!;

      expect(row.absoluteChange).toBeCloseTo(to - from, 2);
      expect(row.percentageChange).toBeCloseTo(((to - from) / from) * 100, 8);
      // A GEL comparison has no percentage-point field.
      expect(row.percentagePointChange).toBeNull();
    });

    it("uses percentage POINTS for a percentage measure, never growth of a percentage", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat"] },
        fromYear: 2020,
        toYear: 2024,
        measure: "share_of_total_pct",
      });

      const row = only(result);
      expect(row.percentagePointChange).toBeCloseTo(row.to.value! - row.from.value!, 8);
      expect(row.percentageChange).toBeNull();
      expect(row.absoluteChange).toBeNull();
      expect(row.unit).toBe("percent");
    });

    it("keeps both endpoints on a comparable row", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat"] },
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(row.from.year).toBe(2020);
      expect(row.to.year).toBe(2024);
      expect(row.comparability).toBe("comparable");
    });
  });

  describe("the two named not_comparable cases", () => {
    it("declines a 2004-to-later receipts total but keeps the endpoints", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.total"] },
        fromYear: 2004,
        toYear: 2005,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(row.comparability).toBe("not_comparable");
      expect(row.absoluteChange).toBeNull();
      expect(row.percentageChange).toBeNull();
      // Endpoints intact: declining the growth figure must not hide the data.
      expect(row.from.value).not.toBeNull();
      expect(row.to.value).not.toBeNull();
      expect(row.reasons.length).toBeGreaterThan(0);
    });

    it("declines a 2015-to-payment-total municipal comparison", () => {
      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] },
        fromYear: 2015,
        toYear: 2020,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(row.comparability).toBe("not_comparable");
      expect(row.absoluteChange).toBeNull();
      expect(row.from.value).not.toBeNull();
      expect(row.to.value).not.toBeNull();
      expect(result.meta.caveats.map((c) => c.code)).toContain("municipal_total_definition_changed");
    });

    it("still compares two like-for-like municipal payment-total years", () => {
      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["04"], seriesIds: ["municipal.total"] },
        fromYear: 2019,
        toYear: 2023,
        measure: "amount_gel",
      });

      expect(only(result).comparability).toBe("comparable");
      expect(only(result).absoluteChange).not.toBeNull();
    });
  });

  describe("guards", () => {
    it("rejects fromYear >= toYear at parse time", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat"] },
        fromYear: 2024,
        toYear: 2020,
        measure: "amount_gel",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("invalid_parameters");
    });

    it("declines when an endpoint has no value, keeping the other", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.increase_liabilities"] },
        fromYear: 2004,
        toYear: 2005,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(row.from.value).toBeNull();
      expect(row.from.availability).toBe("missing");
      expect(row.to.value).not.toBeNull();
      expect(row.comparability).toBe("not_comparable");
      expect(row.percentageChange).toBeNull();
    });

    it("propagates an out-of-range year as an error rather than an empty comparison", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat"] },
        fromYear: 1999,
        toYear: 2020,
        measure: "amount_gel",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("year_out_of_range");
    });

    it("rejects a measure the target dataset does not support", () => {
      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] },
        fromYear: 2020,
        toYear: 2024,
        measure: "share_of_gdp_pct",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("unsupported_measure");
    });

    it("rejects a stale expectedDataVersion", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat"] },
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
        expectedDataVersion: "0".repeat(64),
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("data_version_changed");
    });
  });

  describe("caveats that only a comparison can raise", () => {
    it("marks a GDP-share comparison spanning the 2010 standard break as limited", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "expenditure", seriesIds: ["expenditure.total"] },
        fromYear: 2009,
        toYear: 2010,
        measure: "share_of_gdp_pct",
      });

      expect(result.meta.caveats.map((c) => c.code)).toContain("gdp_sna_break_2010");
      expect(only(result).comparability).toBe("limited");
      // Limited still yields the point change, unlike not_comparable.
      expect(only(result).percentagePointChange).not.toBeNull();
    });

    it("carries non_positive_comparison_base when the earlier amount is not positive", () => {
      const zero = snapshot.municipal.functionFacts.find((f) => f.amountGel === 0 && f.year < 2025);
      expect(zero).toBeDefined();

      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: [zero!.municipalityCode], seriesIds: [zero!.categoryId] },
        fromYear: zero!.year,
        toYear: 2025,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(result.meta.caveats.map((c) => c.code)).toContain("non_positive_comparison_base");
      // Percentage growth is impossible, but the GEL difference survives.
      expect(row.percentageChange).toBeNull();
      expect(row.absoluteChange).not.toBeNull();
    });
  });

  describe("batching", () => {
    it("compares each selected series independently", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat", "revenue.income_tax"] },
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
      });

      expect(data(result).comparisons.length).toBe(2);
      expect(new Set(data(result).comparisons.map((c) => c.seriesId)).size).toBe(2);
    });

    it("compares each selected municipality independently and keeps entity labels", () => {
      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["04", "11"], seriesIds: ["municipal.total"] },
        fromYear: 2019,
        toYear: 2023,
        measure: "amount_gel",
      });

      expect(data(result).comparisons.length).toBe(2);
      for (const row of data(result).comparisons) {
        expect(row.entityLabelKa.length).toBeGreaterThan(0);
        expect(Object.keys(row).some((key) => key.endsWith("En"))).toBe(false);
      }
    });

    it("compares ministries series too", () => {
      const result = compare(snapshot, {
        target: { dataset: "ministries", level: "admin_category", seriesIds: ["admin_spending.total"] },
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
      });

      expect(only(result).comparability).toBe("comparable");
      expect(only(result).absoluteChange).not.toBeNull();
    });
  });
});

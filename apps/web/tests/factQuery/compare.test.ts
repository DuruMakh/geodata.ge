// apps/web/tests/factQuery/compare.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare } from "../../lib/factQuery/compare";
import { queryMinistries } from "../../lib/factQuery/queryMinistries";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { CAVEAT_RULES } from "../../lib/factQuery/caveats";
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

      // The 2015 portal fallback against a later payment total is the one
      // definition change measured and accepted (compare.ts
      // ACCEPTED_BASIS_CHANGE): median gap 0.94% in 2016, 0.20% by 2024. It
      // compares, and says so in a note.
      const row = only(result);
      expect(row.comparability).toBe("comparable");
      expect(row.absoluteChange).not.toBeNull();
      expect(row.from.value).not.toBeNull();
      expect(row.to.value).not.toBeNull();
      expect(result.meta.caveats.map((c) => c.code)).toContain("municipal_total_definition_changed");
      expect(result.meta.caveats.find((c) => c.code === "municipal_total_definition_changed")?.severity).toBe("note");
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
      // Pinned to 2016 or later ON PURPOSE. This fixture used to be
      // `f.year < 2025`, which resolved to a 2015 municipal function fact, so
      // the test asserted that a 2015-to-2025 functional comparison IS
      // comparable — defending the definition break instead of catching it, and
      // it would have failed against a correct implementation. The behaviour
      // under test here is the non-positive base, so the fixture must not
      // straddle a definition break at all. The break itself is covered by
      // "declines a municipal FUNCTION comparison across the 2015 break" below.
      const zero = snapshot.municipal.functionFacts.find((f) => f.amountGel === 0 && f.year >= 2016 && f.year < 2025);
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

  // ---------------------------------------------------------------------------
  // Regression cover for the review of 2026-09-02. Every test below fails
  // against the implementation as it shipped; several describe figures that were
  // actually published.
  // ---------------------------------------------------------------------------

  describe("definition identity, not display prose", () => {
    // The break: 2015 is the portal functional fallback for all 64
    // municipalities, 2016 onward are payment totals. Only municipal.total
    // embedded that in its display string, so every FUNCTION series compared
    // equal across it and published growth. Education came out at +572.1%.
    // The measured acceptance covers functions as well as the total: both carry
    // the same basis token. What must survive is the NOTE - the reader has to be
    // told the base year is measured differently, or the growth reads as pure.
    it("compares a municipal FUNCTION across the 2015 break, but says it did", () => {
      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["04"], seriesIds: ["municipal.education"] },
        fromYear: 2015,
        toYear: 2020,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(row.comparability).toBe("comparable");
      expect(row.absoluteChange).not.toBeNull();
      expect(row.from.value).not.toBeNull();
      expect(row.to.value).not.toBeNull();
      expect(result.meta.caveats.map((c) => c.code)).toContain("municipal_total_definition_changed");
    });

    // Khulo 2024 is a DIFFERENT fallback - its workbook publishes a plan, not an
    // actual - and is not covered by the measured acceptance.
    it("still declines Khulo's 2024 fallback against a payment-total year", () => {
      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] },
        fromYear: 2023,
        toYear: 2024,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(row.comparability).toBe("not_comparable");
      expect(row.absoluteChange).toBeNull();
      expect(row.from.value).not.toBeNull();
      expect(row.to.value).not.toBeNull();
      expect(result.meta.caveats.map((c) => c.code)).toContain("municipal_source_actual_missing");
    });

    it("compares the share measure across the same break", () => {
      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["04"], seriesIds: ["municipal.education"] },
        fromYear: 2015,
        toYear: 2020,
        measure: "share_of_total_pct",
      });

      expect(only(result).comparability).toBe("comparable");
      expect(only(result).percentagePointChange).not.toBeNull();
    });

    it("still compares two post-break municipal function years", () => {
      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["04"], seriesIds: ["municipal.education"] },
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
      });

      expect(only(result).comparability).toBe("comparable");
      expect(only(result).absoluteChange).not.toBeNull();
    });

    // The other direction: queryMinistries appends the year's own official label
    // when it differs, which is presentation. Comparing display strings declined
    // every program that had ever been renamed - 48 of 48 excluded.
    it("compares a ministries program across a rename", () => {
      const result = compare(snapshot, {
        target: { dataset: "ministries", level: "major_program", seriesIds: ["admin_program.27_02.56e31b26"] },
        fromYear: 2012,
        toYear: 2025,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(row.from.valueDefinition).not.toBe(row.to.valueDefinition);
      expect(row.from.valueDefinitionId).toBe(row.to.valueDefinitionId);
      expect(row.comparability).not.toBe("not_comparable");
      expect(row.absoluteChange).not.toBeNull();
    });
  });

  describe("coverage changes decline; quality flags do not", () => {
    // revenue.grants subtracts GFS internal-flow rows from 2008; 2005 does not.
    // Byte-identical valueDefinition at both ends, so nothing caught it and the
    // pair shipped as "comparable, +651.19%".
    it("declines a netted revenue series across the year netting begins", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.grants"] },
        fromYear: 2005,
        toYear: 2020,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(row.from.valueDefinition).toBe(row.to.valueDefinition);
      expect(row.comparability).toBe("not_comparable");
      expect(row.percentageChange).toBeNull();
    });

    it("still compares two post-netting years of the same series", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.grants"] },
        fromYear: 2015,
        toYear: 2020,
        measure: "amount_gel",
      });

      expect(only(result).comparability).toBe("comparable");
    });

    // A provenance flag in one year and a reconciliation flag in the other are
    // quality disclosures about figures that both still measure total payments.
    // Declining these was the over-correction that made the set too broad.
    it("does not decline an ordinary municipal comparison over asymmetric quality flags", () => {
      const result = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["04"], seriesIds: ["municipal.total"] },
        fromYear: 2019,
        toYear: 2023,
        measure: "amount_gel",
      });

      expect(only(result).comparability).toBe("comparable");
      expect(only(result).absoluteChange).not.toBeNull();
    });

    it("classifies every registered caveat code, so the set cannot silently gain a hole", () => {
      const unclassified = CAVEAT_RULES.filter(
        (rule) => !["breaks", "limits", "none"].includes(rule.comparisonEffect),
      );
      expect(unclassified.map((r) => r.code)).toEqual([]);
    });
  });

  describe("caveats agree with the query that produced the endpoints", () => {
    // compare() rebuilt a CaveatContext by hand. Three of its fields disagreed
    // with the sub-query for the identical rows, which both invented a severe
    // caveat and dropped severe ones. Asking for the CHANGE in a number must
    // never disclose less than asking for the number.
    const codesOf = (result: { meta: { caveats: { code: string }[] } }) =>
      new Set(result.meta.caveats.map((c) => c.code));

    it("never discloses less than queryMunicipal for a region total", () => {
      const queried = queryMunicipal(snapshot, {
        entityIds: ["region.adjara"],
        seriesIds: ["municipal.total"],
        years: [2020, 2024],
        measure: "amount_gel",
      });
      const compared = compare(snapshot, {
        target: { dataset: "municipal", entityIds: ["region.adjara"], seriesIds: ["municipal.total"] },
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
      });

      for (const code of codesOf(queried)) expect(codesOf(compared)).toContain(code);
      expect(codesOf(compared)).toContain("municipal_source_actual_missing");
    });

    it("never discloses more than queryMinistries for the same program cells", () => {
      const queried = queryMinistries(snapshot, {
        level: "major_program",
        seriesIds: ["admin_program.06_04.674b2aee", "admin_program.09_01.f5bec61a"],
        years: [2020, 2024],
        measure: "amount_gel",
      });
      const compared = compare(snapshot, {
        target: {
          dataset: "ministries",
          level: "major_program",
          seriesIds: ["admin_program.06_04.674b2aee", "admin_program.09_01.f5bec61a"],
        },
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
      });

      // The parent categories existed in both years; claiming otherwise named
      // the wrong administering institution for real spending.
      expect(codesOf(compared)).not.toContain("program_parent_category_modern_grouping");
      for (const code of codesOf(compared)) {
        if (code === "non_positive_comparison_base") continue;
        expect(codesOf(queried)).toContain(code);
      }
    });

    it("raises no municipal caveat on a ministries comparison", () => {
      const result = compare(snapshot, {
        target: { dataset: "ministries", level: "major_program", seriesIds: ["admin_program.27_02.56e31b26"] },
        fromYear: 2012,
        toYear: 2025,
        measure: "amount_gel",
      });

      const municipalCodes = result.meta.caveats.filter((c) => c.code.startsWith("municipal"));
      expect(municipalCodes.map((c) => c.code)).toEqual([]);
    });
  });

  describe("status and qualification", () => {
    it("reports a single declined comparison as partial, keeping both values readable", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.total"] },
        fromYear: 2004,
        toYear: 2005,
        measure: "amount_gel",
      });

      // "empty" invited a consumer to short-circuit and throw away the two
      // reviewed numbers the decline deliberately preserved.
      expect(result.status).toBe("partial");
      expect(data(result).comparisons.length).toBe(1);
      expect(only(result).from.value).toBe(2283035800);
    });

    it("qualifies rather than ignores a comparison spanning an approved program join", () => {
      const result = compare(snapshot, {
        target: { dataset: "ministries", level: "major_program", seriesIds: ["admin_program.24_14.6c3a02c8"] },
        fromYear: 2014,
        toYear: 2024,
        measure: "amount_gel",
      });

      const row = only(result);
      expect(row.caveatIds).toContain("program_historical_join");
      // Spec 6.6: a documented join must qualify or decline the comparison. It
      // used to ride along as a note and change nothing, so +170.07% shipped
      // marked fully comparable.
      expect(row.comparability).toBe("limited");
      expect(row.reasons.length).toBeGreaterThan(0);
    });
  });

  describe("2004 receipts", () => {
    it("declines the share branch as well as the amount branch", () => {
      const result = compare(snapshot, {
        target: { dataset: "national", side: "revenue", seriesIds: ["revenue.vat"] },
        fromYear: 2004,
        toYear: 2005,
        measure: "share_of_total_pct",
      });

      // Every 2004 percentage inherits the narrower denominator even when
      // revenue.total is never named in the request.
      expect(only(result).comparability).toBe("not_comparable");
      expect(only(result).percentagePointChange).toBeNull();
    });
  });
});

describe("the country-level datasets", () => {
  it("compares two debt stock years", () => {
    const response = compare(snapshot, {
      target: { dataset: "debt", seriesIds: ["debt.stock.total"] },
      fromYear: 2015,
      toYear: 2024,
      measure: "amount_gel",
    });

    if (response.kind !== "comparisons") throw new Error(`expected comparisons, got ${response.kind}`);
    const rows = (response.data as { comparisons: { absoluteChange: number | null; comparability: string }[] }).comparisons;
    expect(rows[0]!.absoluteChange).not.toBeNull();
    expect(rows[0]!.comparability).toBe("comparable");
  });

  it("refuses to compare a recorded service year with a projected one", () => {
    // debt_service_projection carries comparisonEffect "breaks", so this needs
    // no arithmetic of its own - the existing machinery downgrades it.
    const response = compare(snapshot, {
      target: { dataset: "debt", seriesIds: ["debt.service.total"] },
      fromYear: 2024,
      toYear: 2027,
      measure: "amount_gel",
    });

    if (response.kind !== "comparisons") throw new Error(`expected comparisons, got ${response.kind}`);
    const rows = (response.data as { comparisons: { comparability: string }[] }).comparisons;
    expect(rows[0]!.comparability).toBe("not_comparable");
  });

  it("compares two recorded balance years and refuses a forecast endpoint", () => {
    const recorded = compare(snapshot, {
      target: { dataset: "deficit" },
      fromYear: 2015,
      toYear: 2024,
      measure: "share_of_gdp_pct",
    });
    if (recorded.kind !== "comparisons") throw new Error("expected comparisons");
    expect((recorded.data as { comparisons: { comparability: string }[] }).comparisons[0]!.comparability).toBe("comparable");

    const forecast = compare(snapshot, {
      target: { dataset: "deficit" },
      fromYear: 2024,
      toYear: 2030,
      measure: "share_of_gdp_pct",
    });
    if (forecast.kind !== "comparisons") throw new Error("expected comparisons");
    expect((forecast.data as { comparisons: { comparability: string }[] }).comparisons[0]!.comparability).toBe(
      "not_comparable",
    );
  });
});

describe("issues found in code review", () => {
  it("treats a rate change as a POINT difference, not as growth", () => {
    // PERCENTAGE_MEASURES did not include rate_percent, so the GEL branch ran:
    // a rate moving 3.3 -> 4.9 came back as "grew 48.5%" with the point-change
    // column empty. That is the mislabelling rate_percent exists to prevent.
    const response = compare(snapshot, {
      target: { dataset: "debt", seriesIds: ["debt.rate.total"] },
      fromYear: 2016,
      toYear: 2024,
      measure: "rate_percent",
    });

    if (response.kind !== "comparisons") throw new Error(`expected comparisons, got ${response.kind}`);
    const row = (response.data as {
      comparisons: { absoluteChange: number | null; percentageChange: number | null; percentagePointChange: number | null }[];
    }).comparisons[0]!;

    expect(row.percentagePointChange).not.toBeNull();
    expect(row.absoluteChange).toBeNull();
    expect(row.percentageChange).toBeNull();
  });
});

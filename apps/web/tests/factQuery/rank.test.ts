// apps/web/tests/factQuery/rank.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { rank } from "../../lib/factQuery/rank";
import { envelopeSchema } from "../../lib/factQuery/schemas";
import { AGGREGATE_ONLY_MUNICIPAL_CODES, type FactQuerySnapshot } from "../../lib/factQuery/types";
import type { RankData } from "../../lib/factQuery/rank";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

const data = (result: ReturnType<typeof rank>) => (result as { data: RankData }).data;
const errorOf = (result: ReturnType<typeof rank>) => (result as { error: { code: string } }).error;

describe("rank", () => {
  it("returns a conforming ranking envelope", () => {
    const result = rank(snapshot, {
      datasetId: "municipal-expenditure",
      dimension: "entities",
      entityType: "municipality",
      seriesId: "municipal.total",
      year: 2024,
      measure: "amount_gel",
      metric: "value",
    });

    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("ranking");
  });

  describe("peers only", () => {
    it("ranks municipalities without the Georgia aggregate or any region", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 100,
      });

      const ids = data(result).entries.map((e) => e.entityId);
      expect(ids).not.toContain("country.georgia");
      expect(ids.some((id) => id.startsWith("region."))).toBe(false);
      expect(ids.length).toBe(64);
    });

    it("never ranks an excluded municipality", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 100,
      });

      const ids = data(result).entries.map((e) => e.entityId);
      for (const code of AGGREGATE_ONLY_MUNICIPAL_CODES) expect(ids).not.toContain(code);
    });

    it("ranks regions against regions only", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "region",
        seriesId: "municipal.total",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 100,
      });

      const ids = data(result).entries.map((e) => e.entityId);
      expect(ids.length).toBe(11);
      expect(ids.every((id) => id.startsWith("region."))).toBe(true);
    });

    it("narrows to one region's members with withinRegionId", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        withinRegionId: "region.adjara",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 100,
      });

      expect(data(result).entries.length).toBe(6);
    });

    it("excludes the national total from a series ranking", () => {
      const result = rank(snapshot, {
        datasetId: "national-revenue",
        dimension: "series",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 100,
      });

      const ids = data(result).entries.map((e) => e.seriesId);
      expect(ids).not.toContain("revenue.total");
      expect(ids.length).toBeGreaterThan(0);
    });

    it("excludes the administrative total from a category ranking", () => {
      const result = rank(snapshot, {
        datasetId: "ministries",
        dimension: "series",
        level: "admin_category",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 100,
      });

      const ids = data(result).entries.map((e) => e.seriesId);
      expect(ids).not.toContain("admin_spending.total");
      expect(ids.length).toBe(14);
    });

    it("ranks programs within one parent category when asked", () => {
      const parentSeriesId = "admin_spending.health_social_affairs";
      const result = rank(snapshot, {
        datasetId: "ministries",
        dimension: "series",
        level: "major_program",
        parentSeriesId,
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 100,
      });

      const entries = data(result).entries;
      expect(entries.length).toBeGreaterThan(0);
      const all = rank(snapshot, {
        datasetId: "ministries",
        dimension: "series",
        level: "major_program",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 100,
      });
      expect(entries.length).toBeLessThan(data(all).entries.length);
    });
  });

  describe("ordering", () => {
    it("orders by full-precision value, descending by default", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 100,
      });

      const values = data(result).entries.map((e) => e.value ?? 0);
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index - 1]!).toBeGreaterThanOrEqual(values[index]!);
      }
      // Tbilisi is the largest municipal budget by a wide margin.
      expect(data(result).entries[0]?.entityId).toBe("04");
    });

    it("honours ascending order", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        order: "ascending",
        limit: 100,
      });

      const values = data(result).entries.map((e) => e.value ?? 0);
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index - 1]!).toBeLessThanOrEqual(values[index]!);
      }
    });

    it("honours limit and reports the returned count", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 5,
      });

      expect(data(result).entries.length).toBe(5);
      expect(data(result).universe.returnedCount).toBe(5);
      expect(data(result).universe.candidateCount).toBe(64);
    });

    it("gives every entry a sequential position", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 10,
      });

      expect(data(result).entries.map((e) => e.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  describe("ties", () => {
    // 2024 municipal.defence is zero for 62 of the 64 municipalities, so this
    // is a real tied group rather than a constructed one.
    const defence2024 = () =>
      rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.defence",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        order: "ascending",
        limit: 100,
      });

    it("flags tied entries so an arbitrary order is not read as a difference", () => {
      const entries = data(defence2024()).entries;
      const zeros = entries.filter((e) => e.value === 0);

      expect(zeros.length).toBeGreaterThan(1);
      expect(zeros.every((e) => e.tied)).toBe(true);
    });

    it("does not flag an entry whose value is unique", () => {
      const entries = data(defence2024()).entries;
      const nonZero = entries.filter((e) => (e.value ?? 0) > 0);

      expect(nonZero.length).toBeGreaterThan(0);
      for (const entry of nonZero) {
        const sameValue = entries.filter((e) => e.value === entry.value);
        if (sameValue.length === 1) expect(entry.tied).toBe(false);
      }
    });

    it("breaks ties by stable id so the order is reproducible", () => {
      const first = data(defence2024()).entries.map((e) => e.entityId);
      const second = data(defence2024()).entries.map((e) => e.entityId);
      expect(first).toEqual(second);

      const tiedIds = data(defence2024())
        .entries.filter((e) => e.value === 0)
        .map((e) => e.entityId);
      expect(tiedIds).toEqual([...tiedIds].sort());
    });

    it("reports when the limit cuts through a tied group", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.defence",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        order: "ascending",
        limit: 5,
      });

      expect(data(result).universe.cutoffSplitsTie).toBe(true);
    });
  });

  describe("metric and measure compatibility", () => {
    it("rejects a value ranking given two years", () => {
      const result = rank(snapshot, {
        datasetId: "national-revenue",
        dimension: "series",
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
        metric: "value",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("invalid_parameters");
    });

    it("rejects a change ranking given one year", () => {
      const result = rank(snapshot, {
        datasetId: "national-revenue",
        dimension: "series",
        year: 2024,
        measure: "amount_gel",
        metric: "percentage_change",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("invalid_parameters");
    });

    it("rejects percentage_point_change on a GEL measure", () => {
      const result = rank(snapshot, {
        datasetId: "national-revenue",
        dimension: "series",
        fromYear: 2020,
        toYear: 2024,
        measure: "amount_gel",
        metric: "percentage_point_change",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("unsupported_measure");
    });

    it("rejects percentage_change on a percentage measure", () => {
      const result = rank(snapshot, {
        datasetId: "national-revenue",
        dimension: "series",
        fromYear: 2020,
        toYear: 2024,
        measure: "share_of_total_pct",
        metric: "percentage_change",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("unsupported_measure");
    });

    it("rejects an entities ranking on a national dataset", () => {
      const result = rank(snapshot, {
        datasetId: "national-revenue",
        dimension: "entities",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("invalid_parameters");
    });

    it("rejects a municipal ranking with no seriesId", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("invalid_parameters");
    });
  });

  describe("change rankings", () => {
    it("ranks municipalities by percentage change and reuses compare", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        fromYear: 2019,
        toYear: 2023,
        measure: "amount_gel",
        metric: "percentage_change",
        limit: 100,
      });

      expect(result.kind).toBe("ranking");
      expect(data(result).entries.length).toBeGreaterThan(0);
      const values = data(result).entries.map((e) => e.value ?? 0);
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index - 1]!).toBeGreaterThanOrEqual(values[index]!);
      }
    });

    it("omits candidates that are not comparable and reports why", () => {
      // 2015 is the portal fallback for every municipality, so a 2015 -> 2020
      // change ranking has no comparable candidate at all.
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        fromYear: 2015,
        toYear: 2020,
        measure: "amount_gel",
        metric: "percentage_change",
        limit: 100,
      });

      expect(data(result).entries.length).toBe(0);
      expect(data(result).exclusions.length).toBeGreaterThan(0);
      expect(data(result).exclusions[0]?.reason.length).toBeGreaterThan(0);
      expect(result.status).toBe("empty");
    });

    it("ranks by percentage points on a percentage measure", () => {
      const result = rank(snapshot, {
        datasetId: "ministries",
        dimension: "series",
        level: "admin_category",
        fromYear: 2020,
        toYear: 2024,
        measure: "share_of_total_pct",
        metric: "percentage_point_change",
        limit: 100,
      });

      expect(result.kind).toBe("ranking");
      expect(data(result).entries.length).toBeGreaterThan(0);
      expect(data(result).entries[0]?.unit).toBe("percent");
    });
  });

  describe("provenance", () => {
    it("states the ranking definition and the universe it ranked", () => {
      const result = rank(snapshot, {
        datasetId: "ministries",
        dimension: "series",
        level: "major_program",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 5,
      });

      expect(data(result).rankingDefinition.length).toBeGreaterThan(0);
      // A program ranking is among reviewed served series, not every programme
      // in government - the description must say so.
      expect(data(result).universe.description.length).toBeGreaterThan(0);
      expect(data(result).universe.eligibleCount).toBeGreaterThan(0);
    });

    it("marks the basis of ranked values", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        limit: 3,
      });

      for (const entry of data(result).entries) expect(entry.basis).toBe("actual");
    });

    it("rejects a stale expectedDataVersion", () => {
      const result = rank(snapshot, {
        datasetId: "municipal-expenditure",
        dimension: "entities",
        entityType: "municipality",
        seriesId: "municipal.total",
        year: 2024,
        measure: "amount_gel",
        metric: "value",
        expectedDataVersion: "0".repeat(64),
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("data_version_changed");
    });
  });
});

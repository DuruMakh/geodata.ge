// apps/web/tests/factQuery/describeCoverage.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { queryMinistries } from "../../lib/factQuery/queryMinistries";
import { envelopeSchema } from "../../lib/factQuery/schemas";
import { AGGREGATE_ONLY_MUNICIPAL_CODES, type FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

type CoverageData = {
  datasets: { datasetId: string; years: [number, number]; measures: string[] }[];
  series?: { seriesId: string; availability: string; level: string; years: number[] }[];
  entities?: { entityId: string; entitySlug: string | null }[];
  exclusions: { entityId: string; reason: string }[];
};

const data = (result: ReturnType<typeof describeCoverage>) => (result as { data: CoverageData }).data;

describe("describeCoverage", () => {
  it("returns a conforming catalogue envelope with all four datasets", () => {
    const result = describeCoverage(snapshot, {});
    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("catalogue");
    expect(data(result).datasets.map((d) => d.datasetId).sort()).toEqual([
      "ministries",
      "municipal-expenditure",
      "national-expenditure",
      "national-revenue",
    ]);
  });

  it("narrows datasets to the requested one", () => {
    const result = describeCoverage(snapshot, { datasetId: "national-revenue" });
    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(data(result).datasets.length).toBe(1);
    expect(data(result).datasets[0]?.datasetId).toBe("national-revenue");
  });

  it("marks revenue.taxes_total taxonomy_only, never served", () => {
    const series = data(describeCoverage(snapshot, { datasetId: "national-revenue" })).series ?? [];
    const entry = series.find((s) => s.seriesId === "revenue.taxes_total");

    expect(entry).toBeDefined();
    expect(entry?.availability).toBe("taxonomy_only");
    expect(entry?.years).toEqual([]);
  });

  it("lists the calculated totals even though no fact row backs them", () => {
    const revenue = data(describeCoverage(snapshot, { datasetId: "national-revenue" })).series ?? [];
    const total = revenue.find((s) => s.seriesId === "revenue.total");

    expect(total?.availability).toBe("calculated_total");
    expect(total?.years.length).toBeGreaterThan(0);
  });

  it("reports exact years per series, not a filled range", () => {
    const series = data(describeCoverage(snapshot, { datasetId: "ministries", level: "major_program" })).series ?? [];
    const ragged = series.filter((s) => s.years.length > 0 && s.years.length < s.years[s.years.length - 1] - s.years[0] + 1);

    expect(ragged.length).toBeGreaterThan(0);
  });

  it("never lists an excluded municipality as an entity, but does explain it", () => {
    const result = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure" }));
    const entityIds = (result.entities ?? []).map((e) => e.entityId);

    for (const code of AGGREGATE_ONLY_MUNICIPAL_CODES) {
      expect(entityIds).not.toContain(code);
      expect(result.exclusions.some((x) => x.entityId === code && x.reason.length > 0)).toBe(true);
    }
  });

  it("exposes the url slug on municipalities as a matching aid", () => {
    const entities = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure" })).entities ?? [];
    expect(entities.find((e) => e.entityId === "11")?.entitySlug).toBe("khulo");
  });

  it("searches over id, georgian label and slug", () => {
    const bySlug = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure", search: "khulo" })).entities ?? [];
    const byId = data(describeCoverage(snapshot, { datasetId: "national-revenue", search: "revenue.vat" })).series ?? [];

    expect(bySlug.map((e) => e.entityId)).toContain("11");
    expect(byId.map((s) => s.seriesId)).toContain("revenue.vat");
  });

  it("returns empty status when a search matches nothing", () => {
    const result = describeCoverage(snapshot, { datasetId: "national-revenue", search: "zzz-no-such-series" });
    expect(result.status).toBe("empty");
  });

  it("rejects a stale expectedDataVersion", () => {
    const result = describeCoverage(snapshot, { expectedDataVersion: "0".repeat(64) });
    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe("data_version_changed");
  });

  it("rejects an unknown dataset with invalid_parameters and offers valid choices", () => {
    const result = describeCoverage(snapshot, { datasetId: "not-a-dataset" });
    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("error");
    expect((result as { error: { code: string; validChoices?: string[] } }).error.code).toBe("invalid_parameters");
    expect((result as { error: { validChoices?: string[] } }).error.validChoices).toContain("national-revenue");
  });

  it("fires no data-shaped caveat on a catalogue request", () => {
    expect(describeCoverage(snapshot, {}).meta.caveats).toEqual([]);
  });

  it("carries licence and data version in meta", () => {
    const meta = describeCoverage(snapshot, {}).meta;
    expect(meta.licence).toBe("CC BY 4.0");
    expect(meta.dataVersion).toBe(snapshot.dataVersion);
  });

  describe("the level filter lists what is queryable at that level, not structural levels", () => {
    const seriesAt = (level: "admin_category" | "major_program") =>
      data(describeCoverage(snapshot, { datasetId: "ministries", level })).series ?? [];

    it("surfaces admin_spending.total under admin_category, still labelled a total", () => {
      const total = seriesAt("admin_category").find((s) => s.seriesId === "admin_spending.total");

      // queryMinistries accepts the total ONLY at admin_category, so a client
      // narrowing the catalogue by level must find it there - otherwise the
      // state budget's headline number is undiscoverable through the catalogue.
      expect(total).toBeDefined();
      // Its structural level is untouched: the filter widened, the data did not.
      expect(total?.level).toBe("total");
      expect(total?.availability).toBe("calculated_total");
    });

    it("does not surface admin_spending.total under major_program", () => {
      expect(seriesAt("major_program").map((s) => s.seriesId)).not.toContain("admin_spending.total");
    });

    it("agrees with what queryMinistries actually accepts at admin_category", () => {
      const catalogueQueryable = seriesAt("admin_category")
        .filter((s) => s.availability !== "taxonomy_only")
        .map((s) => s.seriesId)
        .sort();

      // An unknown_series error reports the real queryable set as validChoices.
      const rejected = queryMinistries(snapshot, {
        level: "admin_category",
        seriesIds: ["definitely.not.a.series"],
        years: [2024],
        measure: "amount_gel",
      });
      const accepted = (rejected as { error: { validChoices?: string[] } }).error.validChoices ?? [];

      expect(catalogueQueryable).toEqual([...accepted].sort());
      expect(catalogueQueryable).toContain("admin_spending.total");
    });

    it("does not leak a national total into a ministries level filter", () => {
      const series = data(describeCoverage(snapshot, { datasetId: "national-revenue", level: "admin_category" })).series ?? [];
      expect(series.map((s) => s.seriesId)).not.toContain("revenue.total");
    });
  });
});

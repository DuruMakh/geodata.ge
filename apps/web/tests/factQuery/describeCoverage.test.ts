// apps/web/tests/factQuery/describeCoverage.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { envelopeSchema } from "../../lib/factQuery/schemas";
import { AGGREGATE_ONLY_MUNICIPAL_CODES, type FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

type CoverageData = {
  datasets: { datasetId: string; years: [number, number]; measures: string[] }[];
  series?: { seriesId: string; availability: string; years: number[] }[];
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
    expect(result.kind).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe("data_version_changed");
  });

  it("rejects an unknown dataset with invalid_parameters and offers valid choices", () => {
    const result = describeCoverage(snapshot, { datasetId: "not-a-dataset" });
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
});

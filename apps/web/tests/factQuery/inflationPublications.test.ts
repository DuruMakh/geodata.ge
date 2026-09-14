// apps/web/tests/factQuery/inflationPublications.test.ts
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { buildAllPublications, INFLATION_CATEGORIES_CSV_COLUMNS, type PublicationArtifact } from "../../lib/factQuery/publications";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
let files: PublicationArtifact[];
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
  files = buildAllPublications(snapshot);
}, 120_000);

const file = (name: string) => files.find((artifact) => artifact.fileName === name)!;
const json = (name: string) => JSON.parse(file(name).bytes.toString("utf8"));
const headlineYoy = (period: string) =>
  snapshot.inflation.facts.find((f) => f.seriesId === "cpi.headline" && f.measure === "yoy_pct" && f.period === period)?.value;

describe("inflation publications", () => {
  it("lists the three files in the manifest with their exact hashes", () => {
    const manifest = json("manifest.json");
    for (const name of ["inflation-national.json", "inflation-categories.csv", "inflation-categories.json"]) {
      const entry = manifest.files.find((f: { fileName: string }) => f.fileName === name);
      expect(entry.sha256).toBe(createHash("sha256").update(file(name).bytes).digest("hex"));
    }
  });

  it("publishes national CPI, the target and basket weights as observations", () => {
    const national = json("inflation-national.json");
    expect(national).toMatchObject({ schemaVersion: "1.2.0", datasetId: "inflation" });
    const headline = national.observations.find((o: { observationId: string }) => o.observationId === "inflation:country.georgia:cpi.headline:2026-08:yoy_pct");
    expect(headline.value).toBe(headlineYoy("2026-08"));
    expect(national.observations.some((o: { seriesId: string }) => o.seriesId === "cpi.target")).toBe(true);
    const weight = national.observations.find((o: { measure: string }) => o.measure === "basket_weight_pct");
    expect(weight.period).toBeUndefined();
    expect(national.observations.some((o: { measure: string }) => o.measure === "contribution_pp")).toBe(false);
    // One coverage block per part: the parts span different months and years.
    expect(Object.keys(national.coverage).sort()).toEqual(["avg12_pct", "basket_weight_pct", "index_2010", "mom_pct", "target_pct", "yoy_pct"]);
  });

  it("publishes group rates and contributions that close on the headline", () => {
    const bytes = file("inflation-categories.csv").bytes;
    expect(bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191]))).toBe(true);
    const rows = parse(bytes, { bom: true, columns: true }) as Record<string, string>[];
    expect(Object.keys(rows[0]!)).toEqual([...INFLATION_CATEGORIES_CSV_COLUMNS]);
    expect(rows.find((r) => r.series_id === "cpi.cat.07" && r.measure === "yoy_pct" && r.period === "2026-08")).toMatchObject({ value: "15.1989", calculation: "published" });
    const divisions = rows.filter((r) => r.selection === "divisions");
    expect(divisions.every((r) => r.calculation === "fiscal_ge_derived")).toBe(true);
    const byPeriod = new Map<string, number>();
    for (const row of divisions) byPeriod.set(row.period!, (byPeriod.get(row.period!) ?? 0) + Number(row.value));
    expect(byPeriod.size).toBeGreaterThan(100);
    for (const [period, sum] of byPeriod) expect(Math.abs(sum - headlineYoy(period)!)).toBeLessThan(1e-9);
    expect(rows.some((r) => r.selection === "subgroups" && r.series_id === "cpi.contribution_residual")).toBe(true);
  });

  it("describes the CSV in a metadata file without repeating its rows", () => {
    const metadata = json("inflation-categories.json");
    expect(metadata.observations).toBeUndefined();
    expect(metadata.data.sha256).toBe(createHash("sha256").update(file("inflation-categories.csv").bytes).digest("hex"));
    expect(metadata.data.url).toBe("/downloads/data/inflation-categories.csv");
    expect(metadata.catalogue.datasets[0].datasetId).toBe("inflation");
    expect(metadata.caveats.map((c: { code: string }) => c.code)).toContain("inflation_contribution_derived");
    // The generic totals warning names parentSeriesId, a column the CSV does not have; the
    // rule that matters here is that contributions close only within one selection.
    expect(metadata.noticeEn).toContain("selection");
    expect(metadata.noticeEn).toContain("cpi.contribution_residual");
    expect(metadata.notice).toMatch(/\p{Script=Georgian}/u);
  });

  it("adds inflation to the published catalogue", () => {
    expect(json("catalogue.json").datasets.map((d: { datasetId: string }) => d.datasetId)).toContain("inflation");
  });
});

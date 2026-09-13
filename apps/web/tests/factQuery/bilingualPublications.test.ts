import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { buildAllPublications, type PublicationArtifact } from "../../lib/factQuery/publications";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import type { Observation } from "../../lib/factQuery/observations";

let snapshot: FactQuerySnapshot;
let artifacts: PublicationArtifact[];
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-06T00:00:00Z" });
  artifacts = buildAllPublications(snapshot);
});
const read = (name: string) => JSON.parse(artifacts.find(file => file.fileName === name)!.bytes.toString("utf8"));

describe("bilingual bulk publications", () => {
  it("publishes all JSON and CSV files under the same version and verifies their exact bytes", () => {
    expect(artifacts.map(file => file.fileName).sort()).toEqual(["manifest.json", "catalogue.json", "sources.json", "national-revenue.json", "national-expenditure.json", "ministries.json", "municipal-expenditure.json", "government-debt.json", "government-debt-rates.json", "general-government-balance.json", "gdp-overview.json", "gdp-overview.csv", "economic-sectors.json", "economic-sectors.csv", "regional-economies.json", "regional-economies.csv"].sort());
    for (const artifact of artifacts.filter(file=>file.fileName.endsWith(".json"))) {
      const published = read(artifact.fileName);
      expect(published.schemaVersion).toBe("1.2.0");
      expect(published.dataVersion).toBe(snapshot.dataVersion);
    }
    for (const entry of read("manifest.json").files) {
      const artifact = artifacts.find(file => file.fileName === entry.fileName)!;
      expect(entry.url).toBe(`/downloads/data/${entry.fileName}`);
      expect(entry.sha256).toBe(createHash("sha256").update(artifact.bytes).digest("hex"));
      expect(entry.byteSize).toBe(artifact.bytes.byteLength);
      expect(entry.rowCount).toBe(artifact.rowCount);
    }
  });
  it("makes every dataset interpretable in English without changing its fiscal fields", () => {
    for (const artifact of artifacts.filter(file => file.fileName.endsWith(".json") && !["manifest.json", "catalogue.json", "sources.json"].includes(file.fileName))) {
      const published = read(artifact.fileName);
      expect(published.noticeEn).toContain("totals");
      expect(published.notice).toMatch(/\p{Script=Georgian}/u);
      expect(published.catalogue.datasets[0].labelEn.length).toBeGreaterThan(0);
      expect(published.observations).toHaveLength(artifact.rowCount);
      for (const row of published.observations as Observation[]) {
        for (const text of [row.entityLabelEn, row.seriesLabelEn, row.valueDefinitionEn]) {
          expect(text.trim().length).toBeGreaterThan(0);
          expect(text).not.toMatch(/\p{Script=Georgian}/u);
        }
        expect(row.missingReasonEn === null).toBe(row.missingReason === null);
        if (row.value !== null) expect(row.sourceIds.length).toBeGreaterThan(0);
        else expect(row.missingReasonEn?.length).toBeGreaterThan(0);
      }
      for (const caveat of published.caveats) {
        expect(caveat.messageEn.length).toBeGreaterThan(0);
        expect(caveat.methodologyRefEn).toMatch(/^\/en\//);
      }
      expect(published.supportingValues).toBeDefined();
    }
    for (const row of read("municipal-expenditure.json").supportingValues.populationFacts) {
      const original = snapshot.municipal.populationFacts.find(fact => fact.municipalityCode === row.municipalityCode && fact.year === row.year)!;
      expect(row).toMatchObject(original);
      expect(row.transformationKa).toMatch(/\p{Script=Georgian}/u);
      expect(row.transformationEn).toContain(row.sourceCell);
      expect(row.sourceUnitEn).toBe("thousands");
    }
  });
  it("retains the complete source originals and translated catalogue notices", () => {
    expect(read("sources.json").sources).toEqual(snapshot.sources);
    expect(read("sources.json").noticeEn).toContain("derivation_upstream");
    expect(read("catalogue.json").noticeEn).toContain("catalogue");
    const education = read("national-expenditure.json").observations.find((row: Observation) => row.seriesId === "spending.education" && row.year === 2025);
    expect(education.value).toBe(3045941254);
    expect(education.seriesLabelEn).toBe("Education");
  });
});

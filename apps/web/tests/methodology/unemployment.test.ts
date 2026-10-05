import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { deriveMethodologyCoverage, getMethodologyContent } from "../../lib/methodology/catalog";

const root = path.resolve(process.cwd(), "../..");
test("every captured labour-survey original is exposed with unchanged fingerprints and retrieval dates", async () => {
  const original = JSON.parse(await readFile(path.join(root, "docs/Raw Data/Unemployment/geostat-labour-force-annual/source-manifest.json"), "utf8")) as { source_id: string; sha256: string; bytes: number; retrieved_at: string }[];
  const archive = await loadReviewedSourceManifest(root, "unemployment");
  expect(archive).toHaveLength(9);
  for (const source of original) {
    const row = archive.find(item => item.source_id === source.source_id)!;
    expect(row.sha256).toBe(source.sha256.toLowerCase());
    expect(row.byte_size).toBe(source.bytes);
    expect(row.retrieved_at).toBe("2026-10-03");
    expect(row.downloadHref).toMatch(/^\/downloads\/methodology\/unemployment\/files\//);
    expect([row.years[0], row.years.at(-1)]).toEqual([source.source_id.endsWith("education") || source.source_id.endsWith("long_term") ? 2020 : 2010, 2025]);
  }
  expect(deriveMethodologyCoverage("unemployment", [], [], [], { minYear: Math.min(...archive.flatMap(row => row.years)), maxYear: Math.max(...archive.flatMap(row => row.years)) })).toEqual({ firstYear: 2010, lastYear: 2025 });
});

test.each(["ka", "en"] as const)("methodology resolves a reviewed language companion in %s", locale => {
  const content = getMethodologyContent("unemployment", locale);
  expect(content.archiveManifestId).toBe("unemployment");
  expect(content.coverageSource).toEqual({ kind: "archive" });
  expect(content.canonicalDocuments).toContain("docs/data-methodology/unemployment-annual.md");
  expect(content.reviewedAt).toBe("2026-10-04");
});

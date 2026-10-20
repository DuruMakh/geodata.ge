import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { LABOUR_PUBLIC_SOURCES, LABOUR_RESEARCH_DIRECTORY } from "../../lib/data/labour/types";
import { expectedOriginalSourcePaths } from "../../lib/methodology/sourceInventory";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { deriveMethodologyCoverage, getMethodologyContent } from "../../lib/methodology/catalog";

const root = path.resolve(process.cwd(), "../..");
test("every captured labour-survey original is exposed with unchanged fingerprints and retrieval dates", async () => {
  const original = JSON.parse(await readFile(path.join(root, "docs/Raw Data/Unemployment/geostat-labour-force-annual/source-manifest.json"), "utf8")) as { source_id: string; sha256: string; bytes: number; retrieved_at: string }[];
  const archive = await loadReviewedSourceManifest(root, "unemployment");
  expect(archive).toHaveLength(23);
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

test("the labour detail workbooks and page captures are archived with unchanged fingerprints and the served-or-archived note", async () => {
  const original = JSON.parse(await readFile(path.join(root, LABOUR_RESEARCH_DIRECTORY, "source-manifest.json"), "utf8")) as { source_id: string; sha256: string; bytes: number; retrieved_at: string; local_file: string }[];
  const archive = await loadReviewedSourceManifest(root, "unemployment");
  expect(original.map(source => source.source_id).sort()).toEqual([...LABOUR_PUBLIC_SOURCES].sort());
  for (const source of original) {
    const row = archive.find(item => item.source_id === source.source_id)!;
    expect(row, source.source_id).toBeDefined();
    expect(row.sha256).toBe(source.sha256.toLowerCase());
    expect(row.byte_size).toBe(source.bytes);
    expect(row.retrieved_at).toBe(source.retrieved_at);
    expect(row.repository_source_path).toBe(`${LABOUR_RESEARCH_DIRECTORY}/${source.local_file}`);
    expect(row.public_download_path).toBe(`downloads/methodology/unemployment/files/${path.posix.basename(source.local_file)}${source.local_file.endsWith(".html") ? ".txt" : ""}`);
    // The owner removed the unused-labour rates from the Informal jobs page (2026-10-20): workbook 12 is archived only.
    expect(row.notes).toMatch(source.source_id.startsWith("geostat_lfs_underuse") ? /^Archived only: / : source.source_id.endsWith("_ka") && !source.local_file.endsWith(".html") ? /^Georgian version of .+, with the same numbers in the same cells; archived for its Georgian labels, and no value is read from it\.$/ : /^(Served: |Capture of )/);
    expect(row.years[0]).toBe(source.source_id.startsWith("geostat_lfs_jobs_industry") || source.source_id.startsWith("geostat_lfs_detail_page") ? 2017 : 2020);
    expect(row.years.at(-1)).toBe(2025);
  }
  expect(archive.filter(row => original.some(source => source.source_id === row.source_id)).map(row => row.source_id).sort()).toEqual([...LABOUR_PUBLIC_SOURCES].sort());
});

test("the source inventory for unemployment covers the labour detail folder as well as the annual folder", async () => {
  const rows = await expectedOriginalSourcePaths(root, "unemployment");
  expect(rows).toHaveLength(23);
  expect(rows.filter(row => row.path.startsWith(`${LABOUR_RESEARCH_DIRECTORY}/official/`))).toHaveLength(14);
  expect(rows.filter(row => row.path.startsWith("docs/Raw Data/Unemployment/geostat-labour-force-annual/official/"))).toHaveLength(9);
  expect(rows.some(row => row.path.endsWith(".csv") || row.path.endsWith(".py") || row.path.endsWith(".mjs"))).toBe(false);
});

test.each(["ka", "en"] as const)("methodology resolves a reviewed language companion in %s", locale => {
  const content = getMethodologyContent("unemployment", locale);
  expect(content.archiveManifestId).toBe("unemployment");
  expect(content.coverageSource).toEqual({ kind: "archive" });
  expect(content.canonicalDocuments).toContain("docs/data-methodology/unemployment-annual.md");
  expect(content.reviewedAt).toBe("2026-10-20");
  expect(content.canonicalDocuments).toContain("docs/data-methodology/labour-detail-annual.md");
  const detail = content.sections.find(section => section.id === "detail");
  expect(detail).toBeDefined();
  expect(content.sections.map(section => section.id)).toEqual(["scope", "rates", "detail", "classification", "validation", "limitations", "archive"]);
  expect(detail!.paragraphs.length).toBeGreaterThanOrEqual(6);
});

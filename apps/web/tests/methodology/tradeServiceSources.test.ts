import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { expect, test } from "vitest";
import { TRADE_SERVICES_DOCUMENT_IDS, TRADE_SERVICES_SOURCES } from "../../lib/data/tradeServices/types";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { expectedOriginalSourcePaths } from "../../lib/methodology/sourceInventory";
import { loadWorkbookSources } from "../../lib/methodology/workbookSources";

const originals = [
  { sourceId: TRADE_SERVICES_SOURCES.export, filename: "Georgian-Exports-of-services-by-types.xlsx", bytes: 13817, hash: "091845ddd121d21e43332cfcdf69008ec3d9444fae279fbe3c6002ba0d75fda3" },
  { sourceId: TRADE_SERVICES_SOURCES.import, filename: "Georgian-Imports-of-services-by-types.xlsx", bytes: 13030, hash: "100b9a901dffd1db6604aac7c0b46094e8e46ac425c2090d2d9e18e1141a01d6" },
  { sourceId: "geostat_services_metadata_2025", filename: "1004_180325_EN.PDF", bytes: 96228, hash: "cefc7fa285640ef5a7200619c7d54a50d5b21f467c7a27e3113ff6af419dbb27" },
];
test("registers exactly the three accepted Services originals with unchanged bytes and native source bindings", async () => {
  const root = path.resolve(process.cwd(), "../..");
  const manifestBytes = await readFile(path.join(root, "data/methodology/source-archives/trade.csv"));
  expect(manifestBytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const manifest = await loadReviewedSourceManifest(root, "trade");
  const services = manifest.filter(row => row.source_id.startsWith("geostat_services_"));
  expect(services).toHaveLength(3);
  const inventory = await expectedOriginalSourcePaths(root, "trade");
  expect(inventory.map(row => row.path).sort()).toEqual(manifest.map(row => row.repository_source_path).sort());
  const documents = parse(await readFile(path.join(root, "data/sources/source-documents.csv")), { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  for (const expected of originals) {
    const row = services.find(source => source.source_id === expected.sourceId)!;
    expect(row).toMatchObject({ official_filename: expected.filename, byte_size: expected.bytes, sha256: expected.hash, year: "2020-2024", public_download_path: `downloads/methodology/trade/files/${expected.filename.toLowerCase()}` });
    const bytes = await readFile(path.join(root, row.repository_source_path));
    expect(bytes.byteLength).toBe(expected.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected.hash);
    if (expected.sourceId in TRADE_SERVICES_DOCUMENT_IDS) {
      expect(documents.find(document => document.source_id === TRADE_SERVICES_DOCUMENT_IDS[expected.sourceId])).toMatchObject({ source_url_or_file: row.repository_source_path, last_reviewed_at: "2026-10-11" });
    }
  }
  expect(services.some(row => /countries/i.test(row.official_filename))).toBe(false);
  for (const locale of ["ka", "en"] as const) {
    const sources = (await loadWorkbookSources("trade", undefined, locale)).filter(source => services.some(row => row.downloadHref === source.downloadHref));
    expect(sources).toHaveLength(3);
    expect(sources.every(source => source.title && source.downloadHref.startsWith("/downloads/methodology/trade/files/"))).toBe(true);
    if (locale === "en") expect(sources.every(source => !/\p{Script=Georgian}/u.test(source.title))).toBe(true);
  }
});

import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
test("Trade's Georgian archive registry uses BOM and retains exactly the four approved partner originals", async () => {
  const root = path.resolve(process.cwd(), "../.."), bytes = await readFile(path.join(root, "data/methodology/source-archives/trade.csv"));
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const manifest = await loadReviewedSourceManifest(root, "trade");
  const partners = manifest.filter(row => /country/i.test(row.official_filename));
  expect(partners).toHaveLength(4);
  expect(partners.map(row => row.official_filename).sort()).toEqual(["Export-Country_1995-2026.xlsx", "Import-Country-1995-2026.xlsx", "Export-_Country_Group-1995-2026.xlsx", "Import_Country_Group-1995-2026.xlsx"].sort());
});

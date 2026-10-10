import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { loadWorkbookSources } from "../../lib/methodology/workbookSources";

const originals = {
  "Export-Product-by-4-digit-1995-1999.xlsx": "4944f508b9eb334eca8667202dde49d5270bb6e74580c6df7c5c0067a942ef9a",
  "Export-Product-by-4-digit-2000-2014.xlsx": "65a8294ac8fffc980f1124c675ef45469c40943b3d2d79b177bdf82877cdfe42",
  "Export-Product-by-4-digit-2015-2026.xlsx": "75393acdfc5c16b864b9637d0aba2f6c70684c718d71c7924175b4cfae41e7bb",
  "Import-products--1995-1999_eng.xlsx": "c46b8d735761ed5d7835194ae53d5125e4f47b99cd828138a6c71dd722ca1206",
  "Import-Product-by-4-digit-2000-2014.xlsx": "661ab79a4390d040c886463e7dabb63c7cda2d688c745d52b40a8c0981a50c56",
  "Import-Product-by-4-digit-2015-2026.xlsx": "0a1df285438baa36c9f35523735d75358a7c829477cf8ac6dc17211769c34f1d",
};
test("retains the six exact HS4 originals alongside the existing seven Trade sources", async () => {
  const root = path.resolve(process.cwd(), "../.."), manifest = await loadReviewedSourceManifest(root, "trade");
  expect(manifest).toHaveLength(13);
  const bytes = await readFile(path.join(root, "data/methodology/source-archives/trade.csv"));
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  for (const [filename, hash] of Object.entries(originals)) {
    const row = manifest.find(source => source.official_filename === filename)!;
    expect(row.sha256).toBe(hash);
    expect(row.public_download_path).toBe(`downloads/methodology/trade/files/${filename.toLowerCase()}`);
    expect(createHash("sha256").update(await readFile(path.join(root, row.repository_source_path))).digest("hex")).toBe(hash);
  }
  expect(manifest.find(row => row.official_filename === "FTrade_1995-2026.xlsx")?.sha256).toBe("8eaaa8bf93e3d68d647f7b34857049b6e672924cb4dbf71573db1f173d2cd4ce");
  expect(manifest.some(row => /classificatory|6-digit/.test(row.repository_source_path))).toBe(false);
  for (const locale of ["en", "ka"] as const) {
    const sources = await loadWorkbookSources("trade", undefined, locale);
    expect(sources).toHaveLength(13);
    expect(sources.every(source => source.downloadHref.startsWith("/downloads/methodology/trade/files/"))).toBe(true);
    if (locale === "en") expect(sources.every(source => !/\p{Script=Georgian}/u.test(source.title))).toBe(true);
  }
});

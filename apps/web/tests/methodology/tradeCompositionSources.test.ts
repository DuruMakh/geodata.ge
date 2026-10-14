import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { expect, test } from "vitest";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { expectedOriginalSourcePaths } from "../../lib/methodology/sourceInventory";
import { loadWorkbookSources } from "../../lib/methodology/workbookSources";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { projectPublicSources } from "../../lib/methodology/publicSources";
import { buildTradePartnersWorkbookModel } from "../../lib/explorer/tradePartnersWorkbook";
import { parseTradePartnersHash } from "../../lib/explorer/tradePartnersState";
import { compositionFixture, compositionPresentation } from "../explorer/tradeCompositionFixtures";

const originals = [
  { sourceId: "geostat_trade_export-sitc-2000-2026", filename: "Export-SITC_2000-2026.xlsx", bytes: 84104, hash: "71ba53f3c2e55cfb9bf08262582eb23d42e3752c04f4ac2e2c7c8cf90551bb12" },
  { sourceId: "geostat_trade_import-sitc-2000-2026", filename: "Import-SITC_2000-2026.xlsx", bytes: 85006, hash: "bba9b1a1893287e17a1b3b623ec6b618ff86cb0839dd2ed437f02e97e2793508" },
  { sourceId: "geostat_trade_export-bec-2000-2026", filename: "Export-BEC_2000-2026.xlsx", bytes: 69554, hash: "06328bbed108365194fab97679ef2ec147c4de8c0ffa956f9b1d665e515cab30" },
  { sourceId: "geostat_trade_import-bec-2000-2026", filename: "Import-BEC-2000-2026.xlsx", bytes: 69500, hash: "de22fc331f67306855d32cbc31481d90b117d17ac8ae4b4b360a853643571ec4" },
];

test("publishes four unchanged native originals and binds both flows to their workbook sources", async () => {
  const root = path.resolve(process.cwd(), "../..");
  const manifestBytes = await readFile(path.join(root, "data/methodology/source-archives/trade.csv"));
  expect(manifestBytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  const manifest = await loadReviewedSourceManifest(root, "trade");
  expect(manifest).toHaveLength(22);
  const inventory = await expectedOriginalSourcePaths(root, "trade");
  expect(inventory.map(row => row.path).sort()).toEqual(manifest.map(row => row.repository_source_path).sort());
  const documents = parse(await readFile(path.join(root, "data/sources/source-documents.csv")), { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const catalogue = await loadEnglishCatalogue(root);
  for (const expected of originals) {
    const row = manifest.find(source => source.source_id === expected.sourceId)!;
    expect(row).toMatchObject({ official_filename: expected.filename, byte_size: expected.bytes, sha256: expected.hash, year: "2000-2025", downloadHref: `/downloads/methodology/trade/files/${expected.filename.toLowerCase()}` });
    for (const relative of [row.repository_source_path, `apps/web/public${row.downloadHref}`]) {
      const bytes = await readFile(path.join(root, relative));
      expect(bytes.byteLength).toBe(expected.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected.hash);
    }
    expect(documents.find(document => document.source_id === `source.${expected.sourceId.replaceAll("-", "_")}`)).toMatchObject({ source_url_or_file: row.repository_source_path });
    expect(catalogue.documents[expected.sourceId].attribution?.text).toBe("Geostat");
  }
  for (const locale of ["ka", "en"] as const) {
    const sources = await loadWorkbookSources("trade", undefined, locale);
    const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
    for (const expected of originals) {
      const source = publicSources.find(row => row.source_id === expected.sourceId)!;
      expect(source.title).toBeTruthy(); expect(source.publisher).toBeTruthy();
      if (locale === "en") expect(source.title).not.toMatch(/\p{Script=Georgian}/u);
    }
    for (const classification of ["sitc", "bec"] as const) {
      const data = compositionFixture(classification), presentation = await compositionPresentation(locale, data);
      for (const measure of ["trade.exports", "trade.imports"] as const) {
        const state = parseTradePartnersHash(`#sel=goods.total,${data.entities[0].id}&measure=${measure}`, data);
        const model = buildTradePartnersWorkbookModel({ data, state, sources, siteOrigin: "https://fiscal.ge" }, presentation);
        expect(model.sources.map(source => path.basename(source.downloadHref)).sort()).toEqual(["ftrade_1995-2026.xlsx", `${measure === "trade.exports" ? "export" : "import"}-${classification}${classification === "bec" && measure === "trade.imports" ? "-" : "_"}2000-2026.xlsx`].sort());
      }
    }
  }
});

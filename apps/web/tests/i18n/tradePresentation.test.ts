import path from "node:path";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { getMethodologyContent } from "../../lib/methodology/catalog";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
test("Trade has complete matching messages and explicit USD and publication wording", async () => {
  const [ka, en] = await Promise.all([getMessages("ka", ["trade"]), getMessages("en", ["trade"])]);
  expect(Object.keys(ka).sort()).toEqual(Object.keys(en).sort());
  expect(en["trade.unit.billion"]).toBe("billion USD");
  expect(en["trade.publicationUnspecified"]).toBe("Unspecified");
  expect(ka["trade.indicator.trade.turnover"]).toBe("საგარეო სავაჭრო ბრუნვა");
});
test("Trade registers both pages and only three translated original documents", async () => {
  const root = path.resolve(process.cwd(), "../..");
  const [manifest, catalogue, paths] = await Promise.all([loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root), listPublicPagePaths()]);
  expect(manifest).toHaveLength(3);
  expect(manifest.map(row => path.basename(row.repository_source_path)).sort()).toEqual(["FTrade_1995-2026.xlsx", "external_trade_methodology.html", "metadata-en.html"]);
  for (const source of manifest) expect(catalogue.documents[source.source_id].title.text).toBeTruthy();
  expect(paths).toContain("/explorer/trade"); expect(paths).toContain("/explorer/trade/overview"); expect(paths).toContain("/methodology/trade");
  expect(getMethodologyContent("trade", "en").title).toBe("External trade in goods");
});

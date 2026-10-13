import { expect, test } from "vitest";
import path from "node:path";
import { LIVE_METHODOLOGY_IDS, getMethodologyContent } from "../../lib/methodology/catalog";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
test("national sectors have bilingual methodology and all three original sources", async () => {
  expect([...LIVE_METHODOLOGY_IDS] as string[]).toContain("economic-sectors");
  expect(getMethodologyContent("economic-sectors" as never,"en").title).toBe("Economic sectors");
  expect(getMethodologyContent("economic-sectors" as never,"ka").title).toBe("ეკონომიკის სექტორები");
  const manifest = await loadReviewedSourceManifest(path.resolve(process.cwd(),"../.."),"economic-sectors" as never);
  expect(manifest).toHaveLength(3);
  expect(manifest.some(s=>s.source_id==="source.geostat_national_gdp_sna_2008")).toBe(true);
});

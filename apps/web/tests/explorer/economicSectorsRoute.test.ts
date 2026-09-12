import { expect, test } from "vitest";
import path from "node:path";
import { LIVE_METHODOLOGY_IDS, getMethodologyContent } from "../../lib/methodology/catalog";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { loadServedEconomicSectorsData } from "../../lib/data/economicSectors/importEconomicSectors";
import { loadServedGdpOverviewData } from "../../lib/data/gdpOverview/importGdpOverview";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { buildEconomyHubCards } from "../../lib/explorer/economyHubCards";
test("national sectors have bilingual methodology and all three original sources", async () => {
  expect([...LIVE_METHODOLOGY_IDS] as string[]).toContain("economic-sectors");
  expect(getMethodologyContent("economic-sectors" as never,"en").title).toBe("Economic sectors");
  expect(getMethodologyContent("economic-sectors" as never,"ka").title).toBe("ეკონომიკის სექტორები");
  const manifest = await loadReviewedSourceManifest(path.resolve(process.cwd(),"../.."),"economic-sectors" as never);
  expect(manifest).toHaveLength(3);
  expect(manifest.some(s=>s.source_id==="source.geostat_national_gdp_sna_2008")).toBe(true);
});
test("Economy activates sectors with loaded coverage and keeps regions deferred",async()=>{
  const [{facts:gdp},{facts:sectors},presentation]=await Promise.all([loadServedGdpOverviewData(),loadServedEconomicSectorsData(),getPresentation("en",["gdp"],[])]);
  const cards=buildEconomyHubCards(gdp,presentation,sectors);
  expect(cards[1].href).toBe("/explorer/economy/sectors");
  expect(cards[1].footer).toContain("2010–2025");
  expect(cards[2].href).toBeNull();
});

import path from "node:path";
import { expect, test } from "vitest";
import { renderGdpExpenditurePage, gdpExpenditurePageMetadata } from "../../lib/pages/gdp-expenditure";
import { LIVE_METHODOLOGY_IDS, getMethodologyContent } from "../../lib/methodology/catalog";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { renderPageMarkup } from "../helpers/render-localized";
import { GDP_EXPENDITURE } from "../../lib/data/gdpExpenditure/importGdpExpenditure";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";

test.each(["ka", "en"] as const)("GDP by expenditure renders one dataset, its heading and the default lines: %s", async locale => {
  const metadata = await gdpExpenditurePageMetadata(locale);
  const html = renderPageMarkup(locale, await renderGdpExpenditurePage(locale));
  expect(html.match(/"@type":"BreadcrumbList"/g)).toHaveLength(1);
  expect(html.match(/data-testid="explorer-dataset-json-ld"/g)).toHaveLength(1);
  expect(html).toContain(locale === "en" ? "GDP by expenditure" : "მშპ დანახარჯების მიხედვით");
  // The series list, under its headings.
  expect(html).toContain(locale === "en" ? "Change in inventories" : "მარაგების ცვლილება");
  expect(html).toContain(locale === "en" ? "Investment" : "ინვესტიცია");
  // No highlights block and no bulk-file download: the page is browse-only.
  expect(html).not.toContain("sector-highlights");
  expect(html).not.toContain("/downloads/data/gdp-expenditure");
  expect(metadata.alternates?.canonical).toContain(`${locale === "en" ? "/en" : ""}/explorer/economy/expenditure`);
});

// The English table and workbook name rows from the reviewed catalogue, not the registry.
test("every row has a reviewed English label in the catalogue", async () => {
  const { labels } = await loadEnglishCatalogue(path.resolve(process.cwd(), "../.."));
  for (const row of GDP_EXPENDITURE) expect(labels[row.id]?.text, row.id).toBe(row.labelEn);
});

test("has a bilingual methodology page with the three archived Geostat tables", async () => {
  expect([...LIVE_METHODOLOGY_IDS]).toContain("gdp-expenditure");
  expect(getMethodologyContent("gdp-expenditure", "en").title).toBe("GDP by expenditure");
  expect(getMethodologyContent("gdp-expenditure", "ka").title).toBe("მშპ დანახარჯების მიხედვით");
  const manifest = await loadReviewedSourceManifest(path.resolve(process.cwd(), "../.."), "gdp-expenditure");
  expect(manifest.map(s => s.source_id)).toEqual(["source.geostat_gdp_use_current", "source.geostat_gdp_use_growth", "source.geostat_gdp_use_volume"]);
});

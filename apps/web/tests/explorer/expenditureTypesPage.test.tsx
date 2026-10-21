import path from "node:path";
import { expect, test } from "vitest";
import { renderExpenditureTypesPage, expenditureTypesPageMetadata } from "../../lib/pages/expenditure-types";
import { renderPageMarkup } from "../helpers/render-localized";
import { EXPENDITURE_TYPES } from "../../lib/data/expenditureTypes/importExpenditureTypes";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { BUDGET_SECTION_ORDER, BUDGET_SECTIONS } from "../../lib/explorer/sections";
import { currentEntry, NAV_TREE } from "../../lib/navigation/navTree";

test.each(["ka", "en"] as const)("spending by type renders one dataset, its heading, the latest line and both headings: %s", async locale => {
  const metadata = await expenditureTypesPageMetadata(locale);
  const html = renderPageMarkup(locale, await renderExpenditureTypesPage(locale));
  expect(html.match(/"@type":"BreadcrumbList"/g)).toHaveLength(1);
  expect(html.match(/data-testid="explorer-dataset-json-ld"/g)).toHaveLength(1);
  expect(html).toContain(locale === "en" ? "Government spending by type" : "ხარჯები ეკონომიკური კლასიფიკაციით");
  expect(html).toMatch(/data-testid="sectors-headline"[\s\S]*?29\.7/);
  expect(html).toContain(locale === "en" ? "Running costs" : "მიმდინარე ხარჯები");
  expect(html).toContain(locale === "en" ? "Buildings, roads and other assets" : "შენობები, გზები და სხვა აქტივები");
  // Two measures only, and no highlights block.
  expect(html).toContain(locale === "en" ? "% of GDP" : "% მშპ-ში");
  expect(html).not.toContain(locale === "en" ? "Real growth" : "რეალური ზრდა");
  expect(html).not.toContain("sector-highlights");
  expect(metadata.alternates?.canonical).toContain(`${locale === "en" ? "/en" : ""}/explorer/expenditure-types`);
});

test("every row has a reviewed English label in the catalogue", async () => {
  const { labels } = await loadEnglishCatalogue(path.resolve(process.cwd(), "../.."));
  for (const row of EXPENDITURE_TYPES) expect(labels[row.id]?.text, row.id).toBe(row.labelEn);
});

test("the Budget sidebar lists it right after Spending, and Spending is not current on it", () => {
  expect(BUDGET_SECTION_ORDER.slice(0, 3)).toEqual(["expenditure", "expenditureTypes", "revenue"]);
  expect(BUDGET_SECTIONS.expenditureTypes.href).toBe("/explorer/expenditure-types");
  expect(NAV_TREE[0].sections[1].href).toBe("/explorer/expenditure-types");
  expect(currentEntry("/explorer/expenditure-types")).toBe("/explorer/expenditure-types");
});

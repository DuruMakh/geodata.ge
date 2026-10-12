import { readFile } from "node:fs/promises";
import path from "node:path";
import { isValidElement, type ReactElement } from "react";
import { TradeServices } from "../../components/trade/trade-services";
import { renderTradeServicesPage, tradeServicesMetadata } from "../../lib/pages/trade";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { getMethodologyContent } from "../../lib/methodology/catalog";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { TRADE_CHART_INDICATORS } from "../../lib/data/tradeOverview/types";
test("Trade has complete matching messages and explicit USD and publication wording", async () => {
  const [ka, en] = await Promise.all([getMessages("ka", ["trade"]), getMessages("en", ["trade"])]);
  expect(Object.keys(ka).sort()).toEqual(Object.keys(en).sort());
  expect(en["trade.unit.billion"]).toBe("billion USD");
  expect(en["trade.publicationUnspecified"]).toBe("Unspecified");
  expect(ka["trade.indicator.trade.turnover"]).toBe("საგარეო სავაჭრო ბრუნვა");
});
test("Trade registers its five explorers and eighteen translated original documents", async () => {
  const root = path.resolve(process.cwd(), "../..");
  const [manifest, catalogue, paths] = await Promise.all([loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root), listPublicPagePaths()]);
  expect(manifest).toHaveLength(18);
  expect(manifest.map(row => path.basename(row.repository_source_path)).sort()).toEqual(["Export-Country_1995-2026.xlsx", "Export-_Country_Group-1995-2026.xlsx", "FTrade_1995-2026.xlsx", "Import-Country-1995-2026.xlsx", "Import_Country_Group-1995-2026.xlsx", "external_trade_methodology.html", "metadata-en.html", "Export-Product-by-4-digit-1995-1999.xlsx", "Export-Product-by-4-digit-2000-2014.xlsx", "Export-Product-by-4-digit-2015-2026.xlsx", "Import-products--1995-1999_eng.xlsx", "Import-Product-by-4-digit-2000-2014.xlsx", "Import-Product-by-4-digit-2015-2026.xlsx", "Domestic-Export-Country_2014-2026.xlsx", "Domestic-Exports_by-4-digit-2014-2026.xlsx", "Georgian-Exports-of-services-by-types.xlsx", "Georgian-Imports-of-services-by-types.xlsx", "1004_180325_EN.PDF"].sort());
  for (const source of manifest) expect(catalogue.documents[source.source_id].title.text).toBeTruthy();
  expect(paths).toContain("/explorer/trade"); expect(paths).toContain("/explorer/trade/overview"); expect(paths).toContain("/methodology/trade");
  expect(paths).toContain("/explorer/trade/partners");
  expect(paths).toContain("/explorer/trade/products");
  expect(paths).toContain("/explorer/trade/domestic-exports");
  expect(paths).toContain("/explorer/trade/services");
  expect(getMethodologyContent("trade", "en").title).toBe("External trade in goods and services");
});


test("Services routes, metadata and sidebar use bilingual services presentation", async () => {
  const root = path.resolve(process.cwd(), "../..");
  const [ka, en, revisions, sidebar] = await Promise.all([
    getMessages("ka", ["trade", "common"]), getMessages("en", ["trade", "common"]),
    readFile(path.join(root, "data/localization/en/page-revisions.json"), "utf8"),
    readFile(path.join(root, "apps/web/components/shell/data-sidebar.tsx"), "utf8"),
  ]);
  expect(ka["trade.services.title"]).toBe("მომსახურებით ვაჭრობა");
  expect(en["trade.services.title"]).toBe("Services trade");
  expect(en["trade.services.summary"]).toBe("Georgia's annual services trade, in nominal US dollars.");
  expect(ka["common.tradeServices"]).toBe(ka["trade.services.title"]);
  expect(en["common.tradeServices"]).toBe(en["trade.services.title"]);
  expect(JSON.parse(revisions)["/explorer/trade/services"]).toBe("2026-10-11");
  expect(sidebar.indexOf('data-testid="trade-services-link"')).toBeGreaterThan(sidebar.indexOf('data-testid="trade-domestic-link"'));
  expect(sidebar).toContain('if (tradeServicesActive) event.preventDefault()');
  for (const locale of ["ka", "en"] as const) {
    const route = locale === "ka" ? "apps/web/app/(ka)/explorer/trade/services/page.tsx" : "apps/web/app/(en)/en/explorer/trade/services/page.tsx";
    const source = await readFile(path.join(root, route), "utf8");
    expect(source).toContain(`tradeServicesMetadata("${locale}")`);
    expect(source).toContain(`renderTradeServicesPage("${locale}")`);
  }
});


function pageElements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(pageElements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...pageElements(node.props.children)];
}

test("Services metadata and page inputs use accepted services coverage, labels and originals", async () => {
  for (const locale of ["ka", "en"] as const) {
    const metadata = await tradeServicesMetadata(locale);
    const href = locale === "en" ? "/en/explorer/trade/services" : "/explorer/trade/services";
    expect(metadata.title).toBe(locale === "en" ? "Services trade" : "მომსახურებით ვაჭრობა");
    expect(metadata.description).toContain("2020–2024");
    expect(metadata.alternates?.canonical).toMatch(new RegExp(`${href}$`));
    expect(metadata.alternates?.languages?.en).toMatch(/\/en\/explorer\/trade\/services$/);
    expect(metadata.alternates?.languages?.ka).toMatch(/\/explorer\/trade\/services$/);
    const page = await renderTradeServicesPage(locale), elements = pageElements(page);
    const dataset = elements.find(element => element.props.testId === "explorer-dataset-json-ld")!.props.data as Record<string, unknown>;
    expect(dataset).toMatchObject({ "@type": "Dataset", name: metadata.title, temporalCoverage: "2020/2024", dateModified: "2026-10-11" });
    expect(dataset.url).toMatch(new RegExp(`${href}$`));
    const workspace = elements.find(element => element.type === TradeServices)!;
    const props = workspace.props as unknown as Parameters<typeof TradeServices>[0];
    expect(props.lastReviewedAt).toBe("2026-10-11");
    expect(props.data.national).toHaveLength(20);
    expect(props.data.types.entities).toHaveLength(12);
    expect(props.data.types.dataset).toBe("services");
    expect(page.props.englishLabels["services.total"]).toBeTruthy();
    expect(props.sources.map(source => path.basename(source.downloadHref)).sort()).toEqual(["georgian-exports-of-services-by-types.xlsx", "georgian-imports-of-services-by-types.xlsx"]);
    expect(props.sources.every(source => source.downloadHref === source.downloadHref.toLowerCase())).toBe(true);
    const repairIndex = props.data.types.entities.findIndex(entity => entity.id === "services.maintenance_repair");
    expect(props.data.types.facts.find(([entityIndex, year, measureIndex]) => entityIndex === repairIndex && year === 2020 && TRADE_CHART_INDICATORS[measureIndex] === "trade.exports")?.[3]).toBeNull();
  }
});

import path from "node:path";
import { loadServedExplorerData, loadServedMunicipalData } from "../data/servedData";
import { BUDGET_SECTIONS, BUDGET_SECTION_ORDER } from "../explorer/sections";
import { CITY_PAGE_PATHS } from "../explorer/inflationCityRoutes";
import { populationPlacePaths } from "../explorer/demographyPlaceRoutes";
import { DEMOGRAPHY_HUB_PATH, LIVE_DEMOGRAPHY_PAGES } from "../explorer/demographyRoutes";
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { loadManifestDocuments } from "../factQuery/buildSnapshot";
import { resolvePublicSources } from "../factQuery/sources";
import { AGGREGATE_ONLY_MUNICIPAL_CODES, DEBT_SERIES_LABELS_KA, DEFICIT_SERIES_ID } from "../factQuery/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { LIVE_METHODOLOGY_IDS } from "../methodology/types";
import type { TranslationInventory } from "./types";
import sectorRegistry from "../../../../data/taxonomy/economic-sectors.json";
import unemploymentRegistry from "../../../../data/taxonomy/unemployment-groups.json";
import tradePartnerRegistry from "../../../../data/taxonomy/trade-partners.json";
import moneyTransferRegistry from "../../../../data/taxonomy/money-transfer-countries.json";
import foreignInvestmentRegistry from "../../../../data/taxonomy/foreign-investment.json";
import { readTradeProductCatalogue } from "../data/tradeProducts/catalogue";
import { UNEMPLOYMENT_SECTIONS } from "../explorer/unemploymentSections";
import { unemploymentRegionHref } from "../explorer/unemploymentRegionRoutes";
import { WAGES_SECTIONS, wagesRegionHref } from "../explorer/wages";
import { WAGES_REGIONS } from "../data/wages/types";

const sortedUnique = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

export async function listPublicPagePaths(): Promise<string[]> {
  const { regions } = await loadServedMunicipalData();
  return [
    "/", "/about", "/connect", "/explorer", "/explorer/economy", "/explorer/economy/gdp",
    "/explorer/economy/sectors",
    "/explorer/unemployment",
    "/explorer/trade", "/explorer/trade/overview", "/explorer/trade/partners", "/explorer/trade/products", "/explorer/external", "/explorer/external/money-from-abroad", "/explorer/external/foreign-investment", "/explorer/external/current-account",
    ...UNEMPLOYMENT_SECTIONS.map(section => section.href),
    "/explorer/wages", ...WAGES_SECTIONS.map(section => section.href), ...WAGES_REGIONS.map(wagesRegionHref),
    ...regions.map(region => unemploymentRegionHref(region.id)),
    "/explorer/economy/regions",
    ...regions.map(({ id }) => `/explorer/economy/regions/${id.replace(/^region\./, "")}`),
    "/explorer/inflation", "/explorer/inflation/overview", "/explorer/inflation/categories", "/explorer/inflation/products", "/explorer/inflation/cities",
    ...CITY_PAGE_PATHS,
    DEMOGRAPHY_HUB_PATH, ...LIVE_DEMOGRAPHY_PAGES.map((page) => page.path),
    ...populationPlacePaths(regions.map(({ id }) => id)),
    ...BUDGET_SECTION_ORDER.map((id) => BUDGET_SECTIONS[id].href).filter((href): href is string => href !== null),
    "/explorer/municipalities/georgia",
    ...MUNICIPALITY_ROUTES.map(({ slug }) => `/explorer/municipalities/${slug}`),
    ...regions.map(({ id }) => `/explorer/municipalities/region/${id.replace(/^region\./, "")}`),
    "/methodology", ...LIVE_METHODOLOGY_IDS.map((id) => `/methodology/${id}`),
  ];
}

export async function loadTranslationInventory(): Promise<TranslationInventory> {
  const [explorer, municipal, documents, debtDocuments, unemploymentDocuments, tradeDocuments, wagesDocuments, externalDocuments, pagePaths, tradeProducts] = await Promise.all([
    loadServedExplorerData(), loadServedMunicipalData(), loadManifestDocuments(),
    loadReviewedSourceManifest(path.resolve(process.cwd(), "../.."), "debt"), loadReviewedSourceManifest(path.resolve(process.cwd(), "../.."), "unemployment"), loadReviewedSourceManifest(path.resolve(process.cwd(), "../.."), "trade"), loadReviewedSourceManifest(path.resolve(process.cwd(), "../.."), "wages"), loadReviewedSourceManifest(path.resolve(process.cwd(), "../.."), "external-flows"), listPublicPagePaths(), readTradeProductCatalogue(path.resolve(process.cwd(), "../..")),
  ]);
  const sources = resolvePublicSources({ sourceDocuments: explorer.sourceDocuments, manifestDocuments: documents });
  const programmeHistory = explorer.adminFacts.filter((fact) => fact.level === "major_program").map((fact) => {
    if (!fact.officialLabelKa) throw new Error(`Missing original programme label: ${fact.itemId}:${fact.year}`);
    return { seriesId: fact.itemId, year: fact.year, originalKa: fact.officialLabelKa };
  }).sort((a, b) => a.seriesId.localeCompare(b.seriesId, "en") || a.year - b.year);
  return {
    pagePaths,
    labelIds: sortedUnique([
      ...sectorRegistry.map(row => row.id), "economic-sectors",
      ...unemploymentRegistry.map(row => row.id), "unemployment",
      ...tradePartnerRegistry.map(row => row.id),
      ...moneyTransferRegistry.map(row => row.id),
      ...foreignInvestmentRegistry.map(row => row.id),
      ...tradeProducts.map(row => row.id),
      ...explorer.glossary.keys(), ...explorer.adminCategories.map((row) => row.id),
      ...programmeHistory.map((row) => row.seriesId),
      "expenditure.total", "revenue.total", "admin_spending.total", "municipal.total", "country.georgia", "snapshot.other",
      ...municipal.functions.map((row) => row.id), ...municipal.regions.map((row) => row.id),
      ...municipal.municipalities.flatMap((row) => [row.code, `${row.code}.official-name`]),
      ...AGGREGATE_ONLY_MUNICIPAL_CODES, ...Object.keys(DEBT_SERIES_LABELS_KA), DEFICIT_SERIES_ID,
      "national-revenue", "national-expenditure", "ministries", "municipal-expenditure", "government-debt", "general-government-balance",
    ]),
    sourceIds: sortedUnique(sources.map((row) => row.sourceId)),
    documentIds: sortedUnique([...documents.map((row) => row.documentId), ...debtDocuments.map((row) => row.source_id), ...unemploymentDocuments.map(row => row.source_id), ...tradeDocuments.map(row => row.source_id), ...wagesDocuments.map(row => row.source_id), ...externalDocuments.map(row => row.source_id)]),
    derivedSourceIds: sortedUnique(sources.filter((row) => row.derivation !== null).map((row) => row.sourceId)),
    attributedDocumentIds: sortedUnique([
      ...documents.filter((row) => row.attribution !== null).map((row) => row.documentId),
      ...debtDocuments.map((row) => row.source_id),
      ...unemploymentDocuments.map(row => row.source_id),
      ...tradeDocuments.map(row => row.source_id),
      ...wagesDocuments.map(row => row.source_id),
      ...externalDocuments.map(row => row.source_id),
    ]),
    programmeHistory,
  };
}

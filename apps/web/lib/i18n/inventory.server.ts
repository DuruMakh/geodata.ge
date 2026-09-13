import path from "node:path";
import { loadServedExplorerData, loadServedMunicipalData } from "../data/servedData";
import { BUDGET_SECTIONS, BUDGET_SECTION_ORDER } from "../explorer/sections";
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { DEFICIT_ITEM } from "../explorer/deficitExplorer";
import { loadManifestDocuments } from "../factQuery/buildSnapshot";
import { resolvePublicSources } from "../factQuery/sources";
import { AGGREGATE_ONLY_MUNICIPAL_CODES, DEBT_SERIES_LABELS_KA, DEFICIT_SERIES_ID } from "../factQuery/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { LIVE_METHODOLOGY_IDS } from "../methodology/types";
import type { TranslationInventory } from "./types";
import sectorRegistry from "../../../../data/taxonomy/economic-sectors.json";

const sortedUnique = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

export async function listPublicPagePaths(): Promise<string[]> {
  const { regions } = await loadServedMunicipalData();
  return [
    "/", "/about", "/connect", "/explorer", "/explorer/economy", "/explorer/economy/gdp",
    "/explorer/economy/sectors",
    "/explorer/economy/regions",
    ...regions.map(({ id }) => `/explorer/economy/regions/${id.replace(/^region\./, "")}`),
    "/explorer/inflation", "/explorer/inflation/overview",
    ...BUDGET_SECTION_ORDER.map((id) => BUDGET_SECTIONS[id].href).filter((href): href is string => href !== null),
    "/explorer/municipalities/georgia",
    ...MUNICIPALITY_ROUTES.map(({ slug }) => `/explorer/municipalities/${slug}`),
    ...regions.map(({ id }) => `/explorer/municipalities/region/${id.replace(/^region\./, "")}`),
    "/methodology", ...LIVE_METHODOLOGY_IDS.map((id) => `/methodology/${id}`),
  ];
}

export async function loadTranslationInventory(): Promise<TranslationInventory> {
  const [explorer, municipal, documents, debtDocuments, pagePaths] = await Promise.all([
    loadServedExplorerData(), loadServedMunicipalData(), loadManifestDocuments(),
    loadReviewedSourceManifest(path.resolve(process.cwd(), "../.."), "debt"), listPublicPagePaths(),
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
      ...explorer.glossary.keys(), ...explorer.adminCategories.map((row) => row.id),
      ...programmeHistory.map((row) => row.seriesId),
      "expenditure.total", "revenue.total", "admin_spending.total", "municipal.total", "country.georgia", "snapshot.other",
      ...municipal.functions.map((row) => row.id), ...municipal.regions.map((row) => row.id),
      ...municipal.municipalities.flatMap((row) => [row.code, `${row.code}.official-name`]),
      ...AGGREGATE_ONLY_MUNICIPAL_CODES, ...Object.keys(DEBT_SERIES_LABELS_KA), DEFICIT_SERIES_ID, DEFICIT_ITEM.id,
      "national-revenue", "national-expenditure", "ministries", "municipal-expenditure", "government-debt", "general-government-balance",
    ]),
    sourceIds: sortedUnique(sources.map((row) => row.sourceId)),
    documentIds: sortedUnique([...documents.map((row) => row.documentId), ...debtDocuments.map((row) => row.source_id)]),
    derivedSourceIds: sortedUnique(sources.filter((row) => row.derivation !== null).map((row) => row.sourceId)),
    attributedDocumentIds: sortedUnique([
      ...documents.filter((row) => row.attribution !== null).map((row) => row.documentId),
      ...debtDocuments.map((row) => row.source_id),
    ]),
    programmeHistory,
  };
}

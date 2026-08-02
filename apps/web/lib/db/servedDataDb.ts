import type { LoadedExplorerData, LoadedLandingData } from "../data/servedData";
import {
  loadAdminCategoriesFromMirror,
  loadAdminFactsFromMirror,
  loadBudgetFactsFromMirror,
  loadGlossaryFromMirror,
  loadSourceDocumentsFromMirror,
} from "./mirrorRows";
import { prisma } from "./prisma";

// Database-backed loaders for GEODATA_DATA_SOURCE=db, reading the mirror over
// the pooled connection. The row shapes and mapping live in ./mirrorRows so
// the import can run the identical read path inside its transaction.

export async function loadLandingDataFromDb(): Promise<LoadedLandingData> {
  const [facts, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactsFromMirror(prisma),
    loadGlossaryFromMirror(prisma),
    loadSourceDocumentsFromMirror(prisma),
  ]);

  return { facts, glossary, sourceDocuments };
}

export async function loadExplorerDataFromDb(): Promise<LoadedExplorerData> {
  const [landing, adminFacts, adminCategories] = await Promise.all([
    loadLandingDataFromDb(),
    loadAdminFactsFromMirror(prisma),
    loadAdminCategoriesFromMirror(prisma),
  ]);

  return { ...landing, adminFacts, adminCategories };
}

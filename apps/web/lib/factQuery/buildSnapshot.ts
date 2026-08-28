// apps/web/lib/factQuery/buildSnapshot.ts
//
// The ONE file in lib/factQuery/ permitted to reach the served-data loaders.
// Everything else takes the finished snapshot as an argument. tests/factQuery/
// purity.test.ts excludes this file for exactly that reason.
import { loadServedExplorerData, loadServedMunicipalData } from "../data/servedData";
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { PROGRAM_SUCCESSIONS, findProgramSuccession } from "../data/adminSpending/programSuccessions";
import { LEGACY_PROGRAM_JOINS } from "../data/adminSpending/legacyProgramJoins";
import { makeProgramItemId } from "../data/adminSpending/generateAdminSpendingFacts";
import { hashDataVersion } from "./canonical";
import { SCHEMA_VERSION, type BudgetItemMeta, type FactQuerySnapshot } from "./types";

export type BuildSnapshotOptions = { releaseCommit: string; generatedAt: string };

/**
 * Item ids of the series that carry an approved historical join, from
 * PROGRAM_SUCCESSIONS and LEGACY_PROGRAM_JOINS (lib/data/adminSpending/). Both tables
 * key on `targetCode`, a tavi-VI program CODE — not an item id — and ServedAdminFact
 * (lib/servedRows.ts) exposes no officialCode to join back through. Resolving ids
 * therefore goes through makeProgramItemId, the exact function
 * generateAdminSpendingFacts.ts uses to assign these facts' itemId in the first place,
 * rather than string-building an id that could drift from it.
 *
 * PROGRAM_SUCCESSIONS entries resolve directly: single-step resolution (every entry
 * points at the end of a chain, never an intermediate segment) is a documented
 * invariant of that table. LEGACY_PROGRAM_JOINS entries can still chain into a further
 * succession — e.g. a 2006 join lands on code "35 02", which itself succeeds to
 * "27 02" for years 2006-2018 — so each join is re-checked against
 * findProgramSuccession for its own year before falling back to its own target,
 * mirroring generateAdminSpendingFacts.ts's programItemId exactly.
 */
function historicalJoinSeriesIds(): string[] {
  const ids = new Set<string>();

  for (const succession of PROGRAM_SUCCESSIONS) {
    ids.add(
      makeProgramItemId(succession.targetCode, succession.parentItemId, succession.targetEraKey ?? "default"),
    );
  }

  for (const join of LEGACY_PROGRAM_JOINS) {
    const succession = findProgramSuccession(join.targetCode, join.targetParentItemId, join.year);
    ids.add(
      succession
        ? makeProgramItemId(succession.targetCode, join.targetParentItemId, succession.targetEraKey ?? "default")
        : makeProgramItemId(join.targetCode, join.targetParentItemId, "default"),
    );
  }

  return [...ids].sort();
}

export async function buildFactQuerySnapshot(options: BuildSnapshotOptions): Promise<FactQuerySnapshot> {
  const [explorer, municipal] = await Promise.all([loadServedExplorerData(), loadServedMunicipalData()]);

  // GlossaryEntry (lib/data/glossary.ts) carries no sort/display-order column — unlike
  // AdminSpendingCategory/MunicipalFunction/MunicipalRegion, category-glossary.csv was
  // never given one. The glossary Map's iteration order is the CSV's row order (the
  // order loadGlossary inserted each record in), the only ordering signal genuinely
  // available for a budget item, so that position becomes sortOrder here. `items`
  // itself is still sorted by id below, so the snapshot's own array order stays
  // deterministic regardless of CSV row order.
  const items: BudgetItemMeta[] = Array.from(explorer.glossary.entries())
    .map(([id, entry], sortOrder) => ({
      id,
      side: id.startsWith("revenue.") ? ("revenue" as const) : ("expenditure" as const),
      kaLabel: entry.kaLabel,
      sortOrder,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const slugByCode = Object.fromEntries(MUNICIPALITY_ROUTES.map(({ code, slug }) => [code, slug]));

  const content = {
    schemaVersion: SCHEMA_VERSION,
    national: { facts: explorer.facts, items },
    ministries: {
      facts: explorer.adminFacts,
      categories: explorer.adminCategories,
      historicalJoinSeriesIds: historicalJoinSeriesIds(),
    },
    municipal: {
      functions: municipal.functions,
      regions: municipal.regions,
      municipalities: municipal.municipalities,
      functionFacts: municipal.functionFacts,
      totalFacts: municipal.totalFacts,
      countryFunctionFacts: municipal.countryFunctionFacts,
      countryTotalFacts: municipal.countryTotalFacts,
      adjaraBudgetAdjustments: municipal.adjaraBudgetAdjustments,
      populationFacts: municipal.populationFacts,
      slugByCode,
    },
    gdpFacts: explorer.gdpFacts,
    sources: [],
  };

  return {
    ...content,
    dataVersion: hashDataVersion(content),
    releaseCommit: options.releaseCommit,
    generatedAt: options.generatedAt,
  };
}

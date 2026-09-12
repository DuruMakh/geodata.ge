import Decimal from "decimal.js";
import { readCsvRecords } from "../csv";
import { assertSameServedRows } from "../servedDataParity";
import {
  CPI_CATEGORY_MEASURES,
  CPI_MEASURES,
  CPI_SERIES_IDS,
  type BasketWeightRow,
  type CpiCategoryFact,
  type CpiCategoryMeasure,
  type CpiFact,
  type InflationTargetRow,
  type ServedBasketWeightRow,
  type ServedCpiCategoryFact,
  type ServedCpiFact,
  type ServedInflationTargetRow,
} from "./types";
import {
  categoryFactKey,
  factKey,
  validateBasketWeights,
  validateCategoryFacts,
  validateCpiFacts,
  validateTargetRows,
} from "./validateInflation";

// Relative to apps/web, like every served CSV path (lib/data/servedData.ts).
export const CPI_FACTS_CSV = "../../data/imports/cpi-national-monthly.csv";
export const INFLATION_TARGETS_CSV = "../../data/imports/nbg-inflation-target.csv";

export async function loadCpiFacts(relativePath = CPI_FACTS_CSV): Promise<CpiFact[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map((row): CpiFact => {
    if (!(CPI_SERIES_IDS as readonly string[]).includes(row.series_id)) throw new Error(`Unknown CPI series ${row.series_id}`);
    if (!(CPI_MEASURES as readonly string[]).includes(row.measure)) throw new Error(`Unknown CPI measure ${row.measure}`);
    return {
      seriesId: row.series_id as CpiFact["seriesId"],
      measure: row.measure as CpiFact["measure"],
      period: row.period,
      value: new Decimal(row.value).toFixed(),
      status: row.status as CpiFact["status"],
      sourceId: row.source_id,
      sourceLocator: row.source_locator,
      lastReviewedAt: row.last_reviewed_at,
    };
  });
  validateCpiFacts(facts);
  return facts;
}

export async function loadInflationTargets(relativePath = INFLATION_TARGETS_CSV): Promise<InflationTargetRow[]> {
  const rows = await readCsvRecords(relativePath);
  const targets = rows.map((row): InflationTargetRow => ({
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to === "" ? null : row.effective_to,
    targetPct: new Decimal(row.target_pct).toFixed(),
    sourceId: row.source_id,
    lastReviewedAt: row.last_reviewed_at,
  }));
  validateTargetRows(targets);
  return targets;
}

export const CPI_CATEGORY_FACTS_CSV = "../../data/imports/cpi-categories-monthly.csv";
export const BASKET_WEIGHTS_CSV = "../../data/imports/cpi-basket-weights.csv";

export async function loadCpiCategoryFacts(relativePath = CPI_CATEGORY_FACTS_CSV): Promise<CpiCategoryFact[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map((row): CpiCategoryFact => {
    const level = Number(row.level);
    if (level !== 2 && level !== 3) throw new Error(`Unknown category level ${row.level}`);
    if (!(CPI_CATEGORY_MEASURES as readonly string[]).includes(row.measure)) throw new Error(`Unknown category measure ${row.measure}`);
    return {
      categoryId: row.category_id,
      coicopCode: row.coicop_code,
      level,
      parentId: row.parent_id === "" ? null : row.parent_id,
      measure: row.measure as CpiCategoryMeasure,
      period: row.period,
      value: new Decimal(row.value).toFixed(),
      status: row.status as CpiCategoryFact["status"],
      sourceId: row.source_id,
      sourceLocator: row.source_locator,
      lastReviewedAt: row.last_reviewed_at,
    };
  });
  validateCategoryFacts(facts);
  return facts;
}

export async function loadBasketWeights(relativePath = BASKET_WEIGHTS_CSV): Promise<BasketWeightRow[]> {
  const rows = await readCsvRecords(relativePath);
  return rows.map((row) => ({
    categoryId: row.category_id,
    year: Number(row.year),
    weightPct: new Decimal(row.weight_pct).toFixed(),
    sourceId: row.source_id,
    lastReviewedAt: row.last_reviewed_at,
  }));
}

const SOURCE_DOCUMENTS_CSV = "../../data/sources/source-documents.csv";

export function assertInflationParity(
  csv: { facts: CpiFact[]; targets: InflationTargetRow[]; categories: CpiCategoryFact[]; weights: BasketWeightRow[] },
  db: { facts: CpiFact[]; targets: InflationTargetRow[]; categories: CpiCategoryFact[]; weights: BasketWeightRow[] },
): void {
  validateCpiFacts(db.facts);
  validateTargetRows(db.targets);
  validateCategoryFacts(db.categories);
  validateBasketWeights(db.weights, new Set(db.categories.map((fact) => fact.categoryId)));
  assertSameServedRows("Inflation CPI", csv.facts, db.facts, factKey);
  assertSameServedRows("NBG inflation target", csv.targets, db.targets, (row) => row.effectiveFrom);
  assertSameServedRows("Inflation CPI categories", csv.categories, db.categories, categoryFactKey);
  assertSameServedRows("CPI basket weights", csv.weights, db.weights, (row) => `${row.categoryId}:${row.year}`);
}

/**
 * Build-time memo, the same pattern and for the same reason as
 * lib/data/servedData.ts: the hub, both metadata functions and both page
 * renders each call this, and with the category table it is 28,000 rows —
 * the largest dataset in the repository. Caching the promise collapses them
 * onto one parse, one validation and, in db mode, one parity pass.
 */
let servedInflationPromise: Promise<ServedInflationData> | null = null;

export function resetInflationCacheForTests(): void {
  servedInflationPromise = null;
}

export type ServedInflationData = {
  facts: ServedCpiFact[];
  targets: ServedInflationTargetRow[];
  categories: ServedCpiCategoryFact[];
  weights: ServedBasketWeightRow[];
};

export function loadServedInflationData(): Promise<ServedInflationData> {
  servedInflationPromise ??= loadServedInflationDataUncached();
  return servedInflationPromise;
}

async function loadServedInflationDataUncached(): Promise<{
  facts: ServedCpiFact[];
  targets: ServedInflationTargetRow[];
  categories: ServedCpiCategoryFact[];
  weights: ServedBasketWeightRow[];
}> {
  const mode = (process.env.GEODATA_DATA_SOURCE ?? "csv").trim().toLowerCase();
  if (mode !== "csv" && mode !== "" && mode !== "db") throw new Error("Invalid GEODATA_DATA_SOURCE");
  let facts = await loadCpiFacts();
  let targets = await loadInflationTargets();
  let categories = await loadCpiCategoryFacts();
  let weights = await loadBasketWeights();
  validateBasketWeights(weights, new Set(categories.map((fact) => fact.categoryId)));
  const registered = new Set((await readCsvRecords(SOURCE_DOCUMENTS_CSV)).map((row) => row.source_id));
  for (const id of new Set([...facts, ...targets, ...categories, ...weights].map((row) => row.sourceId))) {
    if (!registered.has(id)) throw new Error(`Inflation source ${id} is not registered in data/sources/source-documents.csv`);
  }
  if (mode === "db") {
    const { loadInflationDataFromDb } = await import("../../db/servedDataDb");
    const db = await loadInflationDataFromDb();
    assertInflationParity({ facts, targets, categories, weights }, db);
    facts = db.facts;
    targets = db.targets;
    categories = db.categories;
    weights = db.weights;
  }
  return {
    facts: facts.map((fact) => ({ ...fact, value: Number(fact.value) })),
    targets: targets.map((row) => ({ ...row, targetPct: Number(row.targetPct) })),
    categories: categories.map((fact) => ({ ...fact, value: Number(fact.value) })),
    weights: weights.map((row) => ({ ...row, weightPct: Number(row.weightPct) })),
  };
}

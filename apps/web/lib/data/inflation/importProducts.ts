import Decimal from "decimal.js";
import { readCsvRecords } from "../csv";
import { resolveServedDataSource } from "../servedDataSource";
import { assertSameServedRows } from "../servedDataParity";
import type { ProductCatalogueRow } from "./productIdentity";
import type { ProductFactRow, ProductMeasure } from "./productTypes";
import { validateProductIndices } from "./validateProducts";

export const PRODUCT_CATALOGUE_CSV = "../../data/imports/cpi-products.csv";
export const PRODUCT_FACTS_CSV = "../../data/imports/cpi-products-monthly.csv";

export type ServedProductData = {
  catalogue: ProductCatalogueRow[];
  facts: ProductFactRow[];
};

export async function loadProductCatalogueCsv(file = PRODUCT_CATALOGUE_CSV): Promise<ProductCatalogueRow[]> {
  const rows = (await readCsvRecords(file)).map((row) => ({
    productId: row.product_id!, coicopCode: row.coicop_code!, labelEn: row.label_en!, labelKa: row.label_ka!,
    firstPeriod: row.first_period!, decisionRef: row.decision_ref!,
  }));
  const ids = new Set<string>();
  for (const row of rows) {
    if (!/^cpi\.product\.p\d{4,}$/.test(row.productId) || ids.has(row.productId) || !/^\d{2}$/.test(row.coicopCode) ||
        !row.labelEn || !row.labelKa || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.firstPeriod) || !row.decisionRef) {
      throw new Error(`Invalid or duplicate product catalogue row ${row.productId}`);
    }
    ids.add(row.productId);
  }
  return rows;
}

export async function loadProductFactsCsv(file = PRODUCT_FACTS_CSV): Promise<ProductFactRow[]> {
  const rows = (await readCsvRecords(file)).map((row) => ({
    productId: row.product_id!, measure: row.measure as ProductMeasure, period: row.period!,
    index100: row.index_100 || null, availability: row.availability as ProductFactRow["availability"],
    sourceId: row.source_id!, sourceLocator: row.source_locator!, lastReviewedAt: row.last_reviewed_at!,
  }));
  for (const row of rows) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.lastReviewedAt)) throw new Error(`Invalid product fact period/date ${row.productId}:${row.period}`);
    if (row.index100 !== null) {
      const value = new Decimal(row.index100);
      if (!value.isFinite() || value.lte(0) || value.decimalPlaces() > 4 || value.gte("100000000")) {
        throw new Error(`Product index exceeds DECIMAL(12,4) precision: ${row.productId}:${row.period}`);
      }
    }
  }
  validateProductIndices(rows);
  return rows;
}

function factKey(row: ProductFactRow): string {
  return `${row.productId}:${row.measure}:${row.period}`;
}

export function assertProductParity(csv: ServedProductData, db: ServedProductData): void {
  assertSameServedRows("Product catalogue", csv.catalogue, db.catalogue, (row) => row.productId);
  // PostgreSQL DECIMAL preserves the value, but may display source trailing zeros differently.
  const normalized = (row: ProductFactRow) => ({ ...row, index100: row.index100 === null ? null : new Decimal(row.index100).toFixed() });
  assertSameServedRows("Product indices", csv.facts.map(normalized), db.facts.map(normalized), factKey);
}

let servedProductPromise: Promise<ServedProductData> | null = null;

export function loadServedProductData(): Promise<ServedProductData> {
  servedProductPromise ??= loadServedProductDataUncached();
  return servedProductPromise;
}

export function resetProductCacheForTests(): void {
  servedProductPromise = null;
}

async function loadServedProductDataUncached(): Promise<ServedProductData> {
  const [catalogue, facts] = await Promise.all([loadProductCatalogueCsv(), loadProductFactsCsv()]);
  const ids = new Set(catalogue.map((row) => row.productId));
  const registered = new Set((await readCsvRecords("../../data/sources/source-documents.csv")).map((row) => row.source_id));
  for (const fact of facts) {
    if (!ids.has(fact.productId)) throw new Error(`Product fact has no current catalogue identity: ${fact.productId}`);
    if (!registered.has(fact.sourceId)) throw new Error(`Product source is not registered: ${fact.sourceId}`);
  }
  const csv = { catalogue, facts };
  if (resolveServedDataSource() !== "db") return csv;
  const { loadProductDataFromDb } = await import("../../db/servedDataDb");
  const db = await loadProductDataFromDb();
  assertProductParity(csv, db);
  return db;
}

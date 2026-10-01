import type { ProductFactRow } from "../data/inflation/productTypes";

export const PRODUCT_QUERY_MEASURES = ["yoy_pct", "cumulative_pct"] as const;
export type ProductQueryMeasure = (typeof PRODUCT_QUERY_MEASURES)[number];
export const PRODUCT_DATASET_ID = "inflation-products" as const;

export type ProductSnapshotCatalogueRow = {
  productId: string;
  coicopCode: string;
  labelKa: string;
  labelEn: string;
  firstPeriod: string;
};

export type ProductSnapshotFact = Pick<ProductFactRow, "productId" | "measure" | "period" | "index100" | "availability" | "sourceId">;

export type ProductHistoryNote = {
  productId: string;
  boundaryYear: number;
  noteKa: string;
  noteEn: string;
};

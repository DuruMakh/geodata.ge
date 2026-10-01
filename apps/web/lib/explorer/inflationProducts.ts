import Decimal from "decimal.js";
import { makePeriod, periodFromKey, periodYear } from "../data/inflation/periods";
import type { ProductCatalogueRow } from "../data/inflation/productIdentity";
import type { ProductFactRow } from "../data/inflation/productTypes";
import { EDITORIAL_PALETTE } from "./colors";

export type ClientProduct = Pick<ProductCatalogueRow, "productId" | "labelEn" | "labelKa" | "firstPeriod">;

/** One dense, source-precision index run. `q` converts each safe integer back to its published index. */
export type PackedProductSeries = { k: string; s: string; q: number; v: Array<number | null> };

type ProductRun = { start: number; values: Array<number | null>; scale: number; prefix: Decimal[]; bad: number[] };

export type ProductIndex = {
  products: ClientProduct[];
  productById: Map<string, ClientProduct>;
  annual: Map<string, ProductRun>;
  monthly: Map<string, ProductRun>;
  earliestYear: number;
  latestPeriod: number;
  defaultRange: { startYear: number; endYear: number };
};

function runKey(fact: Pick<ProductFactRow, "productId" | "measure">): string {
  return `${fact.productId}:${fact.measure === "yoy_index_100" ? "a" : "m"}`;
}

export function packProductFacts(facts: readonly Pick<ProductFactRow, "productId" | "measure" | "period" | "index100">[]): PackedProductSeries[] {
  const groups = new Map<string, Map<number, string | null>>();
  for (const fact of facts) {
    const key = runKey(fact);
    const group = groups.get(key) ?? new Map<number, string | null>();
    const period = periodFromKey(fact.period);
    if (group.has(period)) throw new Error(`Duplicate product index ${key}:${fact.period}`);
    group.set(period, fact.index100);
    groups.set(key, group);
  }
  return [...groups].map(([k, values]) => {
    const periods = [...values.keys()].sort((a, b) => a - b);
    const start = periods[0]!;
    const end = periods.at(-1)!;
    const places = Math.max(0, ...[...values.values()].filter((value): value is string => value !== null)
      .map((value) => (value.split(".")[1] ?? "").length));
    const q = 10 ** places;
    const v = Array.from({ length: end - start + 1 }, (_, offset) => {
      const value = values.get(start + offset);
      if (value === undefined || value === null) return null;
      const scaled = new Decimal(value).mul(q);
      if (!scaled.isInteger() || !Number.isSafeInteger(scaled.toNumber())) throw new Error(`Unsafe product index ${k}:${start + offset}`);
      return scaled.toNumber();
    });
    return { k, s: `${periodYear(start)}-${String((start % 12) + 1).padStart(2, "0")}`, q, v };
  });
}

function unpack(run: PackedProductSeries): ProductRun {
  if (!Number.isSafeInteger(run.q) || run.q <= 0 || run.v.some((value) => value !== null && !Number.isSafeInteger(value))) {
    throw new Error(`Unsafe packed product series ${run.k}`);
  }
  const prefix: Decimal[] = [new Decimal(1)];
  const bad: number[] = [0];
  for (const value of run.v) {
    prefix.push(value === null ? prefix.at(-1)! : prefix.at(-1)!.mul(new Decimal(value).div(run.q * 100)));
    bad.push(bad.at(-1)! + Number(value === null));
  }
  return { start: periodFromKey(run.s), values: run.v, scale: run.q, prefix, bad };
}

export function buildProductIndex(products: ClientProduct[], series: PackedProductSeries[]): ProductIndex {
  const productById = new Map(products.map((product) => [product.productId, product]));
  if (productById.size !== products.length || series.length === 0) throw new Error("Product index needs unique products and data");
  const annual = new Map<string, ProductRun>();
  const monthly = new Map<string, ProductRun>();
  let earliest = Infinity;
  let latest = -Infinity;
  for (const packed of series) {
    const separator = packed.k.lastIndexOf(":");
    const id = packed.k.slice(0, separator);
    const measure = packed.k.slice(separator + 1);
    if (!productById.has(id) || (measure !== "a" && measure !== "m") || packed.v.length === 0) {
      throw new Error(`Unknown product run ${packed.k}`);
    }
    const target = measure === "a" ? annual : monthly;
    if (target.has(id)) throw new Error(`Duplicate product run ${packed.k}`);
    const run = unpack(packed);
    target.set(id, run);
    earliest = Math.min(earliest, run.start);
    latest = Math.max(latest, run.start + run.values.length - 1);
  }
  const earliestYear = periodYear(earliest);
  const endYear = periodYear(latest);
  return {
    products, productById, annual, monthly, earliestYear, latestPeriod: latest,
    defaultRange: { startYear: Math.max(earliestYear, endYear - 3), endYear },
  };
}

function packedValue(run: ProductRun | undefined, period: number): Decimal | null {
  if (!run) return null;
  const value = run.values[period - run.start];
  return value === undefined || value === null ? null : new Decimal(value).div(run.scale);
}

export function productAnnual(index: ProductIndex, id: string, period: number): number | null {
  const value = packedValue(index.annual.get(id), period);
  return value === null ? null : value.minus(100).toNumber();
}

export function productAnnualIndex(index: ProductIndex, id: string, period: number): number | null {
  return packedValue(index.annual.get(id), period)?.toNumber() ?? null;
}

export type ProductCumulative = {
  value: number | null;
  reason: "late_start" | "missing_month" | null;
  missingPeriod: number | null;
};

export function productCumulative(index: ProductIndex, id: string, startYear: number, endPeriod: number): ProductCumulative {
  const start = makePeriod(startYear, 1);
  const run = index.monthly.get(id);
  const first = index.productById.get(id)?.firstPeriod;
  if (!run || (first && periodFromKey(first) > start) || run.start > start) {
    return { value: null, reason: "late_start", missingPeriod: run?.start ?? (first ? periodFromKey(first) : null) };
  }
  if (endPeriod < start) {
    return { value: null, reason: "missing_month", missingPeriod: Math.max(start, run.start + run.values.length) };
  }
  const left = start - run.start;
  const right = Math.min(endPeriod - run.start + 1, run.values.length);
  if (run.bad[right]! > run.bad[left]!) {
    const missing = run.values.findIndex((value, offset) => offset >= left && offset < right && value === null);
    return { value: null, reason: "missing_month", missingPeriod: run.start + missing };
  }
  if (endPeriod >= run.start + run.values.length) {
    return { value: null, reason: "missing_month", missingPeriod: run.start + run.values.length };
  }
  return { value: run.prefix[right]!.div(run.prefix[left]!).minus(1).mul(100).toNumber(), reason: null, missingPeriod: null };
}

export function rankProducts(index: ProductIndex): string[] {
  return index.products.map((item) => item.productId).sort((a, b) => {
    const left = productAnnual(index, a, index.latestPeriod);
    const right = productAnnual(index, b, index.latestPeriod);
    if (left === null) return right === null ? a.localeCompare(b) : 1;
    if (right === null) return -1;
    return right - left || a.localeCompare(b);
  });
}

export function productColor(id: string): string {
  const ordinal = Number(id.split(".").at(-1)?.slice(1));
  if (!Number.isInteger(ordinal) || ordinal < 1) throw new Error(`Invalid product colour ID ${id}`);
  return EDITORIAL_PALETTE[(ordinal - 1) % EDITORIAL_PALETTE.length]!;
}

import Decimal from "decimal.js";
import { periodFromKey, periodKey } from "./periods";
import { buildProductIdentityAudit, type ProductCatalogueRow, type ProductDecisionRow } from "./productIdentity";
import type { PairedProductRow, ProductFactRow, ProductSourceCell } from "./productTypes";

export type ProductValidationReport = {
  factCount: number;
  publishedCells: number;
  unavailableCells: number;
  arithmeticChecked: number;
  arithmeticPriorYearChecked: number;
  arithmeticUncomparable: number;
  maxArithmeticError: number;
  gapCount: number;
};

export function validateProductIndices(facts: ProductFactRow[], priorYearMonthly?: ReadonlyMap<string, string>): ProductValidationReport {
  const seen = new Set<string>();
  const monthly = new Map<string, ProductFactRow>();
  const yearOnYear: ProductFactRow[] = [];
  const coverage = new Map<string, number[]>();
  let publishedCells = 0;
  let unavailableCells = 0;
  for (const fact of facts) {
    const key = `${fact.productId}:${fact.measure}:${fact.period}`;
    if (seen.has(key)) throw new Error(`Duplicate product fact ${key}`);
    seen.add(key);
    if (!fact.sourceId || !fact.sourceLocator || !fact.lastReviewedAt) throw new Error(`Product fact lacks source provenance: ${key}`);
    const month = periodFromKey(fact.period);
    const series = `${fact.productId}:${fact.measure}`;
    const periods = coverage.get(series) ?? [];
    periods.push(month);
    coverage.set(series, periods);
    if (fact.index100 === null) {
      if (fact.availability !== "not_published") throw new Error(`Product missing index has wrong availability: ${key}`);
      unavailableCells += 1;
    } else {
      if (fact.availability !== "published") throw new Error(`Product published index has wrong availability: ${key}`);
      const value = new Decimal(fact.index100);
      if (!value.isFinite() || value.lte(0)) throw new Error(`Product index must be finite and positive: ${key}`);
      publishedCells += 1;
    }
    if (fact.measure === "mom_index_100") monthly.set(`${fact.productId}:${fact.period}`, fact);
    else if (fact.measure === "yoy_index_100") yearOnYear.push(fact);
    else throw new Error(`Unknown product measure: ${key}`);
  }
  let arithmeticChecked = 0;
  let arithmeticPriorYearChecked = 0;
  let arithmeticUncomparable = 0;
  let maxArithmeticError = 0;
  for (const annual of yearOnYear) {
    if (annual.index100 === null) continue;
    const end = periodFromKey(annual.period);
    let compounded = new Decimal(100);
    let comparable = true;
    let usedPriorYear = false;
    for (let period = end - 11; period <= end; period += 1) {
      const key = `${annual.productId}:${periodKey(period)}`;
      const canonical = monthly.get(key);
      const value = canonical?.index100 ?? priorYearMonthly?.get(key);
      if (!value) {
        comparable = false;
        break;
      }
      if (!canonical) usedPriorYear = true;
      compounded = compounded.mul(new Decimal(value).div(100));
    }
    if (!comparable) {
      arithmeticUncomparable += 1;
      continue;
    }
    const error = compounded.minus(annual.index100).abs().toNumber();
    if (error > 0.002) throw new Error(`Product annual index disagrees with twelve monthly indices: ${annual.productId} ${annual.period}, error ${error}`);
    arithmeticChecked += 1;
    if (usedPriorYear) arithmeticPriorYearChecked += 1;
    maxArithmeticError = Math.max(maxArithmeticError, error);
  }
  let gapCount = 0;
  for (const periods of coverage.values()) {
    periods.sort((a, b) => a - b);
    for (let index = 1; index < periods.length; index += 1) gapCount += periods[index]! - periods[index - 1]! - 1;
  }
  return { factCount: facts.length, publishedCells, unavailableCells, arithmeticChecked, arithmeticPriorYearChecked,
    arithmeticUncomparable, maxArithmeticError, gapCount };
}

export function findProductRevisions(previousFacts: ProductFactRow[], previousCatalogue: ProductCatalogueRow[], currentSource: PairedProductRow[], decisions: ProductDecisionRow[]): string[] {
  const issues: string[] = [];
  if (currentSource.length === 0) return ["Product source has no rows"];
  const latestYear = Math.max(...currentSource.map((row) => row.year));
  const latest = currentSource.filter((row) => row.year === latestYear);
  const rosterKey = (row: Pick<PairedProductRow, "coicopCode" | "labelEn" | "labelKa">) => `${row.coicopCode}:${row.labelEn}:${row.labelKa}`;
  const oldKeys = new Set(previousCatalogue.map(rosterKey));
  const newKeys = new Set(latest.map(rosterKey));
  for (const row of previousCatalogue) if (!newKeys.has(rosterKey(row))) issues.push(`Latest basket removed or renamed ${row.productId} ${row.labelEn}`);
  for (const row of latest) if (!oldKeys.has(rosterKey(row))) issues.push(`Latest basket added or renamed ${row.labelEn}`);

  const sourceCells = new Map<string, ProductSourceCell>();
  for (const row of currentSource) {
    for (const cell of row.momCells) sourceCells.set(`mom_index_100:${cell.locator}`, cell);
    for (const cell of row.yoyCells) sourceCells.set(`yoy_index_100:${cell.locator}`, cell);
  }
  for (const fact of previousFacts) {
    const cell = sourceCells.get(`${fact.measure}:${fact.sourceLocator}`);
    if (!cell) {
      issues.push(`Missing source cell for ${fact.productId} ${fact.measure} ${fact.period} at ${fact.sourceLocator}`);
      continue;
    }
    if ((cell.index100 === null) !== (fact.index100 === null)) {
      issues.push(`Availability changed at ${fact.period} for ${fact.productId} ${fact.measure}: ${fact.availability} -> ${cell.index100 === null ? "not_published" : "published"}`);
    } else if (cell.index100 !== fact.index100) {
      issues.push(`Value changed at ${fact.period} for ${fact.productId} ${fact.measure}: ${fact.index100} -> ${cell.index100}`);
    }
  }
  try {
    const resolved = buildProductIdentityAudit(currentSource, previousCatalogue, decisions);
    if (resolved.unresolvedTransitions.length > 0) issues.push(`Identity has ${resolved.unresolvedTransitions.length} unreviewed transition(s)`);
    for (const prior of previousCatalogue) {
      const current = resolved.catalogue.find((item) => item.productId === prior.productId);
      if (current && (current.firstPeriod !== prior.firstPeriod || current.decisionRef !== prior.decisionRef)) {
        issues.push(`Identity changed for ${prior.productId}: ${prior.firstPeriod}/${prior.decisionRef} -> ${current.firstPeriod}/${current.decisionRef}`);
      }
    }
  } catch (error) {
    issues.push(`Identity mapping changed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return issues;
}

export function findProductOutputRevisions(previousCatalogue: ProductCatalogueRow[], currentCatalogue: ProductCatalogueRow[], previousFacts: ProductFactRow[], currentFacts: ProductFactRow[]): string[] {
  const issues: string[] = [];
  const currentById = new Map(currentCatalogue.map((row) => [row.productId, row]));
  const previousIds = new Set(previousCatalogue.map((row) => row.productId));
  for (const previous of previousCatalogue) {
    const current = currentById.get(previous.productId);
    if (!current) {
      issues.push(`Product identity removed: ${previous.productId}`);
    } else if (current.coicopCode !== previous.coicopCode || current.labelEn !== previous.labelEn ||
        current.labelKa !== previous.labelKa || current.firstPeriod !== previous.firstPeriod || current.decisionRef !== previous.decisionRef) {
      issues.push(`Product identity changed for ${previous.productId}: ${previous.labelEn} -> ${current.labelEn}`);
    }
  }
  for (const current of currentCatalogue) if (!previousIds.has(current.productId)) issues.push(`Product identity added: ${current.productId}`);

  const currentByKey = new Map(currentFacts.map((fact) => [`${fact.productId}:${fact.measure}:${fact.period}`, fact]));
  for (const previous of previousFacts) {
    const key = `${previous.productId}:${previous.measure}:${previous.period}`;
    const current = currentByKey.get(key);
    if (!current) {
      issues.push(`Product historical fact removed: ${key}`);
    } else if (current.sourceId !== previous.sourceId || current.sourceLocator !== previous.sourceLocator) {
      issues.push(`Product source assignment changed for ${key}: ${previous.sourceLocator} -> ${current.sourceLocator}`);
    } else if (current.index100 !== previous.index100 || current.availability !== previous.availability) {
      issues.push(`Product historical fact changed for ${key}: ${previous.index100 ?? "missing"} -> ${current.index100 ?? "missing"}`);
    }
  }
  return issues;
}

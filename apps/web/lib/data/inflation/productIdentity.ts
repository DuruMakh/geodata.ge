import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { serializeBomCsv } from "../csvEscape";
import type { PairedProductRow } from "./productTypes";

export type ProductCatalogueRow = {
  productId: string;
  coicopCode: string;
  labelEn: string;
  labelKa: string;
  firstPeriod: string;
  decisionRef: string;
};

export type ProductDecisionRow = {
  decisionId: string;
  productId: string;
  boundaryYear: number;
  currentOrdinal: number;
  currentCoicopCode: string;
  currentLabelEn: string;
  currentLabelKa: string;
  decision: "link" | "split";
  previousYear: number;
  previousOrdinal: number | null;
  previousCoicopCode: string | null;
  previousLabelEn: string | null;
  previousLabelKa: string | null;
  reason: string;
  reviewedAt: string;
};

export type ProductIdentityCandidate = { row: PairedProductRow; clues: string[] };
export type ProductIdentityTransition = {
  productId: string;
  later: PairedProductRow;
  earlierYear: number;
  candidates: ProductIdentityCandidate[];
  reviewStatus: "unresolved" | "linked" | "split";
};
export type ProductIdentityAudit = {
  latestPeriod: string;
  catalogue: ProductCatalogueRow[];
  assignments: { productId: string; row: PairedProductRow }[];
  transitions: ProductIdentityTransition[];
  unresolvedTransitions: ProductIdentityTransition[];
  unassignedSourceRows: PairedProductRow[];
};

function normalized(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function loadProductDecisions(file = path.resolve(process.cwd(), "../../data/mappings/inflation-products/decisions.csv")): Promise<ProductDecisionRow[]> {
  const content = await fs.readFile(file, "utf8");
  const records = parse(content, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const required = ["decision_id", "product_id", "boundary_year", "current_ordinal", "current_coicop_code", "current_label_en", "current_label_ka",
    "decision", "previous_year", "previous_ordinal", "previous_coicop_code", "previous_label_en", "previous_label_ka", "reason", "reviewed_at"];
  return records.map((record, index) => {
    if (Object.keys(record).join(",") !== required.join(",")) throw new Error(`Product decision row ${index + 1} has changed columns`);
    const integer = (value: string, label: string) => {
      const number = Number(value);
      if (!Number.isInteger(number) || number <= 0) throw new Error(`Product decision row ${index + 1} has invalid ${label}`);
      return number;
    };
    if (record.decision !== "link" && record.decision !== "split") throw new Error(`Product decision row ${index + 1} has invalid action`);
    if (!record.reason?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(record.reviewed_at)) throw new Error(`Product decision row ${index + 1} lacks review evidence`);
    return {
      decisionId: record.decision_id!, productId: record.product_id!, boundaryYear: integer(record.boundary_year!, "boundary year"),
      currentOrdinal: integer(record.current_ordinal!, "current ordinal"), currentCoicopCode: record.current_coicop_code!,
      currentLabelEn: record.current_label_en!, currentLabelKa: record.current_label_ka!, decision: record.decision,
      previousYear: integer(record.previous_year!, "previous year"),
      previousOrdinal: record.previous_ordinal ? integer(record.previous_ordinal, "previous ordinal") : null,
      previousCoicopCode: record.previous_coicop_code || null, previousLabelEn: record.previous_label_en || null,
      previousLabelKa: record.previous_label_ka || null, reason: record.reason, reviewedAt: record.reviewed_at!,
    };
  });
}

function identityKey(row: Pick<PairedProductRow, "coicopCode" | "labelEn" | "labelKa">): string {
  return `${row.coicopCode}|${normalized(row.labelEn)}|${normalized(row.labelKa)}`;
}

function latestRows(rows: PairedProductRow[]): PairedProductRow[] {
  if (rows.length === 0) throw new Error("Product identity audit has no source rows");
  const latestYear = Math.max(...rows.map((row) => row.year));
  return rows.filter((row) => row.year === latestYear).sort((a, b) => a.ordinal - b.ordinal);
}

/** Seed opaque IDs once from the current roster; later runs must load the committed catalogue. */
export function seedProductCatalogue(rows: PairedProductRow[]): ProductCatalogueRow[] {
  return latestRows(rows).map((row, index) => ({
    productId: `cpi.product.p${String(index + 1).padStart(4, "0")}`,
    coicopCode: row.coicopCode,
    labelEn: row.labelEn,
    labelKa: row.labelKa,
    firstPeriod: row.momCells[0]!.period,
    decisionRef: "pending-audit",
  }));
}

function candidateRows(later: PairedProductRow, earlier: PairedProductRow[], allLater: PairedProductRow[]): ProductIdentityCandidate[] {
  const laterKeys = new Set(allLater.map(identityKey));
  return earlier
    .filter((row) => !laterKeys.has(identityKey(row)))
    .map((row) => {
      const clues = [
        row.coicopCode === later.coicopCode ? "same COICOP group" : null,
        normalized(row.labelEn) === normalized(later.labelEn) ? "same English name" : null,
        normalized(row.labelKa) === normalized(later.labelKa) ? "same Georgian name" : null,
        row.ordinal === later.ordinal ? "same sheet row number" : null,
      ].filter((clue): clue is string => clue !== null);
      return { row, clues };
    })
    .filter((candidate) => candidate.clues.length > 0)
    .sort((a, b) => {
      const score = (item: ProductIdentityCandidate) =>
        Number(item.clues.includes("same English name")) * 4 + Number(item.clues.includes("same Georgian name")) * 4 +
        Number(item.clues.includes("same COICOP group")) * 2 + Number(item.clues.includes("same sheet row number"));
      return score(b) - score(a) || a.row.ordinal - b.row.ordinal;
    });
}

export function buildProductIdentityAudit(rows: PairedProductRow[], catalogue: ProductCatalogueRow[], decisions: ProductDecisionRow[]): ProductIdentityAudit {
  const decisionByBoundary = new Map<string, ProductDecisionRow>();
  const decisionIds = new Set<string>();
  for (const decision of decisions) {
    const key = `${decision.productId}:${decision.boundaryYear}`;
    if (decisionByBoundary.has(key) || decisionIds.has(decision.decisionId)) throw new Error(`Duplicate decision for ${key}`);
    decisionByBoundary.set(key, decision);
    decisionIds.add(decision.decisionId);
  }
  const current = latestRows(rows);
  const latestPeriod = current[0]!.momCells.at(-1)?.period;
  if (!latestPeriod || current.some((row) => row.momCells.at(-1)?.period !== latestPeriod)) throw new Error("Latest product roster ends in different months");
  if (catalogue.length !== current.length) throw new Error("Product catalogue does not match the latest roster count");
  if (new Set(catalogue.map((item) => item.productId)).size !== catalogue.length ||
      catalogue.some((item) => !/^cpi\.product\.p\d{4,}$/.test(item.productId))) {
    throw new Error("Product catalogue has duplicate or invalid stable IDs");
  }
  const currentByKey = new Map(current.map((row) => [identityKey(row), row]));
  if (currentByKey.size !== current.length) throw new Error("Latest product roster has duplicate group/name identities");
  const catalogueKeys = new Set<string>();
  for (const item of catalogue) {
    const key = identityKey(item);
    const source = currentByKey.get(key);
    if (!source || source.coicopCode !== item.coicopCode || source.labelEn !== item.labelEn || source.labelKa !== item.labelKa || catalogueKeys.has(key)) {
      throw new Error(`Product catalogue does not match the latest roster: ${item.productId}`);
    }
    catalogueKeys.add(key);
  }

  const byYear = new Map<number, PairedProductRow[]>();
  for (const row of rows) {
    const group = byYear.get(row.year) ?? [];
    group.push(row);
    byYear.set(row.year, group);
  }
  const assignments: ProductIdentityAudit["assignments"] = [];
  const transitions: ProductIdentityTransition[] = [];
  const safeCatalogue: ProductCatalogueRow[] = [];
  const usedDecisions = new Set<string>();
  for (const item of catalogue) {
    let row = currentByKey.get(identityKey(item))!;
    let firstPeriod = row.momCells[0]!.period;
    let pendingYear: number | null = null;
    const reviewedRefs: string[] = [];
    for (;;) {
      assignments.push({ productId: item.productId, row });
      firstPeriod = row.momCells[0]!.period;
      if (row.year <= 2015) break;
      const earlier = byYear.get(row.year - 1) ?? [];
      const exact = earlier.filter((candidate) => identityKey(candidate) === identityKey(row));
      if (exact.length > 1) throw new Error(`Duplicate exact product identity in ${row.year - 1}: ${row.labelEn}`);
      if (exact.length === 1) {
        row = exact[0]!;
        continue;
      }
      const decisionKey = `${item.productId}:${row.year}`;
      const decision = decisionByBoundary.get(decisionKey);
      const transition: ProductIdentityTransition = {
        productId: item.productId, later: row, earlierYear: row.year - 1,
        candidates: candidateRows(row, earlier, byYear.get(row.year) ?? []),
        reviewStatus: decision === undefined ? "unresolved" : decision.decision === "link" ? "linked" : "split",
      };
      transitions.push(transition);
      if (decision === undefined) {
        pendingYear = row.year;
        break;
      }
      if (decision.boundaryYear !== row.year || decision.previousYear !== row.year - 1 || decision.currentOrdinal !== row.ordinal ||
          decision.currentCoicopCode !== row.coicopCode || decision.currentLabelEn !== row.labelEn || decision.currentLabelKa !== row.labelKa) {
        throw new Error(`Product decision current source row changed: ${decision.decisionId}`);
      }
      usedDecisions.add(decisionKey);
      reviewedRefs.push(decision.decisionId);
      let predecessor: PairedProductRow | undefined;
      if (decision.previousOrdinal !== null) {
        predecessor = earlier.find((candidate) => candidate.ordinal === decision.previousOrdinal);
        if (!predecessor || predecessor.coicopCode !== decision.previousCoicopCode ||
            predecessor.labelEn !== decision.previousLabelEn || predecessor.labelKa !== decision.previousLabelKa) {
          throw new Error(`Product decision predecessor source row changed: ${decision.decisionId}`);
        }
      } else if (decision.previousCoicopCode !== null || decision.previousLabelEn !== null || decision.previousLabelKa !== null) {
        throw new Error(`Product decision predecessor is incomplete: ${decision.decisionId}`);
      }
      if (decision.decision === "split") break;
      if (!predecessor) throw new Error(`Product link decision has no predecessor: ${decision.decisionId}`);
      row = predecessor;
    }
    safeCatalogue.push({ ...item, firstPeriod, decisionRef: pendingYear !== null ? `pending-review-${pendingYear}` :
      reviewedRefs.length > 0 ? reviewedRefs.join(";") : "exact-bilingual-through-2015" });
  }
  if (usedDecisions.size !== decisions.length) throw new Error(`Stale product decision: ${decisions.find((decision) => !usedDecisions.has(`${decision.productId}:${decision.boundaryYear}`))?.decisionId}`);
  assignments.sort((a, b) => a.row.year - b.row.year || a.row.ordinal - b.row.ordinal);
  transitions.sort((a, b) => a.later.year - b.later.year || a.later.ordinal - b.later.ordinal);
  const owners = new Map<string, string>();
  for (const assignment of assignments) {
    const key = `${assignment.row.year}:${assignment.row.ordinal}`;
    const previous = owners.get(key);
    if (previous && previous !== assignment.productId) throw new Error(`Product source row assigned to multiple products: ${key} (${previous}, ${assignment.productId})`);
    owners.set(key, assignment.productId);
  }
  const assignedRows = new Set(assignments.map(({ row }) => `${row.year}:${row.ordinal}`));
  return {
    latestPeriod,
    catalogue: safeCatalogue,
    assignments,
    transitions,
    unresolvedTransitions: transitions.filter((transition) => transition.reviewStatus === "unresolved"),
    unassignedSourceRows: rows.filter((row) => !assignedRows.has(`${row.year}:${row.ordinal}`)),
  };
}

export function serializeCandidateCatalogue(catalogue: ProductCatalogueRow[]): string {
  return serializeBomCsv(
    ["product_id", "coicop_code", "label_en", "label_ka", "first_period", "decision_ref"],
    catalogue.map((item) => ({
      product_id: item.productId, coicop_code: item.coicopCode, label_en: item.labelEn,
      label_ka: item.labelKa, first_period: item.firstPeriod, decision_ref: item.decisionRef,
    })),
  );
}

export function serializeIdentityReview(audit: ProductIdentityAudit): string {
  const clueType = (candidate: ProductIdentityCandidate | null): string => {
    if (candidate === null) return "no_candidate";
    if (candidate.clues.includes("same English name") || candidate.clues.includes("same Georgian name")) return "one_language_same";
    if (candidate.clues.includes("same sheet row number")) return "same_row_only";
    return "same_group_only";
  };
  const records = audit.transitions.flatMap((transition) => {
    const candidates = transition.candidates.length > 0 ? transition.candidates : [null];
    return candidates.map((candidate) => ({
      product_id: transition.productId,
      boundary_year: transition.later.year,
      current_source_cell: transition.later.momCells[0]!.locator,
      current_group: transition.later.coicopCode,
      current_label_en: transition.later.labelEn,
      current_label_ka: transition.later.labelKa,
      previous_year: transition.earlierYear,
      candidate_source_cell: candidate?.row.momCells[0]?.locator ?? "",
      candidate_group: candidate?.row.coicopCode ?? "",
      candidate_label_en: candidate?.row.labelEn ?? "",
      candidate_label_ka: candidate?.row.labelKa ?? "",
      clues: candidate?.clues.join("; ") ?? "no candidate with a shared group, label or row number",
      clue_type: clueType(candidate),
      review_status: transition.reviewStatus,
    }));
  });
  return serializeBomCsv(
    ["product_id", "boundary_year", "current_source_cell", "current_group", "current_label_en", "current_label_ka",
      "previous_year", "candidate_source_cell", "candidate_group", "candidate_label_en", "candidate_label_ka", "clues", "clue_type", "review_status"],
    records,
  );
}

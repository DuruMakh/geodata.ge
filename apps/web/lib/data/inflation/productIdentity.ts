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
  year: number;
  ordinal: number;
  coicopCode: string;
  labelEn: string;
  labelKa: string;
  productId: string;
  decision: "link" | "split";
  reason: string;
};

export type ProductIdentityCandidate = { row: PairedProductRow; clues: string[] };
export type ProductIdentityTransition = {
  productId: string;
  later: PairedProductRow;
  earlierYear: number;
  candidates: ProductIdentityCandidate[];
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
  if (decisions.length > 0) throw new Error("Identity decisions cannot be applied before the reviewed resolution stage");
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
  for (const item of catalogue) {
    let row = currentByKey.get(identityKey(item))!;
    let firstPeriod = row.momCells[0]!.period;
    let pendingYear: number | null = null;
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
      transitions.push({ productId: item.productId, later: row, earlierYear: row.year - 1, candidates: candidateRows(row, earlier, byYear.get(row.year) ?? []) });
      pendingYear = row.year;
      break;
    }
    safeCatalogue.push({ ...item, firstPeriod, decisionRef: pendingYear === null ? "exact-bilingual-through-2015" : `pending-review-${pendingYear}` });
  }
  assignments.sort((a, b) => a.row.year - b.row.year || a.row.ordinal - b.row.ordinal);
  transitions.sort((a, b) => a.later.year - b.later.year || a.later.ordinal - b.later.ordinal);
  const assignedRows = new Set(assignments.map(({ row }) => `${row.year}:${row.ordinal}`));
  return {
    latestPeriod,
    catalogue: safeCatalogue,
    assignments,
    transitions,
    unresolvedTransitions: transitions,
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
      review_status: "unresolved",
    }));
  });
  return serializeBomCsv(
    ["product_id", "boundary_year", "current_source_cell", "current_group", "current_label_en", "current_label_ka",
      "previous_year", "candidate_source_cell", "candidate_group", "candidate_label_en", "candidate_label_ka", "clues", "clue_type", "review_status"],
    records,
  );
}

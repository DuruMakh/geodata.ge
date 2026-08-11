import { parse } from "csv-parse/sync";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { METHODOLOGY_CONTENT } from "./catalog";
import {
  LIVE_METHODOLOGY_IDS,
  type DecisionCoverageResult,
  type DecisionRegisterRow,
  type MethodologyDatasetId,
} from "./types";

type DecisionRegisterCsvRow = {
  canonical_decision_id: string;
  dataset_id: string;
  canonical_document: string;
  canonical_heading: string;
  public_decision_id: string;
  classification: string;
  reviewed_at: string;
};

const liveIds = new Set<string>(LIVE_METHODOLOGY_IDS);
const classifications = new Set<DecisionRegisterRow["classification"]>([
  "official_fact",
  "geodata_decision",
  "limitation",
]);

function repositoryRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

function parseDecisionRegister(content: string): DecisionRegisterRow[] {
  const rows = parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as DecisionRegisterCsvRow[];

  return rows.map((row, index) => {
    const line = index + 2;
    if (
      !row.canonical_decision_id ||
      !row.dataset_id ||
      !row.canonical_document ||
      !row.canonical_heading ||
      !row.public_decision_id ||
      !row.classification ||
      !row.reviewed_at
    ) {
      throw new Error(`Decision register row ${line} has a missing required field`);
    }
    if (!liveIds.has(row.dataset_id)) {
      throw new Error(`Decision register row ${line} has unknown dataset id: ${row.dataset_id}`);
    }
    if (!classifications.has(row.classification as DecisionRegisterRow["classification"])) {
      throw new Error(`Decision register row ${line} has unknown classification: ${row.classification}`);
    }

    return {
      canonicalDecisionId: row.canonical_decision_id,
      datasetId: row.dataset_id as MethodologyDatasetId,
      canonicalDocument: row.canonical_document,
      canonicalHeading: row.canonical_heading,
      publicDecisionId: row.public_decision_id,
      classification: row.classification as DecisionRegisterRow["classification"],
      reviewedAt: row.reviewed_at,
    };
  });
}

async function loadDecisionRegister(): Promise<DecisionRegisterRow[]> {
  const registerPath = path.join(repositoryRoot(), "data", "methodology", "decision-register.csv");
  return parseDecisionRegister(await readFile(registerPath, "utf8"));
}

function markdownHeadings(content: string): Set<string> {
  return new Set(
    content
      .split(/\r?\n/u)
      .filter((line) => /^#{1,6}\s+/u.test(line))
      .map((line) => line.replace(/^#{1,6}\s+/u, "").trim()),
  );
}

export async function validateDecisionCoverage(
  rowsOverride?: readonly DecisionRegisterRow[],
): Promise<DecisionCoverageResult> {
  const rows = rowsOverride ? [...rowsOverride] : await loadDecisionRegister();
  const seenCanonicalIds = new Set<string>();

  for (const row of rows) {
    if (seenCanonicalIds.has(row.canonicalDecisionId)) {
      throw new Error(`Duplicate canonical decision id: ${row.canonicalDecisionId}`);
    }
    seenCanonicalIds.add(row.canonicalDecisionId);
  }

  const publicDecisions = new Map<
    string,
    { datasetId: MethodologyDatasetId; canonicalDecisionIds: readonly string[] }
  >();
  for (const datasetId of LIVE_METHODOLOGY_IDS) {
    const content = METHODOLOGY_CONTENT[datasetId];
    for (const item of [...content.decisions, ...content.technicalAppendix]) {
      if (publicDecisions.has(item.id)) {
        throw new Error(`Duplicate public decision id: ${item.id}`);
      }
      publicDecisions.set(item.id, { datasetId, canonicalDecisionIds: item.canonicalDecisionIds });
    }
  }

  const headingsByDocument = new Map<string, Set<string>>();
  const unknownPublicIds: string[] = [];
  const uncovered: string[] = [];

  for (const row of rows) {
    const canonicalPath = path.resolve(repositoryRoot(), row.canonicalDocument);
    try {
      await access(canonicalPath);
    } catch {
      throw new Error(`Canonical document does not exist: ${row.canonicalDocument}`);
    }

    let headings = headingsByDocument.get(row.canonicalDocument);
    if (!headings) {
      headings = markdownHeadings(await readFile(canonicalPath, "utf8"));
      headingsByDocument.set(row.canonicalDocument, headings);
    }
    if (!headings.has(row.canonicalHeading)) {
      throw new Error(
        `Canonical heading does not exist in ${row.canonicalDocument}: ${row.canonicalHeading}`,
      );
    }

    const publicDecision = publicDecisions.get(row.publicDecisionId);
    if (!publicDecision) {
      unknownPublicIds.push(row.publicDecisionId);
      continue;
    }
    if (publicDecision.datasetId !== row.datasetId) {
      throw new Error(
        `Dataset mismatch for ${row.canonicalDecisionId}: register=${row.datasetId}, public=${publicDecision.datasetId}`,
      );
    }
    if (!publicDecision.canonicalDecisionIds.includes(row.canonicalDecisionId)) {
      uncovered.push(row.canonicalDecisionId);
    }
  }

  for (const [publicDecisionId, publicDecision] of publicDecisions) {
    for (const canonicalDecisionId of publicDecision.canonicalDecisionIds) {
      const matchingRow = rows.find(
        (row) =>
          row.canonicalDecisionId === canonicalDecisionId &&
          row.publicDecisionId === publicDecisionId &&
          row.datasetId === publicDecision.datasetId,
      );
      if (!matchingRow) uncovered.push(canonicalDecisionId);
    }
  }

  const uniqueUnknownPublicIds = Array.from(new Set(unknownPublicIds)).sort();
  const uniqueUncovered = Array.from(new Set(uncovered)).sort();
  if (uniqueUnknownPublicIds.length > 0) {
    throw new Error(`Unknown public decision id: ${uniqueUnknownPublicIds.join(", ")}`);
  }
  if (uniqueUncovered.length > 0) {
    throw new Error(`Uncovered canonical decision: ${uniqueUncovered.join(", ")}`);
  }

  const result = {
    canonicalDecisionCount: rows.length,
    uncovered: [],
    unknownPublicIds: [],
  } as Omit<DecisionCoverageResult, "publicMappingCount">;

  // Keep the comparison count available to callers without duplicating it in
  // serialized validation reports, where canonicalDecisionCount is the
  // authoritative total.
  Object.defineProperty(result, "publicMappingCount", {
    value: rows.length,
    enumerable: false,
  });

  return result as DecisionCoverageResult;
}

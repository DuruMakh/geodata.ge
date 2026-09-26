import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { serializeBomCsv } from "../csvEscape";
import { buildProductIdentityAudit, loadProductDecisions, type ProductCatalogueRow } from "./productIdentity";
import { INFLATION_PRODUCTS_RAW_ROOT, latestProductVintage, readVerifiedProductFiles } from "./productSourceFiles";
import { pairProductEditions } from "./readGeostatProducts";
import type { ProductFactRow, ProductMeasure, ProductSourceCell } from "./productTypes";
import { findProductRevisions, validateProductIndices } from "./validateProducts";

const CATALOGUE_FILE = path.resolve(process.cwd(), "../../data/mappings/inflation-products/catalogue.csv");

export async function loadProductCatalogue(file = CATALOGUE_FILE): Promise<ProductCatalogueRow[]> {
  const content = await fs.readFile(file, "utf8");
  const records = parse(content, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return records.map((record) => ({
    productId: record.product_id!, coicopCode: record.coicop_code!, labelEn: record.label_en!, labelKa: record.label_ka!,
    firstPeriod: record.first_period!, decisionRef: record.decision_ref!,
  }));
}

export function serializeProductCatalogue(catalogue: ProductCatalogueRow[]): string {
  return serializeBomCsv(
    ["product_id", "coicop_code", "label_en", "label_ka", "first_period", "decision_ref"],
    catalogue.map((row) => ({
      product_id: row.productId, coicop_code: row.coicopCode, label_en: row.labelEn,
      label_ka: row.labelKa, first_period: row.firstPeriod, decision_ref: row.decisionRef,
    })),
  );
}

export function serializeProductFacts(facts: ProductFactRow[]): string {
  return serializeBomCsv(
    ["product_id", "measure", "period", "index_100", "availability", "source_id", "source_locator", "last_reviewed_at"],
    facts.map((row) => ({
      product_id: row.productId, measure: row.measure, period: row.period, index_100: row.index100,
      availability: row.availability, source_id: row.sourceId, source_locator: row.sourceLocator, last_reviewed_at: row.lastReviewedAt,
    })),
  );
}

export async function prepareProducts(options: { rawRoot?: string; previousFacts?: ProductFactRow[] | null } = {}) {
  const rawRoot = options.rawRoot ?? INFLATION_PRODUCTS_RAW_ROOT;
  const vintage = await latestProductVintage(rawRoot);
  const files = await readVerifiedProductFiles(path.join(rawRoot, vintage));
  const rows = pairProductEditions(files);
  const catalogue = await loadProductCatalogue();
  const decisions = await loadProductDecisions();
  if (options.previousFacts !== null && options.previousFacts !== undefined) {
    const revisions = findProductRevisions(options.previousFacts, catalogue, rows, decisions);
    if (revisions.length > 0) throw new Error(`Product historical revision requires review:\n${revisions.slice(0, 20).join("\n")}${revisions.length > 20 ? `\n... and ${revisions.length - 20} more` : ""}`);
  }
  const audit = buildProductIdentityAudit(rows, catalogue, decisions);
  if (audit.unresolvedTransitions.length > 0) {
    throw new Error(`Unreviewed product identity transitions: ${audit.unresolvedTransitions.map((item) => `${item.productId} ${item.later.year}`).join(", ")}`);
  }
  const reviewedAt = decisions.map((row) => row.reviewedAt).sort().at(-1)!;
  const sourceIds = {
    mom_index_100: files.find((file) => file.language === "en" && file.file_role === "mom")!.source_id,
    yoy_index_100: files.find((file) => file.language === "en" && file.file_role === "yoy")!.source_id,
  };
  const facts: ProductFactRow[] = [];
  for (const { productId, row } of audit.assignments) {
    for (const [measure, cells] of [["mom_index_100", row.momCells], ["yoy_index_100", row.yoyCells]] as [ProductMeasure, ProductSourceCell[]][]) {
      for (const cell of cells) {
        if (cell.period < "2015-01") continue;
        facts.push({ productId, measure, period: cell.period, index100: cell.index100,
          availability: cell.index100 === null ? "not_published" : "published", sourceId: sourceIds[measure],
          sourceLocator: cell.locator, lastReviewedAt: reviewedAt });
      }
    }
  }
  facts.sort((a, b) => a.productId.localeCompare(b.productId) || a.measure.localeCompare(b.measure) || a.period.localeCompare(b.period));
  const indexValidation = validateProductIndices(facts);
  return { catalogue: audit.catalogue, facts, validation: {
    latestPeriod: audit.latestPeriod, includedProducts: audit.catalogue.length,
    reviewedLinks: decisions.filter((row) => row.decision === "link").length,
    reviewedSplits: decisions.filter((row) => row.decision === "split").length,
    sourceRowsOutsideCurrentTrace: audit.unassignedSourceRows.length,
    ...indexValidation,
  } };
}

import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { serializeBomCsv } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { buildProductIdentityAudit, loadProductDecisions, type ProductCatalogueRow } from "./productIdentity";
import { INFLATION_PRODUCTS_RAW_ROOT, latestProductVintage, readVerifiedProductFiles } from "./productSourceFiles";
import { pairProductEditions } from "./readGeostatProducts";
import type { ProductFactRow, ProductMeasure, ProductSourceCell } from "./productTypes";
import { findProductOutputRevisions, findProductRevisions, validateProductIndices } from "./validateProducts";

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

export async function prepareProducts(options: { rawRoot?: string; previousFacts?: ProductFactRow[] | null; previousCatalogue?: ProductCatalogueRow[] | null } = {}) {
  const rawRoot = options.rawRoot ?? INFLATION_PRODUCTS_RAW_ROOT;
  const vintage = await latestProductVintage(rawRoot);
  const files = await readVerifiedProductFiles(path.join(rawRoot, vintage));
  const rows = pairProductEditions(files);
  const catalogue = await loadProductCatalogue();
  const decisions = await loadProductDecisions();
  if (options.previousFacts !== null && options.previousFacts !== undefined) {
    const revisions = findProductRevisions(options.previousFacts, options.previousCatalogue ?? catalogue, rows, decisions);
    if (revisions.length > 0) throw new Error(`Product historical revision requires review:\n${revisions.slice(0, 20).join("\n")}${revisions.length > 20 ? `\n... and ${revisions.length - 20} more` : ""}`);
  }
  const audit = buildProductIdentityAudit(rows, catalogue, decisions);
  if (audit.unresolvedTransitions.length > 0) {
    throw new Error(`Unreviewed product identity transitions: ${audit.unresolvedTransitions.map((item) => `${item.productId} ${item.later.year}`).join(", ")}`);
  }
  // The public series starts in 2015. Only exact group and bilingual-name
  // matches may supply the archived 2014 months needed to audit 2015 annual indices.
  const sourceKey = (row: { coicopCode: string; labelEn: string; labelKa: string }) =>
    `${row.coicopCode}:${row.labelEn.trim().replace(/\s+/g, " ").toLocaleLowerCase()}:${row.labelKa.trim().replace(/\s+/g, " ").toLocaleLowerCase()}`;
  const rows2014 = new Map<string, typeof rows[number]>();
  for (const row of rows.filter((item) => item.year === 2014)) {
    const key = sourceKey(row);
    if (rows2014.has(key)) throw new Error(`Duplicate 2014 product identity: ${key}`);
    rows2014.set(key, row);
  }
  const priorYearMonthly = new Map<string, string>();
  for (const { productId, row } of audit.assignments.filter((item) => item.row.year === 2015)) {
    const previous = rows2014.get(sourceKey(row));
    if (!previous) continue;
    for (const cell of previous.momCells) {
      if (cell.index100 !== null) priorYearMonthly.set(`${productId}:${cell.period}`, cell.index100);
    }
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
  const indexValidation = validateProductIndices(facts, priorYearMonthly);
  if (options.previousFacts !== null && options.previousFacts !== undefined) {
    const revisions = findProductOutputRevisions(options.previousCatalogue ?? catalogue, audit.catalogue, options.previousFacts, facts);
    if (revisions.length > 0) throw new Error(`Product canonical output requires review:\n${revisions.slice(0, 20).join("\n")}${revisions.length > 20 ? `\n... and ${revisions.length - 20} more` : ""}`);
  }
  const rosterByYear: Record<string, number> = {};
  for (const row of rows) rosterByYear[row.year] = (rosterByYear[row.year] ?? 0) + 1;
  return { catalogue: audit.catalogue, facts, validation: {
    latestPeriod: audit.latestPeriod, includedProducts: audit.catalogue.length,
    sourceRowsRead: rows.length, rosterByYear, languageParity: "PASS",
    sourceHashes: Object.fromEntries(files.map((file) => [file.local_file, file.sha256])),
    reviewedLinks: decisions.filter((row) => row.decision === "link").length,
    reviewedSplits: decisions.filter((row) => row.decision === "split").length,
    sourceRowsOutsideCurrentTrace: audit.unassignedSourceRows.length,
    excludedSourceRowsSince2015: audit.unassignedSourceRows.filter((row) => row.year >= 2015).length,
    reviewedRevisions: [] as string[],
    ...indexValidation,
  } };
}

async function readExisting(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeProductArtifacts(mode: "write" | "check", options: { outputRoot?: string } = {}) {
  const root = options.outputRoot ?? path.resolve(process.cwd(), "../..");
  const catalogueFile = path.join(root, "data/imports/cpi-products.csv");
  const factsFile = path.join(root, "data/imports/cpi-products-monthly.csv");
  const reportFile = path.join(root, "data/reports/inflation-products-validation.json");
  const [previousCatalogueText, previousFactsText] = await Promise.all([readExisting(catalogueFile), readExisting(factsFile)]);
  if ((previousCatalogueText === null) !== (previousFactsText === null)) throw new Error("Product canonical files are incomplete");
  const previousCatalogue = previousCatalogueText === null ? null : await loadProductCatalogue(catalogueFile);
  const previousFacts = previousFactsText === null ? null :
    (parse(previousFactsText, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[]).map((record) => ({
      productId: record.product_id!, measure: record.measure as ProductMeasure, period: record.period!,
      index100: record.index_100 || null, availability: record.availability as ProductFactRow["availability"],
      sourceId: record.source_id!, sourceLocator: record.source_locator!, lastReviewedAt: record.last_reviewed_at!,
    }));
  const prepared = await prepareProducts({ previousFacts, previousCatalogue });
  const vintage = await latestProductVintage();
  const sourceFiles = await readVerifiedProductFiles(path.join(INFLATION_PRODUCTS_RAW_ROOT, vintage));
  const registered = parse(await fs.readFile(path.resolve(process.cwd(), "../../data/sources/source-documents.csv"), "utf8"),
    { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  // Only English editions supply canonical facts. Georgian twins remain
  // registered as original methodology downloads and are verified above.
  for (const file of sourceFiles.filter((row) => row.language === "en")) {
    const expectedPath = `docs/Raw Data/Inflation/geostat-products/${vintage}/${file.local_file}`;
    const matches = registered.filter((row) => row.source_id === file.source_id && row.source_url_or_file === expectedPath);
    if (matches.length !== 1) throw new Error(`Product source ID is not registered to its archived file: ${file.source_id}`);
  }
  const outputs: Array<[string, string]> = [
    [catalogueFile, serializeProductCatalogue(prepared.catalogue)],
    [factsFile, serializeProductFacts(prepared.facts)],
    [reportFile, `${JSON.stringify(prepared.validation, null, 2)}\n`],
  ];
  for (const [file, content] of outputs) {
    if (mode === "write") {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content);
    } else {
      await assertGeneratedArtifactMatches("inflation products", file, content);
    }
  }
  return prepared.validation;
}

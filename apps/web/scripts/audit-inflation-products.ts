import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { assertGeneratedArtifactMatches } from "../lib/data/generatedArtifacts";
import { buildProductIdentityAudit, seedProductCatalogue, serializeCandidateCatalogue, serializeIdentityReview, type ProductCatalogueRow } from "../lib/data/inflation/productIdentity";
import { INFLATION_PRODUCTS_RAW_ROOT, latestProductVintage, readVerifiedProductFiles } from "../lib/data/inflation/productSourceFiles";
import { pairProductEditions } from "../lib/data/inflation/readGeostatProducts";

const ROOT = path.resolve(process.cwd(), "../..");
const CATALOGUE_FILE = path.join(ROOT, "data/mappings/inflation-products/catalogue.csv");
const REPORT_FILE = path.join(ROOT, "data/reports/inflation-products-identity-review.csv");

async function main() {
  const mode = process.argv[2];
  if (mode !== "--write" && mode !== "--check") throw new Error("Usage: tsx scripts/audit-inflation-products.ts --write|--check");
  const vintage = await latestProductVintage();
  const rows = pairProductEditions(await readVerifiedProductFiles(path.join(INFLATION_PRODUCTS_RAW_ROOT, vintage)));
  const existing = await fs.readFile(CATALOGUE_FILE, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (mode === "--check" && existing === null) throw new Error("Product candidate catalogue is missing");
  const catalogue: ProductCatalogueRow[] = existing === null ? seedProductCatalogue(rows) :
    (parse(existing, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[]).map((record) => ({
      productId: record.product_id!, coicopCode: record.coicop_code!, labelEn: record.label_en!,
      labelKa: record.label_ka!, firstPeriod: record.first_period!, decisionRef: record.decision_ref!,
    }));
  const audit = buildProductIdentityAudit(rows, catalogue, []);
  const candidateCsv = serializeCandidateCatalogue(audit.catalogue);
  const reportCsv = serializeIdentityReview(audit);
  if (existing !== null && candidateCsv !== existing) throw new Error("Product candidate catalogue changed; review identity decisions before replacing it");
  if (mode === "--write") {
    if (existing === null) {
      await fs.mkdir(path.dirname(CATALOGUE_FILE), { recursive: true });
      await fs.writeFile(CATALOGUE_FILE, candidateCsv);
    }
    await fs.mkdir(path.dirname(REPORT_FILE), { recursive: true });
    await fs.writeFile(REPORT_FILE, reportCsv);
  } else {
    await assertGeneratedArtifactMatches("product identity", REPORT_FILE, reportCsv);
  }
  console.log(JSON.stringify({ vintage, latestPeriod: audit.latestPeriod, currentProducts: audit.catalogue.length,
    exactTo2015: audit.catalogue.filter((item) => item.firstPeriod === "2015-01").length,
    unresolvedTransitions: audit.unresolvedTransitions.length, candidateRows: reportCsv.trimEnd().split("\n").length - 1,
    sourceRowsOutsideExactTrace: audit.unassignedSourceRows.length }));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

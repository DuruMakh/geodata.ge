import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { INFLATION_PRODUCTS_RAW_ROOT, readVerifiedProductFiles } from "../../../lib/data/inflation/productSourceFiles";
import { pairProductEditions } from "../../../lib/data/inflation/readGeostatProducts";
import { buildProductIdentityAudit, seedProductCatalogue, serializeCandidateCatalogue, serializeIdentityReview, type ProductCatalogueRow } from "../../../lib/data/inflation/productIdentity";
import type { PairedProductRow, ProductSourceCell } from "../../../lib/data/inflation/productTypes";

let rows: PairedProductRow[];
beforeAll(async () => {
  rows = pairProductEditions(await readVerifiedProductFiles(path.join(INFLATION_PRODUCTS_RAW_ROOT, "2026-08")));
});

function row(year: number, ordinal: number, labelEn: string, labelKa: string): PairedProductRow {
  const cell: ProductSourceCell = { period: `${year}-01`, index100: "100", marker: null, locator: `${year}!D${ordinal + 3}` };
  return { year, ordinal, coicopCode: "01", labelEn, labelKa, momCells: [cell], yoyCells: [cell] };
}

describe("current-basket product identity audit", () => {
  it("seeds all 305 latest products, with only 258 safe exact histories reaching 2015", () => {
    const catalogue = seedProductCatalogue(rows);
    const audit = buildProductIdentityAudit(rows, catalogue, []);
    expect(catalogue).toHaveLength(305);
    expect(new Set(catalogue.map((item) => item.productId)).size).toBe(305);
    expect(catalogue[0]!.productId).toBe("cpi.product.p0001");
    expect(audit.latestPeriod).toBe("2026-08");
    expect(audit.catalogue.filter((item) => item.firstPeriod === "2015-01")).toHaveLength(258);
    expect(audit.unresolvedTransitions).toHaveLength(47);
    expect(audit.transitions).toHaveLength(47);
    expect(audit.assignments.filter((entry) => entry.row.year === 2015)).toHaveLength(258);
    expect(audit.unassignedSourceRows.some((item) => item.year === 2011 && item.labelEn === "Advertising in a newspaper")).toBe(true);
    expect(audit.catalogue.some((item) => item.labelEn === "Advertising in a newspaper")).toBe(false);
  });

  it("finds no transition between the unchanged 2015 and 2016 lists", () => {
    const key = (item: PairedProductRow) => `${item.coicopCode}|${item.labelEn}|${item.labelKa}`;
    expect(rows.filter((item) => item.year === 2015).map(key)).toEqual(rows.filter((item) => item.year === 2016).map(key));
  });

  it("keeps identity when a row number moves between years", () => {
    const fixture = [row(2015, 1, "Rice", "ბრინჯი"), row(2015, 2, "Bread", "პური"), row(2016, 1, "Bread", "პური"), row(2016, 2, "Rice", "ბრინჯი")];
    const audit = buildProductIdentityAudit(fixture, seedProductCatalogue(fixture), []);
    expect(audit.unresolvedTransitions).toHaveLength(0);
    expect(audit.assignments.filter((entry) => entry.row.year === 2015).map((entry) => [entry.productId, entry.row.labelEn])).toEqual([
      ["cpi.product.p0002", "Rice"], ["cpi.product.p0001", "Bread"],
    ]);
  });

  it("leaves a one-language rename unresolved even if the row number agrees", () => {
    const fixture = [row(2015, 1, "Pasteurized milk", "რძე"), row(2016, 1, "Manufactured milk", "რძე")];
    const audit = buildProductIdentityAudit(fixture, seedProductCatalogue(fixture), []);
    expect(audit.unresolvedTransitions).toHaveLength(1);
    expect(audit.catalogue[0]!.firstPeriod).toBe("2016-01");
    expect(audit.unresolvedTransitions[0]!.candidates[0]!.clues).toContain("same Georgian name");
    expect(audit.assignments).toHaveLength(1);
  });

  it("rejects a changed latest roster instead of silently reassigning product IDs", () => {
    const catalogue = seedProductCatalogue(rows);
    const changed = rows.map((item) => item.year === 2026 && item.ordinal === 1 ? { ...item, labelEn: "Renamed rice" } : item);
    expect(() => buildProductIdentityAudit(changed, catalogue, [])).toThrow(/latest roster|catalogue/i);
  });

  it("emits every unresolved boundary with source labels and no accepted link", () => {
    const audit = buildProductIdentityAudit(rows, seedProductCatalogue(rows), []);
    const csv = serializeIdentityReview(audit);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Pasteurized milk");
    expect(csv).toContain("unresolved");
    expect(csv).toContain("one_language_same");
    expect(csv).toContain("same_group_only");
    expect(csv).toContain("no_candidate");
    expect(csv).not.toContain("auto_link");
    expect(csv.split("\n").length).toBeGreaterThan(47);
  });

  it("reproduces the committed candidate catalogue and complete review report byte for byte", async () => {
    const catalogueFile = path.resolve("../../data/mappings/inflation-products/catalogue.csv");
    const reportFile = path.resolve("../../data/reports/inflation-products-identity-review.csv");
    const catalogueText = await fs.readFile(catalogueFile, "utf8");
    const records = parse(catalogueText, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
    const catalogue: ProductCatalogueRow[] = records.map((record) => ({
      productId: record.product_id!, coicopCode: record.coicop_code!, labelEn: record.label_en!,
      labelKa: record.label_ka!, firstPeriod: record.first_period!, decisionRef: record.decision_ref!,
    }));
    const audit = buildProductIdentityAudit(rows, catalogue, []);
    expect(serializeCandidateCatalogue(audit.catalogue)).toBe(catalogueText);
    expect(serializeIdentityReview(audit)).toBe(await fs.readFile(reportFile, "utf8"));
  });
});

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildProductIdentityAudit, loadProductDecisions, type ProductCatalogueRow, type ProductDecisionRow } from "../../../lib/data/inflation/productIdentity";
import { prepareProducts, serializeProductCatalogue, serializeProductFacts, writeProductArtifacts } from "../../../lib/data/inflation/prepareProducts";
import { INFLATION_PRODUCTS_RAW_ROOT, readVerifiedProductFiles } from "../../../lib/data/inflation/productSourceFiles";
import { pairProductEditions } from "../../../lib/data/inflation/readGeostatProducts";
import { findProductOutputRevisions, findProductRevisions, validateProductIndices } from "../../../lib/data/inflation/validateProducts";
import type { PairedProductRow } from "../../../lib/data/inflation/productTypes";

let rows: PairedProductRow[];
let decisions: ProductDecisionRow[];
let catalogue: ProductCatalogueRow[];
let prepared: Awaited<ReturnType<typeof prepareProducts>>;

beforeAll(async () => {
  rows = pairProductEditions(await readVerifiedProductFiles(path.join(INFLATION_PRODUCTS_RAW_ROOT, "2026-08")));
  decisions = await loadProductDecisions();
  prepared = await prepareProducts({ previousFacts: null });
  catalogue = prepared.catalogue;
});

describe("reviewed product identity mapping", () => {
  it("records every approved first boundary and exposes no new unresolved boundary", () => {
    expect(decisions).toHaveLength(47);
    expect(decisions.filter((row) => row.decision === "link")).toHaveLength(29);
    expect(decisions.filter((row) => row.decision === "split")).toHaveLength(18);
    const audit = buildProductIdentityAudit(rows, catalogue, decisions);
    expect(audit.unresolvedTransitions).toHaveLength(0);
    expect(audit.catalogue.filter((item) => item.firstPeriod === "2015-01")).toHaveLength(287);
    expect(audit.catalogue.find((item) => item.productId === "cpi.product.p0088")?.firstPeriod).toBe("2015-01");
    expect(audit.catalogue.find((item) => item.productId === "cpi.product.p0089")?.firstPeriod).toBe("2019-01");
    expect(audit.catalogue.find((item) => item.productId === "cpi.product.p0010")?.firstPeriod).toBe("2019-01");
    expect(audit.assignments.some((entry) => entry.productId === "cpi.product.p0088" && entry.row.year === 2018 && entry.row.labelEn === "Mineral water")).toBe(true);
    expect(audit.assignments.some((entry) => entry.productId === "cpi.product.p0089" && entry.row.year === 2018)).toBe(false);
  });

  it("rejects an unresolved, stale or conflicting reviewed decision", () => {
    const missing = decisions.filter((row) => row.productId !== "cpi.product.p0088");
    expect(buildProductIdentityAudit(rows, catalogue, missing).unresolvedTransitions.some((item) => item.productId === "cpi.product.p0088")).toBe(true);
    const wrongName = decisions.map((row) => row.productId === "cpi.product.p0088" ? { ...row, previousLabelEn: "Wrong water" } : row);
    expect(() => buildProductIdentityAudit(rows, catalogue, wrongName)).toThrow(/predecessor|decision/i);
    const duplicate = decisions.map((row) => row.productId === "cpi.product.p0089" ? { ...row, decision: "link" as const, previousYear: 2018, previousOrdinal: 89,
      previousCoicopCode: "01", previousLabelEn: "Mineral water", previousLabelKa: "მინერალური წყალი" } : row);
    expect(() => buildProductIdentityAudit(rows, catalogue, duplicate)).toThrow(/same source row|multiple products/i);
    expect(() => buildProductIdentityAudit(rows, catalogue, [...decisions, decisions[0]!])).toThrow(/duplicate decision/i);
  });

  it("keeps every latest product, excludes retired rows and preserves source cell meaning", async () => {
    const output = prepared;
    expect(output.catalogue).toHaveLength(305);
    expect(output.catalogue.some((item) => item.labelEn === "Advertising in a newspaper")).toBe(false);
    expect(output.facts.find((fact) => fact.productId === "cpi.product.p0088" && fact.measure === "mom_index_100" && fact.period === "2018-01")?.sourceLocator).toBe("2018!D92");
    expect(output.facts.some((fact) => fact.productId === "cpi.product.p0089" && fact.period === "2018-01")).toBe(false);
    expect(output.facts.find((fact) => fact.productId === "cpi.product.p0089" && fact.measure === "yoy_index_100" && fact.period === "2019-01")).toMatchObject({ index100: null, availability: "not_published" });
    expect(output.facts.find((fact) => fact.productId === "cpi.product.p0089" && fact.measure === "yoy_index_100" && fact.period === "2019-12")).toMatchObject({ index100: "111.8378", availability: "published" });
    expect(output.facts.find((fact) => fact.productId === "cpi.product.p0219" && fact.measure === "mom_index_100" && fact.period === "2026-08")).toMatchObject({ index100: "103.258", sourceLocator: "2026!K222" });
    expect(serializeProductCatalogue(output.catalogue).charCodeAt(0)).toBe(0xfeff);
    expect(serializeProductFacts(output.facts).charCodeAt(0)).toBe(0xfeff);
  });

  it("checks published annual indices against twelve monthly indices and counts uncomparable cells", () => {
    const report = validateProductIndices(prepared.facts);
    expect(report.arithmeticChecked).toBeGreaterThan(38_000);
    expect(report.arithmeticUncomparable).toBeGreaterThan(0);
    expect(report.maxArithmeticError).toBeLessThan(0.002);
    expect(report.unavailableCells).toBeGreaterThan(0);
    const bent = prepared.facts.map((fact) => fact.productId === "cpi.product.p0088" && fact.measure === "yoy_index_100" && fact.period === "2020-03" ?
      { ...fact, index100: "150" } : fact);
    expect(() => validateProductIndices(bent)).toThrow(/annual|twelve|arithmetic/i);
  });

  it("checks 2015 annual cells against verified 2014 monthly indices", () => {
    const audit = buildProductIdentityAudit(rows, catalogue, decisions);
    const previousRows = new Map(rows.filter((row) => row.year === 2014).map((row) =>
      [`${row.coicopCode}:${row.labelEn.trim().toLocaleLowerCase()}:${row.labelKa.trim().toLocaleLowerCase()}`, row]));
    const priorYearMonthly = new Map<string, string>();
    for (const { productId, row } of audit.assignments.filter(({ row }) => row.year === 2015)) {
      const key = `${row.coicopCode}:${row.labelEn.trim().toLocaleLowerCase()}:${row.labelKa.trim().toLocaleLowerCase()}`;
      const prior = previousRows.get(key);
      if (!prior) continue;
      for (const cell of prior.momCells) if (cell.index100 !== null) priorYearMonthly.set(`${productId}:${cell.period}`, cell.index100);
    }
    const report = validateProductIndices(prepared.facts, priorYearMonthly);
    expect(report.arithmeticChecked).toBe(41_830);
    expect(report.arithmeticPriorYearChecked).toBe(3_157);
    expect(report.arithmeticUncomparable).toBe(22);
    expect(prepared.validation.arithmeticChecked).toBe(41_830);
    const tampered2014 = new Map(priorYearMonthly);
    tampered2014.set("cpi.product.p0001:2014-12", "150");
    expect(() => validateProductIndices(prepared.facts, tampered2014)).toThrow(/annual index/);
  });

  it("keeps conservative identities and Geostat's inconsistent bilingual label", () => {
    expect(catalogue.find((item) => item.productId === "cpi.product.p0179")?.firstPeriod).toBe("2019-01");
    expect(catalogue.find((item) => item.productId === "cpi.product.p0269")?.firstPeriod).toBe("2020-01");
    expect(catalogue.find((item) => item.productId === "cpi.product.p0148")).toMatchObject({
      labelEn: "Chipboard", labelKa: "თაბაშირ-მუყაოს ფილა",
    });
  });

  it("reports historical value, missing-marker and removed-row revisions before cohort filtering", () => {
    expect(findProductRevisions(prepared.facts, catalogue, rows, decisions)).toEqual([]);
    const valueChanged = rows.map((row) => row.year === 2019 && row.ordinal === 89 ?
      { ...row, momCells: row.momCells.map((cell) => cell.period === "2019-01" ? { ...cell, index100: "150" } : cell) } : row);
    expect(findProductRevisions(prepared.facts, catalogue, valueChanged, decisions).join(" ")).toMatch(/2019-01.*value|value.*2019-01/i);
    const markerChanged = rows.map((row) => row.year === 2019 && row.ordinal === 89 ?
      { ...row, yoyCells: row.yoyCells.map((cell) => cell.period === "2019-01" ? { ...cell, index100: "100", marker: null } : cell) } : row);
    expect(findProductRevisions(prepared.facts, catalogue, markerChanged, decisions).join(" ")).toMatch(/2019-01.*availability|availability.*2019-01/i);
    const missing = rows.filter((row) => !(row.year === 2019 && row.ordinal === 89));
    expect(findProductRevisions(prepared.facts, catalogue, missing, decisions).join(" ")).toMatch(/missing source cell/i);
  });

  it("stops a changed current basket or an old identity decision with a readable difference", () => {
    const smallerBasket = rows.filter((row) => !(row.year === 2026 && row.ordinal === 305));
    expect(findProductRevisions(prepared.facts, catalogue, smallerBasket, decisions).join(" ")).toMatch(/latest basket.*Photocopying/i);
    const changedDecision = decisions.map((row) => row.productId === "cpi.product.p0088" ? { ...row, decision: "split" as const } : row);
    expect(findProductRevisions(prepared.facts, catalogue, rows, changedDecision).join(" ")).toMatch(/identity.*p0088/i);
  });

  it("stops reassigned stable IDs and old fact locators before replacing canonical files", () => {
    expect(findProductOutputRevisions(catalogue, catalogue, prepared.facts, prepared.facts)).toEqual([]);
    const swappedCatalogue = catalogue.map((item) => item.productId === "cpi.product.p0001" ?
      { ...item, productId: "cpi.product.p0002" } : item.productId === "cpi.product.p0002" ?
        { ...item, productId: "cpi.product.p0001" } : item);
    expect(findProductOutputRevisions(catalogue, swappedCatalogue, prepared.facts, prepared.facts).join(" ")).toMatch(/identity.*p0001|p0001.*identity/i);
    const replacedId = catalogue.map((item) => item.productId === "cpi.product.p0001" ? { ...item, productId: "cpi.product.p0999" } : item);
    expect(findProductOutputRevisions(catalogue, replacedId, prepared.facts, prepared.facts).join(" ")).toMatch(/identity removed.*p0001/i);
    const swappedFacts = prepared.facts.map((fact) => fact.productId === "cpi.product.p0001" ?
      { ...fact, productId: "cpi.product.p0002" } : fact.productId === "cpi.product.p0002" ?
        { ...fact, productId: "cpi.product.p0001" } : fact);
    expect(findProductOutputRevisions(catalogue, catalogue, prepared.facts, swappedFacts).join(" ")).toMatch(/source.*assignment|locator.*changed/i);
  });

  it("matches committed canonical files, retains Excel BOM and reports validation", async () => {
    const root = path.resolve("../..");
    const catalogueCsv = await fs.readFile(path.join(root, "data/imports/cpi-products.csv"), "utf8");
    const factsCsv = await fs.readFile(path.join(root, "data/imports/cpi-products-monthly.csv"), "utf8");
    expect(catalogueCsv.charCodeAt(0)).toBe(0xfeff);
    expect(factsCsv.charCodeAt(0)).toBe(0xfeff);
    expect(catalogueCsv).toBe(serializeProductCatalogue(prepared.catalogue));
    expect(factsCsv).toBe(serializeProductFacts(prepared.facts));
    const report = JSON.parse(await fs.readFile(path.join(root, "data/reports/inflation-products-validation.json"), "utf8")) as Record<string, unknown>;
    expect(report).toMatchObject({ latestPeriod: "2026-08", includedProducts: 305, reviewedLinks: 29, reviewedSplits: 18 });
    expect(report.arithmeticChecked).toBeGreaterThan(38_000);
    await expect(writeProductArtifacts("check")).resolves.toMatchObject({ includedProducts: 305 });
  });

  it("rejects a stale generated artifact without touching committed data", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "product-artifacts-"));
    try {
      const root = path.resolve("../..");
      for (const relative of ["data/imports/cpi-products.csv", "data/imports/cpi-products-monthly.csv", "data/reports/inflation-products-validation.json"]) {
        const destination = path.join(dir, relative);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.copyFile(path.join(root, relative), destination);
      }
      const report = path.join(dir, "data/reports/inflation-products-validation.json");
      await fs.appendFile(report, " ");
      await expect(writeProductArtifacts("check", { outputRoot: dir })).rejects.toThrow(/stale|mismatch/i);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

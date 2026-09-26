import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildProductIdentityAudit, loadProductDecisions, type ProductCatalogueRow, type ProductDecisionRow } from "../../../lib/data/inflation/productIdentity";
import { prepareProducts, serializeProductCatalogue, serializeProductFacts } from "../../../lib/data/inflation/prepareProducts";
import { INFLATION_PRODUCTS_RAW_ROOT, readVerifiedProductFiles } from "../../../lib/data/inflation/productSourceFiles";
import { pairProductEditions } from "../../../lib/data/inflation/readGeostatProducts";
import type { PairedProductRow } from "../../../lib/data/inflation/productTypes";

let rows: PairedProductRow[];
let decisions: ProductDecisionRow[];
let catalogue: ProductCatalogueRow[];

beforeAll(async () => {
  rows = pairProductEditions(await readVerifiedProductFiles(path.join(INFLATION_PRODUCTS_RAW_ROOT, "2026-08")));
  decisions = await loadProductDecisions();
  catalogue = (await prepareProducts({ previousFacts: null })).catalogue;
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
    const output = await prepareProducts({ previousFacts: null });
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
});

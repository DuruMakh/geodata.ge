import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadProductCatalogueCsv, loadProductFactsCsv } from "../../lib/data/inflation/importProducts";
import { buildProductIndex, packProductFacts, productAnnual, rankProducts, type ProductIndex } from "../../lib/explorer/inflationProducts";
import { buildInflationProductWorkbookExportModel } from "../../lib/explorer/inflationProductWorkbook";
import type { InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";

const sources: InflationWorkbookSource[] = ["source.geostat_product_yoy", "source.geostat_product_mom"].flatMap((sourceId) =>
  (["en", "ka"] as const).map((language) => ({
    sourceId, language, years: Array.from({ length: 16 }, (_, offset) => 2011 + offset),
    title: `${sourceId} ${language}`, organization: "Geostat",
    downloadHref: `/downloads/methodology/inflation/files/${language}/${sourceId}.xlsx`, retrievedAt: "2026-09-27",
  })));

let index: ProductIndex;
let presentation: Presentation;

beforeAll(async () => {
  const [catalogue, facts, messages] = await Promise.all([
    loadProductCatalogueCsv(), loadProductFactsCsv(), getMessages("en", ["inflation"]),
  ]);
  index = buildProductIndex(catalogue, packProductFacts(facts));
  presentation = { locale: "en", messages, englishLabels: {} };
});

const input = () => ({
  index, state: { indicator: "annual" as const, range: index.defaultRange, selected: [] as string[] },
  presentation, sources, siteOrigin: "https://fiscal.ge",
});

describe("individual-product inflation workbook", () => {
  it("exports the full current summary with empty selection", () => {
    const model = buildInflationProductWorkbookExportModel(input());
    expect(model.readable.rows).toHaveLength(index.products.length);
    expect(model.analysis.rows).toHaveLength(0);
    expect(model.sheetNames).toEqual(["Summary", "Data", "Sources"]);
    expect(model.sources).toHaveLength(2);
    expect(model.sources.every((row) => row.absoluteUrl.startsWith("https://fiscal.ge/downloads/"))).toBe(true);
    expect(model.readable.subtitle).toContain("Fiscal.ge");
  });

  it("uses the same rates as the page and explains late history", () => {
    const model = buildInflationProductWorkbookExportModel(input());
    const firstId = rankProducts(index)[0]!;
    const annual = model.readable.rows[0]!.valuesByYear[1];
    expect(annual).toBeCloseTo(productAnnual(index, firstId, index.latestPeriod)! / 100);
    expect(model.readable.numberFormat).toBe("0.0%");
    const past = buildInflationProductWorkbookExportModel({
      ...input(), state: { ...input().state, range: { startYear: 2015, endYear: 2016 } },
    });
    const late = past.readable.rows.find((row) => row.label.includes("Coffee cup with saucer"))!;
    expect(late.valuesByYear[2]).toBeNull();
    expect(late.label).toContain("2019");
    expect(past.sourceYears).toContain(2026);
    expect(past.readable.rows[0]!.valuesByYear[1]).toBe(annual);
  });

  it("does not call unverified earlier identity history unpublished", () => {
    const model = buildInflationProductWorkbookExportModel({
      ...input(), state: { indicator: "cumulative", range: { startYear: 2015, endYear: 2020 }, selected: ["cpi.product.p0179"] },
    });
    const beforeIdentity = model.analysis.rows.find((row) => row[0] === 2015 && row[1] === 1)!;
    expect(beforeIdentity[3]).toBeNull();
    expect(beforeIdentity[6]).toBe("history starts 2019-01");
    expect(beforeIdentity[7]).toBe("history starts 2019-01");
  });

  it("leaves a full-range cumulative value blank after one missing monthly index", () => {
    const shortId = "cpi.product.p0999";
    const shortIndex = buildProductIndex(
      [{ productId: shortId, labelEn: "Sample", labelKa: "ნიმუში", firstPeriod: "2026-01" }],
      packProductFacts([
        { productId: shortId, measure: "mom_index_100", period: "2026-01", index100: "101" },
        { productId: shortId, measure: "mom_index_100", period: "2026-02", index100: null },
        { productId: shortId, measure: "yoy_index_100", period: "2026-02", index100: "110" },
      ]),
    );
    const model = buildInflationProductWorkbookExportModel({
      ...input(), index: shortIndex,
      state: { indicator: "cumulative", range: { startYear: 2026, endYear: 2026 }, selected: [shortId] },
    });
    expect(model.readable.rows[0]!.valuesByYear[2]).toBeNull();
    expect(model.readable.rows[0]!.label).toContain("2026-02");
    expect(model.analysis.rows.every((row) => row[5] === null)).toBe(true);
  });

  it("writes percentage fractions and all selected products without truncation", async () => {
    const model = buildInflationProductWorkbookExportModel({
      ...input(), state: { ...input().state, range: { startYear: index.earliestYear, endYear: index.defaultRange.endYear }, selected: rankProducts(index) },
    });
    const before = performance.now();
    const bytes = await createWorkbookBuffer(model);
    const elapsedMs = Math.round(performance.now() - before);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
    expect(workbook.worksheets[0]!.getCell("B4").value).toBeCloseTo(productAnnual(index, rankProducts(index)[0]!, index.latestPeriod)! / 100);
    expect(workbook.worksheets[0]!.getCell("B4").numFmt).toBe("0.0%");
    expect(workbook.worksheets[0]!.rowCount).toBeGreaterThan(305);
    expect(workbook.worksheets[1]!.rowCount).toBeGreaterThan(40_000);
    expect(workbook.worksheets[2]!.getCell("D4").hyperlink).toMatch(/^https:\/\/fiscal\.ge\/downloads\//);
    console.info(`Full product workbook: ${elapsedMs} ms, ${bytes.byteLength} bytes, heap ${Math.round(process.memoryUsage().heapUsed / 1_048_576)} MiB`);
  }, 120_000);
});

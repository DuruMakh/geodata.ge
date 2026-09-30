import path from "node:path";
import * as XLSX from "xlsx";
import { beforeAll, describe, expect, it } from "vitest";
import { INFLATION_PRODUCTS_RAW_ROOT, readVerifiedProductFiles, type VerifiedProductFile } from "../../../lib/data/inflation/productSourceFiles";
import { pairProductEditions, readGeostatProducts } from "../../../lib/data/inflation/readGeostatProducts";

let files: VerifiedProductFile[];
const file = (role: "mom" | "yoy", language: "en" | "ka") => files.find((row) => row.file_role === role && row.language === language)!;

beforeAll(async () => {
  files = await readVerifiedProductFiles(path.join(INFLATION_PRODUCTS_RAW_ROOT, "2026-08"));
});

function rewrite(source: VerifiedProductFile, edit: (sheet: XLSX.WorkSheet) => void): VerifiedProductFile {
  const book = XLSX.read(source.content, { type: "buffer", cellFormula: true });
  edit(book.Sheets["2015"]!);
  return { ...source, content: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer };
}

describe("Geostat detailed product indices", () => {
  it("pairs every row of the four editions and preserves published indices and missing cells", () => {
    const rows = pairProductEditions(files);
    const byYear = (year: number) => rows.filter((row) => row.year === year);
    expect(byYear(2015)).toHaveLength(295);
    expect(byYear(2016)).toHaveLength(295);
    expect(byYear(2026)).toHaveLength(305);
    expect(byYear(2026)[0]!.momCells.at(-1)!.period).toBe("2026-08");
    const gasoline = byYear(2026).find((row) => row.labelEn === "Gasoline")!;
    expect(gasoline.momCells.at(-1)).toMatchObject({ index100: "103.258", locator: "2026!K222" });
    expect(gasoline.yoyCells.at(-1)).toMatchObject({ index100: "123.1325", locator: "2026!K222" });
    expect(rows.flatMap((row) => row.yoyCells).filter((cell) => cell.marker !== null)).toHaveLength(770);
    expect(rows.flatMap((row) => row.momCells).every((cell) => cell.index100 !== null)).toBe(true);
  });

  it("rejects a malformed month header", () => {
    const broken = rewrite(file("mom", "en"), (sheet) => { sheet["D3"]!.v = "January"; });
    expect(() => readGeostatProducts(broken.content, "mom", "en")).toThrow(/month header/);
  });

  it("rejects a duplicate item number", () => {
    const broken = rewrite(file("mom", "en"), (sheet) => { sheet["A5"]!.v = 1; });
    expect(() => readGeostatProducts(broken.content, "mom", "en")).toThrow(/ordinal|item number/i);
  });

  it("rejects a nonpositive index and unexpected text", () => {
    const zero = rewrite(file("mom", "en"), (sheet) => { sheet["D4"]!.v = 0; });
    expect(() => readGeostatProducts(zero.content, "mom", "en")).toThrow(/positive/);
    const text = rewrite(file("yoy", "en"), (sheet) => { sheet["D4"] = { t: "s", v: "unknown" }; });
    expect(() => readGeostatProducts(text.content, "yoy", "en")).toThrow(/unexpected|missing marker/);
  });

  it("stops a new missing-value pattern in either measure", () => {
    const monthlyGap = rewrite(file("mom", "en"), (sheet) => { sheet["D4"] = { t: "s", v: "..." }; });
    expect(() => readGeostatProducts(monthlyGap.content, "mom", "en")).toThrow(/missing.*pattern/i);
    const isolatedAnnualGap = rewrite(file("yoy", "en"), (sheet) => { sheet["D4"] = { t: "s", v: "…" }; });
    expect(() => readGeostatProducts(isolatedAnnualGap.content, "yoy", "en")).toThrow(/missing.*pattern/i);
  });

  it("rejects a formula even when it has a cached numeric value", () => {
    const broken = rewrite(file("mom", "en"), (sheet) => { sheet["D4"]!.f = "1+1"; });
    expect(() => readGeostatProducts(broken.content, "mom", "en")).toThrow(/formula/);
  });

  it("rejects one reordered or relabeled Georgian row", () => {
    const broken = rewrite(file("mom", "ka"), (sheet) => {
      const old = sheet["C4"]!.v;
      sheet["C4"]!.v = sheet["C5"]!.v;
      sheet["C5"]!.v = old;
    });
    expect(() => pairProductEditions(files.map((source) => source === file("mom", "ka") ? broken : source))).toThrow(/inventory|label|row/i);
  });

  it("rejects a vintage that does not match the latest parsed month", () => {
    expect(() => pairProductEditions(files.map((source) => ({ ...source, vintage: "2026-07" })))).toThrow(/vintage/);
  });
});

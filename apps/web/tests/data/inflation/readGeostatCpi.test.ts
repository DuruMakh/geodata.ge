import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { beforeAll, describe, expect, it } from "vitest";
import { makePeriod, periodFromKey, periodKey, periodMonth, periodYear } from "../../../lib/data/inflation/periods";
import { CPI_FILE_ROLES, readGeostatCpiFile, type CpiFileRole, type ParsedCpiSeries } from "../../../lib/data/inflation/readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage, readVerifiedCpiFiles, type VerifiedCpiFile } from "../../../lib/data/inflation/sourceFiles";

let files: VerifiedCpiFile[];
let vintageDir: string;

beforeAll(async () => {
  vintageDir = path.join(INFLATION_RAW_ROOT, "geostat-cpi", await latestCpiVintage());
  files = await readVerifiedCpiFiles(vintageDir);
});

const file = (role: CpiFileRole, language: "en" | "ka") =>
  files.find((row) => row.file_role === role && row.language === language)!;

function cell(series: ParsedCpiSeries[], seriesId: string, key: string) {
  return series.find((row) => row.seriesId === seriesId)!.cells.find((entry) => entry.period === periodFromKey(key));
}

describe("periods", () => {
  it("encodes months as consecutive integers", () => {
    expect(makePeriod(2026, 8)).toBe(2026 * 12 + 7);
    expect(periodFromKey("2026-08")).toBe(makePeriod(2026, 8));
    expect(periodKey(makePeriod(2004, 1))).toBe("2004-01");
    expect(periodYear(makePeriod(2010, 12))).toBe(2010);
    expect(periodMonth(makePeriod(2010, 12))).toBe(12);
    expect(makePeriod(2011, 1) - makePeriod(2010, 12)).toBe(1);
    expect(() => periodFromKey("2026-13")).toThrow(/Invalid period/);
  });
});

describe("Geostat CPI workbooks", () => {
  it("verifies all twelve archived files against the manifest", () => {
    expect(files).toHaveLength(12);
  });

  it("reads each national series at published precision, rebasing only =100 files", () => {
    const index = readGeostatCpiFile(file("index_2010", "en").content, "index_2010", "en");
    expect(index[0]!.cells[0]).toEqual({ period: makePeriod(2000, 1), value: "52.4448", locator: "Georgia!B4" });

    const yoy = readGeostatCpiFile(file("yoy", "en").content, "yoy", "en");
    expect(cell(yoy, "cpi.headline", "2004-01")).toEqual({ period: makePeriod(2004, 1), value: "5.1981", locator: "Georgia!D5" });
    expect(cell(yoy, "cpi.headline", "2026-08")?.value).toBe("5.6479");

    const mom = readGeostatCpiFile(file("mom", "en").content, "mom", "en");
    expect(cell(mom, "cpi.headline", "2026-08")?.value).toBe("0.4049");

    const avg12 = readGeostatCpiFile(file("avg12", "en").content, "avg12", "en");
    expect(avg12[0]!.cells[0]).toMatchObject({ period: makePeriod(2002, 1), value: "4.6715" });

    const coreYoy = readGeostatCpiFile(file("core_yoy", "en").content, "core_yoy", "en");
    expect(coreYoy.map((row) => [row.seriesId, row.measure])).toEqual([["cpi.core", "yoy_pct"], ["cpi.core_ex_tobacco", "yoy_pct"]]);
    expect(cell(coreYoy, "cpi.core", "2010-01")?.value).toBe("1.9499");
    expect(cell(coreYoy, "cpi.core_ex_tobacco", "2010-01")?.value).toBe("1.8143");
    expect(cell(coreYoy, "cpi.core", "2026-08")?.value).toBe("3.799");

    const coreMom = readGeostatCpiFile(file("core_mom", "en").content, "core_mom", "en");
    expect(cell(coreMom, "cpi.core", "2010-01")?.value).toBe("0.4282");
  });

  it("reads the Georgian files to exactly the English values", () => {
    for (const role of CPI_FILE_ROLES) {
      const pairs = (series: ParsedCpiSeries[]) => series.map((row) => row.cells.map((entry) => `${entry.period}=${entry.value}`));
      expect(pairs(readGeostatCpiFile(file(role, "ka").content, role, "ka")), role).toEqual(
        pairs(readGeostatCpiFile(file(role, "en").content, role, "en")),
      );
    }
  });
});

describe("layout guards", () => {
  function rewrite(content: Buffer, edit: (rows: unknown[][], names: string[]) => { rows: unknown[][]; name?: string }): Buffer {
    const book = XLSX.read(content, { type: "buffer" });
    const name = book.SheetNames[0]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name]!, { header: 1, raw: true, defval: null });
    const next = edit(rows, book.SheetNames);
    const out = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(next.rows), next.name ?? name);
    return XLSX.write(out, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  it("refuses a missing month header", () => {
    const broken = rewrite(file("index_2010", "en").content, (rows) => ({ rows: rows.map((row, index) => (index === 2 ? [] : row)) }));
    expect(() => readGeostatCpiFile(broken, "index_2010", "en")).toThrow(/month header/);
  });

  it("refuses a renamed national sheet", () => {
    const broken = rewrite(file("index_2010", "en").content, (rows) => ({ rows, name: "Tbilisi" }));
    expect(() => readGeostatCpiFile(broken, "index_2010", "en")).toThrow(/national sheet/);
  });

  it("refuses a value after a gap", () => {
    const broken = rewrite(file("index_2010", "en").content, (rows) => ({
      rows: rows.map((row, index) => (index === 10 ? [row[0], null, ...row.slice(2)] : row)),
    }));
    expect(() => readGeostatCpiFile(broken, "index_2010", "en")).toThrow(/after a gap/);
  });

  it("refuses an English file whose title names a different table", () => {
    const broken = rewrite(file("index_2010", "en").content, (rows) => ({ rows: [["CONSUMER PRICE INDICES IN GEORGIA Previous month=100"], ...rows.slice(1)] }));
    expect(() => readGeostatCpiFile(broken, "index_2010", "en")).toThrow(/title/);
  });

  it("refuses tampered bytes", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cpi-vintage-"));
    try {
      await fs.cp(vintageDir, temp, { recursive: true });
      await fs.appendFile(path.join(temp, "en", "cpi-yoy.xlsx"), " ");
      await expect(readVerifiedCpiFiles(temp)).rejects.toThrow(/hash mismatch/);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});

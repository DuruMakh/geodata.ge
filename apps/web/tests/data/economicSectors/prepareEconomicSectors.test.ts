import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { afterEach, expect, test } from "vitest";
import { prepareEconomicSectors, writeEconomicSectorsArtifacts } from "../../../lib/data/economicSectors/prepareEconomicSectors";

const root = path.resolve(process.cwd(), "../..");
const manifestPath = "docs/Raw Data/Economy/economic-sectors/source-manifest.json";
const temporary: string[] = [];

test("retains original XML decimal digits before GEL conversion and growth subtraction", async () => {
  const result = await prepareEconomicSectors(root);
  // Literal values independently inspected in the archived XML, not SheetJS numbers.
  expect(result.facts.find(f => f.seriesId === "sector.a" && f.year === 2010 && f.measure === "nominal")?.value).toBe("1963727396.7742849");
  expect(result.facts.find(f => f.seriesId === "sector.e" && f.year === 2011 && f.measure === "real_growth")?.value).toBe("-17.584777525302826");
  expect(result.validation.growthChecks.find(f => f.seriesId === "sector.b" && f.year === 2011)?.previousVolume).toBe("412.65746793035271");
  expect(result.facts.find(f => f.seriesId === "economy.gdp_total" && f.year === 2010 && f.measure === "nominal")?.value).toBe("22148652202.055619");
});
afterEach(async () => { await Promise.all(temporary.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true }))); });

// Compact generated sheets retain reviewed row/column coordinates, but use simple
// values: twenty sectors of 1m, basic total 20m, taxes 2m, subsidies 1m, GDP 21m.
async function fixture(
  mutate?: (sheet: XLSX.WorkSheet, role: string) => void,
  rehash = true,
  mutateManifest?: (manifest: { files: Array<{ role: string; annualYears: number[]; preliminaryYears: number[]; lastAnnualColumn: string }> }) => void,
) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "economic-sectors-"));
  temporary.push(dir);
  const manifest = JSON.parse(await fs.readFile(path.join(root, manifestPath), "utf8"));
  mutateManifest?.(manifest);
  const registry = JSON.parse(await fs.readFile(path.join(root, "data/taxonomy/economic-sectors.json"), "utf8"));
  const save = async (file: string, content: string | Buffer) => {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), content);
  };
  await save("data/taxonomy/economic-sectors.json", JSON.stringify(registry));
  for (const entry of manifest.files) {
    const sheet = XLSX.utils.aoa_to_sheet([]);
    const put = (address: string, value: string | number) => { sheet[address] = { t: typeof value === "number" ? "n" : "s", v: value }; };
    sheet["!ref"] = "A1:CZ36";
    put("A2", "NACE \nRev. 2 ");
    for (let i = 0; i < 20; i++) { put(`A${i + 3}`, registry[i].classificationCode); put(`B${i + 3}`, registry[i].officialName); }
    ["(=) GDP at basic prices", "(+) Taxes on products", "(-) Subsidies on products", "(=) GDP at market prices"].forEach((label, i) => put(`B${i + 23}`, label));
    put("B32", "* Revised data will be published on November 16, 2026.");
    put("B36", "Last update: 19.06.2026");
    entry.annualYears.forEach((year: number, i: number) => {
      const c = 6 + i * 5;
      put(XLSX.utils.encode_cell({ r: 1, c }), entry.preliminaryYears.includes(year) ? `${year}*` : year);
      for (let r = 2; r <= 25; r++) put(XLSX.utils.encode_cell({ r, c }), entry.role === "growth" ? 100 : r < 22 ? 1 : [20, 2, 1, 21][r - 22]);
    });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, entry.sheet);
    const original = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    mutate?.(sheet, entry.role);
    const bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    entry.sha256 = createHash("sha256").update(rehash ? bytes : original).digest("hex");
    entry.bytes = (rehash ? bytes : original).length;
    await save(entry.file, bytes);
  }
  await save(manifestPath, JSON.stringify(manifest));
  const nominalYears = manifest.files.find((entry: { role: string }) => entry.role === "nominal").annualYears;
  await save("data/imports/gdp-overview-annual.csv", "series_id,year,value\n" + nominalYears.map((year: number) => `nominal_gel,${year},21000000\n`).join(""));
  return dir;
}

test("extracts every archived annual observation and reconciles all sixteen years", async () => {
  const result = await prepareEconomicSectors(root);
  expect(result.validation.counts).toEqual({ nominal: 336, share_of_gdp: 336, real_growth: 315 });
  expect(result.facts.filter(f => f.measure === "nominal" && f.seriesId !== "economy.gdp_total")).toHaveLength(320);
  expect(result.reconciliation).toHaveLength(16);
  for (const row of result.reconciliation) {
    expect(new Decimal(row.gvaDifferenceGel).abs().lte("0.01")).toBe(true);
    expect(new Decimal(row.gdpDifferenceGel).abs().lte("0.01")).toBe(true);
    expect(row.overviewGdpParity).toBe(true);
  }
  expect(result.validation.growthChecks).toHaveLength(315);
  expect(result.facts.find(f => f.seriesId === "sector.a" && f.year === 2010 && f.measure === "nominal")?.value).toBe("1963727396.7742849");
  expect(result.facts.find(f => f.seriesId === "sector.t" && f.year === 2025 && f.measure === "nominal")).toMatchObject({ value: "86354085.573384111", status: "preliminary" });
  expect(result.facts.find(f => f.seriesId === "economy.gdp_total" && f.year === 2025 && f.measure === "real_growth")).toMatchObject({ value: "7.46161492416432", calculation: "index_to_growth" });
  expect(result.facts.filter(f => f.status === "preliminary")).toHaveLength(63);
});

test("allows exactly the 21 unsupported 2010 growth cells without inventing rates", async () => {
  const result = await prepareEconomicSectors(await fixture());
  expect(result.facts).toHaveLength(987);
  expect(result.validation.missingCells).toHaveLength(21);
  expect(result.validation.missingCells.every(cell => cell.year === 2010 && cell.measure === "real_growth")).toBe(true);
  expect(result.facts.filter(f => f.measure === "real_growth").every(f => f.value === "0")).toBe(true);
});

test("derives future validation counts and wording from manifest coverage", async () => {
  const dir = await fixture(undefined, true, (manifest) => {
    for (const file of manifest.files) {
      file.annualYears.push(2026);
      file.preliminaryYears = [2026];
      file.lastAnnualColumn = file.role === "growth" ? "CD" : "CI";
    }
  });

  const result = await prepareEconomicSectors(dir);
  expect(result.validation.fullGridObservations).toBe(21 * 17 * 3);
  expect(result.validation.missingGrowthReason).toContain("2011-2026");
});

test("accepts any contiguous preliminary-year suffix ending at the latest year", async () => {
  const dir = await fixture(undefined, true, (manifest) => {
    for (const file of manifest.files) file.preliminaryYears = [2022, 2023, 2024, 2025];
  });

  await expect(prepareEconomicSectors(dir)).resolves.toMatchObject({ validation: { status: "PASS" } });
});

test.each([
  ["duplicate annual headers", "nominal", "H2", 2010, /Duplicate annual/],
  ["quarterly-only header", "nominal", "G2", "2010 Q4", /Annual coverage/],
  ["shifted activity", "nominal", "A3", "B", /code\/label/],
  ["missing activity label", "growth", "B3", "", /code\/label/],
  ["wrong basic total", "nominal", "G23", 22, /GVA reconciliation/],
  ["wrong tax total", "nominal", "G24", 3, /GDP reconciliation/],
  ["missing nominal cell", "nominal", "G3", "", /numeric cell/],
  ["wrong index conversion evidence", "growth", "G3", 101, /Growth check/],
  ["wrong preliminary marker", "growth", "BY2", 2025, /preliminary/],
  ["missing previous volume", "growth_validation", "G3", "", /numeric cell/],
] as const)("rejects %s", async (_name, role, address, value, error) => {
  const dir = await fixture((sheet, current) => { if (current === role) sheet[address] = { t: typeof value === "number" ? "n" : "s", v: value }; });
  await expect(prepareEconomicSectors(dir)).rejects.toThrow(error);
});

test("rejects changed source bytes before workbook extraction", async () => {
  const dir = await fixture((sheet, role) => { if (role === "nominal") sheet.G3.v = 2; }, false);
  await expect(prepareEconomicSectors(dir)).rejects.toThrow(/hash mismatch/);
});

test("requires exact overview GDP parity", async () => {
  const dir = await fixture();
  await fs.appendFile(path.join(dir, "data/imports/gdp-overview-annual.csv"), "nominal_gel,2010,21000000.001\n");
  await expect(prepareEconomicSectors(dir)).rejects.toThrow(/overview GDP parity/);
});

test.each(["sourceId", "conversion"])("rejects an unreviewed growth %s", async field => {
  const dir = await fixture();
  const file = path.join(dir, manifestPath);
  const manifest = JSON.parse(await fs.readFile(file, "utf8"));
  manifest.files.find((s: { role: string }) => s.role === "growth")[field] = "unreviewed";
  await fs.writeFile(file, JSON.stringify(manifest));
  await expect(prepareEconomicSectors(dir)).rejects.toThrow(/Unreviewed source mapping/);
});

test("writes BOM CSV with flat fields and checks exact bytes without rewriting stale files", async () => {
  const dir = await fixture();
  await writeEconomicSectorsArtifacts(true, dir);
  await writeEconomicSectorsArtifacts(false, dir);
  const file = path.join(dir, "data/imports/economic-sectors-annual.csv");
  const bytes = await fs.readFile(file);
  expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
  const rows = parse(bytes, { columns: true, bom: true }) as Record<string, string>[];
  expect(rows).toHaveLength(987);
  expect(Object.keys(rows[0])).toEqual(["series_id", "year", "measure", "value", "unit", "valuation", "price_basis", "calculation", "status", "source_id", "source_locator", "last_reviewed_at"]);
  expect(rows.find(r => r.year === "2025")?.source_locator).toContain("2025*");
  await fs.appendFile(file, "\n");
  const stale = await fs.readFile(file);
  await expect(writeEconomicSectorsArtifacts(false, dir)).rejects.toThrow(/stale/);
  expect(await fs.readFile(file)).toEqual(stale);
});

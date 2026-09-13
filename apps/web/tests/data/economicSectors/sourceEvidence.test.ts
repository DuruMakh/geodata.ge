import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import * as XLSX from "xlsx";
import { strFromU8, unzipSync } from "fflate";
import { prepareEconomicSectors } from "../../../lib/data/economicSectors/prepareEconomicSectors";
import { expect, test } from "vitest";

const root = path.resolve(process.cwd(), "../..");
const D = Decimal.clone({ precision: 50 });

test("archived sector originals support exactly the reviewed annual coverage", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root,
    "docs/Raw Data/Economy/economic-sectors/source-manifest.json"), "utf8"));
  const xml = new Map<string, string>();
  const annual = new Map<string, Map<number, number>>();
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(path.join(root, entry.file));
    expect(bytes.length).toBe(entry.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    const book = XLSX.read(bytes, { type: "buffer" });
    expect(book.SheetNames).toEqual([entry.sheet]);
    const sheet = book.Sheets[entry.sheet];
    xml.set(entry.role, strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"]));
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const columns = new Map<number, number>();
    rows[1].forEach((header, column) => {
      if (/^\d{4}\*?$/.test(String(header))) {
        const year = Number(String(header).replace("*", ""));
        expect(columns.has(year)).toBe(false);
        columns.set(year, column);
      }
    });
    annual.set(entry.role, columns);
    expect([...columns.keys()]).toEqual(entry.annualYears);
    expect(XLSX.utils.encode_col(columns.values().next().value!)).toBe(entry.firstAnnualColumn);
    expect(XLSX.utils.encode_col([...columns.values()].at(-1)!)).toBe(entry.lastAnnualColumn);
    expect(rows.slice(2, 22).map(row => row[0])).toEqual("ABCDEFGHIJKLMNOPQRST".split(""));
    expect(rows[25][1]).toBe("(=) GDP at market prices");
    expect(rows.flat()).toContain("* Revised data will be published on November 16, 2026.");
    for (const column of columns.values()) {
      for (const row of [...Array.from({ length: 20 }, (_, index) => index + 2), 25]) {
        expect(typeof rows[row][column]).toBe("number");
        expect(Number.isFinite(rows[row][column])).toBe(true);
      }
    }
  }
  const cell = (role: string, year: number, row: number) => {
    const address = XLSX.utils.encode_cell({ r: row - 1, c: annual.get(role)!.get(year)! });
    const fragment = xml.get(role)!.split(`r="${address}"`)[1]?.split("</c>")[0];
    const raw = fragment?.split("<v>")[1]?.split("</v>")[0];
    if (!raw) throw new Error(`Missing original XML value: ${role} ${address}`);
    return new D(raw);
  };
  const prepared = await prepareEconomicSectors(root);
  for (const fact of prepared.facts) {
    const row = fact.seriesId === "economy.gdp_total" ? 26 : fact.seriesId.charCodeAt(7) - 97 + 3;
    const nominal = cell("nominal", fact.year, row).mul(1000000);
    const expected = fact.measure === "nominal" ? nominal : fact.measure === "real_growth"
      ? cell("growth", fact.year, row).minus(100)
      : nominal.div(cell("nominal", fact.year, 26).mul(1000000)).mul(100).toDecimalPlaces(20);
    expect(fact.value, `${fact.seriesId} ${fact.year} ${fact.measure}`).toBe(expected.toFixed());
  }
  for (const year of annual.get("nominal")!.keys()) {
    const gva = Array.from({ length: 20 }, (_, index) => cell("nominal", year, index + 3))
      .reduce((sum, value) => sum.plus(value), new D(0));
    const gvaDifference = gva.minus(cell("nominal", year, 23));
    expect(gvaDifference.abs().lte(manifest.nominalReconciliationToleranceMillionGel),
      `${year} GVA difference: ${gvaDifference.toFixed()} million GEL`).toBe(true);
    const gdp = cell("nominal", year, 23).plus(cell("nominal", year, 24)).minus(cell("nominal", year, 25));
    const gdpDifference = gdp.minus(cell("nominal", year, 26));
    expect(gdpDifference.abs().lte(manifest.nominalReconciliationToleranceMillionGel),
      `${year} GDP difference: ${gdpDifference.toFixed()} million GEL`).toBe(true);
  }
  let checked = 0;
  for (const year of annual.get("growth")!.keys()) {
    for (const row of [...Array.from({ length: 20 }, (_, index) => index + 3), 26]) {
      const published = cell("growth", year, row).minus(100);
      const calculated = cell("growth_validation", year, row).div(cell("growth_validation", year - 1, row)).minus(1).times(100);
      const difference = published.minus(calculated);
      expect(difference.abs().lte(manifest.growthCheckTolerancePercentagePoints),
        `${year} source row ${row} growth difference: ${difference.toFixed()} percentage points`).toBe(true);
      checked++;
    }
  }
  expect(checked).toBe(315);
  expect(annual.get("growth")!.has(2010)).toBe(false);
  expect(annual.get("growth_validation")!.has(2009)).toBe(false);
  expect(cell("growth", 2025, 26).minus(100).toFixed()).toBe("7.46161492416432");
});

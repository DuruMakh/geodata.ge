import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { strToU8, zipSync } from "fflate";
import { describe, expect, test } from "vitest";
import { assertEnergyFoodParity, loadEnergyFoodFacts, toClientEnergyFoodFact } from "../../../lib/data/energyFood/importEnergyFood";
import { energyFoodMirrorCreateRows, loadEnergyFoodFactsFromMirror } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { readWorkbookCells } from "../../../lib/data/energyFood/prepareEnergyFood";
import { ENERGY_FOOD_INDICATORS, ENERGY_FOOD_PUBLIC_SOURCES, ENERGY_FOOD_SOURCES, type EnergyFoodFact } from "../../../lib/data/energyFood/types";
import { energyFoodDisplayDecimals, expectedEnergyFoodKeys, validateEnergyFoodFacts } from "../../../lib/data/energyFood/validation";

const root = path.resolve(process.cwd(), "../..");
const loadFacts = (): EnergyFoodFact[] =>
  (parse(fs.readFileSync(path.join(root, "data/imports/energy-food-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[]).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as EnergyFoodFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as EnergyFoodFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as EnergyFoodFact["valueStatus"],
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly EnergyFoodFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;

/** A General-format row of the given unit; its published value is the stored value cut to 15 significant digits. */
const general = (facts: readonly EnergyFoodFact[], unit: string) => facts.find(f => f.unit === unit && f.sourceNumberFormat === "General")!;
const food = (facts: readonly EnergyFoodFact[]) => general(facts, "percent");

test("serves all 681 reviewed values", () => {
  const facts = loadFacts();
  expect(facts).toHaveLength(681);
  expect(new Set(facts.map(f => f.indicatorId)).size).toBe(ENERGY_FOOD_INDICATORS.length);
  expect(facts.filter(f => f.valueStatus === "no_flow")).toHaveLength(3);
  expect(find(facts, "energy.supply.electricity", 2023).value).toBe("-58.3");
  expect(() => validateEnergyFoodFacts(facts)).not.toThrow();
});

test("source inventories", () => {
  expect(ENERGY_FOOD_INDICATORS).toHaveLength(57);
  expect(ENERGY_FOOD_SOURCES).toHaveLength(26);
  expect(ENERGY_FOOD_PUBLIC_SOURCES).toHaveLength(42);
  expect(new Set(ENERGY_FOOD_PUBLIC_SOURCES).size).toBe(42);
  expect(expectedEnergyFoodKeys().size).toBe(681);
});

describe("readWorkbookCells", () => {
  const entry = (name: string, text: string) => [name, strToU8(text)] as const;
  const workbook = (sheets: string) => zipSync(Object.fromEntries([
    entry("xl/workbook.xml", `<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="GWh&amp;TJ" sheetId="2" r:id="rId2"/></sheets></workbook>`),
    // The first listed sheet is stored as sheet2.xml and the second as sheet1.xml.
    entry("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId2" Type="x/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId1" Type="x/worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>`),
    entry("xl/sharedStrings.xml", `<sst><si><t>Label</t></si><si><r><t>-</t></r><r><t xml:space="preserve">&#160;</t></r></si><si/><si><t/></si><si><t>After</t></si></sst>`),
    entry("xl/worksheets/sheet2.xml", `<worksheet><sheetData><row r="5"><c r="B5" s="3" t="s"><v>1</v></c><c r="C5" s="3"/><c r="D5"><v>12</v></c></row></sheetData></worksheet>`),
    entry("xl/worksheets/sheet1.xml", sheets),
  ]));

  test("resolves out-of-order sheets and is not misled by a self-closing cell", () => {
    const cells = readWorkbookCells(workbook(`<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>7.25</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row></sheetData></worksheet>`));
    expect(cells.get("Data:C5")).toBeUndefined();
    expect(cells.get("Data:D5")).toEqual({ token: "12" });
    expect(cells.get("Data:B5")).toEqual({ text: "- " });
    expect(cells.get("GWh&TJ:A1")).toEqual({ text: "Label" });
    expect(cells.get("GWh&TJ:B1")).toEqual({ token: "7.25" });
    expect(cells.get("GWh&TJ:D5")).toBeUndefined();
    // Self-closing <si/> and <t/> hold no text and must not swallow the string after them.
    expect(cells.get("GWh&TJ:A2")).toEqual({ text: "" });
    expect(cells.get("GWh&TJ:B2")).toEqual({ text: "" });
    expect(cells.get("GWh&TJ:C2")).toEqual({ text: "After" });
  });
});

describe("energyFoodDisplayDecimals", () => {
  test.each([["#,##0.0", 1], ["0.0", 1], ["0", 0], ["#,##0.0;[Red]#,##0.0", 1]] as const)("%s shows %i decimals", (format, decimals) => {
    expect(energyFoodDisplayDecimals(format)).toBe(decimals);
  });
  test("rejects General, which has no fixed precision, and unknown formats", () => {
    expect(() => energyFoodDisplayDecimals("General")).toThrow(/number format/);
    expect(() => energyFoodDisplayDecimals("0.00%")).toThrow(/number format/);
  });
});

test.each([
  ["an altered published value", (facts: EnergyFoodFact[]) => { facts[0].publishedValue = "0.99"; }, /published value/],
  ["a duplicate observation", (facts: EnergyFoodFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: EnergyFoodFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2015 wind row", (facts: EnergyFoodFact[]) => { facts.push({ ...find(facts, "electricity.production.wind", 2016), year: 2015 }); }, /outside the approved coverage/],
  ["a 2025 energy row", (facts: EnergyFoodFact[]) => { facts.push({ ...find(facts, "energy.supply.total", 2024), year: 2025 }); }, /outside the approved coverage/],
  ["a 2013 food row", (facts: EnergyFoodFact[]) => { facts.push({ ...find(facts, "food.self_sufficiency.wheat", 2014), year: 2013 }); }, /outside the approved coverage/],
  ["a negative household consumption", (facts: EnergyFoodFact[]) => { Object.assign(find(facts, "energy.final.households", 2020), { value: "-5", publishedValue: "-5.0" }); }, /range/],
  ["a no-flow row with value 5", (facts: EnergyFoodFact[]) => { Object.assign(find(facts, "energy.imports.crude_oil", 2013), { value: "5", publishedValue: "5.0" }); }, /no-flow/],
  ["a zero food ratio", (facts: EnergyFoodFact[]) => { Object.assign(find(facts, "food.self_sufficiency.wheat", 2020), { value: "0", publishedValue: "0" }); }, /range/],
  ["a General food ratio with a decimal", (facts: EnergyFoodFact[]) => { Object.assign(food(facts), { value: "73.4", publishedValue: "73.4" }); }, /more decimals|whole number/],
  ["a food ratio published with a decimal", (facts: EnergyFoodFact[]) => { Object.assign(find(facts, "food.self_sufficiency.meat", 2024), { publishedValue: "47.1" }); }, /published value|whole number/],
  ["a General ktoe value that is not the 15-digit cut of its stored value", (facts: EnergyFoodFact[]) => { Object.assign(general(facts, "ktoe"), { publishedValue: "1.5" }); }, /published value/],
  ["a ktoe value published with two decimals", (facts: EnergyFoodFact[]) => { Object.assign(find(facts, "energy.supply.total", 2024), { value: "5914.55", publishedValue: "5914.55" }); }, /Invalid energy and food published value, more decimals/],
  ["a gwh value published with two decimals", (facts: EnergyFoodFact[]) => { Object.assign(find(facts, "electricity.production.total", 2024), { value: "14234.15", publishedValue: "14234.15" }); }, /more decimals/],
  ["a non-numeric published value", (facts: EnergyFoodFact[]) => { facts[0].publishedValue = "n/a"; }, /Invalid energy and food published value/],
  ["a wrong source for the year", (facts: EnergyFoodFact[]) => { find(facts, "energy.supply.total", 2020).sourceId = "geostat_energy_balance_2021_aggregated"; }, /source contract/],
] as const)("validation rejects %s", (_, mutate, error) => {
  const facts = loadFacts().map(f => ({ ...f }));
  mutate(facts);
  expect(() => validateEnergyFoodFacts(facts)).toThrow(error);
});

test("General rows publish the stored value cut to 15 significant digits", () => {
  const facts = loadFacts().map(f => ({ ...f }));
  Object.assign(general(facts, "ktoe"), { value: "520.20000000000005", publishedValue: "520.2" });
  expect(() => validateEnergyFoodFacts(facts)).not.toThrow();
});

test("validation accepts the real negative electricity supply", () => {
  const facts = loadFacts();
  for (const year of [2016, 2023]) expect(Number(find(facts, "energy.supply.electricity", year).value)).toBeLessThan(0);
  expect(() => validateEnergyFoodFacts(facts)).not.toThrow();
});

describe("loading and parity", () => {
  test("loadEnergyFoodFacts serves the 681 canonical rows", async () => {
    const facts = await loadEnergyFoodFacts();
    expect(facts).toHaveLength(681);
    expect(find(facts, "energy.supply.electricity", 2023).value).toBe("-58.3");
  });

  test("loadEnergyFoodFacts rejects a canonical file that no longer matches its acceptance fingerprint", async () => {
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), "energy-food-"));
    try {
      for (const relative of ["data/imports/energy-food-annual.csv", "data/reports/energy-food-validation.json"]) {
        fs.mkdirSync(path.dirname(path.join(copy, relative)), { recursive: true });
        fs.copyFileSync(path.join(root, relative), path.join(copy, relative));
      }
      await expect(loadEnergyFoodFacts(copy)).resolves.toHaveLength(681);
      fs.appendFileSync(path.join(copy, "data/imports/energy-food-annual.csv"), "\n");
      await expect(loadEnergyFoodFacts(copy)).rejects.toThrow(/fingerprint/);
    } finally {
      fs.rmSync(copy, { recursive: true, force: true });
    }
  });

  test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
    const facts = await loadEnergyFoodFacts();
    const padded = facts.map(f => ({ ...f }));
    Object.assign(find(padded, "energy.supply.total", 2013), { value: `${find(facts, "energy.supply.total", 2013).value}0`, publishedValue: `${find(facts, "energy.supply.total", 2013).publishedValue}0` });
    expect(() => assertEnergyFoodParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
    expect(() => assertEnergyFoodParity(facts, padded)).not.toThrow();
    expect(new Decimal("5914.50").eq("5914.5")).toBe(true);
    const changed = facts.map(f => ({ ...f }));
    changed[5].value = new Decimal(changed[5].value).plus("0.00000001").toFixed();
    expect(() => assertEnergyFoodParity(facts, changed)).toThrow();
    expect(() => assertEnergyFoodParity(facts, facts.slice(1))).toThrow();
  });

  test("client facts carry the published figure and a precision set by the unit", async () => {
    const facts = await loadEnergyFoodFacts();
    expect(toClientEnergyFoodFact(find(facts, "energy.supply.total", 2023))).toMatchObject({ value: Number(find(facts, "energy.supply.total", 2023).publishedValue), decimals: 1, sourceId: "geostat_energy_balance_2023_aggregated" });
    expect(toClientEnergyFoodFact(find(facts, "electricity.production.total", 2024)).decimals).toBe(1);
    expect(toClientEnergyFoodFact(find(facts, "food.self_sufficiency.wheat", 2023))).toMatchObject({ decimals: 0, sourceId: "geostat_food_balance_sheets" });
    expect(toClientEnergyFoodFact(find(facts, "food.self_sufficiency.meat", 2025)).decimals).toBe(0);
    // A General-format row (no fixed precision in its cell) still gets the unit's decimals.
    expect(toClientEnergyFoodFact(general(facts, "ktoe")).decimals).toBe(1);
    expect(toClientEnergyFoodFact(food(facts)).decimals).toBe(0);
    expect(facts.every(f => { const c = toClientEnergyFoodFact(f); return c.decimals === (f.unit === "percent" ? 0 : 1) && c.value === Number(f.publishedValue); })).toBe(true);
  });

  test("the database mirror round-trips exact decimals and source relations", async () => {
    const facts = await loadEnergyFoodFacts();
    const rows = energyFoodMirrorCreateRows(facts, "energy-food-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
    const db = (list: typeof rows) => ({ energyFoodFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "energyFoodFact">;
    const mirror = await loadEnergyFoodFactsFromMirror(db(rows));
    expect(() => assertEnergyFoodParity(facts, mirror)).not.toThrow();
    expect(mirror.find(f => f.value === "-58.3")).toBeDefined();
    expect(rows[0].importRunId).toBe("energy-food-run-1");
    expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
    await expect(loadEnergyFoodFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
  });
});

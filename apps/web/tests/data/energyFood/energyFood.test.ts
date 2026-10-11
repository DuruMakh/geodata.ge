import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { strToU8, zipSync } from "fflate";
import { describe, expect, test } from "vitest";
import { prepareEnergyFoodData, readWorkbookCells } from "../../../lib/data/energyFood/prepareEnergyFood";
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

test("the canonical file reproduces the research package", async () => {
  await expect(prepareEnergyFoodData(root, "check")).resolves.toBeUndefined();
});

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
    entry("xl/sharedStrings.xml", `<sst><si><t>Label</t></si><si><r><t>-</t></r><r><t xml:space="preserve">&#160;</t></r></si></sst>`),
    entry("xl/worksheets/sheet2.xml", `<worksheet><sheetData><row r="5"><c r="B5" s="3" t="s"><v>1</v></c><c r="C5" s="3"/><c r="D5"><v>12</v></c></row></sheetData></worksheet>`),
    entry("xl/worksheets/sheet1.xml", sheets),
  ]));

  test("resolves out-of-order sheets and is not misled by a self-closing cell", () => {
    const cells = readWorkbookCells(workbook(`<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>7.25</v></c></row></sheetData></worksheet>`));
    expect(cells.get("Data:C5")).toBeUndefined();
    expect(cells.get("Data:D5")).toEqual({ token: "12" });
    expect(cells.get("Data:B5")).toEqual({ text: "- " });
    expect(cells.get("GWh&TJ:A1")).toEqual({ text: "Label" });
    expect(cells.get("GWh&TJ:B1")).toEqual({ token: "7.25" });
    expect(cells.get("GWh&TJ:D5")).toBeUndefined();
  });
});

describe("energyFoodDisplayDecimals", () => {
  test.each([["#,##0.0", undefined, 1], ["0.0", undefined, 1], ["0", undefined, 0], ["#,##0.0;[Red]#,##0.0", undefined, 1], ["General", "22", 0], ["General", "138.7", 1]] as const)("%s (%s) shows %i decimals", (format, published, decimals) => {
    expect(energyFoodDisplayDecimals(format, published)).toBe(decimals);
  });
  test("rejects an unknown format and a General format with no published value", () => {
    expect(() => energyFoodDisplayDecimals("0.00%")).toThrow(/number format/);
    expect(() => energyFoodDisplayDecimals("General")).toThrow(/published value/);
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
  ["a wrong source for the year", (facts: EnergyFoodFact[]) => { find(facts, "energy.supply.total", 2020).sourceId = "geostat_energy_balance_2021_aggregated"; }, /source contract/],
] as const)("validation rejects %s", (_, mutate, error) => {
  const facts = loadFacts().map(f => ({ ...f }));
  mutate(facts);
  expect(() => validateEnergyFoodFacts(facts)).toThrow(error);
});

test("validation accepts the real negative electricity supply", () => {
  const facts = loadFacts();
  for (const year of [2016, 2023]) expect(Number(find(facts, "energy.supply.electricity", year).value)).toBeLessThan(0);
  expect(() => validateEnergyFoodFacts(facts)).not.toThrow();
});

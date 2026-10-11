import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { prepareHouseholdData, readSheetCellTokens } from "../../../lib/data/household/prepareHousehold";
import { HOUSEHOLD_INDICATORS, householdSourceId, type HouseholdFact } from "../../../lib/data/household/types";
import { expectedHouseholdKeys, householdPublishedValue, validateHouseholdFacts } from "../../../lib/data/household/validation";

const root = path.resolve(process.cwd(), "../..");
const loadFacts = (): HouseholdFact[] =>
  (parse(fs.readFileSync(path.join(root, "data/imports/household-income-spending-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[]).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id, areaId: row.area_id, measure: row.measure, value: row.value, publishedValue: row.published_value,
    unit: row.unit, basis: row.basis, valueStatus: row.value_status, sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell,
    sourceNumberFormat: row.source_number_format, lastReviewedAt: row.last_reviewed_at,
  }) as HouseholdFact);
const find = (facts: readonly HouseholdFact[], indicatorId: string, areaId: string, measure: string, year: number) =>
  facts.find(f => f.indicatorId === indicatorId && f.areaId === areaId && f.measure === measure && f.year === year)!;
/** Sets an exact value and keeps its published rounding consistent, so only the rule under test fails. */
const setValue = (f: HouseholdFact, value: string) => Object.assign(f, { value, publishedValue: householdPublishedValue(value) });

test("the canonical file reproduces the research package", async () => {
  await expect(prepareHouseholdData(root, "check")).resolves.toBeUndefined();
});

test("serves all 10,638 reviewed values", () => {
  const facts = loadFacts();
  expect(facts).toHaveLength(10638);
  expect(expectedHouseholdKeys().size).toBe(10638);
  expect(HOUSEHOLD_INDICATORS).toHaveLength(27);
  expect(find(facts, "income.total", "georgia", "per_household", 2025).publishedValue).toBe("2025.8");
  expect(find(facts, "spending.consumption", "georgia", "per_household", 2025).publishedValue).toBe("1438.7");
  expect(() => validateHouseholdFacts(facts)).not.toThrow();
});

test("derives the served source id", () => {
  expect(householdSourceId("spending.food", "region.tbilisi", "per_capita")).toBe("geostat_household_spending_capita_region");
  expect(householdSourceId("income.wages", "georgia", "per_household")).toBe("geostat_household_income_household_national");
  expect(householdSourceId("income.wages", "settlement.rural", "per_capita")).toBe("geostat_household_income_capita_settlement");
});

test("a self-closing empty cell does not swallow the next cell's value", () => {
  const tokens = readSheetCellTokens('<sheetData><row r="5"><c r="A5" t="s"><v>3</v></c><c r="B5" s="3"/><c r="C5" s="4"><v>8.4499999999999993</v></c><c r="D5"/><c r="E5" s="4"><v>12</v></c></row></sheetData>');
  expect(Object.fromEntries(tokens)).toEqual({ A5: "3", C5: "8.4499999999999993", E5: "12" });
});

test("a published value is the displayed number: 15 significant digits, then half-up", () => {
  expect(householdPublishedValue("2025.7499999999999")).toBe("2025.8");
  expect(householdPublishedValue("8.4499999999999993")).toBe("8.5");
  expect(householdPublishedValue("8.44")).toBe("8.4");
});

test.each([
  ["an altered published value", (facts: HouseholdFact[]) => { facts[0].publishedValue = "999.9"; }, /published value/],
  ["the displayed-digits rule (2025.7499999999999 published as 2025.7)", (facts: HouseholdFact[]) => { Object.assign(facts[0], { value: "2025.7499999999999", publishedValue: "2025.7" }); }, /published value/],
  ["a duplicate observation", (facts: HouseholdFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: HouseholdFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2018 Guria row", (facts: HouseholdFact[]) => { facts.push({ ...find(facts, "income.wages", "region.guria", "per_household", 2019), year: 2018 }); }, /outside the approved coverage/],
  ["a 2001 row", (facts: HouseholdFact[]) => { facts.push({ ...find(facts, "income.wages", "georgia", "per_household", 2002), year: 2001 }); }, /outside the approved coverage/],
  ["a negative value", (facts: HouseholdFact[]) => { setValue(find(facts, "income.gifts", "region.imereti", "per_capita", 2020), "-1"); }, /Negative/],
  ["a source row that does not match its workbook", (facts: HouseholdFact[]) => { facts[0].sourceId = "geostat_household_income_capita_region"; }, /source contract/],
  ["income.wages raised by 1", (facts: HouseholdFact[]) => { const f = find(facts, "income.wages", "region.imereti", "per_household", 2020); setValue(f, new Decimal(f.value).plus(1).toFixed()); }, /do not add up to income\.total/],
  ["Georgia above both towns and villages", (facts: HouseholdFact[]) => {
    const above = Decimal.max(find(facts, "income.gifts", "settlement.urban", "per_capita", 2020).value, find(facts, "income.gifts", "settlement.rural", "per_capita", 2020).value).plus(1).toFixed();
    setValue(find(facts, "income.gifts", "georgia", "per_capita", 2020), above);
  }, /between towns and villages/],
  ["a 2025 income.total of 2025.9", (facts: HouseholdFact[]) => { setValue(find(facts, "income.total", "georgia", "per_household", 2025), "2025.9"); }, /does not publish 2025\.8/],
] as const)("validation rejects %s", (_, mutate, error) => {
  const facts = loadFacts();
  mutate(facts);
  expect(() => validateHouseholdFacts(facts)).toThrow(error);
});

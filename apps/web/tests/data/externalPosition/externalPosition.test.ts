import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { EXTERNAL_POSITION_CSV_HEADERS, REVIEWED_AT, prepareExternalPositionData } from "../../../lib/data/externalPosition/prepareExternalPosition";
import { EXTERNAL_POSITION_INDICATORS, EXTERNAL_POSITION_SOURCES, type ExternalPositionFact } from "../../../lib/data/externalPosition/types";
import { expectedExternalPositionKeys, validateExternalPositionFacts } from "../../../lib/data/externalPosition/validation";

const root = path.resolve(process.cwd(), "../..");
const loadFacts = async (): Promise<ExternalPositionFact[]> =>
  (parse(await fs.readFile(path.join(root, "data/imports/external-position-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[]).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as ExternalPositionFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as "usd_million", periodEnd: row.period_end, basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly ExternalPositionFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;
/** Sets an exact value and keeps its published rounding consistent, so only the rule under test fails. */
const setValue = (f: ExternalPositionFact, value: string) =>
  Object.assign(f, { value, publishedValue: new Decimal(value).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1) });

test("the canonical file is current with its research package", async () => {
  await expect(prepareExternalPositionData(root, "check")).resolves.toBeUndefined();
});

test("serves all 254 reviewed values over the approved coverage", async () => {
  const facts = await loadFacts();
  expect(facts).toHaveLength(254);
  expect(expectedExternalPositionKeys().size).toBe(254);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(EXTERNAL_POSITION_INDICATORS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(EXTERNAL_POSITION_SOURCES));
  expect(facts.every(f => f.basis === "actual" && f.valueStatus === "official" && f.unit === "usd_million" && f.lastReviewedAt === REVIEWED_AT)).toBe(true);
  expect(facts.filter(f => f.periodEnd !== `${f.year}-12-31`).map(f => `${f.indicatorId}:${f.periodEnd}`).sort()).toEqual([
    ...EXTERNAL_POSITION_INDICATORS.filter(id => id.startsWith("ext_debt.")).map(id => `${id}:2026-06-30`),
    ...EXTERNAL_POSITION_INDICATORS.filter(id => id.startsWith("reserves.")).map(id => `${id}:2026-09-30`),
  ].sort());
  expect(find(facts, "ext_debt.total", 2025).publishedValue).toBe("27046.9");
  expect(find(facts, "ext_debt.government", 2025).publishedValue).toBe("9202.9");
  expect(find(facts, "reserves.total", 2025).publishedValue).toBe("6159.3");
  expect(find(facts, "reserves.total", 1995).publishedValue).toBe("196.2");
  expect(find(facts, "reserves.total", 2026).publishedValue).toBe("8166.9");
  expect(find(facts, "ext_debt.total", 2026).publishedValue).toBe("28166.2");
  expect(Math.min(...facts.filter(f => f.indicatorId === "ext_debt.total").map(f => f.year))).toBe(2006);
  expect(Math.min(...facts.filter(f => f.indicatorId === "reserves.total").map(f => f.year))).toBe(1995);
  expect(find(facts, "reserves.gold", 2010).value).toBe("0");
});

test("the canonical file is UTF-8 with a BOM and the agreed header", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/external-position-annual.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8").slice(1).split("\n")[0]).toBe(EXTERNAL_POSITION_CSV_HEADERS.join(","));
});

test("the file passes validation", async () => {
  const facts = await loadFacts();
  expect(() => validateExternalPositionFacts(facts)).not.toThrow();
});

test.each([
  ["an altered published value", (facts: ExternalPositionFact[]) => { facts[0].publishedValue = "0.99"; }, /published value/],
  ["a duplicate observation", (facts: ExternalPositionFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: ExternalPositionFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2005 total debt row", (facts: ExternalPositionFact[]) => { facts.push({ ...find(facts, "ext_debt.total", 2006), year: 2005, periodEnd: "2005-12-31" }); }, /outside the approved coverage/],
  ["a second non-December row", (facts: ExternalPositionFact[]) => { find(facts, "ext_debt.total", 2024).periodEnd = "2024-06-30"; }, /period end/],
  ["a 2025 row dated 2025-09-30", (facts: ExternalPositionFact[]) => { find(facts, "reserves.total", 2025).periodEnd = "2025-09-30"; }, /period end/],
  ["a 2026 debt row dated 2026-12-31", (facts: ExternalPositionFact[]) => { find(facts, "ext_debt.total", 2026).periodEnd = "2026-12-31"; }, /period end/],
  ["debt parts that do not add up", (facts: ExternalPositionFact[]) => { const f = find(facts, "ext_debt.government", 2020); setValue(f, new Decimal(f.value).plus(1).toFixed()); }, /groups/],
  ["a reserves residual of 31 million USD", (facts: ExternalPositionFact[]) => {
    const parts = ["reserves.fx", "reserves.gold", "reserves.sdr"].reduce((sum, id) => sum.plus(find(facts, id, 2020).value), new Decimal(0));
    setValue(find(facts, "reserves.total", 2020), parts.plus(31).toFixed());
  }, /residual/],
  ["a unit other than usd_million", (facts: ExternalPositionFact[]) => { (facts[0] as { unit: string }).unit = "gel_million"; }, /source contract/],
  ["a calculated status", (facts: ExternalPositionFact[]) => { (find(facts, "ext_debt.total", 2020) as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a debt row from the reserves workbook", (facts: ExternalPositionFact[]) => { find(facts, "ext_debt.total", 2020).sourceId = "nbg_official_reserve_assets"; }, /source contract/],
  ["a negative amount", (facts: ExternalPositionFact[]) => { setValue(find(facts, "reserves.sdr", 2010), "-1"); }, /range/],
  ["gold before 2024 that is not the published zero", (facts: ExternalPositionFact[]) => { setValue(find(facts, "reserves.gold", 2010), "5"); }, /gold/],
  ["gold of zero from 2024", (facts: ExternalPositionFact[]) => { setValue(find(facts, "reserves.gold", 2025), "0"); }, /gold/],
  ["a changed 2025 anchor", (facts: ExternalPositionFact[]) => { setValue(find(facts, "reserves.total", 2025), new Decimal(find(facts, "reserves.total", 2025).value).plus(1).toFixed()); }, /anchor/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  mutate(facts);
  expect(() => validateExternalPositionFacts(facts)).toThrow(error);
});

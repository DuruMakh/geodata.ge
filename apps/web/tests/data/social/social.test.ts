import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { REVIEWED_AT, SOCIAL_CSV_HEADERS, loadSocialAverageInputs, prepareSocialData } from "../../../lib/data/social/prepareSocial";
import {
  SOCIAL_GEORGIA, SOCIAL_INDICATORS, SOCIAL_PAYMENT_PROGRAMMES, SOCIAL_PUBLIC_SOURCES, SOCIAL_SOURCES, socialFactKey, type SocialFact, type SocialIndicator,
} from "../../../lib/data/social/types";
import { SOCIAL_KNOWN_DIFFERENCES, expectedSocialKeys, validateSocialFacts } from "../../../lib/data/social/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/Social/ssa-statistics");
const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = async (): Promise<SocialFact[]> =>
  (await readCsv(path.join(root, "data/imports/social-protection-annual.csv"))).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as SocialIndicator, geographyId: row.geography_id, value: row.value, unit: row.unit as SocialFact["unit"],
    months: Number(row.months), basis: row.basis as "actual", valueStatus: row.value_status as SocialFact["valueStatus"], sourceId: row.source_id,
    sourceWorkbook: row.source_workbook, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly SocialFact[], indicatorId: string, geographyId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.geographyId === geographyId && f.year === year)!;
const has = (facts: readonly SocialFact[], indicatorId: string, geographyId: string, year: number) => facts.some(f => f.indicatorId === indicatorId && f.geographyId === geographyId && f.year === year);
const plus = (f: SocialFact, amount: string) => Object.assign(f, { value: new Decimal(f.value).plus(amount).toFixed(f.indicatorId.endsWith(".avg_monthly") ? 2 : 0) });

test("the committed canonical files match a fresh preparation from the research package", async () => {
  await expect(prepareSocialData(root, "check")).resolves.toBeUndefined();
}, 60_000);

test("serves the package's place, social package and programme values, with the averages and payments rows added", async () => {
  const facts = await loadFacts();
  const rows = await readCsv(path.join(research, "ssa-served-annual.csv"));
  expect(rows).toHaveLength(16335);
  // Inputs only: month-count sums, the regular subsistence money and social package rows the group total repeats.
  const inputsOnly = (row: Record<string, string>) => ["count_months_sum", "regular_amount", "regular_count_months_sum"].includes(row.measure) || row.programme === "social_package";
  const national = (row: Record<string, string>) => row.geography_id === SOCIAL_GEORGIA && row.measure === "amount";
  // The other programmes on Social payments have no indicators of their own, only their payments row.
  const moneyOnly = (row: Record<string, string>) => national(row) && !["pension", "pension_idp", "pension_highmountain", "subsistence_allowance", "social_package"].includes(row.programme);
  const own = rows.filter(row => !inputsOnly(row) && !moneyOnly(row));
  // Money series on place pages and the social package start in their first 12-month year.
  const firstFull = new Map<string, number>();
  for (const row of own) {
    const key = `${row.programme}|${row.measure}|${row.geography_id}`;
    if (/amount$/.test(row.measure) && row.months === "12") firstFull.set(key, Math.min(firstFull.get(key) ?? 9999, Number(row.year)));
  }
  const served = own.filter(row => !/amount$/.test(row.measure) || Number(row.year) >= firstFull.get(`${row.programme}|${row.measure}|${row.geography_id}`)!);
  const averaged = served.filter(row => (row.programme === "pension" || row.programme === "pension_highmountain" || row.programme === "subsistence_allowance") && row.measure === "amount"
    || row.programme === "social_package_group" && row.measure === "group.total.amount").filter(row => row.value !== "0");
  const payments = rows.filter(row => national(row) && row.programme !== "pension_idp");
  const years = new Set(rows.map(row => row.year)).size;
  expect(facts).toHaveLength(served.length + averaged.length + payments.length + years);
  expect(facts).toHaveLength(13891);
  expect(SOCIAL_INDICATORS).toHaveLength(56);
  expect(SOCIAL_PAYMENT_PROGRAMMES).toHaveLength(18);
  expect(SOCIAL_SOURCES).toHaveLength(23);
  expect(SOCIAL_PUBLIC_SOURCES).toEqual([...SOCIAL_SOURCES, "ssa_statistics"]);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(SOCIAL_INDICATORS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(SOCIAL_PUBLIC_SOURCES));
  expect(facts.every(f => f.basis === "actual" && f.lastReviewedAt === REVIEWED_AT)).toBe(true);
  expect(Math.min(...facts.map(f => f.year))).toBe(2013);
  expect(Math.max(...facts.map(f => f.year))).toBe(2025);
  expect(facts.some(f => f.geographyId === "04")).toBe(false);
});

test("the spec's anchors and the calculated averages", async () => {
  const facts = await loadFacts();
  const value = (indicatorId: string, year: number, geographyId = SOCIAL_GEORGIA) => find(facts, indicatorId, geographyId, year).value;
  expect(value("social.pension.recipients", 2025)).toBe("888518");
  expect(value("social.pension.amount", 2025)).toBe("4262309090");
  expect(value("social.pension.avg_monthly", 2025)).toBe("405.13");
  expect(value("social.pension.avg_monthly", 2013)).toBe("133.23");
  expect(value("social.subsistence.families", 2025)).toBe("129506");
  expect(value("social.subsistence.persons", 2025)).toBe("463122");
  expect(value("social.subsistence.employment_families", 2025)).toBe("54842");
  expect(value("social.subsistence.registered_families", 2025)).toBe("397144");
  expect(value("social.subsistence.amount", 2025)).toBe("855291818");
  expect(value("social.social_package.total.recipients", 2025)).toBe("187764");
  expect(value("social.social_package.total.amount", 2025)).toBe("544241359");
  expect(value("social.payments.total.amount", 2025)).toBe("6166123811");
  expect(find(facts, "social.payments.total.amount", SOCIAL_GEORGIA, 2025)).toMatchObject({ months: 12, valueStatus: "calculated", unit: "gel", sourceId: "ssa_statistics" });
  const averages = facts.filter(f => f.indicatorId.endsWith(".avg_monthly"));
  expect(averages.every(f => /^\d+\.\d\d$/.test(f.value) && f.unit === "gel" && f.valueStatus === "calculated")).toBe(true);
  // Places that never had a high-mountain pensioner have no average: 0 / 0 is a gap, not zero.
  expect(has(facts, "social.pension_highmountain.avg_monthly", "region.tbilisi", 2023)).toBe(false);
  expect(facts.filter(f => f.indicatorId.endsWith(".amount") || f.indicatorId.endsWith(".employment_amount")).every(f => f.unit === "gel" && /^\d+$/.test(f.value))).toBe(true);
  expect(find(facts, "social.subsistence.families", "06", 2025).unit).toBe("families");
  expect(find(facts, "social.subsistence.persons", "06", 2025).unit).toBe("persons");
});

test("partial years: payments keep their published months, place and social package money starts in its first full year", async () => {
  const facts = await loadFacts();
  expect(find(facts, "social.payments.covid_vulnerable_compensation.amount", SOCIAL_GEORGIA, 2020).months).toBe(6);
  expect(find(facts, "social.payments.covid_vulnerable_compensation.amount", SOCIAL_GEORGIA, 2021).months).toBe(6);
  expect(find(facts, "social.payments.workplace_injury.amount", SOCIAL_GEORGIA, 2013).months).toBe(9);
  expect(find(facts, "social.payments.pension_highmountain.amount", SOCIAL_GEORGIA, 2016).months).toBe(4);
  expect(has(facts, "social.payments.pension_idp.amount", SOCIAL_GEORGIA, 2025)).toBe(false);
  expect(has(facts, "social.pension_highmountain.recipients", SOCIAL_GEORGIA, 2016)).toBe(true);
  expect(has(facts, "social.pension_highmountain.amount", SOCIAL_GEORGIA, 2016)).toBe(false);
  expect(has(facts, "social.pension_highmountain.avg_monthly", SOCIAL_GEORGIA, 2016)).toBe(false);
  expect(find(facts, "social.pension_highmountain.amount", SOCIAL_GEORGIA, 2017).months).toBe(12);
  expect(has(facts, "social.social_package.disability_severe.recipients", SOCIAL_GEORGIA, 2017)).toBe(true);
  expect(has(facts, "social.social_package.disability_severe.amount", SOCIAL_GEORGIA, 2017)).toBe(false);
  expect(has(facts, "social.social_package.war_participants.recipients", SOCIAL_GEORGIA, 2019)).toBe(true);
  expect(has(facts, "social.social_package.war_participants.amount", SOCIAL_GEORGIA, 2019)).toBe(false);
  expect(has(facts, "social.subsistence.employment_families", SOCIAL_GEORGIA, 2022)).toBe(true);
  expect(has(facts, "social.subsistence.employment_amount", SOCIAL_GEORGIA, 2022)).toBe(false);
  // A later partial year stays, marked with its months.
  expect(find(facts, "social.pension.amount", "unit.upper_abkhazia", 2022).months).toBe(9);
  expect(facts.filter(f => !/(amount|avg_monthly)$/.test(f.indicatorId)).every(f => f.months === 1)).toBe(true);
});

test("the canonical file is UTF-8 with a BOM and the agreed header", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/social-protection-annual.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8").slice(1).split("\n")[0]).toBe(SOCIAL_CSV_HEADERS.join(","));
});

test("the series breaks cover the employment programme and the 2025 group redesign", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/social-protection-series-breaks.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const rows = await readCsv(path.join(root, "data/imports/social-protection-series-breaks.csv"));
  expect(rows.map(r => [r.break_id, r.reference_date])).toEqual([["subsistence_employment_2022", "2022-01-01"], ["social_package_groups_2025", "2025-01-01"]]);
  expect(rows[0].applies_to.split(";")).toEqual(["social.subsistence.families", "social.subsistence.persons"]);
  expect(new Set(rows[1].applies_to.split(";"))).toEqual(new Set(["social.social_package.other.recipients", "social.social_package.other.amount", "social.social_package.disability.recipients", "social.social_package.disability.amount"]));
  expect(rows.every(r => r.reason && r.source_note)).toBe(true);
});

test("validation accepts the recorded source findings, and only those", async () => {
  const facts = await loadFacts();
  const inputs = await loadSocialAverageInputs(root);
  expect(() => validateSocialFacts(facts, inputs)).not.toThrow();
  expect(() => validateSocialFacts(facts)).not.toThrow();
  expect(SOCIAL_KNOWN_DIFFERENCES.map(k => `${k.check}|${k.year}|${k.difference}`)).toEqual([
    "social.pension_idp.amount region.shida_kartli|2015|404686", "social.subsistence.amount region.kvemo_kartli|2013|-126", "social.social_package.amount groups|2022|56",
  ]);
  expect(expectedSocialKeys().has(socialFactKey({ indicatorId: "social.pension.recipients", geographyId: "04", year: 2020 }))).toBe(false);
  expect(expectedSocialKeys().has(socialFactKey({ indicatorId: "social.pension.recipients", geographyId: "region.tbilisi", year: 2020 }))).toBe(true);
});

test.each([
  ["an altered value", (facts: SocialFact[]) => { plus(find(facts, "social.subsistence.families", "06", 2020), "1"); }, /do not add up/],
  ["a duplicate observation", (facts: SocialFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: SocialFact[]) => { facts.splice(facts.indexOf(find(facts, "social.pension.recipients", "06", 2020)), 1); }, /Incomplete/],
  ["a 2026 row", (facts: SocialFact[]) => { facts.push({ ...find(facts, "social.pension.recipients", SOCIAL_GEORGIA, 2025), year: 2026 }); }, /outside 2013–2025/],
  ["a 2012 row", (facts: SocialFact[]) => { facts.push({ ...find(facts, "social.pension.recipients", SOCIAL_GEORGIA, 2013), year: 2012 }); }, /outside 2013–2025/],
  ["a row for municipal code 04", (facts: SocialFact[]) => { facts.push({ ...find(facts, "social.pension.recipients", "06", 2020), geographyId: "04" }); }, /outside the approved coverage/],
  ["a payments total off by 1 GEL", (facts: SocialFact[]) => { plus(find(facts, "social.payments.total.amount", SOCIAL_GEORGIA, 2020), "1"); }, /payments total/],
  ["a pension average off by 0.01", (facts: SocialFact[]) => { plus(find(facts, "social.pension.avg_monthly", "06", 2020), "0.01"); }, /average/],
  ["a region row no longer equal to its parts", (facts: SocialFact[]) => { plus(find(facts, "social.pension.recipients", "region.imereti", 2020), "1"); }, /pension\.recipients region\.imereti.*do not add up.*unrecorded difference found -1/],
  ["regions no longer adding to Georgia", (facts: SocialFact[]) => { plus(find(facts, "social.subsistence.registered_persons", "region.tbilisi", 2020), "1"); }, /do not add up/],
  ["a recorded source finding that stops recurring", (facts: SocialFact[]) => { plus(find(facts, "social.subsistence.amount", "48", 2013), "126"); }, /recorded difference no longer occurs, expected -126, found none/],
  ["social package groups no longer adding to the total", (facts: SocialFact[]) => { plus(find(facts, "social.social_package.survivors.recipients", SOCIAL_GEORGIA, 2020), "1"); }, /groups.*do not add up/],
  ["disability parts no longer adding to disability", (facts: SocialFact[]) => { plus(find(facts, "social.social_package.disability_severe.recipients", SOCIAL_GEORGIA, 2020), "1"); }, /disability parts.*do not add up/],
  ["a payments row that no longer repeats its programme", (facts: SocialFact[]) => { plus(find(facts, "social.payments.pension.amount", SOCIAL_GEORGIA, 2020), "1"); plus(find(facts, "social.payments.total.amount", SOCIAL_GEORGIA, 2020), "1"); }, /payments row/],
  ["a first money year with fewer than 12 months", (facts: SocialFact[]) => { find(facts, "social.pension_highmountain.amount", "06", 2017).months = 4; }, /first year/],
  ["a count covering more than its December", (facts: SocialFact[]) => { find(facts, "social.pension.recipients", "06", 2020).months = 12; }, /source contract/],
  ["an average where the amount is zero", (facts: SocialFact[]) => { facts.push({ ...find(facts, "social.pension_highmountain.avg_monthly", SOCIAL_GEORGIA, 2020), geographyId: "region.tbilisi" }); }, /outside the approved coverage/],
  ["a changed anchor", (facts: SocialFact[]) => { plus(find(facts, "social.payments.water_subsidy.amount", SOCIAL_GEORGIA, 2025), "1"); plus(find(facts, "social.payments.total.amount", SOCIAL_GEORGIA, 2025), "1"); }, /anchor/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  const inputs = await loadSocialAverageInputs(root);
  validateSocialFacts(facts, inputs);
  mutate(facts);
  expect(() => validateSocialFacts(facts, inputs)).toThrow(error);
});

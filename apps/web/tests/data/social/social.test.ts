import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { assertSocialParity, loadSocialBreaks, loadSocialFacts, toClientSocialFact } from "../../../lib/data/social/importSocial";
import { loadSocialFactsFromMirror, socialMirrorCreateRows } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { FUNDED_REVIEWED_AT, REVIEWED_AT, SOCIAL_CSV_HEADERS, checkKnownDifferences, loadSocialAverageInputs, prepareSocialData } from "../../../lib/data/social/prepareSocial";
import {
  FUNDED_PENSION_MONEY as FUNDED_MONEY, FUNDED_PENSION_SOURCES, SOCIAL_AGE_BANDS, SOCIAL_GEORGIA, SOCIAL_INDICATORS, SOCIAL_PAYMENT_PROGRAMMES, SOCIAL_PUBLIC_SOURCES, SOCIAL_SOURCES, socialFactKey, socialSourceDocumentId, type SocialFact, type SocialIndicator,
} from "../../../lib/data/social/types";
import { SOCIAL_AVERAGE_GAPS, SOCIAL_KNOWN_DIFFERENCES, expectedSocialKeys, socialAverage, validateSocialFacts, type SocialAverageInputs } from "../../../lib/data/social/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/Social/ssa-statistics");
const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = async (): Promise<SocialFact[]> =>
  (await readCsv(path.join(root, "data/imports/social-protection-annual.csv"))).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as SocialIndicator, geographyId: row.geography_id, value: row.value, unit: row.unit as SocialFact["unit"],
    months: Number(row.months), basis: row.basis as "actual", valueStatus: row.value_status as SocialFact["valueStatus"], sourceId: row.source_id,
    sourceWorkbook: row.source_workbook, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
/** The funded pension rows have their own rules (negative gains, 12-month counts); the SSA tests below look at the SSA rows. */
const ssaOnly = (facts: readonly SocialFact[]) => facts.filter(f => !f.indicatorId.startsWith("social.funded_pension."));
const find = (facts: readonly SocialFact[], indicatorId: string, geographyId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.geographyId === geographyId && f.year === year)!;
const has = (facts: readonly SocialFact[], indicatorId: string, geographyId: string, year: number) => facts.some(f => f.indicatorId === indicatorId && f.geographyId === geographyId && f.year === year);
type SocialInput = SocialAverageInputs extends ReadonlyMap<string, infer V> ? V : never;
const plus = (f: SocialFact, amount: string) => Object.assign(f, { value: new Decimal(f.value).plus(amount).toFixed(f.indicatorId.endsWith(".avg_monthly") ? 2 : 0) });

test("the committed canonical files match a fresh preparation from the research package", async () => {
  await expect(prepareSocialData(root, "check")).resolves.toBeUndefined();
}, 60_000);

test("serves the package's place, social package and programme values, with the averages and payments rows added", async () => {
  const facts = await loadFacts();
  const rows = await readCsv(path.join(research, "ssa-served-annual.csv"));
  expect(rows).toHaveLength(24451);
  // Inputs only: month-count sums, the regular subsistence money and social package rows the group total repeats.
  const inputsOnly = (row: Record<string, string>) => row.measure.endsWith("count_months_sum") || row.measure === "regular_amount" || row.programme === "social_package";
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
    || row.programme === "social_package_group" && /^group\.[a-z_]+\.amount$/.test(row.measure)).filter(row => row.value !== "0")
    // Counts that miss a month the money has (the recorded gaps) give no average.
    .filter(row => !SOCIAL_AVERAGE_GAPS.some(gap => gap.geographyId === row.geography_id && String(gap.year) === row.year
      && gap.indicatorId === (row.programme === "social_package_group" ? `social.social_package.${row.measure.split(".")[1]}` : `social.${row.programme === "subsistence_allowance" ? "subsistence" : row.programme}`) + ".avg_monthly"));
  const payments = rows.filter(row => national(row) && row.programme !== "pension_idp");
  const years = new Set(rows.map(row => row.year)).size;
  const funded = await readCsv(path.join(root, "docs/Raw Data/Social/pension-fund/pension-fund-annual.csv"));
  expect(funded).toHaveLength(99);
  expect(facts).toHaveLength(served.length + averaged.length + payments.length + years + funded.length);
  expect(facts).toHaveLength(22087);
  expect(facts.filter(f => f.indicatorId.startsWith("social.funded_pension."))).toHaveLength(99);
  expect(SOCIAL_INDICATORS).toHaveLength(88);
  expect(SOCIAL_PAYMENT_PROGRAMMES).toHaveLength(18);
  expect(SOCIAL_SOURCES).toHaveLength(30);
  expect(SOCIAL_PUBLIC_SOURCES).toEqual([...SOCIAL_SOURCES, "ssa_statistics"]);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(SOCIAL_INDICATORS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(SOCIAL_PUBLIC_SOURCES));
  expect(facts.every(f => f.basis === "actual" && f.lastReviewedAt === (f.indicatorId.startsWith("social.funded_pension.") ? FUNDED_REVIEWED_AT : REVIEWED_AT))).toBe(true);
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
  expect(ssaOnly(facts).filter(f => f.indicatorId.endsWith(".amount") || f.indicatorId.endsWith(".employment_amount")).every(f => f.unit === "gel" && /^\d+$/.test(f.value))).toBe(true);
  expect(find(facts, "social.subsistence.families", "06", 2025).unit).toBe("families");
  expect(find(facts, "social.subsistence.persons", "06", 2025).unit).toBe("persons");
});

test("the people in receiving families are served by SSA's eight age bands, which add up to them in every place and year", async () => {
  const facts = await loadFacts();
  expect(SOCIAL_AGE_BANDS).toEqual(["0_6", "6_18", "18_30", "30_40", "40_60", "60_65", "65_70", "70_plus"]);
  const georgia = Object.fromEntries(SOCIAL_AGE_BANDS.map(band => [band, find(facts, `social.subsistence.persons_age_${band}`, SOCIAL_GEORGIA, 2025).value]));
  expect(georgia).toEqual({ "0_6": "47751", "6_18": "142684", "18_30": "42569", "30_40": "67960", "40_60": "82482", "60_65": "18292", "65_70": "19641", "70_plus": "41743" });
  expect(find(facts, "social.subsistence.persons_age_0_6", SOCIAL_GEORGIA, 2025)).toMatchObject({
    unit: "persons", months: 1, valueStatus: "official", sourceId: "ssa_tsa_allowance_03", sourceWorkbook: "ssa-tsa_allowance-03-2025.xlsx", sourceSheet: "December", sourceCell: "B93",
  });
  const persons = facts.filter(f => f.indicatorId === "social.subsistence.persons");
  const ages = facts.filter(f => f.indicatorId.startsWith("social.subsistence.persons_age_"));
  expect(ages).toHaveLength(persons.length * 8);
  for (const total of persons) {
    const sum = SOCIAL_AGE_BANDS.reduce((acc, band) => acc.plus(find(facts, `social.subsistence.persons_age_${band}`, total.geographyId, total.year).value), new Decimal(0));
    expect(sum.toFixed(), socialFactKey(total)).toBe(total.value);
  }
});

test("every social package group has an exact average per month: its money ÷ its monthly people counts", async () => {
  const facts = await loadFacts();
  const rows = await readCsv(path.join(research, "ssa-served-annual.csv"));
  const served = new Map(rows.map(row => [`${row.measure}|${row.year}`, row]));
  const averages = facts.filter(f => /^social\.social_package\.[a-z_]+\.avg_monthly$/.test(f.indicatorId));
  expect(new Set(averages.map(f => f.indicatorId.split(".")[2]))).toEqual(new Set(["total", "disability", "disability_children", "disability_severe", "disability_significant", "disability_moderate", "survivors", "war_participants", "political_repression", "other"]));
  expect(averages).toHaveLength(102);
  for (const f of averages) {
    const group = f.indicatorId.split(".")[2];
    const amount = served.get(`group.${group}.amount|${f.year}`)!;
    const count = served.get(`group.${group}.count_months_sum|${f.year}`)!;
    expect(f.value, socialFactKey(f)).toBe(new Decimal(amount.value).div(count.value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2));
    expect(f).toMatchObject({ unit: "gel", months: 12, valueStatus: "calculated", sourceId: "ssa_socpackage_02", geographyId: SOCIAL_GEORGIA });
    expect(Number(count.months)).toBe(12);
  }
  const value = (group: string, year: number) => find(facts, `social.social_package.${group}.avg_monthly`, SOCIAL_GEORGIA, year).value;
  // 2025: 40,060,338 GEL paid to war participants over 394,271 recipient-months; 25,626,678 GEL to survivors over 249,033.
  expect(value("war_participants", 2025)).toBe("101.61");
  expect(value("survivors", 2025)).toBe("102.90");
  expect(value("total", 2025)).toBe("242.72");
  expect(find(facts, "social.social_package.war_participants.avg_monthly", SOCIAL_GEORGIA, 2025).sourceCell).toMatch(/^\(.+\)\/\(.+\)$/);
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
  // A group's average starts with its money, in the group's first 12-month year.
  expect(has(facts, "social.social_package.disability_severe.avg_monthly", SOCIAL_GEORGIA, 2017)).toBe(false);
  expect(has(facts, "social.social_package.disability_severe.avg_monthly", SOCIAL_GEORGIA, 2018)).toBe(true);
  expect(has(facts, "social.social_package.war_participants.avg_monthly", SOCIAL_GEORGIA, 2019)).toBe(false);
  expect(has(facts, "social.social_package.war_participants.avg_monthly", SOCIAL_GEORGIA, 2020)).toBe(true);
  expect(has(facts, "social.social_package.survivors.avg_monthly", SOCIAL_GEORGIA, 2013)).toBe(true);
  // SSA's blank July 2022 national moderate-disability count leaves that year's average out; the money stays.
  expect(has(facts, "social.social_package.disability_moderate.amount", SOCIAL_GEORGIA, 2022)).toBe(true);
  expect(has(facts, "social.social_package.disability_moderate.avg_monthly", SOCIAL_GEORGIA, 2022)).toBe(false);
  expect(has(facts, "social.social_package.disability_moderate.avg_monthly", SOCIAL_GEORGIA, 2023)).toBe(true);
  expect(has(facts, "social.subsistence.employment_families", SOCIAL_GEORGIA, 2022)).toBe(true);
  expect(has(facts, "social.subsistence.employment_amount", SOCIAL_GEORGIA, 2022)).toBe(false);
  // A later partial year stays, marked with its months.
  expect(find(facts, "social.pension.amount", "unit.upper_abkhazia", 2022).months).toBe(9);
  expect(ssaOnly(facts).filter(f => !/(amount|avg_monthly)$/.test(f.indicatorId)).every(f => f.months === 1)).toBe(true);
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
  expect(rows[0].applies_to.split(";")).toEqual(["social.subsistence.families", "social.subsistence.persons", ...SOCIAL_AGE_BANDS.map(band => `social.subsistence.persons_age_${band}`)]);
  expect(new Set(rows[1].applies_to.split(";"))).toEqual(new Set([
    "social.social_package.other.recipients", "social.social_package.other.amount", "social.social_package.other.avg_monthly",
    "social.social_package.disability.recipients", "social.social_package.disability.amount", "social.social_package.disability.avg_monthly",
  ]));
  expect(rows.every(r => r.reason && r.source_note)).toBe(true);
});

test("validation accepts the recorded source findings, and only those", async () => {
  const facts = await loadFacts();
  const inputs = await loadSocialAverageInputs(root);
  expect(() => validateSocialFacts(facts, inputs)).not.toThrow();
  expect(() => validateSocialFacts(facts)).not.toThrow();
  expect(SOCIAL_KNOWN_DIFFERENCES.map(k => `${k.check}|${k.year}|${k.difference}`)).toEqual([
    "social.pension_idp.amount region.shida_kartli|2015|404686", "social.subsistence.amount region.kvemo_kartli|2013|-126", "social.social_package.amount groups|2022|56",
    "social.social_package.count_months_sum groups|2021|-1",
  ]);
  expect(SOCIAL_AVERAGE_GAPS.map(g => socialFactKey(g))).toEqual(["social.subsistence.avg_monthly:unit.upper_abkhazia:2014", "social.social_package.disability_moderate.avg_monthly:country.georgia:2022"]);
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
  ["age bands no longer adding up to the people in receiving families", (facts: SocialFact[]) => {
    // The same band in Batumi, Adjara and Georgia, so every region and Georgia still add up and only the band sum breaks.
    for (const place of ["06", "region.adjara", SOCIAL_GEORGIA]) plus(find(facts, "social.subsistence.persons_age_30_40", place, 2020), "1");
  }, /subsistence\.persons age groups country\.georgia .*do not add up.*unrecorded difference found 1/],
  ["a missing age band", (facts: SocialFact[]) => { facts.splice(facts.indexOf(find(facts, "social.subsistence.persons_age_70_plus", "06", 2020)), 1); }, /Incomplete/],
  ["an age band citing the persons table", (facts: SocialFact[]) => { find(facts, "social.subsistence.persons_age_0_6", "06", 2020).sourceId = "ssa_tsa_allowance_01"; }, /source contract/],
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

test.each([
  ["a group average off by 0.01", (facts: SocialFact[]) => { plus(find(facts, "social.social_package.war_participants.avg_monthly", SOCIAL_GEORGIA, 2025), "0.01"); }, /average/],
  ["a group's month counts no longer adding up to the total's", (facts: SocialFact[], inputs: Map<string, SocialInput>) => {
    const key = "social.social_package.survivors.avg_monthly:country.georgia:2020";
    const input = inputs.get(key)!;
    inputs.set(key, { ...input, count: new Decimal(input.count).plus(1).toFixed() });
    find(facts, "social.social_package.survivors.avg_monthly", SOCIAL_GEORGIA, 2020).value = socialAverage(input.amount, new Decimal(input.count).plus(1).toFixed());
  }, /count_months_sum groups.*2020/],
  ["a group average whose counts miss a month its money has", (_: SocialFact[], inputs: Map<string, SocialInput>) => {
    const key = "social.social_package.survivors.avg_monthly:country.georgia:2020";
    inputs.set(key, { ...inputs.get(key)!, countMonths: 11 });
  }, /months/],
  ["an unrecorded average whose counts miss a month, where the money is zero", (_: SocialFact[], inputs: Map<string, SocialInput>) => {
    const key = "social.subsistence.avg_monthly:unit.upper_abkhazia:2015";
    inputs.set(key, { ...inputs.get(key)!, countMonths: inputs.get(key)!.amountMonths - 1 });
  }, /no gap is recorded/],
  ["a recorded average gap whose counts no longer miss a month", (_: SocialFact[], inputs: Map<string, SocialInput>) => {
    const key = "social.social_package.disability_moderate.avg_monthly:country.georgia:2022";
    inputs.set(key, { ...inputs.get(key)!, countMonths: 12 });
  }, /recorded average gap no longer has counts missing a month/],
  ["a recorded average gap that is served", (facts: SocialFact[]) => {
    facts.push({ ...find(facts, "social.social_package.disability_moderate.avg_monthly", SOCIAL_GEORGIA, 2023), year: 2022 });
  }, /gap/],
  ["a missing group average", (facts: SocialFact[]) => { facts.splice(facts.indexOf(find(facts, "social.social_package.other.avg_monthly", SOCIAL_GEORGIA, 2016)), 1); }, /Incomplete/],
] as const)("validation with the month-count sums rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  const inputs = new Map(await loadSocialAverageInputs(root));
  validateSocialFacts(facts, inputs);
  mutate(facts, inputs);
  expect(() => validateSocialFacts(facts, inputs)).toThrow(error);
});

test("prepare requires each recorded national average gap's blank cell in the source findings", async () => {
  await expect(checkKnownDifferences(research)).resolves.toBeUndefined();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "social-findings-"));
  try {
    const findings = await fs.readFile(path.join(research, "source-findings.csv"), "utf8");
    const blank = findings.split("\n").filter(line => line.startsWith("socpackage-01,2022,7,E,"));
    expect(blank).toHaveLength(1);
    await fs.writeFile(path.join(directory, "source-findings.csv"), findings.replace(`${blank[0]}\n`, ""));
    await expect(checkKnownDifferences(directory)).rejects.toThrow(/average gap has no matching source finding: social\.social_package\.disability_moderate\.avg_monthly 2022/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("the loader reads the committed canonical file and its break register", async () => {
  const facts = await loadSocialFacts();
  expect(facts).toEqual(await loadFacts());
  expect(facts).toHaveLength(22087);
  const breaks = await loadSocialBreaks();
  expect(breaks.map(b => b.breakId)).toEqual(["subsistence_employment_2022", "social_package_groups_2025"]);
  expect(breaks[0].appliesTo).toEqual(["social.subsistence.families", "social.subsistence.persons", ...SOCIAL_AGE_BANDS.map(band => `social.subsistence.persons_age_${band}`)]);
});

test("parity accepts equal rows and the same decimal written differently, and rejects a changed value or a missing row", async () => {
  const facts = await loadFacts();
  expect(() => assertSocialParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
  const average = facts.findIndex(f => f.indicatorId === "social.pension.avg_monthly" && f.geographyId === SOCIAL_GEORGIA && f.year === 2025);
  expect(facts[average].value).toBe("405.13");
  const padded = facts.map(f => ({ ...f }));
  padded[average].value = "405.130";
  expect(() => assertSocialParity(facts, padded)).not.toThrow();
  const changed = facts.map(f => ({ ...f }));
  changed[average].value = "405.14";
  expect(() => assertSocialParity(facts, changed)).toThrow();
  expect(() => assertSocialParity(facts, facts.slice(1))).toThrow();
});

test("client facts give money in million GEL and leave averages and counts as they are", async () => {
  const facts = await loadFacts();
  expect(toClientSocialFact(find(facts, "social.pension.amount", SOCIAL_GEORGIA, 2025))).toEqual({
    year: 2025, indicatorId: "social.pension.amount", geographyId: SOCIAL_GEORGIA, sourceId: "ssa_pension_01", months: 12, valueStatus: "calculated", value: 4262.30909,
  });
  expect(toClientSocialFact(find(facts, "social.pension.avg_monthly", SOCIAL_GEORGIA, 2025))).toMatchObject({ value: 405.13, valueStatus: "calculated" });
  expect(toClientSocialFact(find(facts, "social.pension.recipients", SOCIAL_GEORGIA, 2025)).value).toBe(888518);
  expect(toClientSocialFact(find(facts, "social.subsistence.employment_amount", SOCIAL_GEORGIA, 2025)).value).toBe(Number(find(facts, "social.subsistence.employment_amount", SOCIAL_GEORGIA, 2025).value) / 1e6);
  expect(toClientSocialFact(find(facts, "social.payments.total.amount", SOCIAL_GEORGIA, 2025)).value).toBe(6166.123811);
  expect(toClientSocialFact(find(facts, "social.subsistence.avg_monthly", SOCIAL_GEORGIA, 2025)).value).toBe(Number(find(facts, "social.subsistence.avg_monthly", SOCIAL_GEORGIA, 2025).value));
});

test("every converted money value is a clean million-GEL decimal, with no floating-point drift", async () => {
  const facts = await loadFacts();
  const money = facts.filter(f => /\.(amount|employment_amount)$/.test(f.indicatorId));
  expect(money.length).toBeGreaterThan(0);
  expect(money.every(f => toClientSocialFact(f).value === Number(new Decimal(f.value).div(1e6).toFixed()))).toBe(true);
  expect(facts.filter(f => !/\.(amount|employment_amount)$/.test(f.indicatorId)).every(f => toClientSocialFact(f).value === Number(f.value))).toBe(true);
});

test("the database mirror round-trips exact decimals, months and source relations", async () => {
  const facts = await loadFacts();
  const rows = socialMirrorCreateRows(facts, "social-run-1").map(row => ({ ...row, value: new Decimal(row.value as string) }));
  const db = (list: typeof rows) => ({ socialFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "socialFact">;
  const mirror = await loadSocialFactsFromMirror(db(rows));
  expect(() => assertSocialParity(facts, mirror)).not.toThrow();
  expect(mirror.find(f => f.indicatorId === "social.payments.covid_vulnerable_compensation.amount" && f.year === 2020)!.months).toBe(6);
  expect(rows[0].importRunId).toBe("social-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}` && row.sourceDocumentId === socialSourceDocumentId(row.sourceId))).toBe(true);
  await expect(loadSocialFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
});

test("every cited source has a source-document row", async () => {
  const csv = await fs.readFile(path.join(root, "data/sources/source-documents.csv"));
  const ids = new Set((parse(csv, { columns: true, bom: true }) as Record<string, string>[]).map(r => r.source_id));
  expect(FUNDED_PENSION_SOURCES.every(id => SOCIAL_PUBLIC_SOURCES.includes(id))).toBe(true);
  expect(SOCIAL_PUBLIC_SOURCES.filter(id => !ids.has(socialSourceDocumentId(id)))).toEqual([]);
});

test("the funded pension values are the Pension Fund package's 99 printed figures, each citing its statement", async () => {
  const facts = (await loadFacts()).filter(f => f.indicatorId.startsWith("social.funded_pension."));
  const rows = await readCsv(path.join(root, "docs/Raw Data/Social/pension-fund/pension-fund-annual.csv"));
  expect(facts).toHaveLength(rows.length);
  for (const row of rows) {
    const indicatorId = (FUNDED_MONEY as readonly string[]).includes(row.measure) ? `social.funded_pension.${row.measure}.amount` : `social.funded_pension.${row.measure}`;
    expect(find(facts, indicatorId, SOCIAL_GEORGIA, Number(row.year)), `${row.measure} ${row.year}`).toMatchObject({
      value: row.value, unit: row.unit, months: Number(row.months), basis: "actual", valueStatus: "official", sourceId: row.source_id,
      sourceWorkbook: row.document, sourceSheet: row.page, sourceCell: row.line, lastReviewedAt: FUNDED_REVIEWED_AT,
    });
  }
  expect(find(facts, "social.funded_pension.savings.amount", SOCIAL_GEORGIA, 2025).value).toBe("8237530000");
  expect(find(facts, "social.funded_pension.securities_gains.amount", SOCIAL_GEORGIA, 2022).value).toBe("-31187000");
  expect(has(facts, "social.funded_pension.dividends.amount", SOCIAL_GEORGIA, 2021)).toBe(false);
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(FUNDED_PENSION_SOURCES));
});

/** A temporary repository root holding only a copy of the Pension Fund package (the six served statements), which prepare reads before the SSA package. */
async function withFundedPackage(change: (directory: string) => Promise<void>, run: (repositoryRoot: string) => Promise<void>) {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-funded-"));
  try {
    const source = path.join(root, "docs/Raw Data/Social/pension-fund");
    const directory = path.join(repositoryRoot, "docs/Raw Data/Social/pension-fund");
    await fs.mkdir(path.join(directory, "official"), { recursive: true });
    for (const name of ["pension-fund-annual.csv", "source-manifest.json", "validation-report.json"]) await fs.copyFile(path.join(source, name), path.join(directory, name));
    for (const name of ["2020-IFRS.pdf", "2022-IFRS-GE.pdf", "2023-IFRS-GE.pdf", "2024-IFRS-GE.pdf", "2025-IFRS.pdf", "Annual_Rep_2025_geo.pdf"]) {
      await fs.copyFile(path.join(source, "official", name), path.join(directory, "official", name));
    }
    await change(directory);
    await run(repositoryRoot);
  } finally {
    await fs.rm(repositoryRoot, { recursive: true, force: true });
  }
}

test("prepare rejects a Pension Fund statement that no longer matches the package manifest", async () => {
  await withFundedPackage(async directory => {
    const file = path.join(directory, "official/2022-IFRS-GE.pdf");
    const bytes = await fs.readFile(file);
    bytes[bytes.length - 1] ^= 1;
    await fs.writeFile(file, bytes);
  }, async repositoryRoot => {
    await expect(prepareSocialData(repositoryRoot, "check")).rejects.toThrow(/Social source capture mismatch: 2022-IFRS-GE\.pdf/);
  });
}, 60_000);

test.each([
  ["a package whose validation did not pass", async (directory: string) => {
    const file = path.join(directory, "validation-report.json");
    await fs.writeFile(file, (await fs.readFile(file, "utf8")).replace('"passed": true', '"passed": false'));
  }, /Pension fund research package validation has not passed/],
  ["a package with a changed row count", async (directory: string) => {
    const file = path.join(directory, "pension-fund-annual.csv");
    await fs.writeFile(file, (await fs.readFile(file, "utf8")).trimEnd().split("\n").slice(0, -1).join("\n") + "\n");
  }, /Pension fund file has 98 rows, expected 99/],
  ["a package with a changed header", async (directory: string) => {
    const file = path.join(directory, "pension-fund-annual.csv");
    await fs.writeFile(file, (await fs.readFile(file, "utf8")).replace("measure,year,value", "measure,year,amount"));
  }, /Pension fund file header changed/],
  ["a row that cites a document other than its source's", async (directory: string) => {
    const file = path.join(directory, "pension-fund-annual.csv");
    await fs.writeFile(file, (await fs.readFile(file, "utf8")).replace("pension_fund_ifrs_2020,2020-IFRS.pdf", "pension_fund_ifrs_2020,2022-IFRS-GE.pdf"));
  }, /Pension fund document not in the source manifest/],
  // A value that no anchor, row count or document name guards: only the hash the package's report holds for the CSV catches it.
  ["a package whose CSV has a hand-edited value", async (directory: string) => {
    const file = path.join(directory, "pension-fund-annual.csv");
    const text = await fs.readFile(file, "utf8");
    expect(text).toContain("interest,2021,163741000,");
    await fs.writeFile(file, text.replace("interest,2021,163741000,", "interest,2021,163741001,"));
  }, /Social source capture mismatch: pension-fund-annual\.csv/],
])("prepare rejects %s", async (_name, change, message) => {
  await withFundedPackage(change, async repositoryRoot => {
    await expect(prepareSocialData(repositoryRoot, "check")).rejects.toThrow(message);
  });
}, 60_000);

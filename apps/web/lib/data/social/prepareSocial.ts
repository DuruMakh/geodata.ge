import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type { CsvRecord } from "../csv";
import { fundedPensionMonths, fundedPensionUnit } from "./fundedPension";
import {
  FUNDED_PENSION_COUNTS, FUNDED_PENSION_MONEY, FUNDED_PENSION_SOURCES, SOCIAL_AGE_BANDS, SOCIAL_GEORGIA, SOCIAL_INDICATORS, SOCIAL_MUNICIPALITIES, SOCIAL_PACKAGE_GROUPS, SOCIAL_PAYMENT_PROGRAMMES, SOCIAL_REGIONS, SOCIAL_SOURCES, SOCIAL_UNITS,
  socialFactKey, socialSourceId, type SocialAcceptance, type SocialFact, type SocialIndicator, type SocialSeriesBreak,
} from "./types";
import { SOCIAL_AVERAGES, SOCIAL_AVERAGE_GAPS, SOCIAL_KNOWN_DIFFERENCES, socialAverage, socialUnit, validateSocialFacts, type SocialAverageInputs } from "./validation";

const RESEARCH = "docs/Raw Data/Social/ssa-statistics";
const FUNDED_RESEARCH = "docs/Raw Data/Social/pension-fund";
export const REVIEWED_AT = "2026-10-20";
/** The Pension Fund package was retrieved and read on this date. */
export const FUNDED_REVIEWED_AT = "2026-10-21";
export const SOCIAL_CSV_HEADERS = ["year", "indicator_id", "geography_id", "value", "unit", "months", "basis", "value_status", "source_id", "source_workbook", "source_sheet", "source_cell", "last_reviewed_at"];
const PACKAGE_HEADERS = ["programme", "measure", "geography_id", "year", "value", "months", "value_status", "source_table", "source_workbook", "source_sheet", "source_cell"];
const FUNDED_HEADERS = ["measure", "year", "value", "unit", "months", "source_id", "document", "page", "line"];
const BREAK_HEADERS = ["break_id", "applies_to", "reference_date", "reason", "source_note"];
const SERVED_ROWS = 24451;
const FUNDED_ROWS = 99;
type Source = { source_id: string; kind: string; table_id: string; local_file: string; sha256: string; bytes: number };
type FundedSource = { source_id: string; document: string; local_file: string; sha256: string; bytes: number; used_for: string };

/** The package's own measures served as an indicator of their own (social package groups are mapped by name below). */
const OWN: Readonly<Record<string, SocialIndicator>> = {
  "pension|recipients": "social.pension.recipients", "pension|amount": "social.pension.amount",
  "pension_idp|recipients": "social.pension_idp.recipients", "pension_idp|amount": "social.pension_idp.amount",
  "pension_highmountain|recipients": "social.pension_highmountain.recipients", "pension_highmountain|amount": "social.pension_highmountain.amount",
  "subsistence_allowance|recipients": "social.subsistence.families", "subsistence_allowance|persons": "social.subsistence.persons",
  "subsistence_allowance|employment_families": "social.subsistence.employment_families", "subsistence_allowance|amount": "social.subsistence.amount",
  "subsistence_allowance|employment_amount": "social.subsistence.employment_amount",
  "tsa_registered|recipients": "social.subsistence.registered_families", "tsa_registered|persons": "social.subsistence.registered_persons",
  ...Object.fromEntries(SOCIAL_AGE_BANDS.map(band => [`subsistence_allowance|age.${band}.persons`, `social.subsistence.persons_age_${band}` as const])),
};
/**
 * Where each average's money and month-count sum come from. The subsistence average covers regular recipients only; a
 * social package group divides its money by its own monthly people counts.
 */
const AVERAGE_INPUTS: Readonly<Record<string, { programme: string; amount: string; count: string }>> = {
  "social.pension.avg_monthly": { programme: "pension", amount: "amount", count: "count_months_sum" },
  "social.pension_highmountain.avg_monthly": { programme: "pension_highmountain", amount: "amount", count: "count_months_sum" },
  "social.subsistence.avg_monthly": { programme: "subsistence_allowance", amount: "regular_amount", count: "regular_count_months_sum" },
  "social.social_package.total.avg_monthly": { programme: "social_package", amount: "amount", count: "count_months_sum" },
  ...Object.fromEntries(SOCIAL_PACKAGE_GROUPS.filter(group => group !== "total").map(group => [
    `social.social_package.${group}.avg_monthly`, { programme: "social_package_group", amount: `group.${group}.amount`, count: `group.${group}.count_months_sum` },
  ])),
};
/** Rows used only to calculate averages (every month-count sum), and the social package total that `group.total` repeats. */
const INPUT_ONLY = (row: CsvRecord) => row.measure.endsWith("count_months_sum") || row.measure === "regular_amount" || row.programme === "social_package";

const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
const packageKey = (programme: string, measure: string, geographyId: string, year: string | number) => `${programme}|${measure}|${geographyId}|${year}`;

async function readServedPackage(repositoryRoot: string): Promise<CsvRecord[]> {
  const file = path.join(repositoryRoot, RESEARCH, "ssa-served-annual.csv");
  const header = (parse(await fs.readFile(file), { bom: true, to_line: 1 }) as string[][])[0];
  if (header.join(",") !== PACKAGE_HEADERS.join(",")) throw new Error("Social served file header changed");
  const rows = await readCsv(file);
  if (rows.length !== SERVED_ROWS) throw new Error(`Social served file has ${rows.length} rows, expected ${SERVED_ROWS}`);
  return rows;
}

function averageInputs(rows: readonly CsvRecord[]): SocialAverageInputs {
  const byKey = new Map(rows.map(row => [packageKey(row.programme, row.measure, row.geography_id, row.year), row]));
  const inputs = new Map<string, { amount: string; count: string; amountMonths: number; countMonths: number }>();
  for (const row of rows) {
    for (const [indicatorId, source] of Object.entries(AVERAGE_INPUTS)) {
      if (row.programme !== source.programme || row.measure !== source.amount) continue;
      const count = byKey.get(packageKey(row.programme, source.count, row.geography_id, row.year));
      if (count === undefined) throw new Error(`Social month-count sum missing: ${row.programme} ${row.measure} ${row.geography_id} ${row.year}`);
      inputs.set(socialFactKey({ indicatorId: indicatorId as SocialIndicator, geographyId: row.geography_id, year: Number(row.year) }),
        { amount: row.value, count: count.value, amountMonths: Number(row.months), countMonths: Number(count.months) });
    }
  }
  return inputs;
}

/** The money and month-count sum of every average, read from the research package's served file. */
export async function loadSocialAverageInputs(repositoryRoot: string): Promise<SocialAverageInputs> {
  return averageInputs(await readServedPackage(repositoryRoot));
}

/**
 * Every SSA workbook a served value is read from, and SSA's statistics page, against the package manifest; and the package's own checks.
 * The Pension Fund's documents are not SSA tables: `readFundedPension` verifies them, and together the two cover every source in SOCIAL_SOURCES.
 */
async function checkPackage(directory: string, rows: readonly CsvRecord[]): Promise<string> {
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  const tables = new Set(rows.map(row => row.source_table));
  const ssaSources = SOCIAL_SOURCES.filter(id => !FUNDED_PENSION_SOURCES.includes(id));
  if (tables.size !== ssaSources.length || [...tables].some(table => !ssaSources.includes(socialSourceId(table)))) throw new Error("Social source inventory mismatch");
  const workbooks = new Map(rows.map(row => [row.source_workbook, row.source_table]));
  for (const [workbook, table] of workbooks) {
    const entries = manifest.filter(source => source.kind === "workbook" && source.local_file === `official/workbooks/${workbook}`);
    if (entries.length !== 1 || entries[0].table_id !== table) throw new Error(`Social workbook not in the source manifest: ${workbook}`);
    await readVerifiedPackageFile(directory, entries[0].local_file, entries[0], `Social source capture mismatch: ${workbook}`);
  }
  const page = manifest.filter(source => source.source_id === "page-statistiklist");
  if (page.length !== 1) throw new Error("Social statistics page not in the source manifest");
  await readVerifiedPackageFile(directory, page[0].local_file, page[0], "Social source capture mismatch: SSA statistics page");
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { passed: boolean; failures: unknown[]; counts: { served_rows: number } };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { passed: boolean; problems: number; served_rows_checked: number };
  if (report.passed !== true || report.failures.length !== 0 || report.counts.served_rows !== SERVED_ROWS
    || independent.passed !== true || independent.problems !== 0 || independent.served_rows_checked !== SERVED_ROWS) throw new Error("Social research package validation has not passed");
  return "passed";
}

/**
 * The Pension Fund package's 99 printed figures as facts. Each cited statement is read against `source-manifest.json` (size and
 * SHA-256) and the package's own validation must have passed; `page` and `line` become the sheet and cell of the fact.
 */
async function readFundedPension(repositoryRoot: string): Promise<SocialFact[]> {
  const directory = path.join(repositoryRoot, FUNDED_RESEARCH);
  const file = path.join(directory, "pension-fund-annual.csv");
  const header = (parse(await fs.readFile(file), { bom: true, to_line: 1 }) as string[][])[0];
  if (header.join(",") !== FUNDED_HEADERS.join(",")) throw new Error("Pension fund file header changed");
  const rows = await readCsv(file);
  if (rows.length !== FUNDED_ROWS) throw new Error(`Pension fund file has ${rows.length} rows, expected ${FUNDED_ROWS}`);
  const manifest: FundedSource[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  const served = manifest.filter(source => source.used_for === "served");
  if (served.length !== FUNDED_PENSION_SOURCES.length || served.some(source => !FUNDED_PENSION_SOURCES.includes(source.source_id))) throw new Error("Pension fund source inventory mismatch");
  for (const row of rows) {
    if (!served.some(source => source.source_id === row.source_id && source.document === row.document)) throw new Error(`Pension fund document not in the source manifest: ${row.document}`);
  }
  for (const source of served) await readVerifiedPackageFile(directory, source.local_file, source, `Social source capture mismatch: ${source.document}`);
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { passed: boolean; failures: unknown[]; rows: number; csv_sha256: string };
  if (report.passed !== true || report.failures.length !== 0 || report.rows !== FUNDED_ROWS) throw new Error("Pension fund research package validation has not passed");
  // The report names the CSV `extract.py` wrote beside it, so a value edited by hand in the CSV is caught here.
  if (createHash("sha256").update(await fs.readFile(file)).digest("hex") !== report.csv_sha256) throw new Error("Social source capture mismatch: pension-fund-annual.csv");
  return rows.map(row => {
    const indicatorId = (FUNDED_PENSION_MONEY as readonly string[]).includes(row.measure) ? `social.funded_pension.${row.measure}.amount`
      : [...FUNDED_PENSION_COUNTS, "return"].includes(row.measure) ? `social.funded_pension.${row.measure}` : null;
    if (!indicatorId || !(SOCIAL_INDICATORS as readonly string[]).includes(indicatorId)) throw new Error(`Pension fund row has no indicator: ${row.measure}`);
    const unit = fundedPensionUnit(indicatorId);
    const months = fundedPensionMonths(indicatorId);
    if (row.unit !== unit || Number(row.months) !== months) throw new Error(`Pension fund row disagrees with its indicator: ${row.measure} ${row.year}`);
    return {
      year: Number(row.year), indicatorId: indicatorId as SocialIndicator, geographyId: SOCIAL_GEORGIA, value: row.value, unit, months,
      basis: "actual", valueStatus: "official", sourceId: row.source_id, sourceWorkbook: row.document, sourceSheet: row.page, sourceCell: row.line, lastReviewedAt: FUNDED_REVIEWED_AT,
    };
  });
}

/** Served places are the site's own: Georgia, the regions and municipalities of municipalities.csv (never Tbilisi's code 04) and the two SSA units. */
async function checkPlaces(repositoryRoot: string, rows: readonly CsvRecord[]): Promise<void> {
  const municipalities = await readCsv(path.join(repositoryRoot, "data/imports/municipalities.csv"));
  const regions = new Set(municipalities.map(row => row.region_id));
  if (regions.size !== SOCIAL_REGIONS.length || SOCIAL_REGIONS.some(region => !regions.has(region))) throw new Error("Social regions disagree with municipalities.csv");
  const codes = municipalities.filter(row => row.municipality_code !== "04");
  if (codes.length !== Object.values(SOCIAL_MUNICIPALITIES).flat().length || codes.some(row => !SOCIAL_MUNICIPALITIES[row.region_id]?.includes(row.municipality_code))) {
    throw new Error("Social municipalities disagree with municipalities.csv");
  }
  const places = new Set([SOCIAL_GEORGIA, ...regions, ...codes.map(row => row.municipality_code), ...Object.keys(SOCIAL_UNITS)]);
  const unknown = rows.find(row => !places.has(row.geography_id));
  if (unknown) throw new Error(`Social place is not one of the site's places: ${unknown.geography_id}`);
}

/** Each recorded subtotal difference must be the national total's source finding for the same table, year and column. */
export async function checkKnownDifferences(directory: string): Promise<void> {
  const findings = await readCsv(path.join(directory, "source-findings.csv"));
  for (const known of SOCIAL_KNOWN_DIFFERENCES) {
    if (!known.finding) continue;
    const { table, column } = known.finding;
    const rows = findings.filter(row => row.table_id === table && row.year === String(known.year) && row.column === column);
    const total = rows.reduce((sum, row) => sum.plus(row.difference), new Decimal(0));
    // A finding is the printed total less its areas; the recorded difference is the parts less the printed total.
    if (!rows.length || total.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).neg().toFixed() !== known.difference) throw new Error(`Social recorded difference has no matching source finding: ${known.check} ${known.year}`);
  }
  // A recorded average gap in a national row is a blank cell SSA left in that year's count table.
  for (const gap of SOCIAL_AVERAGE_GAPS) {
    if (!gap.finding) continue;
    const { table, column } = gap.finding;
    if (!findings.some(row => row.table_id === table && row.year === String(gap.year) && row.column === column && !row.difference)) throw new Error(`Social recorded average gap has no matching source finding: ${gap.indicatorId} ${gap.year}`);
  }
}

/** Spec §10's counting changes. */
const SOCIAL_BREAKS: readonly SocialSeriesBreak[] = [
  {
    breakId: "subsistence_employment_2022",
    appliesTo: ["social.subsistence.families", "social.subsistence.persons", ...SOCIAL_AGE_BANDS.map(band => `social.subsistence.persons_age_${band}` as const)],
    referenceDate: "2022-01-01",
    reason: "Families kept on the allowance through the public employment programme are counted separately from 2022. SSA prints them in a column of their own from December 2022, so from 2022 the families receiving the allowance and the people in them leave them out. The age groups of those people leave them out too. No change may be computed across this point.",
    sourceNote: "SSA subsistence allowance table 1 (tsa_allowance-01), ssa-tsa_allowance-01-2022.xlsx, sheet December, heading D3: \"ოჯახების/პირების რაოდენობა, რომელთა ოჯახიდან ერთი წევრი მაინც ჩართულია საზოგადოებრივი დასაქმების ხელშეწყობის სახელმწიფო პროგრამაში და 4 წლის განმავლობაში უნარჩუნდებათ სოციალურად დაუცველი ოჯახების მონაცემთა ბაზაში რეგისტრაცია\" (spaces normalised). The January–November 2022 sheets have no such column.",
  },
  {
    breakId: "social_package_groups_2025",
    appliesTo: [
      "social.social_package.other.recipients", "social.social_package.other.amount", "social.social_package.other.avg_monthly",
      "social.social_package.disability.recipients", "social.social_package.disability.amount", "social.social_package.disability.avg_monthly",
    ],
    referenceDate: "2025-01-01",
    reason: "SSA redesigned the group table: disability is split by severity, and state-compensation recipients become a cross-cutting column. From 2025 People with disabilities is the sum of SSA's four disability \"/ სულ\" columns, and Other groups is defence veterans and social package by acquired right instead of compensation recipients, utility-subsidy recipients and \"other\". No change may be computed across this point.",
    sourceNote: "SSA social package tables 1 and 2 (socpackage-01, socpackage-02), 2025 workbooks: each group prints breakdown columns and a \"/ სულ\" total, and only the totals are read. The column mapping for each design is in the research package README, \"Social package groups\".",
  },
];

const fact = (indicatorId: SocialIndicator, row: CsvRecord): SocialFact => ({
  year: Number(row.year), indicatorId, geographyId: row.geography_id, value: row.value, unit: socialUnit(indicatorId), months: Number(row.months),
  basis: "actual", valueStatus: row.value_status as SocialFact["valueStatus"], sourceId: socialSourceId(row.source_table),
  sourceWorkbook: row.source_workbook, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: REVIEWED_AT,
});

/**
 * Promotes the research package's served file into the canonical serving CSV: its place, social package and programme
 * values as published, money series starting in their first 12-month year, the averages (money ÷ month-count sum) and
 * the Social payments rows with their total; and the Pension Fund package's funded pension values after them.
 */
export async function prepareSocialData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const funded = await readFundedPension(repositoryRoot);
  const rows = await readServedPackage(repositoryRoot);
  const researchStatus = await checkPackage(directory, rows);
  await checkPlaces(repositoryRoot, rows);
  await checkKnownDifferences(directory);
  const byKey = new Map(rows.map(row => [packageKey(row.programme, row.measure, row.geography_id, row.year), row]));
  for (const row of rows.filter(r => r.programme === "social_package" && ["recipients", "amount", "count_months_sum"].includes(r.measure))) {
    const group = byKey.get(packageKey("social_package_group", `group.total.${row.measure}`, row.geography_id, row.year));
    if (!group || (["value", "months", "source_table", "source_workbook", "source_sheet", "source_cell"] as const).some(field => group[field] !== row[field])) throw new Error(`Social package total differs from its group total: ${row.measure} ${row.year}`);
  }

  const own: SocialFact[] = [];
  const payments: SocialFact[] = [];
  for (const row of rows) {
    const national = row.geography_id === SOCIAL_GEORGIA && row.measure === "amount";
    if (national && (SOCIAL_PAYMENT_PROGRAMMES as readonly string[]).includes(row.programme)) payments.push(fact(`social.payments.${row.programme}.amount` as SocialIndicator, row));
    if (INPUT_ONLY(row)) continue;
    const group = row.programme === "social_package_group" ? /^group\.([a-z_]+)\.(recipients|amount)$/.exec(row.measure) : null;
    const indicatorId = group ? `social.social_package.${group[1]}.${group[2]}` : OWN[`${row.programme}|${row.measure}`];
    if (indicatorId && (SOCIAL_INDICATORS as readonly string[]).includes(indicatorId)) own.push(fact(indicatorId as SocialIndicator, row));
    else if (!national || !(SOCIAL_PAYMENT_PROGRAMMES as readonly string[]).includes(row.programme)) throw new Error(`Social served row has no indicator: ${row.programme} ${row.measure}`);
  }
  if (new Set(own.filter(f => f.indicatorId.startsWith("social.social_package.")).map(f => f.indicatorId.split(".")[2])).size !== SOCIAL_PACKAGE_GROUPS.length) throw new Error("Social package groups changed");

  // A money series starts in its first 12-month year: the partial years before it are dropped (they stay in the payments rows).
  const firstFull = new Map<string, number>();
  for (const f of own) if (f.months === 12) firstFull.set(`${f.indicatorId}|${f.geographyId}`, Math.min(firstFull.get(`${f.indicatorId}|${f.geographyId}`) ?? Infinity, f.year));
  const served = own.filter(f => !/\.(amount|employment_amount)$/.test(f.indicatorId) || f.year >= (firstFull.get(`${f.indicatorId}|${f.geographyId}`) ?? Infinity));

  const inputs = averageInputs(rows);
  const averages: SocialFact[] = [];
  for (const money of served) {
    const average = Object.keys(SOCIAL_AVERAGES).find(id => SOCIAL_AVERAGES[id] === money.indicatorId) as SocialIndicator | undefined;
    if (!average || money.value === "0") continue;
    const input = inputs.get(socialFactKey({ ...money, indicatorId: average }))!;
    // Counts that miss a month the money has would overstate the average (blank is not zero): it is withheld.
    if (input.countMonths !== input.amountMonths) continue;
    const source = AVERAGE_INPUTS[average];
    const [amount, count] = [source.amount, source.count].map(measure => byKey.get(packageKey(source.programme, measure, money.geographyId, money.year))!);
    const joined = (field: "source_workbook" | "source_sheet") => (amount[field] === count[field] ? amount[field] : `${amount[field]};${count[field]}`);
    averages.push({
      ...money, indicatorId: average, value: socialAverage(input.amount, input.count), unit: "gel", valueStatus: "calculated",
      sourceWorkbook: joined("source_workbook"), sourceSheet: joined("source_sheet"), sourceCell: `(${amount.source_cell})/(${count.source_cell})`,
    });
  }

  const order = new Map(SOCIAL_INDICATORS.map((id, i) => [id, i]));
  payments.sort((a, b) => a.year - b.year || order.get(a.indicatorId)! - order.get(b.indicatorId)!);
  const totals: SocialFact[] = [...new Set(payments.map(f => f.year))].map(year => {
    const parts = payments.filter(f => f.year === year);
    return {
      year, indicatorId: "social.payments.total.amount", geographyId: SOCIAL_GEORGIA, value: parts.reduce((sum, f) => sum.plus(f.value), new Decimal(0)).toFixed(),
      unit: "gel", months: 12, basis: "actual", valueStatus: "calculated", sourceId: "ssa_statistics", sourceWorkbook: "*", sourceSheet: "*",
      sourceCell: parts.map(f => f.indicatorId).join("+"), lastReviewedAt: REVIEWED_AT,
    };
  });

  const facts = [...served, ...averages, ...payments, ...totals, ...funded];
  validateSocialFacts(facts, inputs);
  facts.sort((a, b) => order.get(a.indicatorId)! - order.get(b.indicatorId)! || (a.geographyId < b.geographyId ? -1 : a.geographyId > b.geographyId ? 1 : 0) || a.year - b.year);
  const csv = serializeBomCsvRows([SOCIAL_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.geographyId, f.value, f.unit, f.months, f.basis, f.valueStatus, f.sourceId, f.sourceWorkbook, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  const breaks = serializeBomCsvRows([BREAK_HEADERS, ...SOCIAL_BREAKS.map(row => [row.breakId, row.appliesTo.join(";"), row.referenceDate, row.reason, row.sourceNote])]);
  const years = facts.map(f => f.year);
  const acceptance: SocialAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/social-protection-annual.csv", csv], ["data/imports/social-protection-series-breaks.csv", breaks], ["data/reports/social-protection-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("social protection", target, content);
  }
}

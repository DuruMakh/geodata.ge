import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import {
  LABOUR_INDICATORS, LABOUR_JOB_GROUPS, LABOUR_JOB_ITEMS, LABOUR_RESEARCH_DIRECTORY, labourFactKey,
  type LabourFact, type LabourIndicator, type LabourUnit,
} from "./types";

const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const SUM_TOLERANCE = new Decimal("0.000001");
const INDUSTRIES = LABOUR_JOB_ITEMS.filter(item => item !== "total");

/** Every key the serving package must contain, exactly once, from the research package's `coverage.csv`. */
export function expectedLabourKeys(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Set<string> {
  const file = path.join(/* turbopackIgnore: true */ repositoryRoot, LABOUR_RESEARCH_DIRECTORY, "coverage.csv");
  const keys = new Set<string>();
  for (const line of parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[]) {
    // `unavailable_years` is a `;`-separated list of years and ranges, such as "2020-2025" for a series with no observation.
    const unavailable = new Set((line.unavailable_years ? line.unavailable_years.split(";") : []).flatMap(part => {
      const [from, to = from] = part.split("-").map(Number);
      return range(from, to);
    }));
    const years = line.first_year ? range(Number(line.first_year), Number(line.last_year)).filter(year => !unavailable.has(year)) : [];
    if (!(LABOUR_INDICATORS as readonly string[]).includes(line.indicator_id) || Number(line.observations) !== years.length) {
      throw new Error(`Invalid labour coverage line: ${line.indicator_id}`);
    }
    for (const year of years) keys.add(`${line.indicator_id}:${year}`);
  }
  return keys;
}

/** The workbook, unit and served years each indicator is read in: jobs of all persons from 2017, everything else from 2020. */
function contractOf(indicatorId: LabourIndicator): { sourceId: string; unit: LabourUnit; firstYear: number } {
  const [, topic, group] = indicatorId.split(".");
  if (topic === "jobs") return { sourceId: "geostat_lfs_jobs_industry", unit: "thousand_persons", firstYear: group === "all" ? 2017 : 2020 };
  if (topic === "hours") return { sourceId: group === "urban" || group === "rural" ? "geostat_lfs_hours_settlement" : "geostat_lfs_hours_sex", unit: "hours", firstYear: 2020 };
  return { sourceId: `geostat_lfs_${topic}`, unit: "percent", firstYear: 2020 };
}

/** The design spec's anchor values (published text), which a rule change must not move. */
const ANCHORS: ReadonlyArray<readonly [LabourIndicator, number, string]> = [
  ["labour.jobs.all.total", 2025, "1389.7"], ["labour.jobs.all.sector_a", 2017, "289.5"], ["labour.jobs.all.sector_a", 2025, "218.3"],
  ["labour.jobs.all.sector_f", 2017, "84.3"], ["labour.jobs.all.sector_f", 2025, "122.6"], ["labour.hours.all.total", 2025, "41.0"],
  ["labour.informal.total", 2025, "28.3"], ["labour.underuse.composite", 2020, "39.5"], ["labour.underuse.composite", 2025, "27.8"],
  ["labour.neet.age_15_24.total", 2025, "17.6"], ["labour.neet.age_15_29.total", 2025, "23.4"],
];

export function validateLabourFacts(facts: readonly LabourFact[], repositoryRoot?: string): void {
  const expected = expectedLabourKeys(repositoryRoot);
  const seen = new Map<string, LabourFact>();
  for (const fact of facts) {
    const key = labourFactKey(fact);
    if (!LABOUR_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid labour identity: ${key}`);
    if (!expected.has(key) || fact.year < contractOf(fact.indicatorId).firstYear || fact.year > 2025) throw new Error(`Labour observation outside the approved coverage: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate labour observation: ${key}`);
    const contract = contractOf(fact.indicatorId);
    if (
      fact.unit !== contract.unit || fact.basis !== "actual" || fact.valueStatus !== "survey_estimate" || fact.sourceId !== contract.sourceId ||
      !fact.sourceSheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)
    ) throw new Error(`Invalid labour source contract: ${key}`);
    // Every served cell is a non-negative number as the workbook stores it, which can carry an exponent; a Geostat placeholder is no value.
    if (!/^\d+(\.\d+)?(E-?\d+)?$/.test(fact.value) || !/^\d+(\.\d+)?$/.test(fact.publishedValue)) throw new Error(`Invalid labour value: ${key}`);
    // Compared as numbers, so the mirror's "0" is the same published figure as the file's "0.0".
    if (!new Decimal(fact.value).toSignificantDigits(15).toDecimalPlaces(1).eq(fact.publishedValue)) throw new Error(`Labour published value does not match its stored value: ${key}`);
    seen.set(key, fact);
  }
  const missing = [...expected].filter(key => !seen.has(key));
  if (missing.length) throw new Error(`Incomplete labour coverage: ${missing.length} missing, first ${missing[0]}`);

  const value = (indicator: string, year: number) => new Decimal(seen.get(`${indicator}:${year}`)!.value);
  const yearsOf = (indicator: string) => facts.filter(f => f.indicatorId === indicator).map(f => f.year);
  for (const group of LABOUR_JOB_GROUPS) {
    for (const year of yearsOf(`labour.jobs.${group}.total`)) {
      const parts = INDUSTRIES.reduce((sum, item) => sum.plus(value(`labour.jobs.${group}.${item}`, year)), new Decimal(0));
      if (parts.minus(value(`labour.jobs.${group}.total`, year)).abs().gt(SUM_TOLERANCE)) throw new Error(`Labour industries do not add up to the total: ${group} ${year}`);
    }
  }
  for (const item of LABOUR_JOB_ITEMS) {
    for (const year of yearsOf(`labour.jobs.women.${item}`)) {
      if (value(`labour.jobs.women.${item}`, year).plus(value(`labour.jobs.men.${item}`, year)).minus(value(`labour.jobs.all.${item}`, year)).abs().gt(SUM_TOLERANCE)) {
        throw new Error(`Labour women and men do not add up to all persons: ${item} ${year}`);
      }
    }
  }
  for (const [indicator, year, text] of ANCHORS) {
    if (!new Decimal(seen.get(`${indicator}:${year}`)!.publishedValue).eq(text)) throw new Error(`Labour anchor value changed: ${indicator}:${year}`);
  }
}

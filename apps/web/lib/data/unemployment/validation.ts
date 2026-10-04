import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { unemploymentIndicators, unemploymentIsRate, unemploymentObservationKey, type UnemploymentObservation, type UnemploymentBreakdown } from "./types";

const D = Decimal.clone({ precision: 50 });
const tolerance = new D("0.000001");
const sourceIds: Record<UnemploymentBreakdown, string> = {
  national: "geostat_lfs_annual_total", sex: "geostat_lfs_annual_sex", settlement: "geostat_lfs_annual_settlement", age: "geostat_lfs_annual_age", region: "geostat_lfs_annual_region", education: "geostat_lfs_annual_education", long_term: "geostat_lfs_annual_long_term",
};
const readInventory = (name: string): Record<string, string>[] => parse(readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../docs/Raw Data/Unemployment/geostat-labour-force-annual", name), "utf8"), { columns: true, bom: true, skip_empty_lines: true });

export function assertCompleteUnemploymentCoverage(facts: readonly UnemploymentObservation[]): void {
  const expected = new Set<string>();
  for (const row of readInventory("coverage.csv")) {
    for (const year of row.years.split("|").map(Number)) for (const indicator of unemploymentIndicators(row.dimension as UnemploymentBreakdown)) {
      expected.add([row.dimension, row.group_id, row.dimension === "sex" ? row.group_id : "total", indicator, year].join(":"));
    }
  }
  for (const row of readInventory("supplemental-coverage.csv")) {
    for (let year = Number(row.year_min); year <= Number(row.year_max); year++) for (const indicator of unemploymentIndicators(row.dataset as UnemploymentBreakdown)) {
      expected.add([row.dataset, row.group_id, row.sex, indicator, year].join(":"));
    }
  }
  const actual = new Set(facts.map(unemploymentObservationKey));
  if (actual.size !== expected.size || facts.length !== expected.size || [...expected].some(key => !actual.has(key))) throw new Error("Incomplete unemployment coverage: observations differ from the reviewed group/year inventory");
}

export function validateUnemploymentFacts(facts: readonly UnemploymentObservation[]): void {
  const keys = new Set<string>();
  const groups = new Map<string, Map<string, UnemploymentObservation>>();
  for (const fact of facts) {
    const key = unemploymentObservationKey(fact);
    if (keys.has(key)) throw new Error(`Duplicate unemployment observation: ${key}`);
    keys.add(key);
    if (!(fact.dimension in sourceIds) || !unemploymentIndicators(fact.dimension).includes(fact.indicatorId) || fact.sourceId !== sourceIds[fact.dimension] ||
        fact.frequency !== "annual" || fact.basis !== "actual" || fact.valueStatus !== "survey_estimate" || fact.methodologyEpoch !== "ilo19_20" || fact.role !== "primary" ||
        !["total", "women", "men"].includes(fact.sex) || !Number.isInteger(fact.year) || !/^[a-z0-9_.]+$/.test(fact.groupId) ||
        !/^[A-Z]+[1-9][0-9]*$/.test(fact.sourceCell) || !fact.sourceSheet || !fact.sourceLabel || !fact.sourceGroupLabel || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt) ||
        fact.unit !== (unemploymentIsRate(fact.indicatorId) ? "percent" : "thousand_persons")) throw new Error(`Invalid unemployment source/indicator contract: ${key}`);
    const value = new D(fact.value);
    if (!value.isFinite() || value.isNegative() || (fact.unit === "percent" && value.gt(new D(100).plus(tolerance))) || value.toFixed(1, D.ROUND_HALF_UP) !== fact.publishedValue) throw new Error(`Invalid unemployment value or published precision: ${key}`);
    const groupKey = [fact.dimension, fact.groupId, fact.sex, fact.year].join(":");
    const group = groups.get(groupKey) ?? new Map<string, UnemploymentObservation>();
    group.set(fact.indicatorId, fact); groups.set(groupKey, group);
  }
  const close = (actual: Decimal, expected: Decimal, label: string) => {
    if (actual.minus(expected).abs().gt(tolerance)) throw new Error(`Unemployment ${label} does not reconcile`);
  };
  const reference = (sex: string, year: number) => groups.get([sex === "total" ? "national" : "sex", sex === "total" ? "georgia" : sex, sex, year].join(":"));
  for (const [key, group] of groups) {
    const first = [...group.values()][0];
    const get = (indicator: string) => { const row = group.get(indicator); if (!row) throw new Error(`Missing unemployment indicator: ${key}:${indicator}`); return new D(row.value); };
    if (first.dimension === "education") continue;
    if (first.dimension === "long_term") {
      const matching = reference(first.sex, first.year);
      if (!matching) throw new Error("Missing long-term unemployment denominator");
      const count = get("long_term_unemployed");
      const unemployed = new D(matching.get("unemployed")!.value);
      const labourForce = new D(matching.get("labour_force")!.value);
      if (unemployed.lte(0) || labourForce.lte(0) || count.gt(unemployed)) throw new Error("Invalid long-term unemployment count/denominator");
      close(get("long_term_unemployment_rate"), count.div(labourForce).mul(100), "long-term rate denominator");
      close(get("long_term_unemployed_share"), count.div(unemployed).mul(100), "long-term share denominator");
      continue;
    }
    const population = get("population_15_plus"), force = get("labour_force");
    if (population.lte(0) || force.lte(0)) throw new Error(`Invalid unemployment rate denominator: ${key}`);
    close(force, get("employed").plus(get("unemployed")), "labour force identity");
    close(population, force.plus(get("outside_labour_force")), "population identity");
    close(get("unemployment_rate"), get("unemployed").div(force).mul(100), "rate");
    close(get("employment_rate"), get("employed").div(population).mul(100), "employment rate");
    close(get("participation_rate"), force.div(population).mul(100), "participation rate");
  }
  for (const year of new Set(facts.map(f => f.year))) {
    const national = reference("total", year);
    if (!national) continue;
    for (const dimension of ["sex", "settlement", "age", "region"] as const) {
      const members = facts.filter(f => f.year === year && f.dimension === dimension);
      if (!members.length) continue;
      for (const indicator of ["population_15_plus", "labour_force", "employed", "unemployed", "outside_labour_force"]) {
        close(members.filter(f => f.indicatorId === indicator).reduce((sum, f) => sum.plus(f.value), new D(0)), new D(national.get(indicator)!.value), `${dimension} count sum`);
      }
    }
    const longTerm = facts.filter(f => f.year === year && f.dimension === "long_term" && f.indicatorId === "long_term_unemployed");
    if (longTerm.length) close(longTerm.filter(f => f.sex !== "total").reduce((sum, f) => sum.plus(f.value), new D(0)), new D(longTerm.find(f => f.sex === "total")!.value), "long-term sex count sum");
  }
}

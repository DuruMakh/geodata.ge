import { describe, expect, it } from "vitest";
import { loadMunicipalitiesFile } from "../../../lib/data/municipal/municipalitiesFile";
import {
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "../../../lib/data/municipal/importMunicipalFacts";
import { loadMunicipalFunctionsFile } from "../../../lib/data/municipal/taxonomyFiles";

const FUNCTION_FACTS = "../../data/imports/municipal-function-facts-2015-2025.csv";
const TOTAL_FACTS = "../../data/imports/municipal-total-facts-2015-2025.csv";
const MUNICIPALITIES = "../../data/imports/municipalities.csv";
const FUNCTIONS = "../../data/taxonomy/municipal-functions.json";

const YEARS = Array.from({ length: 11 }, (_, index) => 2015 + index);

describe("generated municipal fact files", () => {
  it("is dense: 10 functions x 69 municipalities x 11 years", async () => {
    const facts = await loadMunicipalFunctionFacts(FUNCTION_FACTS);

    expect(facts).toHaveLength(7590);
    expect(new Set(facts.map((fact) => fact.year))).toEqual(new Set(YEARS));
  });

  it("has one total row per municipality-year", async () => {
    const totals = await loadMunicipalTotalFacts(TOTAL_FACTS);
    const keys = totals.map((total) => `${total.year}:${total.municipalityCode}`);

    expect(totals).toHaveLength(759);
    expect(new Set(keys).size).toBe(759);
  });

  it("references only registered municipalities", async () => {
    const [facts, totals, municipalities] = await Promise.all([
      loadMunicipalFunctionFacts(FUNCTION_FACTS),
      loadMunicipalTotalFacts(TOTAL_FACTS),
      loadMunicipalitiesFile(MUNICIPALITIES),
    ]);
    const codes = new Set(municipalities.map((row) => row.code));

    expect(facts.filter((fact) => !codes.has(fact.municipalityCode))).toEqual([]);
    expect(totals.filter((total) => !codes.has(total.municipalityCode))).toEqual([]);
  });

  it("uses the semantic id matching each functional code", async () => {
    const [facts, functions] = await Promise.all([
      loadMunicipalFunctionFacts(FUNCTION_FACTS),
      loadMunicipalFunctionsFile(FUNCTIONS),
    ]);
    const idByCode = new Map(functions.map((entry) => [entry.functionalCode, entry.id]));

    for (const fact of facts) {
      expect(fact.categoryId).toBe(idByCode.get(fact.functionalCode));
    }
  });

  it("sums the ten functions to functional_sum_gel for every municipality-year", async () => {
    const [facts, totals] = await Promise.all([
      loadMunicipalFunctionFacts(FUNCTION_FACTS),
      loadMunicipalTotalFacts(TOTAL_FACTS),
    ]);
    const sums = new Map<string, number>();

    for (const fact of facts) {
      const key = `${fact.year}:${fact.municipalityCode}`;
      sums.set(key, (sums.get(key) ?? 0) + fact.amountGel);
    }

    for (const total of totals) {
      const key = `${total.year}:${total.municipalityCode}`;
      // Tolerance absorbs float addition over ten Decimal(18,2) values only.
      expect(Math.abs((sums.get(key) ?? 0) - total.functionalSumGel), key).toBeLessThan(0.01);
    }
  });

  it("carries the methodology's warning counts unchanged", async () => {
    const totals = await loadMunicipalTotalFacts(TOTAL_FACTS);
    const counts = new Map<string, number>();

    for (const total of totals) {
      counts.set(total.warningType, (counts.get(total.warningType) ?? 0) + 1);
    }

    expect(counts.get("source_version_difference")).toBe(24);
    expect(counts.get("financing_outside_functional")).toBe(21);
    expect(counts.get("source_actual_missing")).toBe(1);
    expect(totals.filter((total) => total.showWarning)).toHaveLength(45);
  });

  it("ships without a BOM, matching the other data/imports files", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");

    for (const file of [FUNCTION_FACTS, TOTAL_FACTS]) {
      const buffer = await readFile(path.resolve(process.cwd(), file));
      expect(buffer.subarray(0, 3).toString("hex"), file).not.toBe("efbbbf");
    }
  });
});

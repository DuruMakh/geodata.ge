import { describe, expect, it } from "vitest";
import { loadMunicipalitiesFile } from "../../../lib/data/municipal/municipalitiesFile";
import {
  loadMunicipalCountryFunctionFacts,
  loadMunicipalCountryTotalFacts,
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "../../../lib/data/municipal/importMunicipalFacts";
import { readCsvRecords } from "../../../lib/data/csv";
import { loadMunicipalFunctionsFile } from "../../../lib/data/municipal/taxonomyFiles";

const FUNCTION_FACTS = "../../data/imports/municipal-function-facts-2015-2025.csv";
const TOTAL_FACTS = "../../data/imports/municipal-total-facts-2015-2025.csv";
const COUNTRY_FUNCTION_FACTS = "../../data/imports/municipal-georgia-function-facts-2015-2025.csv";
const COUNTRY_TOTAL_FACTS = "../../data/imports/municipal-georgia-total-facts-2015-2025.csv";
const COUNTRY_ID = "country.georgia";
const MUNICIPALITIES = "../../data/imports/municipalities.csv";
const FUNCTIONS = "../../data/taxonomy/municipal-functions.json";
const RAW_TOTALS =
  "../../docs/Raw Data/Municipalities/combined-annual-2015-2025/municipal-total-payments-annual-2015-2025.csv";
const RAW_FUNCTIONS =
  "../../docs/Raw Data/Municipalities/combined-annual-2015-2025/municipal-functional-main-annual-2015-2025.csv";

const YEARS = Array.from({ length: 11 }, (_, index) => 2015 + index);
const EXCLUDED_CODES = ["05", "42", "43", "46", "64"];

describe("generated municipal fact files", () => {
  it("is dense: 10 functions x 64 municipalities x 11 years", async () => {
    const facts = await loadMunicipalFunctionFacts(FUNCTION_FACTS);

    expect(facts).toHaveLength(7040);
    expect(new Set(facts.map((fact) => fact.year))).toEqual(new Set(YEARS));
    expect(facts.filter((fact) => EXCLUDED_CODES.includes(fact.municipalityCode))).toEqual([]);
  });

  it("has one total row per municipality-year", async () => {
    const totals = await loadMunicipalTotalFacts(TOTAL_FACTS);
    const keys = totals.map((total) => `${total.year}:${total.municipalityCode}`);

    expect(totals).toHaveLength(704);
    expect(new Set(keys).size).toBe(704);
    expect(totals.filter((total) => EXCLUDED_CODES.includes(total.municipalityCode))).toEqual([]);
  });

  it("aggregates all 69 raw municipalities into Georgia facts", async () => {
    const [countryFunctions, countryTotals, rawFunctions, rawTotals] = await Promise.all([
      loadMunicipalCountryFunctionFacts(COUNTRY_FUNCTION_FACTS),
      loadMunicipalCountryTotalFacts(COUNTRY_TOTAL_FACTS),
      readCsvRecords(RAW_FUNCTIONS),
      readCsvRecords(RAW_TOTALS),
    ]);
    const expected2025 = rawTotals
      .filter((row) => Number(row.year) === 2025)
      .reduce((sum, row) => sum + Number(row.public_total_gel), 0);

    expect(countryFunctions).toHaveLength(110);
    expect(countryTotals).toHaveLength(11);
    expect(countryFunctions.every((row) => row.municipalityCode === COUNTRY_ID)).toBe(true);
    expect(countryTotals.every((row) => row.municipalityCode === COUNTRY_ID)).toBe(true);
    expect(countryTotals.find((row) => row.year === 2025)?.publicTotalGel).toBeCloseTo(expected2025, 2);
    const rawFunctionAmounts = new Map<string, number>();
    for (const row of rawFunctions) {
      const key = `${row.year}:${row.functional_code}`;
      rawFunctionAmounts.set(key, (rawFunctionAmounts.get(key) ?? 0) + Number(row.amount_gel));
    }

    for (const fact of countryFunctions) {
      expect(fact.amountGel, `${fact.year}:${fact.functionalCode}`).toBeCloseTo(
        rawFunctionAmounts.get(`${fact.year}:${fact.functionalCode}`) ?? 0,
        2,
      );
    }

    expect(new Set(rawFunctions.map((row) => row.municipality_code)).size).toBe(69);
    expect(new Set(rawTotals.map((row) => row.municipality_code)).size).toBe(69);
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

    for (const file of [FUNCTION_FACTS, TOTAL_FACTS, COUNTRY_FUNCTION_FACTS, COUNTRY_TOTAL_FACTS]) {
      const buffer = await readFile(path.resolve(process.cwd(), file));
      expect(buffer.subarray(0, 3).toString("hex"), file).not.toBe("efbbbf");
    }
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { validateRawMunicipalCoverage } from "../../../lib/data/municipal/generateMunicipalFacts";
import { loadAdjaraBudgetAdjustments } from "../../../lib/data/municipal/importAdjaraBudgetAdjustments";
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
const ADJARA_ADJUSTMENTS = "../../data/imports/municipal-adjara-budget-adjustments-2015-2025.csv";
const COUNTRY_ID = "country.georgia";
const MUNICIPALITIES = "../../data/imports/municipalities.csv";
const FUNCTIONS = "../../data/taxonomy/municipal-functions.json";
const RAW_TOTALS =
  "../../docs/Raw Data/Municipalities/combined-annual-2015-2025/municipal-total-payments-annual-2015-2025.csv";
const RAW_FUNCTIONS =
  "../../docs/Raw Data/Municipalities/combined-annual-2015-2025/municipal-functional-main-annual-2015-2025.csv";

const YEARS = Array.from({ length: 11 }, (_, index) => 2015 + index);
const EXCLUDED_CODES = ["05", "42", "43", "46", "64"];

let rawFunctions: Awaited<ReturnType<typeof readCsvRecords>>;
let rawTotals: Awaited<ReturnType<typeof readCsvRecords>>;
let expectedRawCodes: string[];

beforeAll(async () => {
  const municipalities = await loadMunicipalitiesFile(MUNICIPALITIES);
  [rawFunctions, rawTotals] = await Promise.all([
    readCsvRecords(RAW_FUNCTIONS),
    readCsvRecords(RAW_TOTALS),
  ]);
  expectedRawCodes = [...municipalities.map((row) => row.code), ...EXCLUDED_CODES].sort();
});

describe("raw 69-series municipal generation contract", () => {
  it("accepts the complete reviewed 69 x 11 x 10 panel", () => {
    expect(() => validateRawMunicipalCoverage(rawFunctions, rawTotals, expectedRawCodes)).not.toThrow();
  });

  it("rejects a missing aggregate-only function row", () => {
    const index = rawFunctions.findIndex(
      (row) => row.municipality_code === "05" && row.year === "2015" && row.functional_code === "7.1",
    );
    expect(index).toBeGreaterThanOrEqual(0);

    expect(() =>
      validateRawMunicipalCoverage(rawFunctions.toSpliced(index, 1), rawTotals, expectedRawCodes),
    ).toThrow(/7,590 raw function rows|missing raw function key/i);
  });

  it("rejects a duplicate aggregate-only function row", () => {
    const duplicate = rawFunctions.find(
      (row) => row.municipality_code === "64" && row.year === "2025" && row.functional_code === "7.10",
    );
    expect(duplicate).toBeDefined();

    expect(() =>
      validateRawMunicipalCoverage([...rawFunctions, { ...duplicate! }], rawTotals, expectedRawCodes),
    ).toThrow(/duplicate raw function key/i);
  });

  it("rejects a missing aggregate-only total row", () => {
    const index = rawTotals.findIndex((row) => row.municipality_code === "05" && row.year === "2015");
    expect(index).toBeGreaterThanOrEqual(0);

    expect(() =>
      validateRawMunicipalCoverage(rawFunctions, rawTotals.toSpliced(index, 1), expectedRawCodes),
    ).toThrow(/759 raw total rows|missing raw total key/i);
  });

  it("rejects a duplicate aggregate-only total row", () => {
    const duplicate = rawTotals.find((row) => row.municipality_code === "64" && row.year === "2025");
    expect(duplicate).toBeDefined();

    expect(() =>
      validateRawMunicipalCoverage(rawFunctions, [...rawTotals, { ...duplicate! }], expectedRawCodes),
    ).toThrow(/duplicate raw total key/i);
  });
});

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

  it("independently aggregates every Georgia function and total component across all 69 contributors", async () => {
    const [countryFunctions, countryTotals, adjustments] = await Promise.all([
      loadMunicipalCountryFunctionFacts(COUNTRY_FUNCTION_FACTS),
      loadMunicipalCountryTotalFacts(COUNTRY_TOTAL_FACTS),
      loadAdjaraBudgetAdjustments(ADJARA_ADJUSTMENTS),
    ]);
    const adjustmentByYear = new Map(adjustments.map((row) => [row.year, row]));

    expect(countryFunctions).toHaveLength(110);
    expect(countryTotals).toHaveLength(11);
    expect(rawFunctions).toHaveLength(7590);
    expect(rawTotals).toHaveLength(759);
    expect(countryFunctions.every((row) => row.municipalityCode === COUNTRY_ID)).toBe(true);
    expect(countryTotals.every((row) => row.municipalityCode === COUNTRY_ID)).toBe(true);

    for (const fact of countryFunctions) {
      const contributors = rawFunctions.filter(
        (row) => Number(row.year) === fact.year && row.functional_code === fact.functionalCode,
      );
      expect(contributors, `${fact.year}:${fact.functionalCode}`).toHaveLength(69);
      expect(fact.amountGel, `${fact.year}:${fact.functionalCode}`).toBeCloseTo(
        contributors.reduce((sum, row) => sum + Number(row.amount_gel), 0),
        2,
      );
    }

    for (const fact of countryTotals) {
      const contributors = rawTotals.filter((row) => Number(row.year) === fact.year);
      const adjustment = adjustmentByYear.get(fact.year)!;
      expect(contributors, String(fact.year)).toHaveLength(69);
      expect(fact.publicTotalGel, `${fact.year}:publicTotalGel`).toBeCloseTo(
        contributors.reduce((sum, row) => sum + Number(row.public_total_gel), 0) +
          adjustment.netRepublicPaymentsGel,
        2,
      );
      expect(fact.functionalSumGel, `${fact.year}:functionalSumGel`).toBeCloseTo(
        contributors.reduce((sum, row) => sum + Number(row.functional_sum_gel), 0),
        2,
      );

      const expectedTotalPayments = contributors.some((row) => row.total_payments_gel.trim() === "")
        ? null
        : contributors.reduce((sum, row) => sum + Number(row.total_payments_gel), 0) +
          adjustment.netRepublicPaymentsGel;
      if (expectedTotalPayments === null) {
        expect(fact.totalPaymentsGel, `${fact.year}:totalPaymentsGel`).toBeNull();
      } else {
        expect(fact.totalPaymentsGel, `${fact.year}:totalPaymentsGel`).toBeCloseTo(expectedTotalPayments, 2);
      }
      expect(fact.expensesGel).toBeNull();
      expect(fact.nonfinancialAssetGrowthGel).toBeNull();
      expect(fact.financialAssetGrowthGel).toBeNull();
      expect(fact.liabilityDecreaseGel).toBeNull();
      expect(fact.reconciliationDifferenceGel).toBeNull();
    }

    expect(new Set(rawFunctions.map((row) => row.municipality_code)).size).toBe(69);
    expect(new Set(rawTotals.map((row) => row.municipality_code)).size).toBe(69);
    expect(countryTotals.some((row) => row.totalPaymentsGel === null)).toBe(true);
    expect(countryTotals.find((row) => row.year === 2015)?.publicTotalGel).toBeCloseTo(
      2186717489.17,
      2,
    );
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

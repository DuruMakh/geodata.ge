import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "../../../lib/data/municipal/importMunicipalFacts";

// readCsvRecords resolves against process.cwd(); write fixtures under it and
// pass a relative path, the same contract the real loaders use.
async function fixture(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "municipal-"));
  const filePath = path.join(dir, name);
  await writeFile(filePath, content, "utf8");
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

const FUNCTION_HEADER =
  "year,municipality_code,category_id,functional_code,amount_gel,basis,source_id";
const TOTAL_HEADER =
  "year,municipality_code,public_total_gel,public_total_measure,total_payments_gel,expenses_gel," +
  "nonfinancial_asset_growth_gel,financial_asset_growth_gel,liability_decrease_gel,functional_sum_gel," +
  "reconciliation_difference_gel,warning_amount_gel,show_warning,warning_type,basis,source_id";

describe("municipal fact loaders", () => {
  it("parses a function fact row", async () => {
    const file = await fixture(
      "functions.csv",
      `${FUNCTION_HEADER}\n2015,04,municipal.general_public_services,7.1,81492992.43,actual,source.municipal_portal_archive\n`,
    );

    await expect(loadMunicipalFunctionFacts(file)).resolves.toEqual([
      {
        year: 2015,
        municipalityCode: "04",
        categoryId: "municipal.general_public_services",
        functionalCode: "7.1",
        amountGel: 81492992.43,
        basis: "actual",
        sourceId: "source.municipal_portal_archive",
      },
    ]);
  });

  it("keeps the leading zero in municipality_code", async () => {
    const file = await fixture(
      "functions.csv",
      `${FUNCTION_HEADER}\n2015,04,municipal.health,7.7,1.00,actual,source.municipal_portal_archive\n`,
    );
    const [fact] = await loadMunicipalFunctionFacts(file);

    expect(fact.municipalityCode).toBe("04");
  });

  it("rejects a non-main functional code", async () => {
    const file = await fixture(
      "functions.csv",
      `${FUNCTION_HEADER}\n2015,04,municipal.preschool,7.9.1,1.00,actual,source.municipal_portal_archive\n`,
    );

    await expect(loadMunicipalFunctionFacts(file)).rejects.toThrow(/functional_code must be/);
  });

  it("rejects a negative amount", async () => {
    const file = await fixture(
      "functions.csv",
      `${FUNCTION_HEADER}\n2015,04,municipal.health,7.7,-1.00,actual,source.municipal_portal_archive\n`,
    );

    await expect(loadMunicipalFunctionFacts(file)).rejects.toThrow(/nonnegative/);
  });

  it("parses a total row with empty optional components as null", async () => {
    const file = await fixture(
      "totals.csv",
      `${TOTAL_HEADER}\n2015,04,958433318.62,portal_functional_total_fallback,,,,,,958433318.62,,,false,none,actual,source.municipal_portal_archive\n`,
    );
    const [total] = await loadMunicipalTotalFacts(file);

    expect(total.publicTotalGel).toBe(958433318.62);
    expect(total.publicTotalMeasure).toBe("portal_functional_total_fallback");
    expect(total.totalPaymentsGel).toBeNull();
    expect(total.expensesGel).toBeNull();
    expect(total.showWarning).toBe(false);
    expect(total.warningType).toBe("none");
  });

  it("parses a warning row", async () => {
    const file = await fixture(
      "totals.csv",
      `${TOTAL_HEADER}\n2020,04,100.00,total_payments,100.00,60.00,20.00,15.00,5.00,80.00,20.00,20.00,true,financing_outside_functional,actual,source.municipal_history_workbooks\n`,
    );
    const [total] = await loadMunicipalTotalFacts(file);

    expect(total.showWarning).toBe(true);
    expect(total.warningType).toBe("financing_outside_functional");
    expect(total.warningAmountGel).toBe(20);
    expect(total.financialAssetGrowthGel).toBe(15);
  });

  it("rejects an unknown warning_type", async () => {
    const file = await fixture(
      "totals.csv",
      `${TOTAL_HEADER}\n2020,04,100.00,total_payments,100.00,60.00,20.00,15.00,5.00,80.00,20.00,20.00,true,mystery,actual,source.municipal_history_workbooks\n`,
    );

    await expect(loadMunicipalTotalFacts(file)).rejects.toThrow(/warning_type/);
  });
});

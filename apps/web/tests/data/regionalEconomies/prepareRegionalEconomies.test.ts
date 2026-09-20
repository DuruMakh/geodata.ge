import path from "node:path";
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import {
  buildRegionalEconomyArtifacts,
  prepareRegionalEconomies,
} from "../../../lib/data/regionalEconomies/prepareRegionalEconomies";
import { loadRegionalSourceEvidence } from "../../../lib/data/regionalEconomies/sourceEvidence";
import { REGIONAL_GDP_TOTAL } from "../../../lib/data/regionalEconomies/types";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const D = Decimal.clone({ precision: 50 });

describe("regional economy preparation", () => {
  test("regenerates the complete reviewed regional fact and control sets", async () => {
    const result = await prepareRegionalEconomies(repositoryRoot);

    expect(result.observations).toHaveLength(6_930);
    expect(result.reconciliation).toHaveLength(495);
    expect(result.report.sourceCounts).toEqual({
      regionalTotals: 165,
      regionalSectorAmounts: 3_300,
      reconciliationRows: 495,
    });
    expect(result.report.missingValues).toBe(0);
    expect(result.report.duplicateKeys).toBe(0);
    expect(result.report.allRegionAccountsReconcile).toBe(true);
    expect(result.report.allRegionTotalsReconcileToNational).toBe(true);
    expect(result.report.nationalSectorPublicationDifferences).toHaveLength(7);
  });

  test("retains exact source precision for representative regions, zero and small values", async () => {
    const { observations } = await prepareRegionalEconomies(repositoryRoot);
    const value = (regionId: string, seriesId: string, year: number, measure = "nominal") =>
      observations.find((row) => row.regionId === regionId && row.seriesId === seriesId && row.year === year && row.measure === measure)?.value;

    expect(value("region.imereti", REGIONAL_GDP_TOTAL, 2024)).toBe("7203151022.6438331");
    expect(value("region.imereti", "sector.a", 2024)).toBe("715676721.66770501");
    expect(value("region.imereti", "sector.a", 2024, "share_of_region_gdp")).toBe("9.93560622868940159803");
    expect(value("region.tbilisi", REGIONAL_GDP_TOTAL, 2024)).toBe("49374720708.906709");
    expect(value("region.adjara", REGIONAL_GDP_TOTAL, 2024)).toBe("8634024526.8968592");
    expect(value("region.racha_lechkhumi_kvemo_svaneti", "sector.i", 2010)).toBe("0");
    expect(value("region.racha_lechkhumi_kvemo_svaneti", "sector.t", 2024)).toBe("135181.11270837582");
  });

  test("emits every published amount directly from exact workbook XML text", async () => {
    const evidence = await loadRegionalSourceEvidence(repositoryRoot);
    const { observations } = await prepareRegionalEconomies(repositoryRoot);
    const nominal = new Map(
      observations
        .filter((row) => row.measure === "nominal")
        .map((row) => [`${row.regionId}:${row.seriesId}:${row.year}`, row.value]),
    );

    for (const sheet of evidence.activitySheets) {
      for (const year of sheet.years) {
        expect(nominal.get(`${sheet.regionId}:${REGIONAL_GDP_TOTAL}:${year}`)).toBe(
          new D(evidence.totalSheet.cell(sheet.regionId, year).value).mul(1_000_000).toFixed(),
        );
        for (const activity of sheet.activities) {
          expect(nominal.get(`${sheet.regionId}:${activity.seriesId}:${year}`)).toBe(
            new D(sheet.cell(year, activity.row).value).mul(1_000_000).toFixed(),
          );
        }
      }
    }
  });

  test("fails closed around the seven reviewed national publication differences", async () => {
    const { report } = await prepareRegionalEconomies(repositoryRoot);
    expect(report.nationalSectorPublicationDifferences).toEqual([
      { year: 2020, seriesId: "sector.a", regionalMinusNationalMillionGel: "-45.000000000000721" },
      { year: 2020, seriesId: "sector.c", regionalMinusNationalMillionGel: "-34.999999999999393" },
      { year: 2020, seriesId: "sector.r", regionalMinusNationalMillionGel: "79.999999999999974" },
      { year: 2021, seriesId: "sector.c", regionalMinusNationalMillionGel: "-60.000000000020284" },
      { year: 2021, seriesId: "sector.f", regionalMinusNationalMillionGel: "60.0000000000005447" },
      { year: 2022, seriesId: "sector.k", regionalMinusNationalMillionGel: "-4.9999999999998745" },
      { year: 2022, seriesId: "sector.o", regionalMinusNationalMillionGel: "4.999999999999802" },
    ]);
  });

  test("builds byte-stable BOM CSV and validation artifacts", async () => {
    const result = await prepareRegionalEconomies(repositoryRoot);
    const artifacts = buildRegionalEconomyArtifacts(result);
    const canonical = artifacts.get("data/imports/regional-economies-annual.csv")!;
    const reconciliation = artifacts.get("data/staging/regional-economies-reconciliation.csv")!;
    const report = JSON.parse(artifacts.get("data/reports/regional-economies-validation.json")!.toString("utf8"));

    expect(canonical.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(canonical.toString("utf8").split("\n")[0]).toBe(
      "\ufeffregion_id,series_id,year,measure,value,unit,valuation,price_basis,calculation,status,source_id,source_locator,last_reviewed_at",
    );
    expect(canonical.toString("utf8").trimEnd().split("\n")).toHaveLength(6_931);
    expect(reconciliation.toString("utf8").trimEnd().split("\n")).toHaveLength(496);
    expect(report.sourceCounts.reconciliationRows).toBe(495);
  });
});

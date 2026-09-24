import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import type { MunicipalRegion } from "../municipal/types";
import { serializeBomCsvRows } from "../csvEscape";
import { shareOfRegionGdpPercent } from "./calculations";
import { loadRegionalSourceEvidence } from "./sourceEvidence";
import {
  REGIONAL_GDP_TOTAL,
  type RegionalEconomyObservation,
} from "./types";
import { validateRegionalEconomyObservations } from "./validation";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const MEASURES = ["nominal", "share_of_region_gdp"] as const;

const REVIEWED_NATIONAL_DIFFERENCES = [
  { year: 2020, seriesId: "sector.a", regionalMinusNationalMillionGel: "-45.000000000000721" },
  { year: 2020, seriesId: "sector.c", regionalMinusNationalMillionGel: "-34.999999999999393" },
  { year: 2020, seriesId: "sector.r", regionalMinusNationalMillionGel: "79.999999999999974" },
  { year: 2021, seriesId: "sector.c", regionalMinusNationalMillionGel: "-60.000000000020284" },
  { year: 2021, seriesId: "sector.f", regionalMinusNationalMillionGel: "60.0000000000005447" },
  { year: 2022, seriesId: "sector.k", regionalMinusNationalMillionGel: "-4.9999999999998745" },
  { year: 2022, seriesId: "sector.o", regionalMinusNationalMillionGel: "4.999999999999802" },
] as const;

type ReconciliationComponent = "taxes_on_products" | "subsidies_on_products" | "net_product_taxes";

export type RegionalEconomyReconciliation = {
  regionId: string;
  year: number;
  component: ReconciliationComponent;
  valueGel: string;
  sourceId: string;
  sourceLocator: string;
  summedSectorGvaGel: string;
  publishedBasicPriceGdpGel: string;
  publishedMarketPriceGdpGel: string;
  regionalTotalGel: string;
  gvaDifferenceGel: string;
  accountingDifferenceGel: string;
  totalDifferenceGel: string;
  toleranceGel: string;
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export async function prepareRegionalEconomies(repositoryRoot: string) {
  const evidence = await loadRegionalSourceEvidence(repositoryRoot);
  const regions = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "data/taxonomy/municipal-regions.json"), "utf8"),
  ) as MunicipalRegion[];
  const regionOrder = new Map(regions.map((region, index) => [region.id, index]));
  const seriesOrder = new Map([
    REGIONAL_GDP_TOTAL,
    ...evidence.sectors.map((sector) => sector.id),
  ].map((seriesId, index) => [seriesId, index]));
  const tolerance = new D(evidence.manifest.regionalAccountingToleranceGel);
  const observations: RegionalEconomyObservation[] = [];
  const reconciliation: RegionalEconomyReconciliation[] = [];

  for (const sheet of evidence.activitySheets) {
    for (const year of sheet.years) {
      const totalInput = evidence.totalSheet.cell(sheet.regionId, year);
      const totalGel = new D(totalInput.value).mul(1_000_000);
      const publishedMarket = new D(sheet.cell(year, 26).value).mul(1_000_000);
      const basic = new D(sheet.cell(year, 23).value).mul(1_000_000);
      const taxesInput = sheet.cell(year, 24);
      const subsidiesInput = sheet.cell(year, 25);
      const taxes = new D(taxesInput.value).mul(1_000_000);
      const subsidies = new D(subsidiesInput.value).mul(1_000_000);
      const summedSectorGva = sheet.activities.reduce(
        (sum, activity) => sum.plus(new D(sheet.cell(year, activity.row).value).mul(1_000_000)),
        new D(0),
      );
      const gvaDifference = summedSectorGva.minus(basic);
      const accountingDifference = basic.plus(taxes).minus(subsidies).minus(publishedMarket);
      const totalDifference = publishedMarket.minus(totalGel);
      if (gvaDifference.abs().gt(tolerance)) throw new Error(`Regional GVA reconciliation failed: ${sheet.regionId} ${year}`);
      if (accountingDifference.abs().gt(tolerance)) throw new Error(`Regional GDP accounting reconciliation failed: ${sheet.regionId} ${year}`);
      if (totalDifference.abs().gt(tolerance)) throw new Error(`Regional total workbook parity failed: ${sheet.regionId} ${year}`);

      const totalNominal: RegionalEconomyObservation = {
        regionId: sheet.regionId,
        seriesId: REGIONAL_GDP_TOTAL,
        year,
        measure: "nominal",
        value: totalGel.toFixed(),
        unit: "gel",
        valuation: "market_prices",
        priceBasis: "current_prices",
        calculation: "published",
        status: "published",
        sourceId: "source.geostat_regional_gdp",
        sourceLocator: totalInput.locator,
        lastReviewedAt: evidence.manifest.reviewedAt,
      };
      observations.push(totalNominal, {
        ...totalNominal,
        measure: "share_of_region_gdp",
        value: "100",
        unit: "percent",
        calculation: "ratio_to_region_gdp",
        sourceId: "source.fiscal_regional_economy_share",
        sourceLocator: `${totalInput.locator}; ${totalInput.locator}`,
      });

      for (const activity of sheet.activities) {
        const input = sheet.cell(year, activity.row);
        const value = new D(input.value).mul(1_000_000).toFixed();
        const nominal: RegionalEconomyObservation = {
          regionId: sheet.regionId,
          seriesId: activity.seriesId,
          year,
          measure: "nominal",
          value,
          unit: "gel",
          valuation: "basic_prices",
          priceBasis: "current_prices",
          calculation: "published",
          status: "published",
          sourceId: "source.geostat_regional_gdp_by_activity",
          sourceLocator: input.locator,
          lastReviewedAt: evidence.manifest.reviewedAt,
        };
        observations.push(nominal, {
          ...nominal,
          measure: "share_of_region_gdp",
          value: shareOfRegionGdpPercent(value, totalGel.toFixed()),
          unit: "percent",
          calculation: "ratio_to_region_gdp",
          sourceId: "source.fiscal_regional_economy_share",
          sourceLocator: `${input.locator}; ${totalInput.locator}`,
        });
      }

      const controls = {
        summedSectorGvaGel: summedSectorGva.toFixed(),
        publishedBasicPriceGdpGel: basic.toFixed(),
        publishedMarketPriceGdpGel: publishedMarket.toFixed(),
        regionalTotalGel: totalGel.toFixed(),
        gvaDifferenceGel: gvaDifference.toFixed(),
        accountingDifferenceGel: accountingDifference.toFixed(),
        totalDifferenceGel: totalDifference.toFixed(),
        toleranceGel: tolerance.toFixed(),
      };
      reconciliation.push(
        {
          regionId: sheet.regionId,
          year,
          component: "taxes_on_products",
          valueGel: taxes.toFixed(),
          sourceId: "source.geostat_regional_gdp_by_activity",
          sourceLocator: taxesInput.locator,
          ...controls,
        },
        {
          regionId: sheet.regionId,
          year,
          component: "subsidies_on_products",
          valueGel: subsidies.toFixed(),
          sourceId: "source.geostat_regional_gdp_by_activity",
          sourceLocator: subsidiesInput.locator,
          ...controls,
        },
        {
          regionId: sheet.regionId,
          year,
          component: "net_product_taxes",
          valueGel: taxes.minus(subsidies).toFixed(),
          sourceId: "source.fiscal_regional_economy_share",
          sourceLocator: `${taxesInput.locator}; ${subsidiesInput.locator}`,
          ...controls,
        },
      );
    }
  }

  observations.sort((left, right) =>
    (regionOrder.get(left.regionId)! - regionOrder.get(right.regionId)!) ||
    (seriesOrder.get(left.seriesId)! - seriesOrder.get(right.seriesId)!) ||
    (MEASURES.indexOf(left.measure) - MEASURES.indexOf(right.measure)) ||
    (left.year - right.year));
  reconciliation.sort((left, right) =>
    (regionOrder.get(left.regionId)! - regionOrder.get(right.regionId)!) ||
    (left.year - right.year) ||
    (["taxes_on_products", "subsidies_on_products", "net_product_taxes"].indexOf(left.component) -
      ["taxes_on_products", "subsidies_on_products", "net_product_taxes"].indexOf(right.component)));

  const validation = validateRegionalEconomyObservations(observations, regions, evidence.sectors);
  const nationalSectorPublicationDifferences = [];
  for (const year of evidence.activitySheets[0].years) {
    for (const activity of evidence.activitySheets[0].activities) {
      const regional = evidence.activitySheets.reduce(
        (sum, sheet) => sum.plus(sheet.cell(year, activity.row).value),
        new D(0),
      );
      const difference = regional.minus(evidence.nationalValidation.cell(year, activity.row).value);
      if (difference.abs().gt("0.01")) {
        nationalSectorPublicationDifferences.push({
          year,
          seriesId: activity.seriesId,
          regionalMinusNationalMillionGel: difference.toFixed(),
        });
      }
    }
  }
  if (!same(nationalSectorPublicationDifferences, REVIEWED_NATIONAL_DIFFERENCES)) {
    throw new Error("Regional/national sector publication differences changed");
  }

  for (const year of evidence.activitySheets[0].years) {
    const regionalTotal = evidence.activitySheets.reduce(
      (sum, sheet) => sum.plus(evidence.totalSheet.cell(sheet.regionId, year).value),
      new D(0),
    ).mul(1_000_000);
    const publishedRegionalTotal = new D(evidence.totalSheet.nationalCell(year).value).mul(1_000_000);
    const publishedNationalTotal = new D(evidence.nationalValidation.cell(year, 26).value).mul(1_000_000);
    if (regionalTotal.minus(publishedRegionalTotal).abs().gt(tolerance) || publishedRegionalTotal.minus(publishedNationalTotal).abs().gt(tolerance)) {
      throw new Error(`Regional totals do not reconcile to national GDP: ${year}`);
    }
  }

  return {
    observations,
    reconciliation,
    report: {
      status: "PASS" as const,
      capturedOn: evidence.manifest.capturedOn,
      reviewedAt: evidence.manifest.reviewedAt,
      coverage: { firstYear: 2010, lastYear: 2024, regions: regions.length, sectors: evidence.sectors.length },
      sourceCounts: {
        regionalTotals: regions.length * 15,
        regionalSectorAmounts: regions.length * evidence.sectors.length * 15,
        reconciliationRows: reconciliation.length,
      },
      validationCounts: validation.counts,
      missingValues: 0,
      duplicateKeys: observations.length - validation.uniqueKeys,
      allRegionAccountsReconcile: true,
      allRegionTotalsReconcileToNational: true,
      regionalAccountingToleranceGel: tolerance.toFixed(),
      nationalSectorPublicationDifferences,
      sourceHashes: Object.fromEntries(evidence.manifest.sources.map((source) => [source.file, source.sha256])),
    },
  };
}

const csv = (headers: string[], rows: (string | number | boolean)[][]) => serializeBomCsvRows([headers, ...rows]);

export function buildRegionalEconomyArtifacts(
  result: Awaited<ReturnType<typeof prepareRegionalEconomies>>,
) {
  const canonical = csv(
    [
      "region_id", "series_id", "year", "measure", "value", "unit", "valuation",
      "price_basis", "calculation", "status", "source_id", "source_locator", "last_reviewed_at",
    ],
    result.observations.map((row) => [
      row.regionId, row.seriesId, row.year, row.measure, row.value, row.unit, row.valuation,
      row.priceBasis, row.calculation, row.status, row.sourceId, row.sourceLocator, row.lastReviewedAt,
    ]),
  );
  const reconciliation = csv(
    [
      "region_id", "year", "component", "value_gel", "source_id", "source_locator",
      "summed_sector_gva_gel", "published_basic_price_gdp_gel", "published_market_price_gdp_gel",
      "regional_total_gel", "gva_difference_gel", "accounting_difference_gel", "total_difference_gel",
      "tolerance_gel",
    ],
    result.reconciliation.map((row) => [
      row.regionId, row.year, row.component, row.valueGel, row.sourceId, row.sourceLocator,
      row.summedSectorGvaGel, row.publishedBasicPriceGdpGel, row.publishedMarketPriceGdpGel,
      row.regionalTotalGel, row.gvaDifferenceGel, row.accountingDifferenceGel, row.totalDifferenceGel,
      row.toleranceGel,
    ]),
  );
  return new Map<string, Buffer>([
    ["data/imports/regional-economies-annual.csv", Buffer.from(canonical, "utf8")],
    ["data/staging/regional-economies-reconciliation.csv", Buffer.from(reconciliation, "utf8")],
    ["data/reports/regional-economies-validation.json", Buffer.from(`${JSON.stringify(result.report, null, 2)}\n`, "utf8")],
  ]);
}

export async function writeRegionalEconomyArtifacts(
  write: boolean,
  repositoryRoot = path.resolve(process.cwd(), "../.."),
) {
  const result = await prepareRegionalEconomies(repositoryRoot);
  const artifacts = buildRegionalEconomyArtifacts(result);
  for (const [relativePath, expected] of artifacts) {
    const target = path.join(repositoryRoot, relativePath);
    if (write) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, expected);
      continue;
    }
    let actual: Buffer;
    try {
      actual = await fs.readFile(target);
    } catch {
      throw new Error(`Generated regional economy artifact is missing: ${relativePath}`);
    }
    if (!actual.equals(expected)) throw new Error(`Generated regional economy artifact is stale: ${relativePath}`);
  }
  return result.report;
}

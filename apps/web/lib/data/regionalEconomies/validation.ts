import Decimal from "decimal.js";
import type { MunicipalRegion } from "../municipal/types";
import type { SectorDefinition } from "../economicSectors/types";
import { shareOfRegionGdpPercent } from "./calculations";
import {
  REGIONAL_GDP_TOTAL,
  type RegionalEconomyMeasure,
  type RegionalEconomyObservation,
  type RegionalEconomyValidationReport,
} from "./types";

const YEARS = Array.from({ length: 15 }, (_, index) => 2010 + index);
const MEASURES: RegionalEconomyMeasure[] = ["nominal", "share_of_region_gdp"];
const DECIMAL_TEXT = /^-?(0|[1-9]\d*)(?:\.\d+)?$/;

const key = (row: Pick<RegionalEconomyObservation, "regionId" | "seriesId" | "measure" | "year">) =>
  `${row.regionId}:${row.seriesId}:${row.measure}:${row.year}`;

function validateDecimal(row: RegionalEconomyObservation) {
  if (!DECIMAL_TEXT.test(row.value)) throw new Error(`Invalid decimal ${key(row)}`);
  const value = new Decimal(row.value);
  if (
    !value.isFinite() ||
    (value.isZero() && row.value.startsWith("-")) ||
    value.decimalPlaces() > 20 ||
    value.abs().gte("100000000000000000000")
  ) throw new Error(`Decimal does not fit regional economy mirror ${key(row)}`);
}

function validateDate(value: string, rowKey: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) throw new Error(`Invalid regional economy review date ${rowKey}`);
}

export function validateRegionalEconomyObservations(
  rows: readonly RegionalEconomyObservation[],
  regions: readonly MunicipalRegion[],
  sectorRegistry: readonly SectorDefinition[],
): RegionalEconomyValidationReport {
  const regionIds = new Set(regions.map((region) => region.id));
  const sectors = sectorRegistry
    .filter((sector): sector is SectorDefinition & { classificationCode: string } => sector.classificationCode !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const seriesIds = [REGIONAL_GDP_TOTAL, ...sectors.map((sector) => sector.id)];
  const allowedSeriesIds = new Set(seriesIds);
  const observed = new Map<string, RegionalEconomyObservation>();

  for (const row of rows) {
    const rowKey = key(row);
    if (!regionIds.has(row.regionId)) throw new Error(`Unknown regional economy region ${rowKey}`);
    if (!allowedSeriesIds.has(row.seriesId)) throw new Error(`Unknown regional economy series ${rowKey}`);
    if (!Number.isInteger(row.year) || !YEARS.includes(row.year)) throw new Error(`Invalid regional economy year ${rowKey}`);
    if (!MEASURES.includes(row.measure)) throw new Error(`Invalid regional economy measure ${rowKey}`);
    if (observed.has(rowKey)) throw new Error(`Duplicate regional economy observation ${rowKey}`);
    observed.set(rowKey, row);
    validateDecimal(row);
    validateDate(row.lastReviewedAt, rowKey);
    if (!row.sourceLocator.trim()) throw new Error(`Missing regional economy source locator ${rowKey}`);
    if (row.status !== "published" || row.priceBasis !== "current_prices") {
      throw new Error(`Invalid regional economy status or price basis ${rowKey}`);
    }
    const expectedValuation = row.seriesId === REGIONAL_GDP_TOTAL ? "market_prices" : "basic_prices";
    if (row.valuation !== expectedValuation) throw new Error(`Invalid regional economy valuation ${rowKey}`);
    if (row.measure === "nominal") {
      const expectedSource = row.seriesId === REGIONAL_GDP_TOTAL
        ? "source.geostat_regional_gdp"
        : "source.geostat_regional_gdp_by_activity";
      if (row.unit !== "gel" || row.calculation !== "published" || row.sourceId !== expectedSource) {
        throw new Error(`Invalid regional economy nominal contract ${rowKey}`);
      }
    } else if (
      row.unit !== "percent" ||
      row.calculation !== "ratio_to_region_gdp" ||
      row.sourceId !== "source.fiscal_regional_economy_share"
    ) throw new Error(`Invalid regional economy share contract ${rowKey}`);
  }

  const find = (regionId: string, seriesId: string, measure: RegionalEconomyMeasure, year: number) =>
    observed.get(key({ regionId, seriesId, measure, year }));

  for (const region of regions) {
    for (const year of YEARS) {
      const denominator = find(region.id, REGIONAL_GDP_TOTAL, "nominal", year);
      if (!denominator) throw new Error(`Missing regional economy observation ${region.id}:${REGIONAL_GDP_TOTAL}:nominal:${year}`);
      if (new Decimal(denominator.value).lte(0)) throw new Error(`Expected positive regional GDP ${region.id}:${year}`);
      for (const seriesId of seriesIds) {
        const nominal = find(region.id, seriesId, "nominal", year);
        const share = find(region.id, seriesId, "share_of_region_gdp", year);
        if (!nominal) throw new Error(`Missing regional economy observation ${region.id}:${seriesId}:nominal:${year}`);
        if (!share) throw new Error(`Missing regional economy observation ${region.id}:${seriesId}:share_of_region_gdp:${year}`);
        const expectedShare = shareOfRegionGdpPercent(nominal.value, denominator.value);
        if (share.value !== expectedShare) throw new Error(`Invalid regional GDP share ${key(share)}`);
      }
    }
  }

  const nominal = rows.filter((row) => row.measure === "nominal").length;
  const shareOfRegionGdp = rows.filter((row) => row.measure === "share_of_region_gdp").length;
  return {
    counts: {
      regions: regions.length,
      years: YEARS.length,
      selectableSeries: seriesIds.length,
      nominal,
      shareOfRegionGdp,
      total: rows.length,
    },
    uniqueKeys: observed.size,
  };
}

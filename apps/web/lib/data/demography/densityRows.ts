import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { z } from "zod";
import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import { DemographyStopError } from "./stops";

const EXCLUDED = "excluded";

const rowSchema = z
  .object({
    table_label: z.string().min(1),
    geography_id: z.string().regex(new RegExp(`^(${MUNICIPAL_COUNTRY_ID.replace(".", "\\.")}|region\\.[a-z_]+|${EXCLUDED})$`)),
    area_km2: z.string().regex(/^(\d+(\.\d+)?)?$/),
    mapping_note: z.string().min(1),
    reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((row) => (row.geography_id === EXCLUDED ? row.area_km2 === "" : Number(row.area_km2) > 0), {
    message: "a reviewed unit needs a positive area and an excluded row none",
  });

export type DensityRow = { geographyId: string; areaKm2: number } | { geographyId: null; areaKm2: null };

export type DensityRows = {
  /** The row labels of Geostat's density table, in the order of the reviewed file. */
  readonly labels: readonly string[];
  /** A label that no reviewed file knows stops preparation. Surrounding whitespace is ignored. */
  resolve(label: string): DensityRow;
  /** The area in km² behind a unit's density: the March-2014 area, without the occupied territories. */
  areaOf(geographyId: string): number;
};

/**
 * Geostat's density table prints no area, only persons per km². Its densities are the 1 January
 * population divided by a fixed area as of March 2014, so the reviewed file records that area for
 * Georgia and each region, with the way it was derived. Validation recomputes every served density
 * from it. The region areas must add up to Georgia's, and every region must appear exactly once.
 */
export async function loadDensityRows(repositoryRoot: string, regionIds: readonly string[]): Promise<DensityRows> {
  const file = path.join(repositoryRoot, "data/mappings/demography/density-rows.csv");
  const records = parse(await fs.readFile(file, "utf8"), { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const byLabel = new Map<string, DensityRow>();
  const areas = new Map<string, number>();
  records.forEach((record, index) => {
    const result = rowSchema.safeParse(record);
    if (!result.success) throw new Error(`density-rows.csv row ${index + 2} is invalid: ${result.error.message}`);
    const { table_label: label, geography_id: geographyId, area_km2: area } = result.data;
    if (byLabel.has(label)) throw new Error(`The density row mapping lists the label twice: ${label}`);
    if (geographyId === EXCLUDED) {
      byLabel.set(label, { geographyId: null, areaKm2: null });
      return;
    }
    if (areas.has(geographyId)) throw new Error(`The density row mapping lists the unit twice: ${geographyId}`);
    areas.set(geographyId, Number(area));
    byLabel.set(label, { geographyId, areaKm2: Number(area) });
  });

  for (const id of [MUNICIPAL_COUNTRY_ID, ...regionIds]) {
    if (!areas.has(id)) throw new Error(`The density row mapping has no row for ${id}`);
  }
  const unreviewed = [...areas.keys()].filter((id) => id !== MUNICIPAL_COUNTRY_ID && !regionIds.includes(id));
  if (unreviewed.length > 0) throw new Error(`The density row mapping names units that are not reviewed regions: ${unreviewed.join(", ")}`);
  const regionSum = regionIds.reduce((total, id) => total.plus(areas.get(id)!), new Decimal(0));
  if (!regionSum.equals(areas.get(MUNICIPAL_COUNTRY_ID)!)) {
    throw new Error(`The region areas must add up to Georgia's area: ${regionSum} km² against ${areas.get(MUNICIPAL_COUNTRY_ID)} km²`);
  }

  return {
    labels: [...byLabel.keys()],
    resolve(rawLabel) {
      const row = byLabel.get(rawLabel.trim());
      if (!row) throw new DemographyStopError("unreviewed_label", `Unreviewed density table row: ${rawLabel}`);
      return row;
    },
    areaOf(geographyId) {
      const area = areas.get(geographyId);
      if (area === undefined) throw new Error(`No reviewed area for ${geographyId}`);
      return area;
    },
  };
}

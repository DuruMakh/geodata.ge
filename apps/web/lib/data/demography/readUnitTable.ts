import { MUNICIPAL_COUNTRY_ID } from "../municipal/types";
import { type DemographyGeography, readUnitRows, type UnitScope } from "./geography";
import { findYearColumns, type StoredSheet } from "./readStoredSheet";
import { DemographyStopError } from "./stops";

export type UnitCell = {
  geographyId: string;
  year: number;
  /** Whole persons or events: the unit's own cell, plus its starred city row where Geostat prints one separately. */
  value: number;
  /** The stored cells the value comes from: the unit's own, then its city component's. */
  refs: string[];
};

export type UnitTableOptions = {
  scope: UnitScope;
  /** Population tables publish thousands of persons; event tables publish counts. */
  scale: "thousands" | "count";
  /** First year served for Georgia, and for regions and municipalities. The last year is whatever the header holds. */
  countryFrom: number;
  unitsFrom: number;
};

/**
 * One table of Georgia, regions and self-governed units by year, read into whole numbers with the
 * exact cells they come from. Units are matched by reviewed label only. A served cell that is
 * blank, a value in an excluded unit or outside a city row's published years, a repeated row and
 * a missing municipality or region each stop preparation. Output order is Georgia, the regions in
 * taxonomy order, then the municipalities in file order, each by year.
 */
export function readUnitTable(sheet: StoredSheet, geography: DemographyGeography, options: UnitTableOptions): UnitCell[] {
  const { scope, scale, countryFrom, unitsFrom } = options;
  const columns = findYearColumns(sheet, 4);
  const lastYear = Math.max(...columns.keys());
  const years = (from: number) => Array.from({ length: lastYear - from + 1 }, (_, index) => from + index);
  const refAt = (row: number, year: number) => {
    const block = columns.get(year);
    if (block?.length !== 1) {
      throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} needs exactly one column under ${year}`);
    }
    return sheet.ref(block[0]!, row);
  };
  const read = (ref: string) => (scale === "thousands" ? sheet.persons(ref) : sheet.count(ref));
  const required = (ref: string, label: string) => {
    const value = read(ref);
    if (value === null) throw new DemographyStopError("missing_served_cell", `Sheet ${sheet.name} has no value at ${ref} (${label})`);
    return value;
  };

  const byGeography = new Map<string, Map<number, UnitCell>>();
  const cityRows: Array<{ hostId: string; year: number; value: number; ref: string }> = [];
  const seen = new Set<string>();

  for (const { row, label } of readUnitRows(sheet)) {
    const unit = geography.resolve(label, scope);
    const key = unit.kind === "city_component" || unit.kind === "excluded" ? `${unit.kind}:${label}` : `${unit.kind}:${unit.geographyId}`;
    if (seen.has(key)) throw new DemographyStopError("layout_changed", `${label} appears twice in sheet ${sheet.name}`);
    seen.add(key);

    if (unit.kind === "excluded") {
      for (const year of years(unitsFrom)) {
        const ref = refAt(row, year);
        if (read(ref) !== null) throw new DemographyStopError("unexpected_value", `Excluded unit ${label} holds a value at ${sheet.name}!${ref}`);
      }
    } else if (unit.kind === "city_component") {
      for (const year of years(unitsFrom)) {
        const ref = refAt(row, year);
        if (year >= unit.startYear && year <= unit.endYear) {
          cityRows.push({ hostId: unit.geographyId, year, value: required(ref, label), ref });
        } else if (read(ref) !== null) {
          throw new DemographyStopError("unexpected_value", `City row ${label} holds a value outside its published years at ${sheet.name}!${ref}`);
        }
      }
    } else {
      const cells = new Map<number, UnitCell>();
      for (const year of years(unit.kind === "country" ? countryFrom : unitsFrom)) {
        const ref = refAt(row, year);
        cells.set(year, { geographyId: unit.geographyId, year, value: required(ref, label), refs: [ref] });
      }
      byGeography.set(unit.geographyId, cells);
    }
  }

  for (const id of [MUNICIPAL_COUNTRY_ID, ...geography.municipalities.map((municipality) => municipality.code)]) {
    if (!byGeography.has(id)) throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} has no row for ${id}`);
  }
  for (const city of cityRows) {
    const host = byGeography.get(city.hostId)!.get(city.year)!;
    host.value += city.value;
    host.refs.push(city.ref);
  }
  // Tbilisi is one municipality and one region, and Geostat prints only the municipality row.
  for (const region of geography.regions) {
    if (byGeography.has(region.id)) continue;
    const members = geography.municipalities.filter((municipality) => municipality.regionId === region.id);
    if (members.length !== 1) throw new DemographyStopError("layout_changed", `Sheet ${sheet.name} has no row for ${region.id}`);
    const cells = new Map<number, UnitCell>();
    for (const [year, cell] of byGeography.get(members[0]!.code)!) cells.set(year, { ...cell, geographyId: region.id, refs: [...cell.refs] });
    byGeography.set(region.id, cells);
  }

  const order = [MUNICIPAL_COUNTRY_ID, ...geography.regions.map((region) => region.id), ...geography.municipalities.map((municipality) => municipality.code)];
  return order.flatMap((id) => [...byGeography.get(id)!.values()]);
}

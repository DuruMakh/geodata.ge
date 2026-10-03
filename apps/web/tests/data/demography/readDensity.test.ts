import { beforeAll, describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { loadDensityRows, type DensityRows } from "../../../lib/data/demography/densityRows";
import { loadDemographyGeography } from "../../../lib/data/demography/geography";
import { readDensity } from "../../../lib/data/demography/readDensity";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { DemographyStopError } from "../../../lib/data/demography/stops";
import type { DemographyObservation, DemographySources } from "../../../lib/data/demography/types";
import { editSource, repositoryRoot, setCell, unitCell } from "./helpers";

const SERIES = "demography.population_density";
const SOURCE = "source.geostat_demography_density";
const GEORGIA = "country.georgia";
const AREA_NOTE = "Note:  Starting from 2014, the area of the regions is given as of March, 2014";

let sources: DemographySources;
let rows: DensityRows;
let density: DemographyObservation[];
beforeAll(async () => {
  sources = await loadDemographySources(repositoryRoot);
  const geography = await loadDemographyGeography(repositoryRoot);
  rows = await loadDensityRows(repositoryRoot, geography.regions.map((region) => region.id));
  density = readDensity(sources, rows);
});

const at = (geographyId: string, year: number) => density.find((row) => row.geographyId === geographyId && row.year === year)!;
const yearsOf = (geographyId: string) => density.filter((row) => row.geographyId === geographyId).map((row) => row.year);
const condition = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof DemographyStopError ? error.condition : `not a stop: ${String(error)}`;
  }
  return "no error";
};
const readEdited = (edit: (sheet: XLSX.WorkSheet) => void) => readDensity(editSource(sources, SOURCE, edit), rows);

describe("population density from Geostat's table 03", () => {
  test("carries Georgia and each region as published, with the exact cell and the 1 January reference date", () => {
    expect(at(GEORGIA, 2025)).toEqual({
      seriesId: SERIES,
      geographyId: GEORGIA,
      year: 2025,
      value: "68.7",
      unit: "persons_per_km2",
      estimateBasis: "census_based",
      status: "published",
      sourceId: SOURCE,
      sourceLocator: "1!AG5 [2025-01-01]",
      lastReviewedAt: "2026-10-03",
    });
    expect(at("region.tbilisi", 2025)).toMatchObject({ value: "2648.9", sourceLocator: "1!AG6 [2025-01-01]" });
    expect(at("region.racha_lechkhumi_kvemo_svaneti", 2024).value).toBe("5.7");
    expect(at("region.imereti", 2026).value).toBe("76.8");
  });

  test("carries the one column Geostat stores unrounded at the one decimal its workbook displays", () => {
    // Adjara 2022 is stored 122.57310344827586 under a one-decimal format.
    expect(at("region.adjara", 2022).value).toBe("122.6");
    expect(at(GEORGIA, 2022).value).toBe("64.5");
  });

  test("starts Georgia in 2014 and the regions in 2015, where the March-2014 area basis and the regional population begin", () => {
    expect(yearsOf(GEORGIA)).toEqual(Array.from({ length: 13 }, (_, index) => 2014 + index));
    for (const regionId of ["region.tbilisi", "region.adjara", "region.shida_kartli"]) {
      expect(yearsOf(regionId)).toEqual(Array.from({ length: 12 }, (_, index) => 2015 + index));
    }
    expect(density).toHaveLength(13 + 11 * 12);
    expect(density.some((row) => row.geographyId === null || row.year < 2014)).toBe(false);
  });

  test("labels the population behind each value as the 1 January population is labelled", () => {
    expect(at(GEORGIA, 2014).estimateBasis).toBe("retro_projection");
    expect(at("region.guria", 2015).estimateBasis).toBe("pre_census");
    expect(at("region.guria", 2024).estimateBasis).toBe("pre_census");
    expect(at("region.guria", 2025).estimateBasis).toBe("census_based");
  });

  test("matches the text the workbook displays for every carried value", () => {
    const shown = XLSX.read(sources.get(SOURCE).bytes, { type: "buffer", cellText: true, cellNF: true });
    const sheet = shown.Sheets[shown.SheetNames[0]!]!;

    for (const row of density) {
      const ref = /^1!([A-Z]+\d+) /.exec(row.sourceLocator)![1]!;
      expect(row.value, `${row.geographyId} ${row.year}`).toBe((sheet[ref] as XLSX.CellObject).w!.replaceAll(",", ""));
    }
  });
});

describe("density stop conditions", () => {
  test("stops on a value for the occupied territory of Abkhazia", () => {
    expect(condition(() => readEdited((sheet) => setCell(sheet, unitCell(sheet, "Abkhazia A.R.", 2020), 17.3)))).toBe("unexpected_value");
  });

  test("stops on a blank served cell", () => {
    expect(condition(() => readEdited((sheet) => delete sheet[unitCell(sheet, "Guria", 2024)]))).toBe("missing_served_cell");
  });

  test("stops on text where a number belongs", () => {
    expect(condition(() => readEdited((sheet) => setCell(sheet, unitCell(sheet, "Guria", 2024), "n/a")))).toBe("unexpected_cell");
  });

  test("stops when Geostat's note about the March-2014 area basis changes or goes", () => {
    const noteRow = (sheet: XLSX.WorkSheet) => Object.keys(sheet).find((key) => key.startsWith("A") && (sheet[key] as XLSX.CellObject).v === AREA_NOTE)!;

    expect(condition(() => readEdited((sheet) => setCell(sheet, noteRow(sheet), "Note: Starting from 2014, the area of the regions is given as of March, 2024")))).toBe("layout_changed");
    expect(condition(() => readEdited((sheet) => delete sheet[noteRow(sheet)]))).toBe("layout_changed");
  });

  test("stops on a moved header and on a row label nobody reviewed", () => {
    expect(condition(() => readEdited((sheet) => setCell(sheet, "A4", "territories")))).toBe("layout_changed");
    expect(condition(() => readEdited((sheet) => setCell(sheet, unitCell(sheet, "Imereti", 2020).replace(/[A-Z]+/, "A"), "Imeretia")))).toBe("unreviewed_label");
  });

  test("stops when a reviewed row has gone", () => {
    expect(condition(() => readEdited((sheet) => setCell(sheet, unitCell(sheet, "Guria", 2020).replace(/[A-Z]+/, "A"), "Abkhazia A.R.")))).toBe("layout_changed");
  });
});

import { beforeAll, describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { readFertilityByAge } from "../../../lib/data/demography/readFertilityAge";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { DemographyStopError } from "../../../lib/data/demography/stops";
import type { DemographyObservation, DemographySources } from "../../../lib/data/demography/types";
import { editSource, repositoryRoot, setCell } from "./helpers";

const SERIES = "demography.age_specific_fertility_rate";
const SOURCE = "source.geostat_demography_fertility";
const GROUPS = ["mother_under_20", "mother_20_24", "mother_25_29", "mother_30_34", "mother_35_39", "mother_40_44", "mother_45_54"];
const NOTE = "Note: 1995-2013 based on the retro-projection; starting from 2014 based on the registered data";

let sources: DemographySources;
let fertility: DemographyObservation[];
beforeAll(async () => {
  sources = await loadDemographySources(repositoryRoot);
  fertility = readFertilityByAge(sources);
});

const at = (group: string, year: number) => fertility.find((row) => row.ageGroup === group && row.year === year)!;
const condition = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof DemographyStopError ? error.condition : `not a stop: ${String(error)}`;
  }
  return "no error";
};
const readEdited = (edit: (sheet: XLSX.WorkSheet) => void) => readFertilityByAge(editSource(sources, SOURCE, edit));

describe("age-specific fertility rates from Geostat's table 16", () => {
  test("carries the seven mother-age groups for Georgia, 2014 to 2025, as published", () => {
    expect(fertility).toHaveLength(7 * 12);
    expect(new Set(fertility.map((row) => row.ageGroup))).toEqual(new Set(GROUPS));
    expect(Math.min(...fertility.map((row) => row.year))).toBe(2014);
    expect(Math.max(...fertility.map((row) => row.year))).toBe(2025);
    expect(fertility.every((row) => row.geographyId === "country.georgia")).toBe(true);
  });

  test("labels each rate with its group, unit, lineage and exact cell", () => {
    expect(at("mother_20_24", 2014)).toEqual({
      seriesId: SERIES,
      geographyId: "country.georgia",
      year: 2014,
      value: "144.7",
      unit: "births_per_1000_women",
      estimateBasis: "registered",
      status: "published",
      sourceId: SOURCE,
      sourceLocator: "1!C26 [2014]",
      lastReviewedAt: "2026-10-03",
      ageGroup: "mother_20_24",
    });
    expect(at("mother_under_20", 2025)).toMatchObject({ value: "12.4", sourceLocator: "1!B37 [2025]" });
    expect(at("mother_45_54", 2025)).toMatchObject({ value: "4.0", sourceLocator: "1!H37 [2025]" });
  });

  test("keeps the trailing zero of a whole-number rate, as the workbook displays it", () => {
    expect(at("mother_25_29", 2023).value).toBe("102.0");
  });

  test("matches the text the workbook displays for every carried value", () => {
    const shown = XLSX.read(sources.get(SOURCE).bytes, { type: "buffer", cellText: true, cellNF: true });
    const sheet = shown.Sheets[shown.SheetNames[0]!]!;

    for (const row of fertility) {
      const ref = /^1!([A-Z]+\d+) /.exec(row.sourceLocator)![1]!;
      expect(row.value, `${row.ageGroup} ${row.year}`).toBe((sheet[ref] as XLSX.CellObject).w);
    }
  });
});

describe("fertility-by-age stop conditions", () => {
  test("stops on a changed mother-age label or header", () => {
    expect(condition(() => readEdited((sheet) => setCell(sheet, "C5", "20-25")))).toBe("layout_changed");
    expect(condition(() => readEdited((sheet) => setCell(sheet, "B4", "age of woman:")))).toBe("layout_changed");
  });

  test("stops when the note that dates the registered data changes or goes", () => {
    const noteCell = (sheet: XLSX.WorkSheet) => Object.keys(sheet).find((key) => (sheet[key] as XLSX.CellObject).v === NOTE)!;

    expect(condition(() => readEdited((sheet) => setCell(sheet, noteCell(sheet), "Note: starting from 2012 based on the registered data")))).toBe("layout_changed");
    expect(condition(() => readEdited((sheet) => delete sheet[noteCell(sheet)]))).toBe("layout_changed");
  });

  test("stops on a blank served cell and on text where a rate belongs", () => {
    expect(condition(() => readEdited((sheet) => delete sheet.C26))).toBe("missing_served_cell");
    expect(condition(() => readEdited((sheet) => setCell(sheet, "D27", "n/a")))).toBe("unexpected_cell");
  });
});

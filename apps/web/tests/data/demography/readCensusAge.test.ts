import { beforeAll, describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { loadDemographyGeography, type DemographyGeography } from "../../../lib/data/demography/geography";
import { readCensusAge } from "../../../lib/data/demography/readCensusAge";
import { readStoredSheet } from "../../../lib/data/demography/readStoredSheet";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { DemographyStopError } from "../../../lib/data/demography/stops";
import type { DemographyObservation, DemographySources } from "../../../lib/data/demography/types";
import { editSource, repositoryRoot, setCell } from "./helpers";

const BY_AGE = "demography.census_population_by_age";
const BY_SETTLEMENT = "demography.census_population_by_settlement";
const SOURCE = "source.geostat_census2024_population_by_age_settlement";
const GEORGIA = "country.georgia";
const AGE_GROUPS = ["age_0_4", "age_5_9", "age_10_14", "age_15_19", "age_20_24", "age_25_29", "age_30_34", "age_35_39", "age_40_44", "age_45_49", "age_50_54", "age_55_59", "age_60_64", "age_65_69", "age_70_74", "age_75_79", "age_80_84", "age_85_plus"];

let sources: DemographySources;
let geography: DemographyGeography;
let census: DemographyObservation[];
beforeAll(async () => {
  [sources, geography] = await Promise.all([loadDemographySources(repositoryRoot), loadDemographyGeography(repositoryRoot)]);
  census = readCensusAge(sources, geography);
});

const series = (seriesId: string) => census.filter((row) => row.seriesId === seriesId);
const settlementRow = (geographyId: string, sex: string, settlement: string) =>
  series(BY_SETTLEMENT).find((row) => row.geographyId === geographyId && row.sex === sex && row.settlement === settlement)!;
const ageRow = (geographyId: string, sex: string, settlement: string, ageGroup: string) =>
  series(BY_AGE).find((row) => row.geographyId === geographyId && row.sex === sex && row.settlement === settlement && row.ageGroup === ageGroup)!;
const condition = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof DemographyStopError ? error.condition : `not a stop: ${String(error)}`;
  }
  return "no error";
};
const readEdited = (edit: (sheet: XLSX.WorkSheet) => void) => readCensusAge(editSource(sources, SOURCE, edit), geography);
const rowOf = (label: string) => readStoredSheet(sources.get(SOURCE).bytes, "1").findRow(label);

describe("the 2024 census by age, sex and settlement", () => {
  test("carries Geostat's published national findings: sexes, urban and rural", () => {
    expect(settlementRow(GEORGIA, "total", "total").value).toBe("3929581");
    expect(settlementRow(GEORGIA, "male", "total").value).toBe("1881004");
    expect(settlementRow(GEORGIA, "female", "total").value).toBe("2048577");
    expect(settlementRow(GEORGIA, "total", "urban").value).toBe("2455444");
    expect(settlementRow(GEORGIA, "total", "rural").value).toBe("1474137");
  });

  test("adds the five-year groups up to the published 0-14, 15-64 and 65+ findings", () => {
    const sum = (from: number, to: number) => AGE_GROUPS.slice(from, to + 1).reduce((total, group) => total + Number(ageRow(GEORGIA, "total", "total", group).value), 0);

    expect(sum(0, 2)).toBe(770_823);
    expect(sum(3, 12)).toBe(2_466_058);
    expect(sum(13, 17)).toBe(692_700);
  });

  test("labels every row as a census count on 14 November 2024, with the exact cell", () => {
    expect(settlementRow(GEORGIA, "total", "total")).toEqual({
      seriesId: BY_SETTLEMENT,
      geographyId: GEORGIA,
      year: 2024,
      value: "3929581",
      unit: "persons",
      estimateBasis: "census_count",
      status: "published",
      sourceId: SOURCE,
      sourceLocator: "1!B7 [2024-11-14]",
      lastReviewedAt: "2026-10-03",
      sex: "total",
      settlement: "total",
    });
    expect(ageRow(GEORGIA, "male", "rural", "age_85_plus")).toMatchObject({ ageGroup: "age_85_plus", sourceLocator: "1!I25 [2024-11-14]" });
  });

  test("serves ages for Georgia and the 11 regions only, and the settlement split for all 76 units", () => {
    expect(series(BY_AGE)).toHaveLength(12 * 3 * 3 * 18);
    expect(series(BY_SETTLEMENT)).toHaveLength(76 * 3 * 3);
    expect(new Set(series(BY_AGE).map((row) => row.geographyId)).size).toBe(12);
    expect(new Set(series(BY_SETTLEMENT).map((row) => row.geographyId)).size).toBe(76);
    expect(series(BY_AGE).every((row) => row.geographyId === GEORGIA || row.geographyId.startsWith("region."))).toBe(true);
    expect(census.every((row) => row.year === 2024)).toBe(true);
  });

  test("gives Tbilisi's region the row Geostat prints for its municipality", () => {
    expect(settlementRow("region.tbilisi", "total", "total").value).toBe("1331485");
    expect(settlementRow("04", "total", "total").value).toBe("1331485");
    expect(settlementRow("region.tbilisi", "total", "total").sourceLocator).toBe(settlementRow("04", "total", "total").sourceLocator);
    // Female, urban, 30-34 is the seventh age row under the Tbilisi row, in column G.
    const sheet = readStoredSheet(sources.get(SOURCE).bytes, "1");
    const tbilisi = sheet.findRow("C. Tbilisi");
    expect(ageRow("region.tbilisi", "female", "urban", "age_30_34")).toMatchObject({
      value: String(sheet.countNilAsZero(`G${tbilisi + 7}`)),
      sourceLocator: `1!G${tbilisi + 7} [2024-11-14]`,
    });
    expect(ageRow("region.adjara", "total", "total", "age_0_4")).toBeDefined();
  });

  test("reads a dash as the true zero the table's own note says it is", () => {
    // Batumi has no rural settlements and Khelvachauri no urban ones; the cells print "-".
    expect(settlementRow("06", "total", "rural").value).toBe("0");
    expect(settlementRow("06", "male", "rural").value).toBe("0");
    expect(settlementRow("08", "total", "urban").value).toBe("0");
    expect(Number(settlementRow("06", "total", "urban").value)).toBe(Number(settlementRow("06", "total", "total").value));
  });
});

describe("census age table stop conditions", () => {
  test("stops when the note that defines the dash, or the note on occupied territories, changes", () => {
    expect(condition(() => readEdited((sheet) => setCell(sheet, "A1435", "- Not available")))).toBe("layout_changed");
    expect(condition(() => readEdited((sheet) => setCell(sheet, "A1434", "Note: Includes occupied territories of Georgia")))).toBe("layout_changed");
  });

  test("stops on a blank cell and on text where a count belongs", () => {
    expect(condition(() => readEdited((sheet) => delete sheet.C7))).toBe("missing_served_cell");
    expect(condition(() => readEdited((sheet) => setCell(sheet, "D8", "n/a")))).toBe("unexpected_cell");
  });

  test("stops on a count that is not a whole number of persons", () => {
    expect(condition(() => readEdited((sheet) => setCell(sheet, "B7", 3929581.5)))).toBe("not_whole_person");
  });

  test("stops on a moved header, a changed age label and a changed title", () => {
    expect(condition(() => readEdited((sheet) => setCell(sheet, "E5", "Town")))).toBe("layout_changed");
    expect(condition(() => readEdited((sheet) => setCell(sheet, "C6", "Men")))).toBe("layout_changed");
    expect(condition(() => readEdited((sheet) => setCell(sheet, "A9", "5-10")))).toBe("layout_changed");
    expect(condition(() => readEdited((sheet) => setCell(sheet, "A1", "Population of Georgia by regions")))).toBe("layout_changed");
  });

  test("stops on a unit label nobody reviewed and on a unit printed twice", () => {
    expect(condition(() => readEdited((sheet) => setCell(sheet, `A${rowOf("Keda Municipality")}`, "Keda Municipalty")))).toBe("unreviewed_label");
    expect(condition(() => readEdited((sheet) => setCell(sheet, `A${rowOf("Keda Municipality")}`, "Kobuleti Municipality")))).toBe("layout_changed");
  });
});

import { beforeAll, describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { loadReviewedAnomalies, type ReviewedAnomalies } from "../../../lib/data/demography/anomalies";
import { loadDemographyGeography, type DemographyGeography } from "../../../lib/data/demography/geography";
import { findYearColumns, readStoredSheet } from "../../../lib/data/demography/readStoredSheet";
import { readVitalEvents } from "../../../lib/data/demography/readVital";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { DemographyStopError } from "../../../lib/data/demography/stops";
import type { DemographyObservation, DemographySources } from "../../../lib/data/demography/types";
import { editSource, repositoryRoot, setCell, unitCell } from "./helpers";

let sources: DemographySources;
let geography: DemographyGeography;
let anomalies: ReviewedAnomalies;
let vital: DemographyObservation[];
beforeAll(async () => {
  [sources, geography, anomalies] = await Promise.all([
    loadDemographySources(repositoryRoot),
    loadDemographyGeography(repositoryRoot),
    loadReviewedAnomalies(repositoryRoot),
  ]);
  vital = readVitalEvents(sources, geography, anomalies);
});

const GEORGIA = "country.georgia";
const SERIES = {
  births: "demography.live_births",
  deaths: "demography.deaths",
  naturalIncrease: "demography.natural_increase",
  crudeBirthRate: "demography.crude_birth_rate",
  crudeDeathRate: "demography.crude_death_rate",
  totalFertilityRate: "demography.total_fertility_rate",
  infantMortalityRate: "demography.infant_mortality_rate",
  lifeExpectancyTotal: "demography.life_expectancy_total",
  lifeExpectancyMale: "demography.life_expectancy_male",
  lifeExpectancyFemale: "demography.life_expectancy_female",
};
const COUNT_SERIES = [SERIES.births, SERIES.deaths, SERIES.naturalIncrease];
const SOURCE = {
  births: "source.geostat_demography_births",
  deaths: "source.geostat_demography_deaths",
  naturalIncrease: "source.geostat_demography_natural_increase",
  crudeBirthRate: "source.geostat_demography_crude_birth_rate",
  fertility: "source.geostat_demography_fertility",
};
const rowsOf = (seriesId: string) => vital.filter((row) => row.seriesId === seriesId);
const at = (seriesId: string, geographyId: string, year: number) =>
  rowsOf(seriesId).find((row) => row.geographyId === geographyId && row.year === year)!;
const condition = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof DemographyStopError ? error.condition : `not a stop: ${String(error)}`;
  }
  return "no error";
};

describe("registered vital-event counts", () => {
  test("carries Georgia's births, deaths and natural increase with the audit's values and exact cells", () => {
    expect(at(SERIES.births, GEORGIA, 2014)).toEqual({
      seriesId: SERIES.births,
      geographyId: GEORGIA,
      year: 2014,
      value: "60635",
      unit: "persons",
      estimateBasis: "registered",
      status: "published",
      sourceId: SOURCE.births,
      sourceLocator: "1!V5 [2014]",
      lastReviewedAt: "2026-10-01",
    });
    expect(at(SERIES.births, GEORGIA, 2025)).toMatchObject({ value: "37867", sourceLocator: "1!AG5 [2025]" });
    expect(at(SERIES.deaths, GEORGIA, 2014).value).toBe("49087");
    expect(at(SERIES.deaths, GEORGIA, 2025).value).toBe("44319");
    expect(at(SERIES.naturalIncrease, GEORGIA, 2014).value).toBe("11548");
    expect(at(SERIES.naturalIncrease, GEORGIA, 2025).value).toBe("-6452");
  });

  test("starts Georgia in 2014 and every region and municipality in 2015, with no earlier row", () => {
    for (const seriesId of COUNT_SERIES) {
      const rows = rowsOf(seriesId);
      const georgia = rows.filter((row) => row.geographyId === GEORGIA).map((row) => row.year);
      const units = rows.filter((row) => row.geographyId !== GEORGIA);

      expect(georgia, seriesId).toEqual(Array.from({ length: 12 }, (_, index) => 2014 + index));
      expect(Math.min(...units.map((row) => row.year)), seriesId).toBe(2015);
      expect(rows, seriesId).toHaveLength(12 + (11 + 64) * 11);
    }
  });

  test("lists Georgia, then the regions in taxonomy order, then the municipalities in file order", () => {
    const order = [...new Set(rowsOf(SERIES.deaths).map((row) => row.geographyId))];

    expect(order[0]).toBe(GEORGIA);
    expect(order.slice(1, 12)).toEqual(geography.regions.map((region) => region.id));
    expect(order.slice(12)).toEqual(geography.municipalities.map((municipality) => municipality.code));
  });

  test("makes Georgia the sum of the 64 municipalities and each region the sum of its members, 2015 to 2025", () => {
    for (const seriesId of COUNT_SERIES) {
      for (let year = 2015; year <= 2025; year += 1) {
        const municipalities = geography.municipalities.map((row) => ({ ...row, value: Number(at(seriesId, row.code, year).value) }));
        expect(municipalities.reduce((sum, row) => sum + row.value, 0), `${seriesId} Georgia ${year}`).toBe(Number(at(seriesId, GEORGIA, year).value));
        for (const region of geography.regions) {
          const members = municipalities.filter((row) => row.regionId === region.id);
          expect(members.reduce((sum, row) => sum + row.value, 0), `${seriesId} ${region.id} ${year}`).toBe(Number(at(seriesId, region.id, year).value));
        }
      }
    }
  });

  test("makes natural increase births minus deaths in every row", () => {
    for (const row of rowsOf(SERIES.naturalIncrease)) {
      const births = Number(at(SERIES.births, row.geographyId, row.year).value);
      const deaths = Number(at(SERIES.deaths, row.geographyId, row.year).value);
      expect(births - deaths, `${row.geographyId} ${row.year}`).toBe(Number(row.value));
    }
  });

  test("adds a starred city to its municipality in 2015 and 2016 and not after", () => {
    const sheet = readStoredSheet(sources.get(SOURCE.births).bytes, "1");
    const columns = findYearColumns(sheet, 4);
    const refOf = (label: string, year: number) => sheet.ref(columns.get(year)![0]!, sheet.findRow(label));
    for (const year of [2015, 2016]) {
      const total = sheet.count(refOf("Telavi Municipality", year))! + sheet.count(refOf("C. Telavi*", year))!;
      expect(at(SERIES.births, "15", year)).toMatchObject({
        value: String(total),
        sourceLocator: `1!${refOf("Telavi Municipality", year)}+${refOf("C. Telavi*", year)} [${year}]`,
      });
    }
    expect(at(SERIES.births, "15", 2017).sourceLocator).toBe(`1!${refOf("Telavi Municipality", 2017)} [2017]`);
  });

  test("ignores the one reviewed stray zero and nothing else", () => {
    const ignoresNothing = { accepts: () => false };
    const changedValue = editSource(sources, SOURCE.naturalIncrease, (sheet) => setCell(sheet, "AB85", 1));
    const otherCell = editSource(sources, SOURCE.naturalIncrease, (sheet) => setCell(sheet, unitCell(sheet, "C. Telavi*", 2020), 0));

    expect(condition(() => readVitalEvents(sources, geography, ignoresNothing))).toBe("unexpected_value");
    expect(condition(() => readVitalEvents(changedValue, geography, anomalies))).toBe("unexpected_value");
    expect(condition(() => readVitalEvents(otherCell, geography, anomalies))).toBe("unexpected_value");
  });

  test("stops on an excluded unit with a value, a blank served cell and a fractional count", () => {
    const excluded = editSource(sources, SOURCE.deaths, (sheet) => setCell(sheet, unitCell(sheet, "Abkhazia A.R.", 2020), 3));
    const blank = editSource(sources, SOURCE.births, (sheet) => setCell(sheet, unitCell(sheet, "C. Batumi Municipality", 2020), "-"));
    const fractional = editSource(sources, SOURCE.births, (sheet) => setCell(sheet, unitCell(sheet, "Guria", 2020), 100.5));

    expect(condition(() => readVitalEvents(excluded, geography, anomalies))).toBe("unexpected_value");
    expect(condition(() => readVitalEvents(blank, geography, anomalies))).toBe("missing_served_cell");
    expect(condition(() => readVitalEvents(fractional, geography, anomalies))).toBe("not_whole_person");
  });
});

describe("published rates", () => {
  const rate = (seriesId: string, year: number) => at(seriesId, GEORGIA, year);

  test("carries Georgia's 2025 rates as published, with the lineage and exact cell", () => {
    expect(rate(SERIES.totalFertilityRate, 2025)).toEqual({
      seriesId: SERIES.totalFertilityRate,
      geographyId: GEORGIA,
      year: 2025,
      value: "1.53",
      unit: "children_per_woman",
      estimateBasis: "registered",
      status: "published",
      sourceId: SOURCE.fertility,
      sourceLocator: "1!I37 [2025]",
      lastReviewedAt: "2026-10-01",
    });
    expect(rate(SERIES.crudeBirthRate, 2025)).toMatchObject({ value: "9.6", unit: "per_1000_population", sourceLocator: "1!B36 [2025]" });
    expect(rate(SERIES.crudeDeathRate, 2025)).toMatchObject({ value: "11.3", unit: "per_1000_population" });
    expect(rate(SERIES.infantMortalityRate, 2025)).toMatchObject({ value: "7.6", unit: "per_1000_live_births" });
    expect(rate(SERIES.lifeExpectancyTotal, 2025)).toMatchObject({ value: "76.0", unit: "years" });
    expect(rate(SERIES.lifeExpectancyMale, 2025).value).toBe("71.4");
    expect(rate(SERIES.lifeExpectancyFemale, 2025).value).toBe("80.6");
  });

  test("starts every rate in 2014 and carries Georgia only", () => {
    for (const seriesId of Object.values(SERIES).filter((id) => !COUNT_SERIES.includes(id))) {
      const rows = rowsOf(seriesId);

      expect(rows.map((row) => row.year), seriesId).toEqual(Array.from({ length: 12 }, (_, index) => 2014 + index));
      expect(rows.every((row) => row.geographyId === GEORGIA && row.estimateBasis === "registered"), seriesId).toBe(true);
    }
  });

  test("carries each rate exactly as the workbook displays it, including where Geostat stores unrounded digits", () => {
    const displayed = (sourceId: string) => XLSX.read(sources.get(sourceId).bytes, { type: "buffer", cellNF: true }).Sheets["1"]!;
    const rates = vital.filter((row) => !COUNT_SERIES.includes(row.seriesId));

    expect(rates).toHaveLength(12 * 7);
    for (const row of rates) {
      const ref = row.sourceLocator.split("!")[1]!.split(" ")[0]!;
      expect(row.value, `${row.seriesId} ${row.year}`).toBe(displayed(row.sourceId)[ref]!.w);
    }
    expect(rate(SERIES.infantMortalityRate, 2014).value).toBe("9.5");
  });

  test("lists the counts first and carries no natural increase rate", () => {
    const order = [...new Set(vital.map((row) => row.seriesId))];

    expect(order).toEqual(Object.values(SERIES));
    expect(vital).toHaveLength(3 * (12 + 75 * 11) + 7 * 12);
  });

  test("stops on a moved column, a blank year, a skipped year and text in a rate cell", () => {
    const moved = editSource(sources, SOURCE.crudeBirthRate, (sheet) => setCell(sheet, "B4", "Ratio"));
    const blank = editSource(sources, SOURCE.crudeBirthRate, (sheet) => setCell(sheet, "B30", "-"));
    const skipped = editSource(sources, SOURCE.crudeBirthRate, (sheet) => setCell(sheet, "A30", 2021));
    const text = editSource(sources, SOURCE.crudeBirthRate, (sheet) => setCell(sheet, "B30", "n/a"));

    expect(condition(() => readVitalEvents(moved, geography, anomalies))).toBe("layout_changed");
    expect(condition(() => readVitalEvents(blank, geography, anomalies))).toBe("missing_served_cell");
    expect(condition(() => readVitalEvents(skipped, geography, anomalies))).toBe("layout_changed");
    expect(condition(() => readVitalEvents(text, geography, anomalies))).toBe("unexpected_cell");
  });
});

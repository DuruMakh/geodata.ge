import ExcelJS from "exceljs";
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { DEFAULT_POPULATION_STATE, type PopulationState } from "../../lib/explorer/demographyPopulation";
import { buildPopulationWorkbookExportModel } from "../../lib/explorer/demographyPopulationWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { ClientDemographyObservation } from "../../lib/servedRows";

let facts: ClientDemographyObservation[];
let places: DemographyPlace[];

const presentation = {
  locale: "en" as const,
  englishLabels: {},
  messages: {
    "demography.workbookTitle": "Population on 1 January",
    "demography.placeHeader": "Place",
    "demography.levelHeader": "Level",
    "demography.levelCountry": "Country",
    "demography.levelRegion": "Region",
    "demography.levelMunicipality": "Municipality",
    "demography.populationHeader": "Population (persons)",
    "demography.densityHeader": "Density (persons per km²)",
    "demography.basisHeader": "Basis",
    "demography.basisRetro": "re-estimated in 2018",
    "demography.basisPre": "estimated before the 2024 census",
    "demography.basisCensus": "based on the 2024 census",
    "demography.breakLabel": "Census re-base",
    "demography.unitPersons": "persons, 1 January",
  },
};
const sources = [
  { sourceId: "source.geostat_municipal_population", years: Array.from({ length: 23 }, (_, i) => 2004 + i), title: "Population by self-governed unit", organization: "Geostat", downloadHref: "/downloads/methodology/demography/files/population.xlsx" as const, retrievedAt: "2026-10-01" },
  { sourceId: "source.geostat_demography_density", years: Array.from({ length: 13 }, (_, i) => 2014 + i), title: "Density by regions", organization: "Geostat", downloadHref: "/downloads/methodology/demography/files/density.xlsx" as const, retrievedAt: "2026-10-03" },
  { sourceId: "unrelated", years: [2020], title: "Unrelated", organization: "Other", downloadHref: "/downloads/methodology/demography/files/unrelated.xlsx" as const, retrievedAt: "2026-10-03" },
];

const build = (patch: Partial<PopulationState> = {}, extra: Partial<typeof presentation> = {}) =>
  buildPopulationWorkbookExportModel(facts, places, { ...DEFAULT_POPULATION_STATE, ...patch }, { ...presentation, ...extra }, sources, "https://fiscal.ge");

beforeAll(async () => {
  const [{ facts: served }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.map(projectDemographyObservation);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  const labels = await getPresentation("en", [], ids);
  places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: labels.englishLabels,
    georgiaNameKa: "საქართველო",
  });
});

describe("population workbook", () => {
  test("Georgia over every year: sheets, columns, plain-language basis and the re-base flag", () => {
    const model = build();
    expect(model.filename).toBe("fiscal-demography-population-2004-2026-en.xlsx");
    expect(model.sheetNames).toEqual(["Summary", "Data", "Sources"]);
    expect(model.analysis.headers).toEqual(["Place", "Level", "Year", "Population (persons)", "Density (persons per km²)", "Basis", "Status"]);
    expect(model.analysis.rows[0]).toEqual(["Georgia", "Country", 2004, 3_937_716, null, "re-estimated in 2018", "Published"]);
    expect(model.analysis.rows.find((row) => row[2] === 2014)).toEqual(["Georgia", "Country", 2014, expect.any(Number), 65, "re-estimated in 2018", "Published"]);
    expect(model.analysis.rows.find((row) => row[2] === 2024)![5]).toBe("estimated before the 2024 census");
    expect(model.analysis.rows.find((row) => row[2] === 2025)![5]).toBe("based on the 2024 census · Census re-base");
    expect(model.analysis.rows.find((row) => row[2] === 2026)![5]).toBe("based on the 2024 census");
    expect(model.analysis.numericFormats).toEqual({ 4: "#,##0", 5: "#,##0.0" });
    expect(model.readable.rows[0]).toMatchObject({ kind: "total", label: "Georgia", change: null });
    expect(model.readable.rows[0]!.valuesByYear[2025]).toBe(3_930_428);
    expect(model.readable.showChangeColumn).toBe(false);
    expect(model.readable.amountDecimals).toBe(0);
  });

  test("a municipality has no density; a region has it from 2015; a missing year is blank and says so", () => {
    const model = build({ selectedIds: ["11", "region.imereti"], range: { kind: "manual", start: 2014, end: 2016 } });
    const khulo = model.analysis.rows.filter((row) => row[0] === "Khulo");
    expect(khulo.every((row) => row[4] === null && row[1] === "Municipality")).toBe(true);
    const imereti = model.analysis.rows.filter((row) => row[0] === "Imereti");
    expect(imereti.find((row) => row[2] === 2014)).toEqual(["Imereti", "Region", 2014, null, null, "re-estimated in 2018", "Not available"]);
    expect(imereti.find((row) => row[2] === 2016)![4]).toEqual(expect.any(Number));
  });

  test("the English workbook carries no Georgian text", () => {
    const text = JSON.stringify(build({ selectedIds: [GEORGIA_PLACE_ID, "region.imereti", "11"] }));
    expect(text).not.toMatch(/[Ⴀ-ჿ]/);
  });

  test("sources: population always, density only when a Georgia or region row can carry it, years inside the range", () => {
    const georgia = build();
    expect(georgia.sources.map((source) => [source.title, source.years[0], source.years.at(-1)])).toEqual([
      ["Population by self-governed unit", 2004, 2026],
      ["Density by regions", 2014, 2026],
    ]);
    expect(georgia.sources[0]!.absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/demography/files/population.xlsx");
    expect(build({ selectedIds: ["11"] }).sources.map((source) => source.title)).toEqual(["Population by self-governed unit"]);
    expect(build({ range: { kind: "manual", start: 2004, end: 2010 } }).sources.map((source) => source.title)).toEqual(["Population by self-governed unit"]);
  });

  test("an empty selection exports no rows or sources", () => {
    const model = build({ selectedIds: [] });
    expect(model.readable.rows).toEqual([]);
    expect(model.analysis.rows).toEqual([]);
    expect(model.sources).toEqual([]);
  });

  test("the Georgian file name has no language suffix", () => {
    expect(build({}, { locale: "ka" as never }).filename).toBe("fiscal-demography-population-2004-2026.xlsx");
  });

  test("the written file has three sheets and numeric, formatted cells", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(build()));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
    const data = workbook.getWorksheet("Data")!;
    expect(data.getCell("D2").value).toBe(3_937_716);
    expect(data.getCell("D2").numFmt).toBe("#,##0");
    expect(data.getCell("E2").value).toBeNull();
    expect(data.getCell("E12").numFmt).toBe("#,##0.0");
  });

  test("the Data sheet's columns are wide enough for the longest place name and the basis text", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(build()));
    const data = workbook.getWorksheet("Data")!;
    // Place, Level, Year, Population, Density, Basis, Status. The default widths gave Place 10 and Basis 16.
    expect(Array.from({ length: 7 }, (_, index) => data.getColumn(index + 1).width)).toEqual([34, 14, 8, 16, 14, 46, 12]);
  });

  test("the Summary sheet header names the places, marks the census re-base on 2025 and has no change column", async () => {
    const model = build();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(model));
    const summary = workbook.getWorksheet("Summary")!;
    // The writer puts the title on row 1, the subtitle on row 2 and the column headers on row 3.
    const headers = Array.from({ length: summary.columnCount }, (_, index) => summary.getCell(3, index + 1).value);
    const yearHeader = (year: number) => headers[model.readable.years.indexOf(year) + 1];
    expect(headers[0]).toBe("Place");
    expect(yearHeader(2024)).toBe("2024");
    expect(yearHeader(2025)).toBe("2025 · Census re-base");
    expect(yearHeader(2026)).toBe("2026");
    expect(headers.map((header) => String(header)).join(" ")).not.toMatch(/change/i);
  });
});

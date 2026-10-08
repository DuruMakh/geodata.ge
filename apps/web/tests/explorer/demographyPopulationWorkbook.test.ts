import ExcelJS from "exceljs";
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import type { PopulationQuery } from "../../lib/explorer/demographyPopulation";
import { buildPopulationWorkbookExportModel } from "../../lib/explorer/demographyPopulationWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
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

const DEFAULT_QUERY: PopulationQuery = { selectedIds: [GEORGIA_PLACE_ID], range: { kind: "all" } };

const build = (patch: Partial<PopulationQuery> = {}, extra: Partial<typeof presentation> = {}) =>
  buildPopulationWorkbookExportModel(facts, places, { ...DEFAULT_QUERY, ...patch }, { ...presentation, ...extra }, sources, "https://fiscal.ge");

// The length of a text in Excel column units: each Georgian letter counts 1.2 and every other character 1. Rounded to a
// tenth so the sum carries no floating-point noise into the comparisons.
const weighted = (text: string) =>
  Math.round(Array.from(text).reduce((sum, character) => sum + (/\p{Script=Georgian}/u.test(character) ? 1.2 : 1), 0) * 10) / 10;

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

  test("a place page names the place and the range in the file", () => {
    const all = buildPopulationWorkbookExportModel(facts, places, { selectedIds: ["06"], range: { kind: "all" } }, presentation, sources, "https://fiscal.ge", "batumi");
    expect(all.filename).toBe("fiscal-demography-population-batumi-2004-2026-en.xlsx");
    const manual = buildPopulationWorkbookExportModel(facts, places, { selectedIds: ["06"], range: { kind: "manual", start: 2015, end: 2026 } }, presentation, sources, "https://fiscal.ge", "batumi");
    expect(manual.filename).toBe("fiscal-demography-population-batumi-2015-2026-en.xlsx");
  });

  // On the page the place the page is about is the total row of the table (first, bold). The Summary sheet says the same
  // when it is told which place that is; told nothing, Georgia is the total, as for every call made before this existed.
  test("the page's own place is the total row of the Summary sheet; without it Georgia is", async () => {
    const query: PopulationQuery = { selectedIds: ["region.adjara", "06"], range: { kind: "all" } };
    const buildFor = (q: PopulationQuery, totalId?: string) =>
      buildPopulationWorkbookExportModel(facts, places, q, presentation, sources, "https://fiscal.ge", "region-adjara", totalId);
    const kinds = (q: PopulationQuery, totalId?: string) => buildFor(q, totalId).readable.rows.map((row) => [row.label, row.kind]);
    expect(kinds(query, "region.adjara")).toEqual([["Adjara", "total"], ["Batumi", "item"]]);
    expect(kinds(query, "06")).toEqual([["Adjara", "item"], ["Batumi", "total"]]);
    expect(kinds(query)).toEqual([["Adjara", "item"], ["Batumi", "item"]]);
    expect(kinds({ ...query, selectedIds: [GEORGIA_PLACE_ID, "region.adjara"] })).toEqual([["Georgia", "total"], ["Adjara", "item"]]);

    // And the written sheet shows it: rows start under the title, the subtitle and the header, and a total row is bold.
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(buildFor(query, "region.adjara")));
    const summary = workbook.getWorksheet("Summary")!;
    expect([summary.getCell(4, 1).value, summary.getCell(4, 1).font?.bold]).toEqual(["Adjara", true]);
    expect([summary.getCell(5, 1).value, summary.getCell(5, 1).font?.bold]).toEqual(["Batumi", undefined]);
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

  // The widths are not counted by hand. Whatever the real messages and place names say, the written Data sheet must
  // leave room for every cell. Excel's column unit is the width of a digit and Georgian letters are wider than that
  // (about 1.1 to 1.3 times on real fonts), so a body cell is weighed with each Georgian letter at 1.2 and every other
  // character at 1, and must fit within its column's width minus 1 (a column keeps about a unit for padding). It is an
  // estimate, not a measurement of any one font. Place and Basis cells are the ones Excel can cut off (they do not wrap
  // and the next cell is filled), but every body cell gets the same rule. Header cells wrap, so they are counted in
  // plain characters against the whole width. Each language is built from its real message files, over Georgia, the 11
  // regions and the municipality with the longest name in each language, every year.
  test.each(["ka", "en"] as const)("the %s Data sheet leaves room for every cell (Georgian script weighted, approximate)", async (locale) => {
    const municipal = await loadServedMunicipalData();
    const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
    const real = await getPresentation(locale, ["demography", "common", "controls", "main", "format", "workbook", "municipal"], ids);
    const realPlaces = buildDemographyPlaces({
      regions: municipal.regions,
      municipalities: municipal.municipalities,
      englishLabels: real.englishLabels,
      georgiaNameKa: message(real.messages, "demography.georgia"),
    });
    const municipalities = realPlaces.filter((place) => place.level === "municipality");
    const longest = (name: (place: DemographyPlace) => string) =>
      municipalities.reduce((best, place) => (name(place).length > name(best).length ? place : best));
    const selectedIds = [...new Set([
      GEORGIA_PLACE_ID,
      ...realPlaces.filter((place) => place.level === "region").map((place) => place.id),
      longest((place) => place.nameKa).id,
      longest((place) => place.nameEn).id,
    ])];
    const model = buildPopulationWorkbookExportModel(facts, realPlaces, { ...DEFAULT_QUERY, selectedIds }, real, sources, "https://fiscal.ge");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(model));
    const data = workbook.getWorksheet(model.sheetNames[1])!;
    const tooLong = new Set<string>();
    data.eachRow((row, rowNumber) =>
      row.eachCell((cell, column) => {
        const width = data.getColumn(column).width ?? 0;
        const header = rowNumber === 1;
        const length = header ? cell.text.length : weighted(cell.text);
        const room = header ? width : width - 1;
        if (length > room) {
          tooLong.add(`${locale} ${data.getCell(1, column).text} (column ${column}, ${width} wide, room for ${room}): "${cell.text}" is ${length} long`);
        }
      }),
    );
    expect([...tooLong]).toEqual([]);
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

  // The 2025 column header carries the re-base label, which is longer than a year column: "2025 · Census re-base" is 21
  // characters and "2025 · აღწერით გადათვლა" is 23, 15 of them Georgian letters. Excel hides the START of text that does
  // not fit in a right-aligned cell next to a filled one, which here is the year itself. So the header row wraps and is two
  // lines tall (the writer counts a line as 15 points), and each label must fit the lines it is given. The same estimate as
  // the Data sheet test: Georgian letters weigh 1.2, a line holds the column's width minus a unit of padding, and the result
  // is approximate, not a measurement of any one font. The 2025 header gets two lines, every other header one.
  const TWO_LINES = 2 * 15;
  test.each(["ka", "en"] as const)("the %s Summary sheet header wraps and every label fits its lines (Georgian script weighted, approximate)", async (locale) => {
    const real = await getPresentation(locale, ["demography"], []);
    const model = buildPopulationWorkbookExportModel(facts, places, DEFAULT_QUERY, real, sources, "https://fiscal.ge");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(model));
    const summary = workbook.getWorksheet(model.sheetNames[0])!;

    // Place first, then one column per year; there is no change column.
    const columns = model.readable.years.length + 1;
    const rebaseColumn = model.readable.years.indexOf(2025) + 2;
    expect(rebaseColumn).toBeGreaterThan(1);
    const problems: string[] = [];
    const height = summary.getRow(3).height ?? 0;
    if (height < TWO_LINES) problems.push(`${locale}: the header row is ${height} high, two lines need ${TWO_LINES}`);
    for (let column = 1; column <= columns; column += 1) {
      const cell = summary.getCell(3, column);
      if (cell.alignment?.wrapText !== true) problems.push(`${locale}: header cell ${column} "${cell.text}" does not wrap`);
      const room = (summary.getColumn(column).width ?? 0) - 1;
      const lines = column === rebaseColumn ? 2 : 1;
      const length = weighted(cell.text);
      if (length > lines * room) problems.push(`${locale}: header "${cell.text}" is ${length} long, ${lines} line(s) of ${room} hold ${lines * room}`);
    }
    expect(problems).toEqual([]);
  });

  // Wrapping is opt-in: headerLabels without `wrap` (what the inflation workbooks pass) is written as it always was.
  test("without the wrap flag the Summary header stays on one line at the default row height", async () => {
    const model = build();
    const { category, columns } = model.readable.headerLabels!;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer({ ...model, readable: { ...model.readable, headerLabels: { category, columns } } }));
    const summary = workbook.getWorksheet("Summary")!;
    expect(summary.getCell(3, 1).alignment).toEqual({ horizontal: "left", vertical: "middle" });
    expect(summary.getCell(3, 2).alignment).toEqual({ horizontal: "right", vertical: "middle" });
    expect(summary.getRow(3).height).toBeUndefined();
  });
});

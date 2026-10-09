import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { projectMigrationObservation } from "../../lib/explorer/clientData";
import { DEFAULT_MIGRATION_STATE, MIGRATION_SERIES } from "../../lib/explorer/demographyMigration";
import { buildMigrationWorkbookExportModel } from "../../lib/explorer/demographyMigrationWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { loadPopulationSources } from "../../lib/pages/demography-population";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Locale, Presentation } from "../../lib/i18n/types";
import type { ClientMigrationFact } from "../../lib/servedRows";

const GEORGIAN = /\p{Script=Georgian}/u;
let facts: ClientMigrationFact[];
const presentations = {} as Record<Locale, Presentation>;
const sources = [
  { sourceId: "source.geostat_demography_migration_citizenship", years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], title: "Immigrants and emigrants", organization: "Geostat", downloadHref: "/downloads/methodology/demography/files/33.xlsx" as const, retrievedAt: "2026-10-01" },
  { sourceId: "source.geostat_municipal_population", years: [2025], title: "Population", organization: "Geostat", downloadHref: "/downloads/methodology/demography/files/01.xlsx" as const, retrievedAt: "2026-10-01" },
];

beforeAll(async () => {
  const { facts: served } = await loadServedDemographyData();
  facts = served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
  for (const locale of ["ka", "en"] as const) presentations[locale] = await getPresentation(locale, ["demography", "workbook"], []);
});

describe("migration workbook", () => {
  it("groups arrivals and departures with their totals and ends with the net, for the active range, groups and sex", () => {
    const state = { ...DEFAULT_MIGRATION_STATE, range: { kind: "manual" as const, start: 2022, end: 2023 } };
    const model = buildMigrationWorkbookExportModel({ facts, state, sources, siteOrigin: "https://fiscal.ge" }, presentations.en);
    expect(model.filename).toBe("fiscal-demography-migration-2022-2023-en.xlsx");
    expect(model.readable.years).toEqual([2022, 2023]);
    const labels = model.readable.rows.map((row) => `${row.kind}:${row.parentLabel ?? ""}:${row.label}`);
    expect(labels[0]).toBe("group::Arrivals");
    expect(labels[7]).toBe("group::Departures");
    expect(labels.at(-1)).toBe("total::Net migration");
    expect(model.readable.rows).toHaveLength(15);
    expect(model.readable.rows[0]!.valuesByYear).toEqual({ 2022: 179_778, 2023: 205_857 });
    expect(model.readable.rows[7]!.valuesByYear).toEqual({ 2022: 125_269, 2023: 245_064 });
    expect(model.readable.rows.at(-1)!.valuesByYear).toEqual({ 2022: 54_509, 2023: -39_207 });
    expect(model.readable.subtitle).toContain("Other countries");
    expect(model.analysis.headers).toEqual(["Year", "Direction", "Citizenship", "Sex", "Persons"]);
    expect(model.analysis.rows).toHaveLength(2 * 2 * 6);
    expect(model.analysis.rows[0]).toEqual([2022, "Arrivals", "Georgia", "All", expect.any(Number)]);
    expect(model.sources.map((source) => source.title)).toEqual(["Immigrants and emigrants"]);
    expect(model.sources[0]!.years).toEqual([2022, 2023]);
    expect(JSON.stringify(model)).not.toMatch(GEORGIAN);
  });

  it("follows the sex filter and the selection, and labels the net as the selected groups' net", () => {
    const state = { ...DEFAULT_MIGRATION_STATE, sex: "female" as const, selectedIds: ["citizenship.georgia" as const], range: { kind: "manual" as const, start: 2025, end: 2025 } };
    const model = buildMigrationWorkbookExportModel({ facts, state, sources, siteOrigin: "https://fiscal.ge" }, presentations.ka);
    expect(model.filename).toBe("fiscal-demography-migration-2025-2025.xlsx");
    expect(model.readable.rows).toHaveLength(5);
    expect(model.readable.rows.at(-1)!.label).toBe("წმინდა მიგრაცია (არჩეული ჯგუფები)");
    expect(model.analysis.rows.every((row) => row[3] === "ქალები")).toBe(true);
  });
});

describe("migration workbook sources", () => {
  it("cites both Geostat migration originals from the reviewed manifest, over the whole period", async () => {
    const reviewed = await loadPopulationSources("en");
    const model = buildMigrationWorkbookExportModel({ facts, state: DEFAULT_MIGRATION_STATE, sources: reviewed, siteOrigin: "https://fiscal.ge" }, presentations.en);
    expect(model.sources).toHaveLength(2);
    for (const source of model.sources) expect(source.years).toEqual([2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(JSON.stringify(model.sources)).not.toMatch(GEORGIAN);
  });
});

describe("migration workbook subtitle", () => {
  it("gives a short range's Summary subtitle room for the computed group's definition in both languages", async () => {
    const state = { ...DEFAULT_MIGRATION_STATE, range: { kind: "manual" as const, start: 2022, end: 2023 } };
    for (const locale of ["ka", "en"] as const) {
      const model = buildMigrationWorkbookExportModel({ facts, state, sources, siteOrigin: "https://fiscal.ge" }, presentations[locale]);
      expect(model.readable.fitSubtitle, locale).toBe(true);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await createWorkbookBuffer(model));
      // Two years fill the minimum four columns (100 characters); the subtitle runs past that, so one line would cut it.
      expect(workbook.worksheets[0]!.getRow(2).height, locale).toBeGreaterThanOrEqual(30);
    }
  });
});

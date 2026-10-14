import path from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import { buildUnemploymentWorkbookExportModel } from "../../lib/explorer/unemploymentWorkbook";
import { changeUnemploymentBreakdown, changeUnemploymentEducationSex, DEFAULT_UNEMPLOYMENT_STATE, parseUnemploymentHash, type UnemploymentState } from "../../lib/explorer/unemploymentState";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { projectWorkbookSources } from "../../lib/methodology/workbookSources";
import type { Locale, Presentation } from "../../lib/i18n/types";

let facts: ClientUnemploymentObservation[];
beforeAll(async () => { facts = (await loadServedUnemploymentData()).facts; });
async function workbook(locale: Locale, patch: Partial<UnemploymentState>) {
  const root = path.resolve(process.cwd(), "../..");
  const [manifest, catalogue] = await Promise.all([loadReviewedSourceManifest(root, "unemployment"), loadEnglishCatalogue(root)]);
  const presentation: Presentation = { locale, messages: await getMessages(locale, ["unemployment", "workbook", "format"]), englishLabels: {} };
  const sources = manifest.map(row => ({ ...projectWorkbookSources([row], locale, catalogue.documents)[0], sourceId: row.source_id }));
  return buildUnemploymentWorkbookExportModel(facts, UNEMPLOYMENT_GROUPS, { ...DEFAULT_UNEMPLOYMENT_STATE, range: { kind: "manual", start: 2024, end: 2025 }, ...patch }, presentation, sources, "https://fiscal.ge");
}
test.each(["ka", "en"] as const)("writes native %s count/rate workbooks with correct units, basis and public hyperlinks", async locale => {
  for (const indicator of ["unemployed", "unemployment_rate"] as const) {
    const model = await workbook(locale, { indicator });
    expect(model.readable.years).toEqual([2024, 2025]);
    expect(model.analysis.rows).toHaveLength(2);
    expect(model.analysis.headers.join(" ")).not.toMatch(/GEL|₾|source.cell|source_id/i);
    expect(model.readable.rows[0].basisByYear).toEqual({ 2024: "actual", 2025: "actual" });
    expect(model.sources).toHaveLength(1); expect(model.sources[0].years).toEqual([2024, 2025]);
    const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
    expect(excel.worksheets.map(sheet => sheet.name)).toEqual(locale === "en" ? ["Summary", "Data", "Sources"] : ["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
    const cell = excel.worksheets[0].getCell("C4");
    if (indicator === "unemployment_rate") {
      expect(cell.value).toBeCloseTo(0.139, 3); expect(cell.numFmt).toBe("0.0%");
      expect(excel.worksheets[1].getCell("C2").numFmt).toBe("0.0%");
    } else {
      expect(cell.value).toBeCloseTo(224, 1); expect(cell.numFmt).toContain("0.0");
      expect(model.analysis.headers[2]).toBe(locale === "en" ? "Number (thousand persons)" : "რაოდენობა (ათასი ადამიანი)");
    }
    // U16-16: the Data sheet names the row column as the Summary sheet does.
    expect(model.analysis.headers[1]).toBe(locale === "en" ? "Category" : "კატეგორია");
    const sourceCell = excel.worksheets[2].getCell("D4").value;
    expect(sourceCell).toMatchObject({ hyperlink: "https://fiscal.ge/downloads/methodology/unemployment/files/01-labour-force-indicators.xlsx" });
  }
});
test("education-only exports exclude a removed national reference and unrelated originals", async () => {
  const model = await workbook("en", { breakdown: "education", educationSex: "women", selectedIds: ["education.higher"] });
  expect(model.readable.rows.map(row => row.label)).toEqual(["Higher"]);
  expect(model.sources.map(source => source.downloadHref)).toEqual(["/downloads/methodology/unemployment/files/13-labour-force-indicators-by-education.xlsx"]);
  expect(model.readable.title).toContain("Women");
  const withReference = await workbook("en", { breakdown: "education", educationSex: "women", selectedIds: ["education.higher", "women"] });
  expect(withReference.sources).toHaveLength(2);
});

test.each(["ka", "en"] as const)("export filenames describe the active population after leaving education in %s", async locale => {
  const education = changeUnemploymentEducationSex(changeUnemploymentBreakdown(DEFAULT_UNEMPLOYMENT_STATE, "education", facts), "women", facts);
  const national = changeUnemploymentBreakdown(education, "national", facts);
  const suffix = locale === "en" ? "-en" : "";
  expect(national.educationSex).toBe("women");
  expect((await workbook(locale, national)).filename).toBe(locale === "en"
    ? "fiscal-unemployment-national-unemployment-rate-2010-2025-en.xlsx"
    : "fiscal-unemployment-erovnuli-umushevrobis-done-2010-2025.xlsx");
  const returned = changeUnemploymentBreakdown(national, "education", facts);
  expect((await workbook(locale, returned)).filename).toBe(locale === "en"
    ? `fiscal-unemployment-education-women-unemployment-rate-2020-2025${suffix}.xlsx`
    : "fiscal-unemployment-ganatleba-kalebi-umushevrobis-done-2020-2025.xlsx");
});

// U16-17 and U17-10: file names are words of the workbook's language (Georgian romanized, as a browser saves a non-ASCII
// name as "download"), never internal ids such as `labour_force`.
test.each(["ka", "en"] as const)("export filenames carry readable %s words, not ids", async locale => {
  const name = async (hash: string, section: Parameters<typeof parseUnemploymentHash>[3], regionId?: string) =>
    (await workbook(locale, parseUnemploymentHash(hash, facts, UNEMPLOYMENT_GROUPS, section, regionId))).filename;
  const gender = await name("sel=georgia:unemployment_rate,women:unemployment_rate&start=2010&end=2025", "gender");
  const age = await name("breakdown=age&start=2020&end=2025", "age");
  const labourForce = await name("sel=region.imereti:labour_force&start=2019&end=2025", "regions", "region.imereti");
  const people = await name("sel=region.imereti:labour_force,region.imereti:employed&start=2019&end=2025", "regions", "region.imereti");
  for (const filename of [gender, age, labourForce, people]) expect(filename).toMatch(/^[a-z0-9.-]+$/);
  expect([gender, age, labourForce, people]).toEqual(locale === "en" ? [
    "fiscal-unemployment-sex-unemployment-rate-2010-2025-en.xlsx",
    "fiscal-unemployment-age-unemployment-rate-2020-2025-en.xlsx",
    "fiscal-unemployment-imereti-labour-force-2019-2025-en.xlsx",
    "fiscal-unemployment-imereti-number-thousand-persons-2019-2025-en.xlsx",
  ] : [
    "fiscal-unemployment-skesi-umushevrobis-done-2010-2025.xlsx",
    "fiscal-unemployment-asaki-umushevrobis-done-2020-2025.xlsx",
    "fiscal-unemployment-imereti-shromis-dzala-2019-2025.xlsx",
    "fiscal-unemployment-imereti-raodenoba-atasi-adamiani-2019-2025.xlsx",
  ]);
});
test("age exports omit removed historical bands and Georgia and use modern years and age-source links", async () => {
  const model = await workbook("en", { breakdown: "age", selectedIds: ["georgia", "age.15_24", "age.15_19"], range: { kind: "manual", start: 2010, end: 2025 } });
  expect(model.readable.years).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  expect(model.readable.rows.map(row => [row.label, row.kind])).toEqual([["15-19", "item"]]);
  expect(model.readable.rows[0].valuesByYear[2025]).toBeCloseTo(0.39, 2);
  expect(model.sources).toHaveLength(1);
  expect(model.sources[0].years).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  expect(model.sources[0].downloadHref).toContain("04-labour-force-indicators-by-age.xlsx");
});
test("long-term labour-force rate and unemployment share have distinct export labels and values", async () => {
  const rate = await workbook("en", { breakdown: "long_term", indicator: "long_term_unemployment_rate" });
  const share = await workbook("en", { breakdown: "long_term", indicator: "long_term_unemployed_share" });
  expect(rate.readable.title).toContain("labour force"); expect(share.readable.title).toContain("all unemployed");
  expect(rate.readable.rows[0].valuesByYear[2025]).toBeCloseTo(0.049, 3);
  expect(share.readable.rows[0].valuesByYear[2025]).toBeCloseTo(0.355, 3);
});

test.each(["ka", "en"] as const)("overview exports every selected indicator with its own source value and label in %s", async locale => {
  const state = parseUnemploymentHash("sel=georgia:employed,georgia:self_employed,georgia:hired&start=2025&end=2025", facts, UNEMPLOYMENT_GROUPS, "overview");
  const model = await workbook(locale, state);
  expect(model.readable.rows).toHaveLength(3);
  expect(model.readable.rows.map(row => row.valuesByYear[2025])).toEqual([
    facts.find(f => f.dimension === "national" && f.year === 2025 && f.indicatorId === "employed")!.value,
    facts.find(f => f.dimension === "national" && f.year === 2025 && f.indicatorId === "self_employed")!.value,
    facts.find(f => f.dimension === "national" && f.year === 2025 && f.indicatorId === "hired")!.value,
  ]);
  expect(model.readable.rows.map(row => row.label)).toEqual(locale === "en" ? ["Employed people", "Self-employed", "Hired employees"] : ["დასაქმებულები", "თვითდასაქმებული", "დაქირავებული"]);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets[0].getCell("B6").value).toBeCloseTo(961.1005993998547, 10);
  expect(excel.worksheets[1].getCell("C2").numFmt).toBe("#,##0.0");
  expect(model.sources).toHaveLength(1);
});

test.each(["ka", "en"] as const)("gender exports identify each group's selected indicator in %s", async locale => {
  const state = parseUnemploymentHash("sel=women:unemployed,men:employed&start=2025&end=2025", facts, UNEMPLOYMENT_GROUPS, "gender");
  const model = await workbook(locale, state);
  expect(model.readable.rows.map(row => row.label)).toEqual(locale === "en" ? ["Men · Employed people", "Women · Unemployed people"] : ["კაცები · დასაქმებულები", "ქალები · უმუშევრები"]);
  expect(model.readable.rows.map(row => row.valuesByYear[2025])).toEqual([770.17689056414815, 79.40887847046638]);
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.sources.map(source => source.downloadHref)).toEqual(["/downloads/methodology/unemployment/files/02-labour-force-indicators-by-sex.xlsx"]);
});

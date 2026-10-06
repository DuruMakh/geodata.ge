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
  expect((await workbook(locale, national)).filename).toBe(`fiscal-unemployment-national-unemployment_rate-2010-2025${suffix}.xlsx`);
  const returned = changeUnemploymentBreakdown(national, "education", facts);
  expect((await workbook(locale, returned)).filename).toBe(`fiscal-unemployment-education-unemployment_rate-women-2020-2025${suffix}.xlsx`);
});
test("missing historical values stay blank with unavailable status and no invented source years", async () => {
  const model = await workbook("en", { breakdown: "age", selectedIds: ["age.15_24", "age.15_19"] });
  const historical = model.readable.rows.find(row => row.label === "15-24")!;
  expect(historical.valuesByYear[2025]).toBeNull(); expect(historical.basisByYear[2025]).toBeNull();
  expect(model.analysis.rows.some(row => row[1] === "15-24" && row[2] === null && row[3] === "Not available")).toBe(true);
  expect(model.sources[0].years).toEqual([2024, 2025]);
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

import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadPovertyFacts, toClientPovertyFact } from "../../lib/data/poverty/importPoverty";
import type { ClientPovertyFact } from "../../lib/data/poverty/types";
import { buildPovertyWorkbookExportModel } from "../../lib/explorer/povertyWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Presentation } from "../../lib/i18n/types";
import { buildPovertyModel, changePovertyView, defaultPovertyState, parsePovertyHash, povertyCoverage, povertyViewSeries, serializePovertyHash } from "../../lib/explorer/poverty";

let facts: ClientPovertyFact[];
beforeAll(async () => { facts = (await loadPovertyFacts()).map(toClientPovertyFact); });

test("each page starts with only its reference selected and coverage taken from the facts", () => {
  expect(defaultPovertyState("rates")).toEqual({ mode: "line", range: { kind: "all" }, view: "absolute", selectedIds: ["poverty.absolute|georgia"] });
  expect(defaultPovertyState("inequality")).toEqual({ mode: "line", range: { kind: "all" }, view: "main", selectedIds: ["gini.total_income|georgia"] });
  expect(povertyCoverage("rates", "absolute", facts)).toMatchObject({ min: 2004, max: 2025 });
  expect(povertyCoverage("rates", "relative", facts)).toMatchObject({ min: 2004, max: 2025 });
  expect(povertyCoverage("rates", "international", facts)).toMatchObject({ min: 2004, max: 2024 });
  expect(povertyCoverage("inequality", "main", facts)).toMatchObject({ min: 2006, max: 2025 });
});

test("absolute and relative groups nest under their Georgia line", () => {
  const absolute = povertyViewSeries("rates", "absolute");
  expect(absolute.map(s => s.groupId)).toEqual(["georgia", "settlement.urban", "settlement.rural", "age.0_17", "age.18_64", "age.65_plus", "sex.female", "sex.male"]);
  expect(absolute.slice(1).every(s => s.parentId === "poverty.absolute|georgia" && !s.reference)).toBe(true);
  const relative = povertyViewSeries("rates", "relative");
  expect(relative.map(s => [s.id, s.reference, s.parentId])).toEqual([
    ["poverty.relative_60|georgia", true, undefined],
    ["poverty.relative_60|settlement.urban", false, "poverty.relative_60|georgia"],
    ["poverty.relative_60|settlement.rural", false, "poverty.relative_60|georgia"],
    ["poverty.relative_40|georgia", false, undefined],
    ["poverty.relative_40|settlement.urban", false, "poverty.relative_40|georgia"],
    ["poverty.relative_40|settlement.rural", false, "poverty.relative_40|georgia"],
  ]);
  expect(povertyViewSeries("rates", "international").map(s => s.indicatorId)).toEqual(["poverty.international_300", "poverty.international_420", "poverty.international_830"]);
  expect(povertyViewSeries("inequality", "main").map(s => s.indicatorId)).toEqual(["gini.total_income", "gini.cash_inflows", "gini.total_inflows", "gini.consumption_expenditure", "gini.cash_expenditure", "gini.total_expenditure"]);
});

test("switching to international clamps a range ending 2025 to 2024, and switching back keeps it", () => {
  const start = { ...defaultPovertyState("rates"), range: { kind: "manual" as const, start: 2010, end: 2025 } };
  const international = changePovertyView(start, "rates", "international", facts);
  expect(international).toMatchObject({ view: "international", range: { kind: "manual", start: 2010, end: 2024 }, selectedIds: ["poverty.international_300|georgia"] });
  const back = changePovertyView(international, "rates", "absolute", facts);
  expect(back).toMatchObject({ view: "absolute", range: { kind: "manual", start: 2010, end: 2024 }, selectedIds: ["poverty.absolute|georgia"] });
  // The full International range is kept, not widened, when switching back.
  const full = changePovertyView({ ...start, range: { kind: "manual", start: 2004, end: 2024 } }, "rates", "international", facts);
  expect(changePovertyView(full, "rates", "absolute", facts).range).toEqual({ kind: "manual", start: 2004, end: 2024 });
});

test("the hash round-trips, drops another tab's series and keeps an explicit empty selection", () => {
  const state = { mode: "table" as const, view: "relative" as const, range: { kind: "manual" as const, start: 2012, end: 2020 }, selectedIds: ["poverty.relative_60|georgia", "poverty.relative_40|settlement.rural"] };
  const hash = serializePovertyHash(state, "rates");
  expect(parsePovertyHash(`#${hash}`, "rates", facts)).toEqual(state);
  expect(parsePovertyHash("#tab=absolute&sel=", "rates", facts).selectedIds).toEqual([]);
  expect(parsePovertyHash("#tab=international&sel=poverty.relative_60|settlement.rural", "rates", facts).selectedIds).toEqual([]);
  expect(parsePovertyHash("#tab=unknown", "rates", facts)).toMatchObject({ view: "absolute", selectedIds: ["poverty.absolute|georgia"] });
  const inequality = serializePovertyHash(defaultPovertyState("inequality"), "inequality");
  expect(inequality).not.toContain("tab=");
  expect(parsePovertyHash(`#${inequality}`, "inequality", facts)).toEqual(defaultPovertyState("inequality"));
});

test("the model carries published values and the view's precision", () => {
  const rates = buildPovertyModel("rates", facts, defaultPovertyState("rates"));
  expect(rates.selected[0].endValue).toBe(7.1);
  expect(rates.decimals).toBe(1);
  expect(rates.years).toEqual(Array.from({ length: 22 }, (_, i) => 2004 + i));
  const inequality = buildPovertyModel("inequality", facts, defaultPovertyState("inequality"));
  expect(inequality.selected[0].endValue).toBe(0.34);
  expect(inequality.decimals).toBe(2);
});

const SOURCES = ["geostat_poverty_absolute", "geostat_poverty_relative", "geostat_poverty_international", "geostat_gini"].map(sourceId => ({
  sourceId, years: Array.from({ length: 22 }, (_, i) => 2004 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-10",
  downloadHref: `/downloads/methodology/poverty/files/${sourceId}.xlsx` as const,
}));
const presentationFor = async (locale: Locale): Promise<Presentation> => ({ locale, englishLabels: {}, messages: await getMessages(locale, ["poverty", "workbook", "format", "common"]) });

test.each(["ka", "en"] as const)("the %s International workbook keeps the selected lines, years and only their source", async (locale: Locale) => {
  const ids = ["poverty.international_300|georgia", "poverty.international_420|georgia", "poverty.international_830|georgia"];
  const model = buildPovertyWorkbookExportModel({
    section: "rates", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: Object.fromEntries(ids.map(id => [id, id])),
    state: { mode: "table", view: "international", range: { kind: "manual", start: 2020, end: 2024 }, selectedIds: ids },
  }, await presentationFor(locale));
  expect(model.filename).toMatch(/^fiscal-poverty-rates-international-2020-2024/);
  expect(model.readable.years).toEqual([2020, 2021, 2022, 2023, 2024]);
  expect(model.readable.rows).toHaveLength(3);
  expect(model.readable.numberFormat).toBe("0.0");
  expect(model.analysis.rows).toHaveLength(15);
  expect(model.analysis.headers.join(" ")).not.toMatch(/source_cell|sheet|source_id/i);
  expect(model.sources.map(source => source.title)).toEqual(["geostat_poverty_international"]);
  expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/poverty/files/geostat_poverty_international.xlsx");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
});

test("the inequality workbook keeps two decimals", async () => {
  const model = buildPovertyWorkbookExportModel({
    section: "inequality", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { "gini.total_income|georgia": "Total income" },
    state: { ...defaultPovertyState("inequality"), range: { kind: "manual", start: 2024, end: 2025 } },
  }, await presentationFor("en"));
  expect(model.filename).toMatch(/^fiscal-poverty-inequality-2024-2025/);
  expect(model.readable.numberFormat).toBe("0.00");
  // Column 3 is the value (year, series, value, status); column 2 holds the series label.
  expect(model.analysis.numericFormats).toEqual({ 3: "0.00" });
  expect(model.analysis.rows.at(-1)!.slice(0, 3)).toEqual([2025, "Total income", 0.34]);
  expect(model.sources.map(source => source.title)).toEqual(["geostat_gini"]);
});

// U20-09 (owner review): the relative lines' Georgia rows read like their nested rows, so phone-legend entries line up;
// "of median consumption" stays in the line under the heading.
test.each(["ka", "en"] as const)("the %s relative-poverty Georgia rows are as short as their nested rows", async (locale) => {
  const messages = await getMessages(locale, ["poverty"]);
  for (const line of ["60", "40"]) {
    const georgia = messages[`poverty.series.poverty.relative_${line}|georgia`]!;
    const rural = messages[`poverty.series.poverty.relative_${line}|settlement.rural`]!;
    expect(georgia.split(": ")[0]).toBe(rural.split(": ")[0]);
  }
  expect(messages["poverty.latest.relative"]).toContain(locale === "en" ? "median consumption" : "მედიანური მოხმარების");
});

// U20-10 and U23-05: the source note's update date is the site's date format (DESIGN.md §6.2), kept on one line; the
// trade overview prints it the same way.
test("the source notes print their update date as the header does, unbroken", async () => {
  const { renderPovertyPage } = await import("../../lib/pages/poverty");
  const { renderTradeOverviewPage } = await import("../../lib/pages/trade");
  const { renderPageMarkup } = await import("../helpers/render-localized");
  for (const html of [renderPageMarkup("en", await renderPovertyPage("en", "inequality")), renderPageMarkup("en", await renderTradeOverviewPage("en"))]) {
    const note = html.match(/<p[^>]*data-testid="source-label"[^>]*>([\s\S]*?)<\/p>/)![1]!;
    expect(note).toMatch(/<span class="whitespace-nowrap">\d{1,2} [A-Z][a-z]+ \d{4}<\/span>/);
    expect(note).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  }
  const ka = renderPageMarkup("ka", await renderPovertyPage("ka", "inequality")).match(/<p[^>]*data-testid="source-label"[^>]*>([\s\S]*?)<\/p>/)![1]!;
  expect(ka).toMatch(/<span class="whitespace-nowrap">\d{4}-\d{2}-\d{2}<\/span>/);
});

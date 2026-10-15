import { beforeAll, expect, test } from "vitest";
import { loadExternalPositionFacts, toClientExternalPositionFact } from "../../lib/data/externalPosition/importExternalPosition";
import type { ClientExternalPositionFact } from "../../lib/data/externalPosition/types";
import { INK } from "../../lib/explorer/colors";
import type { CurrentAccountGdp } from "../../lib/explorer/currentAccount";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { buildExternalPositionWorkbookExportModel } from "../../lib/explorer/externalPositionWorkbook";
import {
  EXTERNAL_POSITION_SECTIONS, buildExternalPositionModel, externalPositionLatestLabel, externalPositionLatestMonth, changeExternalPositionView, defaultExternalPositionState, externalPositionCoverage, externalPositionSeries,
  externalPositionViewFacts, parseExternalPositionHash, serializeExternalPositionHash, type ExternalPositionState,
} from "../../lib/explorer/externalPosition";

let facts: ClientExternalPositionFact[];
// Nominal GDP in US dollars for 1996-2025, as Current account serves it: none for 1995 or the 2026 mid-year point.
const gdp: CurrentAccountGdp[] = Array.from({ length: 30 }, (_, i) => ({ year: 1996 + i, valueUsd: (1996 + i === 2025 ? 50 : 5 + i / 2) * 1e9, preliminary: 1996 + i >= 2025 }));
const GDP_2025 = 50e9;
beforeAll(async () => {
  facts = (await loadExternalPositionFacts()).map(toClientExternalPositionFact);
});
const span = (years: { min: number; max: number }) => [years.min, years.max];

test("the two sections", () => {
  expect(EXTERNAL_POSITION_SECTIONS).toEqual([
    { id: "foreign-debt", href: "/explorer/external/foreign-debt", labelKey: "common.foreignDebt" },
    { id: "reserves", href: "/explorer/external/reserves", labelKey: "common.reserves" },
  ]);
});

test("each page starts on amounts with its total selected and covers its own years", () => {
  expect(defaultExternalPositionState("foreign-debt")).toEqual({ mode: "line", range: { kind: "all" }, view: "amount", selectedIds: ["ext_debt.total"] });
  expect(defaultExternalPositionState("reserves")).toEqual({ mode: "line", range: { kind: "all" }, view: "amount", selectedIds: ["reserves.total"] });
  expect(span(externalPositionCoverage("foreign-debt", "amount", facts, gdp))).toEqual([2006, 2026]);
  expect(span(externalPositionCoverage("reserves", "amount", facts, gdp))).toEqual([1995, 2026]);
});

test("the parts nest under the total", () => {
  const shape = (section: Parameters<typeof externalPositionSeries>[0]) => externalPositionSeries(section).map(s => [s.id, s.reference, s.parentId]);
  expect(shape("foreign-debt")).toEqual([
    ["ext_debt.total", true, undefined],
    ["ext_debt.government", false, "ext_debt.total"], ["ext_debt.banks", false, "ext_debt.total"], ["ext_debt.companies", false, "ext_debt.total"],
    ["ext_debt.intercompany", false, "ext_debt.total"], ["ext_debt.central_bank", false, "ext_debt.total"],
  ]);
  expect(shape("reserves")).toEqual([
    ["reserves.total", true, undefined],
    ["reserves.fx", false, "reserves.total"], ["reserves.gold", false, "reserves.total"], ["reserves.sdr", false, "reserves.total"],
  ]);
  expect(externalPositionSeries("foreign-debt").filter(s => s.parentId)).toHaveLength(5);
  expect(externalPositionSeries("reserves").filter(s => s.parentId)).toHaveLength(3);
});

test("% of GDP divides each amount by the same year's GDP and drops the years without one", () => {
  const shown = externalPositionViewFacts("gdp", facts, gdp);
  const debt2025 = facts.find(f => f.indicatorId === "ext_debt.total" && f.year === 2025)!;
  expect(shown.find(f => f.indicatorId === "ext_debt.total" && f.year === 2025)!.value).toBeCloseTo(debt2025.value / GDP_2025 * 100, 10);
  // 1995 and 2026 have no GDP, so no fact is left for them, and nothing becomes 0.
  expect(shown.some(f => f.year === 1995 || f.year === 2026)).toBe(false);
  expect(shown.filter(f => f.indicatorId === "reserves.total").map(f => f.year)).toEqual(Array.from({ length: 30 }, (_, i) => 1996 + i));
  expect(externalPositionViewFacts("amount", facts, gdp)).toBe(facts);
  expect(span(externalPositionCoverage("reserves", "gdp", facts, gdp))).toEqual([1996, 2025]);
  expect(span(externalPositionCoverage("foreign-debt", "gdp", facts, gdp))).toEqual([2006, 2025]);
});

test("2026 never gets a % of GDP value, even once a GDP row for it exists", () => {
  const withGdp2026 = [...gdp, { year: 2026, valueUsd: 55e9, preliminary: true }];
  const shown = externalPositionViewFacts("gdp", facts, withGdp2026);
  expect(shown.some(f => f.year === 2026)).toBe(false);
  expect(span(externalPositionCoverage("foreign-debt", "gdp", facts, withGdp2026))).toEqual([2006, 2025]);
  const model = buildExternalPositionModel("foreign-debt", facts, { ...defaultExternalPositionState("foreign-debt"), view: "gdp" }, withGdp2026);
  expect(model.years).not.toContain(2026);
  expect(model.years.at(-1)).toBe(2025);
  expect(model.latestYears).toEqual([]);
});

test("the model's 1995 reserves value is absent on % of GDP, not 0", () => {
  const model = buildExternalPositionModel("reserves", facts, { ...defaultExternalPositionState("reserves"), view: "gdp", range: { kind: "manual", start: 1995, end: 2000 } }, gdp);
  expect(model.years).toEqual([1996, 1997, 1998, 1999, 2000]);
  expect(model.years).not.toContain(1995);
  const total = model.series.find(s => s.id === "reserves.total")!;
  expect(total.valuesByYear[1995]).toBeUndefined();
  expect(total.valuesByYear[1996]).not.toBeNull();
  const full = buildExternalPositionModel("reserves", facts, { ...defaultExternalPositionState("reserves"), view: "gdp" }, gdp);
  expect(full.years[0]).toBe(1996);
  expect(full.years.at(-1)).toBe(2025);
  expect(full.series[0].valuesByYear[2025]).toBeCloseTo(facts.find(f => f.indicatorId === "reserves.total" && f.year === 2025)!.value / GDP_2025 * 100, 10);
});

test("switching view keeps the years, clamped to the view, and the same series both ways", () => {
  const start: ExternalPositionState = { ...defaultExternalPositionState("foreign-debt"), range: { kind: "manual", start: 2015, end: 2026 }, selectedIds: ["ext_debt.total", "ext_debt.banks"] };
  const gdpState = changeExternalPositionView(start, "foreign-debt", "gdp", facts, gdp);
  expect(gdpState).toMatchObject({ view: "gdp", range: { kind: "manual", start: 2015, end: 2025 }, selectedIds: ["ext_debt.total", "ext_debt.banks"] });
  const back = changeExternalPositionView(gdpState, "foreign-debt", "amount", facts, gdp);
  expect(back).toMatchObject({ view: "amount", range: { kind: "manual", start: 2015, end: 2025 }, selectedIds: ["ext_debt.total", "ext_debt.banks"] });
  // An "all years" range stays "all" and follows the view's own coverage.
  const all = changeExternalPositionView(defaultExternalPositionState("reserves"), "reserves", "gdp", facts, gdp);
  expect(all.range).toEqual({ kind: "all" });
  expect(buildExternalPositionModel("reserves", facts, all, gdp).years[0]).toBe(1996);
  // A selection the user emptied stays empty.
  expect(changeExternalPositionView({ ...start, selectedIds: [] }, "foreign-debt", "gdp", facts, gdp).selectedIds).toEqual([]);
});

test("the hash round-trips, keeps an explicit empty selection, drops unknown ids and falls back to amounts on an unknown tab", () => {
  const state: ExternalPositionState = { mode: "table", view: "gdp", range: { kind: "manual", start: 2010, end: 2024 }, selectedIds: ["reserves.total", "reserves.gold"] };
  const hash = serializeExternalPositionHash(state);
  expect(hash).toContain("tab=gdp");
  expect(parseExternalPositionHash(`#${hash}`, "reserves", facts, gdp)).toEqual(state);
  // The default state also writes its tab.
  const defaults = defaultExternalPositionState("foreign-debt");
  expect(serializeExternalPositionHash(defaults)).toContain("tab=amount");
  expect(parseExternalPositionHash(`#${serializeExternalPositionHash(defaults)}`, "foreign-debt", facts, gdp)).toEqual(defaults);
  expect(parseExternalPositionHash("#tab=amount&sel=", "reserves", facts, gdp).selectedIds).toEqual([]);
  expect(parseExternalPositionHash("#sel=reserves.fx,nonsense,ext_debt.total,reserves.total", "reserves", facts, gdp).selectedIds).toEqual(["reserves.total", "reserves.fx"]);
  expect(parseExternalPositionHash("#tab=unknown", "reserves", facts, gdp)).toMatchObject({ view: "amount", selectedIds: ["reserves.total"] });
  expect(parseExternalPositionHash("", "foreign-debt", facts, gdp)).toEqual(defaults);
  // A range outside the view's coverage is refitted: 1995 does not exist on % of GDP.
  expect(parseExternalPositionHash("#tab=gdp&start=1995&end=2000", "reserves", facts, gdp).range).toMatchObject({ kind: "manual", start: 1996, end: 2000 });
});

test("the model carries the unit, the latest points and the reference's latest value", () => {
  const amounts = buildExternalPositionModel("reserves", facts, defaultExternalPositionState("reserves"), gdp);
  expect(amounts.unit).toBe("usd");
  expect(amounts.latestYears).toEqual([2026]);
  expect(amounts.latest).toEqual({ year: 2026, periodEnd: "2026-09-30", latestPeriod: true, value: facts.find(f => f.indicatorId === "reserves.total" && f.year === 2026)!.value });
  expect(amounts.series.map(s => s.id)).toEqual(["reserves.total", "reserves.fx", "reserves.gold", "reserves.sdr"]);
  expect(amounts.selected.map(s => s.id)).toEqual(["reserves.total"]);
  expect(amounts.series[0].color).toBe(INK);
  expect(amounts.series[1].color).not.toBe(INK);

  const debt = buildExternalPositionModel("foreign-debt", facts, defaultExternalPositionState("foreign-debt"), gdp);
  expect(debt.latest).toMatchObject({ year: 2026, periodEnd: "2026-06-30", latestPeriod: true });
  expect(debt.latestYears).toEqual([2026]);

  const share = buildExternalPositionModel("reserves", facts, { ...defaultExternalPositionState("reserves"), view: "gdp" }, gdp);
  expect(share.unit).toBe("percent");
  expect(share.latestYears).toEqual([]);
  expect(share.latest).toEqual({ year: 2025, periodEnd: "2025-12-31", latestPeriod: false, value: facts.find(f => f.indicatorId === "reserves.total" && f.year === 2025)!.value / GDP_2025 * 100 });

  // A range that stops before 2026 holds no latest point.
  expect(buildExternalPositionModel("reserves", facts, { ...defaultExternalPositionState("reserves"), range: { kind: "manual", start: 2015, end: 2025 } }, gdp).latestYears).toEqual([]);
});

test("gold is a published zero before 2024, not a gap", () => {
  const model = buildExternalPositionModel("reserves", facts, { ...defaultExternalPositionState("reserves"), selectedIds: ["reserves.gold"] }, gdp);
  const gold = model.series.find(s => s.id === "reserves.gold")!;
  expect(gold.valuesByYear[2010]).toBe(0);
  expect(gold.valuesByYear[2010]).not.toBeNull();
  // Zero stays zero as a share of GDP too.
  const share = buildExternalPositionModel("reserves", facts, { ...defaultExternalPositionState("reserves"), view: "gdp" }, gdp);
  expect(share.series.find(s => s.id === "reserves.gold")!.valuesByYear[2010]).toBe(0);
});

const presentation = async (locale: "ka" | "en" = "en"): Promise<Presentation> => ({ locale, englishLabels: {}, messages: await getMessages(locale, ["workbook", "format", "external"]) });
const SOURCES = ["nbg_gross_external_debt_bpm6", "nbg_official_reserve_assets"].map(sourceId => ({
  sourceId, years: Array.from({ length: 32 }, (_, i) => 1995 + i), title: sourceId, organization: "National Bank of Georgia", retrievedAt: "2026-10-14",
  downloadHref: `/downloads/methodology/external/files/${sourceId}.xlsx` as const,
}));
const GDP_SOURCES = [{ years: [1996, 2025], title: "Geostat GDP", organization: "Geostat", downloadHref: "https://www.geostat.ge/media/gdp.xlsx" as const, retrievedAt: "2026-08-13" }];
const workbookFor = async (section: Parameters<typeof externalPositionSeries>[0], view: ExternalPositionState["view"], selectedIds: string[], start: number, end: number, locale: "ka" | "en" = "en") => {
  const p = await presentation(locale);
  const model = buildExternalPositionModel(section, facts, { mode: "table", view, range: { kind: "manual", start, end }, selectedIds }, gdp);
  return buildExternalPositionWorkbookExportModel({
    section, facts, gdp, gdpSources: GDP_SOURCES, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: Object.fromEntries(selectedIds.map(id => [id, id])),
    state: { mode: "table", view, range: { kind: "manual", start, end }, selectedIds },
    latestLabel: model.latestYears.length ? externalPositionLatestLabel(model.latest, p.messages) : undefined,
  }, p);
};

test("the latest point's month is localized from its period end", async () => {
  expect(externalPositionLatestMonth("2026-09-30", (await presentation("en")).messages)).toBe("Sep");
  expect(externalPositionLatestMonth("2026-06-30", (await presentation("en")).messages)).toBe("Jun");
  expect(externalPositionLatestMonth("2026-09-30", (await presentation("ka")).messages)).toBe("სექტ.");
  expect(externalPositionLatestMonth("2026-06-30", (await presentation("ka")).messages)).toBe("ივნ.");
});

test("the latest column label joins the year and the localized month", async () => {
  expect(externalPositionLatestLabel({ year: 2026, periodEnd: "2026-09-30" }, (await presentation("en")).messages)).toBe("2026 (Sep)");
  expect(externalPositionLatestLabel({ year: 2026, periodEnd: "2026-06-30" }, (await presentation("ka")).messages)).toBe("2026 (ივნ.)");
});

test("the Reserves workbook exports million USD for the four series, with the 2026 column named by its month", async () => {
  const ids = externalPositionSeries("reserves").map(s => s.id);
  const model = await workbookFor("reserves", "amount", ids, 2020, 2026);
  expect(model.filename).toBe("fiscal-reserves-2020-2026-en.xlsx");
  expect(model.readable.title).toBe("Reserves · Amount");
  expect(model.readable.unitLabel).toBe("million USD");
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.years).toHaveLength(7);
  expect(model.readable.rows).toHaveLength(4);
  expect(model.readable.rows.map(row => row.kind)).toEqual(["total", "item", "item", "item"]);
  // Million USD to one decimal, with no float noise from the dollar conversion.
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(6159.3);
  expect(model.readable.rows[2].valuesByYear[2020]).toBe(0);
  expect(model.readable.rows[2].basisByYear[2020]).toBe("actual");
  expect(model.readable.headerLabels).toEqual({ category: "Series", columns: ["2020", "2021", "2022", "2023", "2024", "2025", "2026 (Sep)"], wrap: true });
  expect(model.analysis.rows).toHaveLength(28);
  expect(model.analysis.headers).toEqual(["Year", "Series", "million USD", "Status"]);
  expect(model.analysis.numericFormats).toEqual({ 3: "#,##0.0" });
  const status = (year: number) => model.analysis.rows.find(r => r[0] === year && r[1] === "reserves.total")![3];
  expect(status(2025)).toBe("Published");
  expect(status(2026)).toBe("Latest published amount, not a 31 December value");
  expect(model.sources.map(source => source.title)).toEqual(["nbg_official_reserve_assets"]);
  expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/external/files/nbg_official_reserve_assets.xlsx");
});

test("the Foreign debt % of GDP workbook has no 2026 column and cites the GDP source beside the NBG file", async () => {
  const model = await workbookFor("foreign-debt", "gdp", ["ext_debt.total", "ext_debt.banks"], 2020, 2026);
  expect(model.filename).toBe("fiscal-foreign-debt-gdp-2020-2025-en.xlsx");
  expect(model.readable.years).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  expect(model.readable.headerLabels!.columns).toEqual(["2020", "2021", "2022", "2023", "2024", "2025"]);
  expect(model.readable.unitLabel).toBe("% of GDP");
  expect(model.readable.numberFormat).toBe("0.0");
  expect(model.analysis.headers[2]).toBe("Share of GDP (%)");
  expect(model.analysis.numericFormats).toEqual({ 3: "0.0" });
  expect(model.analysis.rows.some(row => row[0] === 2026)).toBe(false);
  const debt2025 = facts.find(f => f.indicatorId === "ext_debt.total" && f.year === 2025)!;
  expect(model.readable.rows[0].valuesByYear[2025]).toBeCloseTo(debt2025.value / GDP_2025 * 100, 10);
  expect(model.sources.map(source => source.title)).toEqual(["nbg_gross_external_debt_bpm6", "Geostat GDP"]);
  // The amounts cite only the NBG file.
  expect((await workbookFor("foreign-debt", "amount", ["ext_debt.total"], 2020, 2026)).sources.map(source => source.title)).toEqual(["nbg_gross_external_debt_bpm6"]);
});

test("the Georgian workbook names its 2026 column with the Georgian month", async () => {
  const model = await workbookFor("foreign-debt", "amount", ["ext_debt.total"], 2024, 2026, "ka");
  expect(model.readable.headerLabels!.columns).toEqual(["2024", "2025", "2026 (ივნ.)"]);
  expect(model.filename).toBe("fiscal-foreign-debt-2024-2026.xlsx");
});

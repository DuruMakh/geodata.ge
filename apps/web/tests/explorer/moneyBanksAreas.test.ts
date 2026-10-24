import { beforeAll, expect, test } from "vitest";
import { loadMoneyBanksFacts, toClientMoneyBanksFact } from "../../lib/data/moneyBanks/importMoneyBanks";
import { MONEY_BANKS_LOAN_AREAS, type ClientMoneyBanksFact } from "../../lib/data/moneyBanks/types";
import { businessAreaSlug } from "../../lib/explorer/businessAreas";
import { formatAmount } from "../../lib/explorer/format";
import { buildMoneyBanksWorkbookExportModel } from "../../lib/explorer/moneyBanksWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import { moneyBanksAreaStaticParams } from "../../lib/pages/money-banks-regions-shared";
import { renderMoneyBanksRegionsPage } from "../../lib/pages/money-banks-regions";
import { renderMoneyBanksAreaPage } from "../../lib/pages/money-banks-area";
import { loadMoneyBanksCsv } from "../helpers/money-banks-csv";
import { renderPageMarkup } from "../helpers/render-localized";
import {
  MONEY_BANKS_REGIONS_HREF, buildMoneyBanksAreaModel, moneyBanksAreaDefaultSelection, moneyBanksAreaHref, moneyBanksAreaOfMapId, moneyBanksAreaSelectionHash,
  moneyBanksAreaSeries, moneyBanksAreaSlug, moneyBanksMapId, moneyBanksRegionHref, parseMoneyBanksAreaHash,
} from "../../lib/explorer/moneyBanksAreas";
import { buildMoneyBanksRegionMapModel } from "../../lib/explorer/moneyBanksRegionMap";

let facts: ClientMoneyBanksFact[];
// Expected figures are read from the reviewed CSV, so an NBG refresh does not fail these tests.
let csv: Awaited<ReturnType<typeof loadMoneyBanksCsv>>;
beforeAll(async () => { facts = (await loadMoneyBanksFacts()).map(toClientMoneyBanksFact); csv = await loadMoneyBanksCsv(); });
const text = (fragment: string) => fragment.replace(/<[^>]*>/g, "").replace(/&nbsp;|\u00a0/g, " ").replace(/&amp;/g, "&");
const latestLine = (html: string) => text(html.match(/<p[^>]*data-testid="money-latest"[^>]*>([\s\S]*?)<\/p>/)![1]);

test("twelve areas with slugs and map ids", () => {
  expect(MONEY_BANKS_LOAN_AREAS.map(moneyBanksAreaSlug)).toEqual([
    "georgia", "tbilisi", "adjara", "guria", "imereti", "kakheti", "mtskheta_mtianeti", "racha_lechkhumi_kvemo_svaneti", "samegrelo_zemo_svaneti", "samtskhe_javakheti", "kvemo_kartli", "shida_kartli",
  ]);
  expect(MONEY_BANKS_LOAN_AREAS.map(moneyBanksAreaSlug)).toEqual(MONEY_BANKS_LOAN_AREAS.map(businessAreaSlug));
  expect(MONEY_BANKS_REGIONS_HREF).toBe("/explorer/money/regions");
  expect(moneyBanksAreaHref("region_imereti")).toBe("/explorer/money/regions/imereti");
  expect(moneyBanksMapId("region_imereti")).toBe("region.imereti");
  expect(moneyBanksMapId("georgia")).toBe("georgia");
  expect(moneyBanksAreaOfMapId("region.imereti")).toBe("region_imereti");
  expect(moneyBanksRegionHref("region.imereti")).toBe("/explorer/money/regions/imereti");
});

test("the map ranks 2025 all loans, Tbilisi first", () => {
  const map = buildMoneyBanksRegionMapModel(facts);
  expect(map.year).toBe(2025);
  expect(map.firstYear).toBe(2015);
  expect(map.regions).toHaveLength(11);
  const top = [...map.regions].sort((a, b) => a.rank - b.rank)[0];
  expect(top.regionId).toBe("region.tbilisi");
  expect(map.regions[0].regionId).toBe("region.tbilisi");
  // Client facts carry lari, so 52,420.1 million is 52,420,100,000.
  expect(map.regions[0].value / 1e6).toBeCloseTo(52420.1, 1);
});

test("an area page lists all loans, lari and foreign currency", () => {
  const series = moneyBanksAreaSeries("region_imereti");
  expect(series.map(s => s.id)).toEqual(["loans_region.region_imereti.total", "loans_region.region_imereti.gel", "loans_region.region_imereti.fx"]);
  expect(series.map(s => s.reference)).toEqual([true, false, false]);
  expect(series.every(s => s.heading === undefined && s.parentId === undefined)).toBe(true);
  expect(moneyBanksAreaDefaultSelection("region_imereti")).toEqual(["loans_region.region_imereti.total"]);
  const state = parseMoneyBanksAreaHash("", "region_imereti", facts);
  expect(state.selectedIds).toEqual(["loans_region.region_imereti.total"]);
  const model = buildMoneyBanksAreaModel("region_imereti", facts, state);
  expect(model.unit).toBe("gel");
  expect([model.range.start, model.range.end]).toEqual([2015, 2025]);
  expect(model.series.map(s => s.color)).toHaveLength(3);
  expect(new Set(model.series.map(s => s.color)).size).toBe(3);
  expect(model.selected.map(s => s.id)).toEqual(["loans_region.region_imereti.total"]);
  expect(model.series[0].endValue).not.toBeNull();
});

test("a selection moves to another area", () => {
  expect(moneyBanksAreaSelectionHash(["loans_region.region_imereti.fx"], "region_guria")).toBe("#sel=loans_region.region_guria.fx");
  expect(moneyBanksAreaSelectionHash(["loans_region.region_imereti.total"], "georgia")).toBe("");
  expect(moneyBanksAreaSelectionHash(["loans_region.georgia.gel", "loans_region.georgia.fx"], "region_tbilisi")).toBe("#sel=loans_region.region_tbilisi.gel%2Cloans_region.region_tbilisi.fx");
});

test("an unknown id in the hash is ignored", () => {
  expect(parseMoneyBanksAreaHash("#sel=loans_region.region_abkhazeti.total", "georgia", facts).selectedIds).toEqual([]);
});

test("the regions index shows Tbilisi's 2025 line, Georgia first and the branch caveat", async () => {
  const html = renderPageMarkup("en", await renderMoneyBanksRegionsPage("en"));
  const year = csv.latestYear("loans_region.region_tbilisi.total");
  expect(year).toBe(2025);
  expect(latestLine(html)).toBe(`${year}: Tbilisi ${csv.billions("loans_region.region_tbilisi.total", year)} bn GEL`);
  expect(latestLine(html)).toBe("2025: Tbilisi 52.4 bn GEL");
  // Georgia is the list's first, unranked row; Tbilisi, the largest region, follows.
  const list = html.slice(html.indexOf('data-testid="regional-index-workspace"'));
  expect(list.indexOf(">Georgia<")).toBeGreaterThan(-1);
  expect(list.indexOf(">Georgia<")).toBeLessThan(list.indexOf(">Tbilisi<"));
  const regionLinks = new Set([...html.matchAll(/href="\/en\/explorer\/money\/regions\/([a-z_]+)"/g)].map(match => match[1]));
  // Georgia's lead row opens its own page; the eleven regions' map shapes and rows open theirs.
  expect(regionLinks.has("georgia")).toBe(true);
  regionLinks.delete("georgia");
  expect([...regionLinks].sort()).toEqual(MONEY_BANKS_LOAN_AREAS.filter(area => area !== "georgia").map(moneyBanksAreaSlug).sort());
  // The source note (not the Dataset summary, which also mentions the branch) carries the caveat, in both languages.
  const sourceNote = (markup: string) => text(markup.match(/<p[^>]*data-testid="regional-source-note"[^>]*>([\s\S]*?)<\/p>/)![1]);
  expect(sourceNote(html)).toContain("loans are counted where the lending bank branch is, not where the borrower lives");
  expect(sourceNote(renderPageMarkup("ka", await renderMoneyBanksRegionsPage("ka")))).toContain("და არა იქ, სადაც მსესხებელი ცხოვრობს");
  // The frame's Dataset is Money and banks' own, credited to the National Bank.
  const dataset = JSON.parse(html.match(/<script[^>]*data-testid="explorer-dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]);
  expect(dataset.provider).toMatchObject({ name: "National Bank of Georgia" });
  expect(dataset.temporalCoverage).toBe("2015/2025");
});

test("an area page reads million GEL, small values included", async () => {
  const html = renderPageMarkup("en", await renderMoneyBanksAreaPage("en", "racha_lechkhumi_kvemo_svaneti"));
  const id = "loans_region.region_racha_lechkhumi_kvemo_svaneti";
  const year = csv.latestYear(`${id}.total`);
  // The heading names the area, so the line does not (it fits on one line at 375px).
  expect(latestLine(html)).toBe(`${year}: all loans ${formatAmount(csv.published(`${id}.total`, year) * 1e6, "en")}`);
  expect(latestLine(html)).toBe("2025: all loans 60.5 mln GEL");
  // 0.311 million lari in foreign currency reads as a number, never 0 or a dash.
  const row = (part: string) => text(html.match(new RegExp(`<div[^>]*data-series-id="${id}.${part}"[^>]*>([\\s\\S]*?)</button>`))![1]);
  expect(row("fx")).toBe("In foreign currency0.3");
  expect(row("total")).toMatch(/^✓All loans60\.5$/);
  expect(row("gel")).toMatch(/^In lari\d/);
  const dataset = JSON.parse(html.match(/<script[^>]*data-testid="explorer-dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]);
  expect(dataset.variableMeasured).toEqual(["Loans"]);
  expect(dataset.temporalCoverage).toBe("2015/2025");
});

test("an unknown area is a 404", async () => {
  await expect(renderMoneyBanksAreaPage("en", "abkhazeti")).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  expect(moneyBanksAreaStaticParams().map(params => params.id)).toEqual(MONEY_BANKS_LOAN_AREAS.map(moneyBanksAreaSlug));
  expect(moneyBanksAreaStaticParams()).toHaveLength(12);
});

test("the area workbook names the area", async () => {
  const presentation = { locale: "en" as const, englishLabels: {}, messages: await getMessages("en", ["workbook", "format", "common", "moneyBanks"]) };
  const ids = ["loans_region.region_imereti.total", "loans_region.region_imereti.fx"];
  const sources = [{ sourceId: "nbg_loans_regions_lreg", years: Array.from({ length: 11 }, (_, i) => 2015 + i), title: "Loans by region (LREG)", organization: "National Bank of Georgia", retrievedAt: "2026-10-21", downloadHref: "/downloads/methodology/money/files/loans-by-regions-lregeng.xlsx" as const }];
  const model = buildMoneyBanksWorkbookExportModel({
    area: "region_imereti", facts, sources, siteOrigin: "https://fiscal.ge", title: "Loans — Imereti", labels: { [ids[0]]: "All loans", [ids[1]]: "In foreign currency" },
    state: { mode: "table", range: { kind: "manual", start: 2015, end: 2025 }, selectedIds: ids },
  }, presentation);
  expect(model.filename).toBe("fiscal-money-loans-region-imereti-2015-2025-en.xlsx");
  expect(model.readable.title).toBe("Loans — Imereti");
  expect(model.readable.rows.map(row => [row.kind, row.label])).toEqual([["total", "All loans"], ["item", "In foreign currency"]]);
  // Million GEL; all loans is lari plus foreign currency, added up by Fiscal.ge.
  const cell = model.analysis.rows.find(row => row[0] === 2025 && row[1] === "All loans")!;
  expect(cell[2]).toBeCloseTo(csv.published("loans_region.region_imereti.total", 2025), 1);
  expect(cell[3]).toBe("Calculated by Fiscal.ge · series break");
  expect(model.sources.map(source => source.absoluteUrl)).toEqual(["https://fiscal.ge/downloads/methodology/money/files/loans-by-regions-lregeng.xlsx"]);
});

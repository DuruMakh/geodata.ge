import { beforeAll, expect, test } from "vitest";
import { loadLabourFacts, toClientLabourFact } from "../../lib/data/labour/importLabour";
import { LABOUR_SOURCES, type ClientLabourFact } from "../../lib/data/labour/types";
import { INK } from "../../lib/explorer/colors";
import { formatInUnit, formatShare } from "../../lib/explorer/format";
import {
  LABOUR_SECTIONS, buildLabourModel, changeLabourSelection, labourCoverage, labourDefaultSelection, labourFullLabel, labourList,
  labourSeries, labourSeriesColor, labourUnit, parseLabourHash, serializeLabourHash, type LabourSectionId,
} from "../../lib/explorer/labour";
import { buildLabourHubCards } from "../../lib/explorer/labourHubCards";
import { buildLabourWorkbookExportModel } from "../../lib/explorer/labourWorkbook";
import type { Locale, Presentation } from "../../lib/i18n/types";

let facts: ClientLabourFact[];
beforeAll(async () => {
  facts = (await loadLabourFacts()).map(toClientLabourFact);
});
const SECTIONS = LABOUR_SECTIONS.map(section => section.id);
const all = { kind: "all" as const };
const manual = (start: number, end: number) => ({ kind: "manual" as const, start, end });

test("the four pages sit under Unemployment", () => {
  expect(LABOUR_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["industries", "/explorer/unemployment/industries", "common.unemploymentIndustries"],
    ["hours", "/explorer/unemployment/hours", "common.unemploymentHours"],
    ["informal", "/explorer/unemployment/informal", "common.unemploymentInformal"],
    ["young-people", "/explorer/unemployment/young-people", "common.unemploymentYoungPeople"],
  ]);
  expect(SECTIONS.map(labourUnit)).toEqual(["thousand_persons", "hours", "percent", "percent"]);
});

test("lists every split under its heading", () => {
  const counts: Record<LabourSectionId, number> = { industries: 60, hours: 85, informal: 9, "young-people": 6 };
  const headings: Record<LabourSectionId, string[]> = {
    industries: ["all", "women", "men"], hours: ["all", "women", "men", "urban", "rural"], informal: ["informal", "underuse"], "young-people": ["age_15_24", "age_15_29"],
  };
  for (const section of SECTIONS) {
    const series = labourSeries(section);
    expect(series, section).toHaveLength(counts[section]);
    expect([...new Set(series.map(s => s.heading))], section).toEqual(headings[section]);
    // Each heading's rows are listed together, in heading order.
    expect(series.map(s => s.heading), section).toEqual(headings[section].flatMap(heading => series.filter(s => s.heading === heading).map(() => heading)));
    expect(series.filter(s => s.reference).map(s => s.id), section).toEqual(labourDefaultSelection(section));
    expect(series[0].reference, section).toBe(true);
    // Every listed row has served values, except Geostat's unpublished men in households as employers.
    const served = new Set(facts.map(f => f.indicatorId));
    expect(series.filter(s => !served.has(s.id)).map(s => s.id), section).toEqual(section === "hours" ? ["labour.hours.men.sector_t"] : []);
  }
  expect(labourDefaultSelection("industries")).toEqual(["labour.jobs.all.total"]);
  expect(labourDefaultSelection("hours")).toEqual(["labour.hours.all.total"]);
  expect(labourDefaultSelection("informal")).toEqual(["labour.informal.total"]);
  expect(labourDefaultSelection("young-people")).toEqual(["labour.neet.age_15_24.total"]);
  // Under each jobs heading: the total, 18 industries in Geostat's order and "not identified"; the hours tables drop three of them.
  expect(labourSeries("industries").slice(20, 40).map(s => s.item)).toEqual([
    "total", "sector_a", "sector_b_e", "sector_f", "sector_g", "sector_h", "sector_i", "sector_j", "sector_k", "sector_l",
    "sector_m", "sector_n", "sector_o", "sector_p", "sector_q", "sector_r", "sector_s", "sector_t", "sector_u", "not_identified",
  ]);
  expect(labourSeries("hours").filter(s => s.heading === "rural").map(s => s.item)).not.toContain("sector_l");
  // The informal total is Georgia's row; the other rows are named by their own key.
  expect(labourSeries("informal").map(s => [s.id, s.item])).toEqual([
    ["labour.informal.total", "georgia"], ["labour.informal.women", "women"], ["labour.informal.men", "men"], ["labour.informal.urban", "urban"], ["labour.informal.rural", "rural"],
    ["labour.underuse.unemployment_rate", "unemployment_rate"], ["labour.underuse.time_related", "time_related"], ["labour.underuse.potential", "potential"], ["labour.underuse.composite", "composite"],
  ]);
  expect(labourSeries("young-people").map(s => s.item)).toEqual(["total", "women", "men", "total", "women", "men"]);
});

test("opens on the page total only", () => {
  for (const section of SECTIONS) {
    const state = parseLabourHash("", section, facts);
    expect(state.selectedIds, section).toEqual(labourDefaultSelection(section));
    expect(state.range, section).toEqual(all);
    expect(state.mode, section).toBe("line");
  }
  const coverage = labourCoverage("industries", facts, labourDefaultSelection("industries"));
  expect([coverage.min, coverage.max]).toEqual([2017, 2025]);
});

test("falls back on a foreign hash and keeps an explicit empty one", () => {
  // A link from another page (or an id that no longer exists) opens on the page's default.
  expect(parseLabourHash("#sel=labour.jobs.all.total", "hours", facts).selectedIds).toEqual(["labour.hours.all.total"]);
  expect(parseLabourHash("#sel=labour.unknown", "informal", facts).selectedIds).toEqual(["labour.informal.total"]);
  // An emptied list stays empty, and its years are every year of the page.
  const empty = parseLabourHash("#view=table&sel=", "industries", facts);
  expect(empty.selectedIds).toEqual([]);
  expect(empty.mode).toBe("table");
  const coverage = labourCoverage("industries", facts, empty.selectedIds);
  expect([coverage.min, coverage.max]).toEqual([2017, 2025]);
  // The hash round-trips, the empty selection included.
  const state = { mode: "table" as const, range: manual(2020, 2024), selectedIds: ["labour.jobs.women.total", "labour.jobs.men.sector_f"] };
  expect(parseLabourHash(`#${serializeLabourHash(state)}`, "industries", facts)).toEqual(state);
  expect(parseLabourHash(`#${serializeLabourHash(empty)}`, "industries", facts).selectedIds).toEqual([]);
});

test("refits the years to later-starting rows", () => {
  const state = { mode: "line" as const, range: manual(2017, 2019), selectedIds: ["labour.jobs.all.total"] };
  const next = changeLabourSelection(state, "industries", ["labour.jobs.women.sector_f"], facts);
  expect(next.selectedIds).toEqual(["labour.jobs.women.sector_f"]);
  const model = buildLabourModel("industries", facts, next);
  expect([model.range.start, model.range.end]).toEqual([2020, 2025]);
  // A wider range is kept as far as the new selection reaches, never collapsed to "all".
  const wide = changeLabourSelection({ ...state, range: manual(2018, 2023) }, "industries", ["labour.jobs.all.total", "labour.jobs.women.sector_f"], facts);
  expect(wide.range).toEqual(manual(2018, 2023));
  // Women and men rows show gaps before 2020, never zeros.
  const mixed = buildLabourModel("industries", facts, wide);
  expect(mixed.selected.find(s => s.id === "labour.jobs.women.sector_f")!.valuesByYear[2018]).toBeNull();
  expect(mixed.unit).toBe("thousand_persons");
});

test("shows a dash for a row without values", () => {
  const state = { mode: "table" as const, range: all, selectedIds: ["labour.hours.men.sector_t"] };
  const list = labourList("hours", facts, state);
  expect(list.end).toBe(2025);
  expect(list.rows["labour.hours.men.sector_t"].latest).toBeUndefined();
  expect(list.rows["labour.hours.men.total"].latest).toEqual({ value: expect.any(Number), year: 2025 });
  const model = buildLabourModel("hours", facts, state);
  expect([model.range.start, model.range.end]).toEqual([2020, 2025]);
  expect(model.selected).toHaveLength(1);
  expect(Object.values(model.selected[0].valuesByYear).every(value => value === null)).toBe(true);
  expect(model.unit).toBe("hours");
  // A list row's figure is its latest value up to the range's end.
  const earlier = labourList("industries", facts, { mode: "line", range: manual(2017, 2019), selectedIds: [] });
  expect(earlier.rows["labour.jobs.all.total"].latest).toEqual({ value: 1295.9, year: 2019 });
  expect(earlier.rows["labour.jobs.women.total"].latest).toBeUndefined();
});

test("names rows with their heading outside the list", () => {
  expect(labourFullLabel("women", "Women", "Construction")).toBe("Women — Construction");
  expect(labourFullLabel("all", "Everyone", "Construction")).toBe("Construction");
  expect(labourFullLabel("age_15_29", "Ages 15–29", "Women")).toBe("Ages 15–29 — Women");
});

test("gives each row of a page its own colour", () => {
  for (const section of SECTIONS) {
    const model = buildLabourModel(section, facts, { mode: "line", range: all, selectedIds: [] });
    const colors = model.series.map(s => s.color);
    expect(new Set(colors).size, section).toBe(colors.length);
    expect(model.series.filter(s => s.color === INK).map(s => s.id), section).toEqual(labourDefaultSelection(section));
    for (const color of colors) expect(color, section).toMatch(/^#[0-9A-F]{6}$/);
  }
  const jobs = labourSeries("industries");
  const colorOf = (id: string) => labourSeriesColor(jobs.find(s => s.id === id)!, jobs.findIndex(s => s.id === id));
  // An industry keeps the Economy page's NACE colour; Geostat's B–E row wears manufacturing's.
  expect(colorOf("labour.jobs.all.sector_f")).toBe("#816150");
  expect(colorOf("labour.jobs.all.sector_b_e")).toBe("#76819F");
  expect(colorOf("labour.jobs.all.not_identified")).toBe("#94856D");
  // Women and men rows take the industry's lighter and darker steps, the same under hours worked.
  expect(colorOf("labour.jobs.women.sector_f")).not.toBe(colorOf("labour.jobs.men.sector_f"));
  const hours = labourSeries("hours");
  const hoursColorOf = (id: string) => labourSeriesColor(hours.find(s => s.id === id)!, hours.findIndex(s => s.id === id));
  expect(hoursColorOf("labour.hours.women.sector_f")).toBe(colorOf("labour.jobs.women.sector_f"));
  expect(hoursColorOf("labour.hours.all.sector_f")).toBe("#816150");
});

const sourceFor = (sourceId: string) => ({
  sourceId, years: Array.from({ length: 9 }, (_, i) => 2017 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-20",
  downloadHref: `/downloads/methodology/unemployment/files/${sourceId}.xlsx` as const,
});
const SOURCES = LABOUR_SOURCES.map(sourceFor);
const MESSAGES: Record<Locale, Record<string, string>> = {
  en: {
    "labour.series": "Series", "labour.value": "Value", "labour.unitColumn": "Unit", "labour.status.published": "Published by Geostat",
    "labour.unit.thousand_persons": "thousand persons", "labour.unit.hours": "hours per week", "labour.unit.percent": "%",
    "labour.cardUnit.thousand_persons": "thousand", "labour.cardUnit.hours": "hours",
    "common.unemploymentIndustries": "Jobs by industry", "common.unemploymentHours": "Hours worked",
    "common.unemploymentInformal": "Informal jobs", "common.unemploymentYoungPeople": "Young people not in work or study",
    "labour.page.industries.summary": "Employed by industry.", "labour.page.hours.summary": "Usual weekly hours.",
    "labour.page.informal.summary": "Informal share.", "labour.page.young-people.summary": "NEET share.",
  },
  ka: {
    "labour.series": "სერია", "labour.value": "მნიშვნელობა", "labour.unitColumn": "ერთეული", "labour.status.published": "საქსტატის მონაცემი",
    "labour.unit.thousand_persons": "ათასი კაცი", "labour.unit.hours": "საათი კვირაში", "labour.unit.percent": "%",
    "labour.cardUnit.thousand_persons": "ათასი", "labour.cardUnit.hours": "საათი",
    "common.unemploymentIndustries": "დასაქმება დარგებით", "common.unemploymentHours": "სამუშაო საათები",
    "common.unemploymentInformal": "არაფორმალური დასაქმება", "common.unemploymentYoungPeople": "ახალგაზრდები",
    "labour.page.industries.summary": "დასაქმებული დარგებით.", "labour.page.hours.summary": "სამუშაო საათები.",
    "labour.page.informal.summary": "არაფორმალური წილი.", "labour.page.young-people.summary": "NEET წილი.",
  },
};
const presentation = (locale: Locale): Presentation => ({ locale, englishLabels: {}, messages: MESSAGES[locale] });
const LABELS: Record<string, string> = {
  "labour.jobs.all.total": "Total", "labour.jobs.all.not_identified": "Not identified", "labour.jobs.women.sector_f": "Construction",
  "labour.hours.all.total": "Total", "labour.hours.men.sector_t": "Households as employers",
  "labour.neet.age_15_24.total": "Total", "labour.neet.age_15_29.women": "Women", "labour.informal.total": "Georgia", "labour.informal.women": "Women",
};
const HEADINGS: Record<string, string> = {
  all: "Everyone", women: "Women", men: "Men", urban: "Towns", rural: "Villages", informal: "Informal jobs", age_15_24: "Ages 15–24", age_15_29: "Ages 15–29",
};
const workbook = (section: LabourSectionId, selectedIds: string[], start: number, end: number, locale: Locale = "en") => buildLabourWorkbookExportModel({
  section, facts, state: { mode: "table", range: manual(start, end), selectedIds }, labels: LABELS, headingLabels: HEADINGS,
  sources: SOURCES, siteOrigin: "https://fiscal.ge", title: "Jobs by industry",
}, presentation(locale));

test("writes the selection to Excel", () => {
  const jobs = workbook("industries", ["labour.jobs.all.total", "labour.jobs.all.not_identified", "labour.jobs.women.sector_f"], 2017, 2025);
  expect(jobs.filename).toBe("fiscal-labour-industries-2017-2025-en.xlsx");
  expect(jobs.readable.numberFormat).toBe("#,##0.0");
  expect(jobs.readable.amountDecimals).toBe(1);
  expect(jobs.readable.subtitle).toBe("2017–2025 · thousand persons");
  expect(jobs.readable.rows.map(row => [row.kind, row.parentLabel, row.label])).toEqual([
    ["total", null, "Total"], ["item", null, "Not identified"], ["item", "Women", "Construction"],
  ]);
  // A published zero stays zero; a year before a row starts is blank.
  const notIdentified = jobs.readable.rows[1];
  expect(notIdentified.valuesByYear[2018]).toBe(0);
  expect(notIdentified.basisByYear[2018]).toBe("published");
  expect(jobs.readable.rows[2].valuesByYear[2019]).toBeNull();
  expect(jobs.readable.rows[2].basisByYear[2019]).toBeNull();
  expect(jobs.analysis.headers).toEqual(["Year", "Series", "Value", "Unit", "Status"]);
  expect(jobs.analysis.numericFormats).toEqual({ 3: "#,##0.0" });
  expect(jobs.analysis.rows).toHaveLength(27);
  expect(jobs.analysis.rows.find(r => r[0] === 2018 && r[1] === "Not identified")).toEqual([2018, "Not identified", 0, "thousand persons", "Published by Geostat"]);
  // Outside the list a row is named with its heading.
  expect(jobs.analysis.rows.find(r => r[0] === 2025 && r[1] === "Women — Construction")).toEqual([2025, "Women — Construction", expect.any(Number), "thousand persons", "Published by Geostat"]);
  expect(jobs.analysis.rows.find(r => r[0] === 2019 && r[1] === "Women — Construction")).toEqual([2019, "Women — Construction", null, "thousand persons", "Not available"]);
  expect(jobs.sources.map(source => source.title)).toEqual(["geostat_lfs_jobs_industry"]);
  expect(jobs.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/unemployment/files/geostat_lfs_jobs_industry.xlsx");

  const hours = workbook("hours", ["labour.hours.men.sector_t"], 2020, 2025);
  expect(hours.filename).toBe("fiscal-labour-hours-2020-2025-en.xlsx");
  expect(Object.values(hours.readable.rows[0].valuesByYear).every(value => value === null)).toBe(true);
  expect(hours.readable.rows[0].parentLabel).toBe("Men");
  expect(hours.analysis.rows.every(r => r[1] === "Men — Households as employers" && r[2] === null && r[4] === "Not available")).toBe(true);
  expect(hours.sources).toEqual([]);
  // A value without a source link would leave the workbook uncited.
  expect(() => buildLabourWorkbookExportModel({
    section: "industries", facts, state: { mode: "line", range: all, selectedIds: ["labour.jobs.all.total"] }, labels: LABELS, headingLabels: HEADINGS,
    sources: [], siteOrigin: "https://fiscal.ge", title: "Jobs",
  }, presentation("en"))).toThrow(/geostat_lfs_jobs_industry/);
  expect(workbook("industries", ["labour.jobs.all.total"], 2017, 2025, "ka").analysis.rows[0]).toEqual([2017, "Total", 1286.9, "ათასი კაცი", "საქსტატის მონაცემი"]);
});

test("names a page total under its heading on the Summary sheet, as on the Data sheet", () => {
  // The Summary sheet prefixes only an item with its heading, so a total under a heading carries the full name itself.
  const young = workbook("young-people", ["labour.neet.age_15_24.total", "labour.neet.age_15_29.women"], 2020, 2025);
  expect(young.readable.rows.map(row => [row.kind, row.parentLabel, row.label])).toEqual([
    ["total", null, "Ages 15–24 — Total"], ["item", "Ages 15–29", "Women"],
  ]);
  expect(young.analysis.rows[0][1]).toBe("Ages 15–24 — Total");
  const informal = workbook("informal", ["labour.informal.total", "labour.informal.women"], 2020, 2025);
  expect(informal.readable.rows.map(row => [row.kind, row.parentLabel, row.label])).toEqual([
    ["total", null, "Informal jobs — Georgia"], ["item", "Informal jobs", "Women"],
  ]);
  expect(informal.analysis.rows[0][1]).toBe("Informal jobs — Georgia");
});

test("builds the four hub cards", () => {
  const en = buildLabourHubCards(facts, presentation("en"), 5);
  expect(en.map(card => [card.index, card.title, card.href, card.description])).toEqual([
    ["05", "Jobs by industry", "/explorer/unemployment/industries", "Employed by industry."],
    ["06", "Hours worked", "/explorer/unemployment/hours", "Usual weekly hours."],
    ["07", "Informal jobs", "/explorer/unemployment/informal", "Informal share."],
    ["08", "Young people not in work or study", "/explorer/unemployment/young-people", "NEET share."],
  ]);
  expect(en.map(card => card.footer)).toEqual([
    "2025 · 1,389.7 thousand · 2017–2025", "2025 · 41.0 hours · 2020–2025", "2025 · 28.3% · 2020–2025", "2025 · 17.6% · 2020–2025",
  ]);
  expect(en.every(card => card.seriesColor === INK && !card.comingSoon)).toBe(true);
  expect(en.map(card => card.series!.length)).toEqual([9, 6, 6, 6]);
  expect(en[0].series![0]).toBe(1286.9);
  expect(en[0].series!.at(-1)).toBe(1389.7);

  const ka = buildLabourHubCards(facts, presentation("ka"), 5);
  const oneDecimal = { divisor: 1, label: "", decimals: 1 };
  expect(ka.map(card => card.index)).toEqual(["05", "06", "07", "08"]);
  expect(ka.map(card => card.footer)).toEqual([
    `2025 · ${formatInUnit(1389.7, oneDecimal)} ათასი · 2017–2025`, `2025 · ${formatInUnit(41, oneDecimal)} საათი · 2020–2025`,
    `2025 · ${formatShare(0.283)} · 2020–2025`, `2025 · ${formatShare(0.176)} · 2020–2025`,
  ]);
  expect(ka[0].title).toBe("დასაქმება დარგებით");
});

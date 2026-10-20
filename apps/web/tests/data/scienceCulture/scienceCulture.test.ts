import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { BUSINESS_REGIONS } from "../../../lib/data/business/types";
import { assertScienceCultureParity, loadScienceCultureBreaks, loadScienceCultureFacts, toClientScienceCultureFact } from "../../../lib/data/scienceCulture/importScienceCulture";
import { scienceCultureMirrorCreateRows, loadScienceCultureFactsFromMirror } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { REVIEWED_AT, SCIENCE_CULTURE_CSV_HEADERS, prepareScienceCultureData } from "../../../lib/data/scienceCulture/prepareScienceCulture";
import {
  SCIENCE_CULTURE_GROUPS, SCIENCE_CULTURE_INDICATORS, SCIENCE_CULTURE_MEASURES, SCIENCE_CULTURE_PUBLIC_SOURCES, SCIENCE_CULTURE_REGIONS,
  SCIENCE_CULTURE_SOURCES, scienceCultureIndicator, scienceCultureSourceDocumentId, type ScienceCultureFact, type ScienceCultureIndicator,
} from "../../../lib/data/scienceCulture/types";
import { expectedScienceCultureKeys, scienceCultureDisplayDecimals, validateScienceCultureFacts } from "../../../lib/data/scienceCulture/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/ScienceCulture/geostat-science-culture-annual");
const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = async (): Promise<ScienceCultureFact[]> =>
  (await readCsv(path.join(root, "data/imports/science-culture-annual.csv"))).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as ScienceCultureIndicator, value: row.value, publishedValue: row.published_value,
    unit: row.unit as ScienceCultureFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly ScienceCultureFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;
/** Sets an exact value and keeps its published form consistent (the stored decimals, at least the display precision), so only the rule under test fails. */
const setValue = (f: ScienceCultureFact, value: string) => {
  const decimals = Math.max(scienceCultureDisplayDecimals(f.indicatorId), new Decimal(value).decimalPlaces());
  return Object.assign(f, { value, publishedValue: new Decimal(value).toFixed(decimals) });
};
const plus = (f: ScienceCultureFact, amount: string) => setValue(f, new Decimal(f.value).plus(amount).toFixed());

test("the committed canonical files match a fresh preparation from the research package", async () => {
  await expect(prepareScienceCultureData(root, "check")).resolves.toBeUndefined();
}, 120_000);

test("serves every reviewed value of the research package over its coverage", async () => {
  const facts = await loadFacts();
  const report = JSON.parse(await fs.readFile(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number };
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(facts).toHaveLength(1733);
  expect(SCIENCE_CULTURE_MEASURES).toHaveLength(19);
  expect(SCIENCE_CULTURE_INDICATORS).toHaveLength(123);
  expect(SCIENCE_CULTURE_REGIONS).toEqual(BUSINESS_REGIONS);
  expect(SCIENCE_CULTURE_SOURCES).toHaveLength(11);
  expect(SCIENCE_CULTURE_GROUPS.researchers).toHaveLength(20);
  expect(scienceCultureIndicator("museum_visitors", "region_guria")).toBe("science_culture.museum_visitors.region_guria");
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(SCIENCE_CULTURE_INDICATORS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(SCIENCE_CULTURE_SOURCES));
  expect(facts.every(f => f.basis === "actual" && f.valueStatus === "official" && f.lastReviewedAt === REVIEWED_AT)).toBe(true);
  expect(find(facts, "science_culture.researchers.total", 2024)).toMatchObject({ publishedValue: "14046", unit: "persons" });
  expect(find(facts, "science_culture.rd_spending.total", 2022)).toMatchObject({ value: "171", publishedValue: "171.0", unit: "gel_million" });
  expect(find(facts, "science_culture.museum_visitors.total", 2025)).toMatchObject({ value: "1998.924", publishedValue: "1998.924" });
  expect(find(facts, "science_culture.theatre_audience.total", 2006)).toMatchObject({ value: "343.6", publishedValue: "343.6" });
  expect(Math.max(...facts.map(f => f.year))).toBe(2025);
});

test("the research package's archived sources are all inventoried", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(research, "source-manifest.json"), "utf8")) as { source_id: string }[];
  expect(new Set(manifest.map(s => s.source_id))).toEqual(new Set(SCIENCE_CULTURE_PUBLIC_SOURCES));
  expect(manifest).toHaveLength(SCIENCE_CULTURE_PUBLIC_SOURCES.length);
});

test("the expected keys and the indicator order are the package's coverage, without its unavailable years", async () => {
  const keys = new Set<string>();
  const coverage = await readCsv(path.join(research, "coverage.csv"));
  for (const row of coverage) {
    const unavailable = row.unavailable_years ? row.unavailable_years.split(";").map(Number) : [];
    for (let year = Number(row.first_year); year <= Number(row.last_year); year++) if (!unavailable.includes(year)) keys.add(`${row.indicator_id}:${year}`);
  }
  expect(expectedScienceCultureKeys()).toEqual(keys);
  expect(expectedScienceCultureKeys().size).toBe(1733);
  expect(SCIENCE_CULTURE_INDICATORS).toEqual(coverage.map(row => row.indicator_id));
  expect(expectedScienceCultureKeys().has("science_culture.theatre_events.total:2020")).toBe(false);
  expect(expectedScienceCultureKeys().has("science_culture.theatre_events.total:2021")).toBe(true);
});

test("display precision is one decimal for thousands and million GEL and none otherwise", () => {
  expect(scienceCultureDisplayDecimals("science_culture.museum_visitors.total")).toBe(1);
  expect(scienceCultureDisplayDecimals("science_culture.museum_tours.region_guria")).toBe(1);
  expect(scienceCultureDisplayDecimals("science_culture.theatre_seats.total")).toBe(1);
  expect(scienceCultureDisplayDecimals("science_culture.theatre_audience.total")).toBe(1);
  expect(scienceCultureDisplayDecimals("science_culture.rd_spending.total")).toBe(1);
  expect(scienceCultureDisplayDecimals("science_culture.researchers.total")).toBe(0);
  expect(scienceCultureDisplayDecimals("science_culture.museum_exhibitions.total")).toBe(0);
  expect(scienceCultureDisplayDecimals("science_culture.invention_patents.local")).toBe(0);
});

test("the canonical files are UTF-8 with a BOM, the agreed header, and the break file is the package's own", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/science-culture-annual.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8").slice(1).split("\n")[0]).toBe(SCIENCE_CULTURE_CSV_HEADERS.join(","));
  const breaks = await fs.readFile(path.join(root, "data/imports/science-culture-series-breaks.csv"));
  expect(breaks.equals(await fs.readFile(path.join(research, "science-culture-series-breaks.csv")))).toBe(true);
  expect(await readCsv(path.join(root, "data/imports/science-culture-series-breaks.csv"))).toMatchObject([
    { break_id: "theatre_audience_2021", applies_to: "science_culture.theatre_audience.total", reference_date: "2021-01-01" },
  ]);
});

test("the museum visitors of the 11 regions fall short of Georgia by exactly the three recorded amounts", async () => {
  const facts = await loadFacts();
  const differences: Record<number, string> = {};
  for (let year = 2005; year <= 2025; year++) {
    const parts = SCIENCE_CULTURE_REGIONS.reduce((sum, region) => sum.plus(find(facts, `science_culture.museum_visitors.${region}`, year).value), new Decimal(0));
    const difference = parts.minus(find(facts, "science_culture.museum_visitors.total", year).value);
    if (!difference.isZero()) differences[year] = difference.toString();
  }
  expect(differences).toEqual({ 2005: "-0.013", 2013: "-0.019", 2023: "-0.03" });
});

test.each([
  ["an altered published value", (facts: ScienceCultureFact[]) => { facts[0].publishedValue = "0.99"; }, /published value/],
  ["a published value rounded away from its stored decimals", (facts: ScienceCultureFact[]) => { find(facts, "science_culture.museum_visitors.total", 2025).publishedValue = "1999.0"; }, /published value/],
  ["a published value that drops a stored decimal", (facts: ScienceCultureFact[]) => { find(facts, "science_culture.rd_spending.total", 2022).publishedValue = "171"; }, /published value/],
  ["a whole-number unit with a decimal", (facts: ScienceCultureFact[]) => { setValue(find(facts, "science_culture.museums.total", 2025), "261.5"); }, /whole/],
  ["a duplicate observation", (facts: ScienceCultureFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: ScienceCultureFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2026 row", (facts: ScienceCultureFact[]) => { facts.push({ ...find(facts, "science_culture.museums.total", 2025), year: 2026 }); }, /after 2025/],
  ["a 2025 researchers row", (facts: ScienceCultureFact[]) => { facts.push({ ...find(facts, "science_culture.researchers.total", 2024), year: 2025 }); }, /outside the approved coverage/],
  ["a 2020 theatre events row", (facts: ScienceCultureFact[]) => { facts.push({ ...find(facts, "science_culture.theatre_events.total", 2021), year: 2020 }); }, /outside the approved coverage/],
  ["a 2019 museum staff row", (facts: ScienceCultureFact[]) => { facts.push({ ...find(facts, "science_culture.museum_staff.total", 2020), year: 2019 }); }, /outside the approved coverage/],
  ["an unknown indicator", (facts: ScienceCultureFact[]) => { facts.push({ ...facts[0], indicatorId: "science_culture.libraries.total" as ScienceCultureIndicator }); }, /identity/],
  ["regions not adding up in exhibitions", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.museum_exhibitions.region_guria", 2020), "1"); }, /museum_exhibitions regions do not add up/],
  ["regions not adding up in museums", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.museums.region_guria", 2020), "1"); }, /museums regions do not add up/],
  ["regions drifting in visitors in an ordinary year", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.museum_visitors.region_guria", 2020), "0.001"); }, /museum_visitors regions do not add up/],
  ["regions drifting from the recorded 2013 visitors difference", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.museum_visitors.region_guria", 2013), "0.001"); }, /museum_visitors regions do not add up/],
  ["the recorded 2023 visitors difference removed", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.museum_visitors.region_guria", 2023), "0.030"); }, /museum_visitors regions do not add up/],
  ["tours drifting beyond 0.2 thousand", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.museum_tours.region_guria", 2020), "0.3"); }, /museum_tours regions do not add up/],
  ["women and men not adding up", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.researchers.women", 2023), "1"); }, /researchers sexes do not add up/],
  ["degrees not adding up", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.researchers.degree_master", 2024), "1"); }, /researchers degrees do not add up/],
  ["fields not adding up", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.researchers.field_social", 2021), "1"); }, /researchers fields do not add up/],
  ["R&D staff not adding up", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.rd_staff.support", 2022), "1"); }, /rd_staff categories do not add up/],
  ["theatre staff contracts not adding up", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.theatre_staff.contract", 2023), "1"); }, /theatre_staff contracts do not add up/],
  ["museum types not adding up", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.museums.type_art", 2015), "1"); }, /museums types do not add up/],
  ["theatre types not adding up", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.theatres.type_puppet", 2015), "1"); }, /theatres types do not add up/],
  ["a calculated status", (facts: ScienceCultureFact[]) => { (find(facts, "science_culture.researchers.total", 2020) as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a value from another sheet", (facts: ScienceCultureFact[]) => { find(facts, "science_culture.researchers.age_under25", 2020).sourceSheet = "1"; }, /source contract/],
  ["a patent from another workbook", (facts: ScienceCultureFact[]) => { find(facts, "science_culture.utility_patents.local", 2020).sourceId = "geostat_science_researchers"; }, /source contract/],
  ["a changed anchor", (facts: ScienceCultureFact[]) => { setValue(find(facts, "science_culture.theatres.total", 2025), "54"); }, /anchor/],
  ["a changed visitors anchor", (facts: ScienceCultureFact[]) => { plus(find(facts, "science_culture.museum_visitors.region_samtskhe_javakheti", 2025), "0.001"); }, /anchor/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  validateScienceCultureFacts(facts);
  mutate(facts);
  expect(() => validateScienceCultureFacts(facts)).toThrow(error);
});

test("loading returns the reviewed canonical rows and the series-break register", async () => {
  const facts = await loadScienceCultureFacts();
  expect(facts).toHaveLength(1733);
  expect(facts).toEqual(await loadFacts());
  const breaks = await loadScienceCultureBreaks();
  expect(breaks).toHaveLength(1);
  expect(breaks[0]).toMatchObject({ breakId: "theatre_audience_2021", appliesTo: ["science_culture.theatre_audience.total"], referenceDate: "2021-01-01" });
});

test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
  const facts = await loadFacts();
  const at = facts.findIndex(f => f.indicatorId === "science_culture.museums.total" && f.year === 2025);
  expect(facts[at].value).toBe("261");
  expect(() => assertScienceCultureParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
  const padded = facts.map(f => ({ ...f }));
  padded[at].value = "261.0";
  padded[at].publishedValue = "261.0";
  expect(() => assertScienceCultureParity(facts, padded)).not.toThrow();
  const trimmed = facts.map(f => ({ ...f }));
  find(trimmed, "science_culture.rd_spending.total", 2022).publishedValue = "171";
  expect(() => assertScienceCultureParity(facts, trimmed)).not.toThrow();
  const changed = facts.map(f => ({ ...f }));
  changed[at].value = "262";
  changed[at].publishedValue = "262";
  expect(() => assertScienceCultureParity(facts, changed)).toThrow();
  expect(() => assertScienceCultureParity(facts, facts.slice(1))).toThrow();
});

test("client facts carry the published number, a unit family and the display precision", async () => {
  const facts = await loadFacts();
  expect(toClientScienceCultureFact(find(facts, "science_culture.museum_visitors.total", 2025))).toEqual({
    year: 2025, indicatorId: "science_culture.museum_visitors.total", sourceId: "geostat_culture_museums_regions", value: 1998.924, unit: "thousand", decimals: 1,
  });
  expect(toClientScienceCultureFact(find(facts, "science_culture.rd_spending.total", 2024))).toMatchObject({ value: 242.9, unit: "gel", decimals: 1 });
  expect(toClientScienceCultureFact(find(facts, "science_culture.researchers.total", 2024))).toMatchObject({ value: 14046, unit: "persons", decimals: 0 });
  expect(toClientScienceCultureFact(find(facts, "science_culture.museums.total", 2025))).toMatchObject({ value: 261, unit: "count", decimals: 0 });
  expect(toClientScienceCultureFact(find(facts, "science_culture.theatre_seats.total", 2025))).toMatchObject({ unit: "thousand", decimals: 1 });
  expect(toClientScienceCultureFact(find(facts, "science_culture.theatre_audience.total", 2025))).toMatchObject({ value: 620.322, unit: "thousand" });
});

test("the database mirror round-trips exact decimals and source relations", async () => {
  const facts = await loadFacts();
  const rows = scienceCultureMirrorCreateRows(facts, "science-culture-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const db = (list: typeof rows) => ({ scienceCultureFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "scienceCultureFact">;
  const mirror = await loadScienceCultureFactsFromMirror(db(rows));
  expect(() => assertScienceCultureParity(facts, mirror)).not.toThrow();
  expect(mirror).toEqual(facts);
  expect(rows[0].importRunId).toBe("science-culture-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
  await expect(loadScienceCultureFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
});

test("every archived source has a source-document row", async () => {
  const csv = await fs.readFile(path.join(root, "data/sources/source-documents.csv"));
  const ids = new Set((parse(csv, { columns: true, bom: true }) as Record<string, string>[]).map(r => r.source_id));
  expect(SCIENCE_CULTURE_PUBLIC_SOURCES.filter(id => !ids.has(scienceCultureSourceDocumentId(id)))).toEqual([]);
});

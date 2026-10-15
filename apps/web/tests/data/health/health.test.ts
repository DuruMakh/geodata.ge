import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import type { BreakRow } from "../../../lib/data/demography/breaks";
import { assertHealthParity, loadHealthBreaks, loadHealthFacts, loadServedHealthData, toClientHealthFact } from "../../../lib/data/health/importHealth";
import { healthMirrorCreateRows, loadHealthFactsFromMirror } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { HEALTH_AREAS, HEALTH_INDICATORS, HEALTH_PUBLIC_SOURCES, HEALTH_SOURCES, HEALTH_UNITS, type HealthFact, type HealthSeriesBreak } from "../../../lib/data/health/types";
import { HEALTH_CSV_HEADERS, prepareHealthData } from "../../../lib/data/health/prepareHealth";
import { expectedHealthKeys, healthDisplayDecimals, healthPublishedValue, validateHealthFacts } from "../../../lib/data/health/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/Health/geostat-health-annual");
const records = (file: string) => parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = (): HealthFact[] =>
  records(path.join(root, "data/imports/health-annual.csv")).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as HealthFact["indicatorId"], areaId: row.area_id as HealthFact["areaId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as HealthFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "published", sourceId: row.source_id,
    sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly HealthFact[], indicatorId: string, year: number, areaId = "georgia") => facts.find(f => f.indicatorId === indicatorId && f.year === year && f.areaId === areaId)!;
/** Changes a value and keeps its published text consistent, so only a cross-check can notice. */
const setValue = (fact: HealthFact, value: string) => Object.assign(fact, { value, publishedValue: healthPublishedValue(fact.unit, value, fact.sourceNumberFormat) });

test("the canonical file carries the package's 4,204 observations", async () => {
  const report = JSON.parse(fs.readFileSync(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number };
  const facts = loadFacts();
  expect(report.primary_observation_count).toBe(4204);
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(expectedHealthKeys().size).toBe(facts.length);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(HEALTH_INDICATORS));
  expect(new Set(facts.map(f => f.areaId))).toEqual(new Set(HEALTH_AREAS));
  expect(new Set(facts.map(f => f.unit))).toEqual(new Set(HEALTH_UNITS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(HEALTH_SOURCES));
  expect(HEALTH_SOURCES.every(id => HEALTH_PUBLIC_SOURCES.includes(id))).toBe(true);
  expect(HEALTH_PUBLIC_SOURCES).toHaveLength(36);
  expect(() => validateHealthFacts(facts)).not.toThrow();
  await expect(prepareHealthData(root, "check")).resolves.toBeUndefined();
});

test("every row is the package row, plus the review date", () => {
  const canonical = records(path.join(root, "data/imports/health-annual.csv"));
  const original = records(path.join(research, "health-annual.csv"));
  expect(Object.keys(canonical[0])).toEqual(HEALTH_CSV_HEADERS);
  expect(canonical.map(({ last_reviewed_at, ...row }) => row)).toEqual(original);
  expect(new Set(canonical.map(row => row.last_reviewed_at))).toEqual(new Set(["2026-10-15"]));
  expect(fs.readFileSync(path.join(root, "data/imports/health-annual.csv")).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
});

test("the series breaks are the package's four counting changes, copied as is", () => {
  const copy = path.join(root, "data/imports/health-series-breaks.csv");
  expect(fs.readFileSync(copy)).toEqual(fs.readFileSync(path.join(research, "health-series-breaks.csv")));
  const breaks: HealthSeriesBreak[] = records(copy).map((row): BreakRow => ({ breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note }));
  expect(breaks.map(b => b.breakId)).toEqual(["staff_definitions_2012", "staff_register_2020", "icd10_groups_2006", "new_cases_electronic_2020"]);
  expect(breaks.every(b => b.appliesTo.every(id => (HEALTH_INDICATORS as readonly string[]).includes(id)))).toBe(true);
});

test("all-deaths values equal the Population page's deaths where both exist", () => {
  const population = new Map(records(path.join(root, "data/imports/demography-vital-annual.csv")).filter(row => row.series_id === "demography.deaths").map(row => [`${row.geography_id}:${row.year}`, row.value]));
  let checked = 0;
  for (const fact of loadFacts().filter(f => f.indicatorId === "health.deaths.total")) {
    const other = population.get(`${fact.areaId === "georgia" ? "country.georgia" : fact.areaId}:${fact.year}`);
    if (other === undefined) continue; // the Population pages serve no regional 2014
    expect(new Decimal(other).eq(fact.value), `${fact.areaId} ${fact.year}`).toBe(true);
    checked += 1;
  }
  expect(checked).toBe(12 + 11 * 11);
});

describe("the published value rule", () => {
  test.each([
    ["#\\ ##0", "22491", "persons", 0],
    ["0.0", "44.2", "per_1000_population", 1],
    ["General", "500.359", "persons_thousand", 3],
    ["0.0", "500.35899999999998", "persons_thousand", 3],
    ["#,##0", "15.232", "units_thousand", 3],
    ["General", "934", "persons", 0],
  ] as const)("%s %s %s shows %i decimals", (format, value, unit, decimals) => {
    expect(healthDisplayDecimals(format, value, unit)).toBe(decimals);
  });
  test("rates and counts round half up, thousands keep the stored value to 15 digits", () => {
    expect(healthPublishedValue("per_1000_population", "10.45", "#,##0.0")).toBe("10.5");
    expect(healthPublishedValue("per_1000_population", "11.260579422224215", "#,##0.0")).toBe("11.3");
    expect(healthPublishedValue("per_1000_population", "13", "0.0")).toBe("13.0");
    expect(healthPublishedValue("persons", "2.5", "#\\ ##0")).toBe("3");
    expect(healthPublishedValue("persons", "1234", "General")).toBe("1234");
    expect(healthPublishedValue("units_thousand", "7.0919999999999996", "0.0")).toBe("7.092");
    expect(healthPublishedValue("visits_thousand", "16760.072", "#\\ ##0")).toBe("16760.072");
  });
  test("rejects a number format the unit does not use", () => {
    expect(() => healthPublishedValue("persons", "1", "0.0")).toThrow(/number format/);
    expect(() => healthPublishedValue("per_1000_population", "1", "General")).toThrow(/number format/);
    expect(() => healthPublishedValue("persons_thousand", "1", "0.00")).toThrow(/number format/);
  });
});

test.each([
  ["an altered published value", (facts: HealthFact[]) => { facts[0].publishedValue = "0.1"; }, /published value/],
  ["a duplicate observation", (facts: HealthFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: HealthFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2013 all-deaths row", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.deaths.total", 2014), year: 2013 }); }, /outside the approved coverage/],
  ["a 2019 covid19 deaths row", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.deaths.covid19", 2020), year: 2019 }); }, /outside the approved coverage/],
  ["a 2026 illness row", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.illness.diabetes", 2025), year: 2026 }); }, /outside the approved coverage/],
  ["a diabetes row before 2016", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.illness.diabetes", 2016), year: 2015 }); }, /outside the approved coverage/],
  ["an unknown indicator", (facts: HealthFact[]) => { facts.push({ ...facts[0], indicatorId: "health.illness.covid19" as HealthFact["indicatorId"] }); }, /Invalid health identity/],
  ["a regional staff row", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.staff.doctors", 2025), areaId: "region.guria" }); }, /outside the approved coverage/],
  ["an Abkhazia area", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.deaths.total", 2025), areaId: "region.abkhazia" as HealthFact["areaId"] }); }, /Invalid health identity/],
  ["causes that do not add up", (facts: HealthFact[]) => { setValue(find(facts, "health.deaths.circulatory", 2025, "region.guria"), "999"); }, /causes do not add up/],
  ["regions that do not add up", (facts: HealthFact[]) => {
    setValue(find(facts, "health.deaths.total", 2025), String(Number(find(facts, "health.deaths.total", 2025).value) + 1));
    setValue(find(facts, "health.deaths.ill_defined", 2025), String(Number(find(facts, "health.deaths.ill_defined", 2025).value) + 1));
  }, /regions do not add up/],
  ["specialities that do not add up to doctors", (facts: HealthFact[]) => { setValue(find(facts, "health.staff.doctors_surgery", 2010), String(Number(find(facts, "health.staff.doctors_surgery", 2010).value) + 1)); }, /specialities do not add up/],
  ["an altered anchor value", (facts: HealthFact[]) => { setValue(find(facts, "health.facilities.hospitals", 2025), "233"); }, /anchor/],
  ["a calculated status", (facts: HealthFact[]) => { (facts[0] as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a planned basis", (facts: HealthFact[]) => { (facts[0] as { basis: string }).basis = "planned"; }, /source contract/],
  ["a wrong unit", (facts: HealthFact[]) => { facts[0].unit = "persons"; }, /source contract/],
  ["a wrong source", (facts: HealthFact[]) => { find(facts, "health.staff.nurses", 2020).sourceId = "geostat_health_physicians"; }, /source contract/],
  ["a negative value", (facts: HealthFact[]) => { Object.assign(find(facts, "health.facilities.hospitals", 2020), { value: "-1", publishedValue: "-1" }); }, /range/],
  ["a non-numeric value", (facts: HealthFact[]) => { find(facts, "health.facilities.hospitals", 2020).value = "n/a"; }, /Invalid health value/],
  ["a non-numeric published value", (facts: HealthFact[]) => { facts[0].publishedValue = "n/a"; }, /published value/],
] as const)("validation rejects %s", (_, mutate, error) => {
  const facts = loadFacts().map(f => ({ ...f }));
  mutate(facts);
  expect(() => validateHealthFacts(facts)).toThrow(error);
});

test("a real zero is a value", () => {
  const facts = loadFacts();
  expect(facts.filter(f => f.value === "0").length).toBeGreaterThan(0);
  expect(() => validateHealthFacts(facts)).not.toThrow();
});

describe("loading and parity", () => {
  test("loadHealthFacts serves the canonical rows and rejects a file that no longer matches its acceptance fingerprint", async () => {
    await expect(loadHealthFacts()).resolves.toHaveLength(4204);
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), "health-"));
    try {
      for (const relative of ["data/imports/health-annual.csv", "data/reports/health-validation.json"]) {
        fs.mkdirSync(path.dirname(path.join(copy, relative)), { recursive: true });
        fs.copyFileSync(path.join(root, relative), path.join(copy, relative));
      }
      await expect(loadHealthFacts(copy)).resolves.toHaveLength(4204);
      fs.appendFileSync(path.join(copy, "data/imports/health-annual.csv"), "\n");
      await expect(loadHealthFacts(copy)).rejects.toThrow(/fingerprint/);
    } finally {
      fs.rmSync(copy, { recursive: true, force: true });
    }
  });

  test("the breaks load from the CSV only, as the package's four registers", async () => {
    const breaks = await loadHealthBreaks();
    expect(breaks.map(b => b.breakId)).toEqual(["staff_definitions_2012", "staff_register_2020", "icd10_groups_2006", "new_cases_electronic_2020"]);
    expect(breaks[0].appliesTo.length).toBeGreaterThan(1);
    expect((await loadServedHealthData())).toMatchObject({ facts: expect.any(Array), breaks });
  });

  test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
    const facts = await loadHealthFacts();
    expect(() => assertHealthParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
    // A stored value written as "20225.0" is the same figure as "20225".
    const padded = facts.map(f => ({ ...f }));
    const doctors = find(padded, "health.staff.doctors", 2002);
    expect(doctors.value).toBe("20225");
    doctors.value = "20225.0";
    expect(() => assertHealthParity(facts, padded)).not.toThrow();
    expect(new Decimal("22491").eq("22491.0")).toBe(true);
    const changed = facts.map(f => ({ ...f }));
    setValue(find(changed, "health.facilities.beds", 2025), "15.233");
    expect(() => assertHealthParity(facts, changed)).toThrow();
    expect(() => assertHealthParity(facts, facts.slice(1))).toThrow();
  });

  test("client facts carry the published figure and the decimals it is published with", async () => {
    const facts = await loadHealthFacts();
    expect(toClientHealthFact(find(facts, "health.facilities.beds", 2025))).toEqual({
      year: 2025, indicatorId: "health.facilities.beds", areaId: "georgia", sourceId: "geostat_health_main", unit: "units_thousand", value: 15.232, decimals: 3,
    });
    expect(toClientHealthFact(find(facts, "health.death_rate.total", 2025))).toMatchObject({ value: 11.3, decimals: 1, unit: "per_1000_population" });
    expect(toClientHealthFact(find(facts, "health.staff.doctors", 2002))).toMatchObject({ value: 20225, decimals: 0, unit: "persons" });
    expect(facts.every(f => { const c = toClientHealthFact(f); return c.value === Number(f.publishedValue) && c.decimals === healthDisplayDecimals(f.sourceNumberFormat, f.value, f.unit); })).toBe(true);
    // Nothing exact or internal leaves the server.
    expect(Object.keys(toClientHealthFact(facts[0])).sort()).toEqual(["areaId", "decimals", "indicatorId", "sourceId", "unit", "value", "year"]);
  });

  test("the database mirror round-trips exact decimals, published precision and source relations", async () => {
    const facts = await loadHealthFacts();
    const rows = healthMirrorCreateRows(facts, "health-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
    const db = (list: typeof rows) => ({ healthFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "healthFact">;
    const mirror = await loadHealthFactsFromMirror(db(rows));
    expect(() => assertHealthParity(facts, mirror)).not.toThrow();
    // A rate published as "13.0" is stored as 13 and comes back with its decimal.
    const whole = facts.find(f => f.unit === "per_1000_population" && f.publishedValue.endsWith(".0"))!;
    expect(mirror.find(f => f.indicatorId === whole.indicatorId && f.areaId === whole.areaId && f.year === whole.year)!.publishedValue).toBe(whole.publishedValue);
    expect(rows[0].importRunId).toBe("health-run-1");
    expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
    expect(rows.every(row => "areaId" in row)).toBe(true);
    await expect(loadHealthFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
  });
});

test("every public source has one source-document row with a Georgian title, an English title and the local file", () => {
  const documents = new Map(records(path.join(root, "data/sources/source-documents.csv")).map(row => [row.source_id, row]));
  const english: Record<string, { name: { text: string } }> = JSON.parse(fs.readFileSync(path.join(root, "data/localization/en/sources.json"), "utf8"));
  const manifest = records(path.join(research, "source-manifest.csv"));
  expect(new Set(manifest.map(row => row.source_id))).toEqual(new Set(HEALTH_PUBLIC_SOURCES));
  expect(manifest).toHaveLength(HEALTH_PUBLIC_SOURCES.length);
  // Geostat's own Georgian table titles, as on the other Georgian-first source rows.
  expect(documents.get("source.geostat_deaths_by_cause_region")!.source_name).toBe("გარდაცვლილთა რიცხოვნობა რეგიონების და გარდაცვალების მიზეზების ძირითადი კლასების მიხედვით");
  expect(documents.get("source.geostat_health_main")!.source_name).toBe("ჯანმრთელობის დაცვის ძირითადი მაჩვენებლები");
  for (const row of manifest) {
    const document = documents.get(`source.${row.source_id}`);
    expect(document, row.source_id).toBeDefined();
    expect(document!.source_name, row.source_id).toMatch(/^[^A-Za-z]*[ა-ჿ]/);
    expect(english[`source.${row.source_id}`]?.name.text, row.source_id).toMatch(/^[^ა-ჿ]+$/);
    expect(document!.source_url_or_file).toBe(`docs/Raw Data/Health/geostat-health-annual/${row.local_file}`);
    expect(document!.last_reviewed_at).toBe("2026-10-15");
  }
});

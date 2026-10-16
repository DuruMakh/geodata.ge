import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test, vi } from "vitest";
import { assertEducationParity, loadEducationFacts, shownEducationFacts, toClientEducationFact } from "../../../lib/data/education/importEducation";
import { educationMirrorCreateRows, loadEducationFactsFromMirror } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { EDUCATION_CSV_HEADERS, REVIEWED_AT, prepareEducationData } from "../../../lib/data/education/prepareEducation";
import {
  EDUCATION_GEORGIA, EDUCATION_HE_GROUPS, EDUCATION_INDICATORS, EDUCATION_MEASURES, EDUCATION_PUBLIC_SOURCES, EDUCATION_SOURCES, EDUCATION_VET_FIELDS, EDUCATION_VET_OLD_FIELDS,
  educationFactKey, educationIndicator, educationSourceDocumentId, type EducationFact, type EducationIndicator,
} from "../../../lib/data/education/types";
import { educationDisplayDecimals, educationPeriodLabel, expectedEducationKeys, validateEducationFacts } from "../../../lib/data/education/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/Education/geostat-education-annual");
const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = async (): Promise<EducationFact[]> =>
  (await readCsv(path.join(root, "data/imports/education-annual.csv"))).map(row => ({
    year: Number(row.year), periodLabel: row.period_label, indicatorId: row.indicator_id as EducationIndicator, geographyId: row.geography_id,
    value: row.value, publishedValue: row.published_value, unit: row.unit as EducationFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    shown: row.shown === "true", sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly EducationFact[], indicatorId: string, geographyId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.geographyId === geographyId && f.year === year)!;
/** Sets an exact value and keeps its published rounding consistent, so only the rule under test fails. */
const setValue = (f: EducationFact, value: string) => {
  const decimals = educationDisplayDecimals(f.indicatorId);
  return Object.assign(f, { value, publishedValue: new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals) });
};
const plus = (f: EducationFact, amount: string) => setValue(f, new Decimal(f.value).plus(amount).toFixed());

test("the committed canonical files match a fresh preparation from the research package", async () => {
  await expect(prepareEducationData(root, "check")).resolves.toBeUndefined();
}, 60_000);

test("serves every reviewed value of the research package over its coverage", async () => {
  const facts = await loadFacts();
  const report = JSON.parse(await fs.readFile(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number };
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(facts).toHaveLength(8815);
  expect(EDUCATION_MEASURES).toHaveLength(12);
  expect(EDUCATION_INDICATORS).toHaveLength(105);
  expect(EDUCATION_HE_GROUPS).toHaveLength(16);
  expect([EDUCATION_VET_FIELDS.length, EDUCATION_VET_OLD_FIELDS.length]).toEqual([9, 9]);
  expect(EDUCATION_SOURCES).toHaveLength(6);
  expect(EDUCATION_PUBLIC_SOURCES).toHaveLength(46);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(EDUCATION_INDICATORS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(EDUCATION_SOURCES));
  expect(facts.every(f => f.basis === "actual" && f.valueStatus === "official" && f.lastReviewedAt === REVIEWED_AT)).toBe(true);
  expect(facts.filter(f => !f.shown)).toHaveLength(170);
  expect(facts.every(f => f.shown === !f.indicatorId.split(".")[2].startsWith("old_"))).toBe(true);
  expect(Math.max(...facts.map(f => f.year))).toBe(2025);
  expect(find(facts, "education.schools.total", EDUCATION_GEORGIA, 2025).publishedValue).toBe("2292");
  expect(find(facts, "education.pupils.total", "region.tbilisi", 2025).publishedValue).toBe("232134");
  expect(find(facts, "education.he_graduates.total", EDUCATION_GEORGIA, 2024)).toMatchObject({ publishedValue: "32494", periodLabel: "2024/25" });
  expect(find(facts, "education.vet_admitted.total", EDUCATION_GEORGIA, 2025)).toMatchObject({ publishedValue: "19690", periodLabel: "2025" });
});

test("the expected keys are the package's coverage, without its unavailable years", async () => {
  const keys = new Set<string>();
  for (const row of await readCsv(path.join(research, "coverage.csv"))) {
    const unavailable = row.unavailable_years ? row.unavailable_years.split(";").map(Number) : [];
    for (let year = Number(row.first_year); year <= Number(row.last_year); year++) if (!unavailable.includes(year)) keys.add(`${row.indicator_id}:${row.geography_id}:${year}`);
  }
  expect(expectedEducationKeys()).toEqual(keys);
  expect(expectedEducationKeys().has("education.pupils.total:04:2020")).toBe(false);
  expect(expectedEducationKeys().has("education.teachers.private:country.georgia:2010")).toBe(false);
  expect(expectedEducationKeys().has("education.teachers.private:country.georgia:2011")).toBe(true);
});

test("text numbers, odd stored decimals and unavailable cells are served exactly", async () => {
  const facts = await loadFacts();
  expect(find(facts, "education.schools.total", EDUCATION_GEORGIA, 2024)).toMatchObject({ value: "2294", sourceCell: "Z3" });
  expect(find(facts, "education.pupils_national.total", EDUCATION_GEORGIA, 2012)).toMatchObject({ value: "559.41499999999996", publishedValue: "559.4", unit: "persons_thousand" });
  const has = (indicatorId: string, geographyId: string, year: number) => facts.some(f => f.indicatorId === indicatorId && f.geographyId === geographyId && f.year === year);
  expect(has("education.teachers.private", EDUCATION_GEORGIA, 2010)).toBe(false);
  expect(has("education.kindergartens.total", "unit.abkhazia_ar", 2020)).toBe(false);
  expect(has("education.vet_admitted.field_ict", EDUCATION_GEORGIA, 2018)).toBe(false);
  expect(facts.filter(f => f.unit === "persons_thousand").every(f => f.indicatorId.startsWith("education.pupils_national."))).toBe(true);
});

test("school years carry their label and vocational years stay plain", () => {
  expect(educationPeriodLabel("pupils", 2009)).toBe("2009/10");
  expect(educationPeriodLabel("pupils", 1999)).toBe("1999/00");
  expect(educationPeriodLabel("schools", 2025)).toBe("2025/26");
  expect(educationPeriodLabel("vet_admitted", 2025)).toBe("2025");
  expect(educationIndicator("pupils_national", "total")).toBe("education.pupils_national.total");
  expect(educationFactKey({ indicatorId: "education.pupils.total", geographyId: "region.tbilisi", year: 2025 })).toBe("education.pupils.total:region.tbilisi:2025");
});

test("the canonical file is UTF-8 with a BOM and the agreed header", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/education-annual.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8").slice(1).split("\n")[0]).toBe(EDUCATION_CSV_HEADERS.join(","));
});

test("the series breaks cover the kindergarten staff counts and the master's-level series", async () => {
  const rows = await readCsv(path.join(root, "data/imports/education-series-breaks.csv"));
  expect(rows.map(r => [r.break_id, r.reference_date])).toEqual([["kindergarten_staff_2020", "2020-09-01"], ["he_levels_2015", "2015-09-01"]]);
  expect(rows[0].applies_to).toBe("education.kg_staff.total");
  expect(new Set(rows[1].applies_to.split(";"))).toEqual(new Set(["he_students", "he_admitted", "he_graduates"].flatMap(m => [`education.${m}.level_bachelor`, `education.${m}.level_master`])));
});

test("geostat's three own sum mismatches are the only ones accepted", async () => {
  const facts = await loadFacts();
  expect(() => validateEducationFacts(facts)).not.toThrow();
  const rows = await readCsv(path.join(root, "data/mappings/education/known-differences.csv"));
  expect(rows.map(r => `${r.check}|${r.year}|${r.difference}`).sort()).toEqual([
    "education.kg_children.total georgia|2024|400", "education.kg_children.total region.samegrelo_zemo_svaneti|2024|-400", "education.pupils.total region.guria|2022|205",
  ]);
});

test.each([
  ["an altered published value", (facts: EducationFact[]) => { facts[0].publishedValue = "0.99"; }, /published value/],
  ["a duplicate observation", (facts: EducationFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: EducationFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2004 pupils row for a municipality", (facts: EducationFact[]) => { facts.push({ ...find(facts, "education.pupils.total", "06", 2005), year: 2004, periodLabel: "2004/05" }); }, /outside the approved coverage/],
  ["a 2026 row", (facts: EducationFact[]) => { facts.push({ ...find(facts, "education.schools.total", EDUCATION_GEORGIA, 2025), year: 2026, periodLabel: "2026/27" }); }, /after 2025/],
  ["a vet_admitted ICT row for 2018", (facts: EducationFact[]) => { facts.push({ ...find(facts, "education.vet_admitted.field_ict", EDUCATION_GEORGIA, 2019), year: 2018, periodLabel: "2018" }); }, /outside the approved coverage/],
  ["a row for municipal code 04", (facts: EducationFact[]) => { facts.push({ ...find(facts, "education.pupils.total", "06", 2020), geographyId: "04" }); }, /outside the approved coverage/],
  ["a calculated status", (facts: EducationFact[]) => { (find(facts, "education.schools.total", EDUCATION_GEORGIA, 2020) as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a shown old vocational field", (facts: EducationFact[]) => { find(facts, "education.vet_admitted.old_law", EDUCATION_GEORGIA, 2015).shown = true; }, /shown flag/],
  ["a hidden current field", (facts: EducationFact[]) => { find(facts, "education.vet_admitted.field_ict", EDUCATION_GEORGIA, 2020).shown = false; }, /shown flag/],
  ["a wrong school-year label", (facts: EducationFact[]) => { find(facts, "education.schools.total", EDUCATION_GEORGIA, 2020).periodLabel = "2020"; }, /period label/],
  ["a region row that no longer equals its parts", (facts: EducationFact[]) => { plus(find(facts, "education.pupils.total", "region.imereti", 2020), "1"); }, /pupils.*do not add up/],
  ["a municipality that no longer adds to its region", (facts: EducationFact[]) => { plus(find(facts, "education.teachers.women", "06", 2020), "1"); }, /do not add up/],
  ["a kept unit that no longer adds to its region", (facts: EducationFact[]) => { plus(find(facts, "education.schools.total", "unit.akhalgori", 2005), "1"); }, /do not add up/],
  ["regions no longer adding to Georgia", (facts: EducationFact[]) => { plus(find(facts, "education.kg_staff.total", "region.tbilisi", 2020), "1"); }, /do not add up/],
  ["a recorded mismatch that stops recurring", (facts: EducationFact[]) => { plus(find(facts, "education.pupils.total", "region.guria", 2022), "-205"); }, /do not add up/],
  ["ownership not adding up", (facts: EducationFact[]) => { plus(find(facts, "education.schools.private", EDUCATION_GEORGIA, 2020), "1"); }, /do not add up/],
  ["university fields not adding up", (facts: EducationFact[]) => { plus(find(facts, "education.he_students.field_science", EDUCATION_GEORGIA, 2020), "1"); }, /do not add up/],
  ["vocational sexes not adding up", (facts: EducationFact[]) => { plus(find(facts, "education.vet_graduates.men", EDUCATION_GEORGIA, 2020), "1"); }, /do not add up/],
  ["a changed anchor", (facts: EducationFact[]) => { setValue(find(facts, "education.he_students.total", EDUCATION_GEORGIA, 2025), "195427"); plus(find(facts, "education.he_students.public", EDUCATION_GEORGIA, 2025), "1"); }, /anchor/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  validateEducationFacts(facts);
  mutate(facts);
  expect(() => validateEducationFacts(facts)).toThrow(error);
});

test("a changed table 11 Georgia row is caught by the cross-checks and the sum of regions", async () => {
  const dir = path.join(root, "docs/Raw Data/Education/geostat-education-annual");
  const facts = await loadFacts();
  const { readWorkbookCells } = await import("../../../lib/data/energyFood/prepareEnergyFood");
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "source-manifest.json"), "utf8")) as { source_id: string; local_file: string }[];
  const cells = readWorkbookCells(await fs.readFile(path.join(dir, manifest.find(s => s.source_id === "geostat_education_municipal")!.local_file)));
  const georgia = (measure: string) => new Map(facts.filter(f => f.indicatorId === `education.${measure}.total` && f.geographyId === "region.tbilisi")
    .map(f => [f.year, cells.get(`${measure}:${f.sourceCell.replace(/\d+$/, "")}${measure === "teachers" ? 4 : 3}`)!.token!] as const));
  const row = { schools: georgia("schools"), pupils: georgia("pupils"), teachers: georgia("teachers") };
  expect(() => validateEducationFacts(facts, row)).not.toThrow();
  const bump = (measure: "schools" | "pupils" | "teachers", year: number) => ({ ...row, [measure]: new Map(row[measure]).set(year, String(Number(row[measure].get(year)) + 1)) });
  expect(() => validateEducationFacts(facts, bump("pupils", 2020))).toThrow(/Georgia pupils|do not add up/);
  expect(() => validateEducationFacts(facts, bump("schools", 2020))).toThrow(/Georgia schools|do not add up/);
  expect(() => validateEducationFacts(facts, bump("teachers", 2020))).toThrow(/Georgia teachers|do not add up/);
});

test("loading serves the same 8,815 values as the canonical file, hidden rows included", async () => {
  const facts = await loadEducationFacts();
  expect(facts).toHaveLength(8815);
  expect(facts).toEqual(await loadFacts());
});

test("loading refuses a canonical file whose fingerprint differs from the report", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "education-"));
  try {
    await fs.mkdir(path.join(dir, "apps/web"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/imports"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/reports"), { recursive: true });
    const csv = await fs.readFile(path.join(root, "data/imports/education-annual.csv"), "utf8");
    const altered = csv.replace("644.20000000000005", "644.30000000000005");
    expect(altered).not.toBe(csv);
    await fs.writeFile(path.join(dir, "data/imports/education-annual.csv"), altered);
    await fs.copyFile(path.join(root, "data/reports/education-validation.json"), path.join(dir, "data/reports/education-validation.json"));
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(path.join(dir, "apps/web"));
    try {
      await expect(loadEducationFacts()).rejects.toThrow(/fingerprint/);
    } finally {
      cwd.mockRestore();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
  const facts = await loadFacts();
  const pupils = facts.findIndex(f => f.indicatorId === "education.pupils_national.total" && f.geographyId === EDUCATION_GEORGIA && f.year === 2025);
  expect(facts[pupils].publishedValue).toBe("644.2");
  expect(() => assertEducationParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
  const padded = facts.map(f => ({ ...f }));
  // Validation requires the published value at its display precision, so the same decimal is written differently in the exact value.
  padded[pupils].value = "644.200000000000050";
  expect(() => assertEducationParity(facts, padded)).not.toThrow();
  const changed = facts.map(f => ({ ...f }));
  changed[pupils].value = "644.30000000000005";
  changed[pupils].publishedValue = "644.3";
  expect(() => assertEducationParity(facts, changed)).toThrow();
  expect(() => assertEducationParity(facts, facts.slice(1))).toThrow();
});

test("client facts carry persons, with Georgia's pupils taken from thousands, and institutions with their display precision", async () => {
  const facts = await loadFacts();
  expect(toClientEducationFact(find(facts, "education.pupils_national.total", EDUCATION_GEORGIA, 2025))).toEqual({
    year: 2025, indicatorId: "education.pupils_national.total", geographyId: EDUCATION_GEORGIA, sourceId: "geostat_education_schools_national", value: 644200, unit: "persons", decimals: 1,
  });
  expect(toClientEducationFact(find(facts, "education.schools.total", EDUCATION_GEORGIA, 2025))).toMatchObject({ value: 2292, unit: "institutions", decimals: 0 });
  expect(toClientEducationFact(find(facts, "education.pupils.total", "region.tbilisi", 2025))).toMatchObject({ value: 232134, unit: "persons", decimals: 0 });
});

test("Georgia's pupils convert from thousands to whole persons without floating-point drift", async () => {
  const facts = await loadFacts();
  expect(toClientEducationFact(find(facts, "education.pupils_national.public", EDUCATION_GEORGIA, 2011)).value).toBe(516700);
  const thousands = facts.filter(f => f.unit === "persons_thousand");
  expect(thousands.length).toBeGreaterThan(0);
  expect(thousands.filter(f => !Number.isInteger(toClientEducationFact(f).value))).toEqual([]);
});

test("shown facts hold no old vocational field, and the file keeps all 170 hidden rows", async () => {
  const facts = await loadFacts();
  const shown = shownEducationFacts(facts);
  expect(shown).toHaveLength(8815 - 170);
  expect(shown.some(f => f.indicatorId.split(".")[2].startsWith("old_"))).toBe(false);
  expect(facts.filter(f => f.indicatorId.split(".")[2].startsWith("old_"))).toHaveLength(170);
});

test("the database mirror round-trips exact decimals, the shown flag and source relations", async () => {
  const facts = await loadFacts();
  const rows = educationMirrorCreateRows(facts, "education-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const db = (list: typeof rows) => ({ educationFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "educationFact">;
  const mirror = await loadEducationFactsFromMirror(db(rows));
  expect(() => assertEducationParity(facts, mirror)).not.toThrow();
  expect(mirror.filter(f => !f.shown)).toHaveLength(170);
  expect(rows[0].importRunId).toBe("education-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
  await expect(loadEducationFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
});

test("every archived source has a source-document row", async () => {
  const csv = await fs.readFile(path.join(root, "data/sources/source-documents.csv"));
  const ids = new Set((parse(csv, { columns: true, bom: true }) as Record<string, string>[]).map(r => r.source_id));
  expect(EDUCATION_PUBLIC_SOURCES.filter(id => !ids.has(educationSourceDocumentId(id)))).toEqual([]);
});

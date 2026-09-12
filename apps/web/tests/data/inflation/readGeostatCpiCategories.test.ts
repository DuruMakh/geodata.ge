import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readGeostatCpiCategories } from "../../../lib/data/inflation/readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage } from "../../../lib/data/inflation/sourceFiles";
import { periodKey } from "../../../lib/data/inflation/periods";

// Parsing one 847 KB workbook costs about three seconds, and these tests want
// three of them repeatedly. The reader is pure, so parse each once.
const parsed = new Map<string, Promise<ReturnType<typeof readGeostatCpiCategories>>>();

function categories(language: "en" | "ka", role: "yoy" | "mom") {
  const key = `${language}:${role}`;
  const cached = parsed.get(key);
  if (cached) return cached;
  const pending = (async () => {
    const vintage = await latestCpiVintage();
    const file = role === "yoy" ? "cpi-yoy.xlsx" : "cpi-mom.xlsx";
    const content = await fs.readFile(path.join(INFLATION_RAW_ROOT, "geostat-cpi", vintage, language, file));
    return readGeostatCpiCategories(content, role, language);
  })();
  parsed.set(key, pending);
  return pending;
}

describe("readGeostatCpiCategories", () => {
  it("reads twelve divisions and forty-three subgroups", async () => {
    const series = await categories("en", "yoy");
    expect(series.filter((row) => row.level === 2)).toHaveLength(12);
    expect(series.filter((row) => row.level === 3)).toHaveLength(43);
  });

  it("keeps Geostat's own labels per language", async () => {
    const en = await categories("en", "yoy");
    const ka = await categories("ka", "yoy");
    expect(en.find((row) => row.coicopCode === "7" && row.level === 2)?.label).toBe("Transport");
    expect(ka.find((row) => row.coicopCode === "7" && row.level === 2)?.label).toBe("ტრანსპორტი");
    expect(en.map((row) => `${row.level}:${row.coicopCode}`)).toEqual(ka.map((row) => `${row.level}:${row.coicopCode}`));
  });

  it("rebases the =100 index to percentage change", async () => {
    const series = await categories("en", "yoy");
    const transport = series.find((row) => row.coicopCode === "7" && row.level === 2)!;
    const last = transport.cells.at(-1)!;
    expect(periodKey(last.period)).toBe("2026-08");
    expect(Number(last.value)).toBeCloseTo(15.2, 1);
  });

  it("tolerates discontinued and late-starting categories", async () => {
    const series = await categories("en", "yoy");
    const postal = series.find((row) => row.coicopCode === "81")!;
    expect(periodKey(postal.cells.at(-1)!.period)).toBe("2011-12");
    const holidays = series.find((row) => row.coicopCode === "96")!;
    expect(periodKey(holidays.cells[0]!.period)).toBe("2020-01");
  });

  it("keeps interior gaps as absent months rather than shifting later values", async () => {
    const series = await categories("en", "yoy");
    const insurance = series.find((row) => row.coicopCode === "125")!;
    const periods = insurance.cells.map((cell) => cell.period);
    expect(periods).toEqual([...periods].sort((a, b) => a - b));
    expect(new Set(periods).size).toBe(periods.length);
    expect(periods.length).toBeLessThan(periods.at(-1)! - periods[0]! + 1);
  });

  it("starts monthly change a year before annual change", async () => {
    const yoy = await categories("en", "yoy");
    const mom = await categories("en", "mom");
    const first = (rows: typeof yoy) => periodKey(rows.find((row) => row.coicopCode === "7" && row.level === 2)!.cells[0]!.period);
    expect(first(yoy)).toBe("2005-01");
    expect(first(mom)).toBe("2004-01");
  });
});

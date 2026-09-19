import path from "node:path";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { readGeostatBasketWeights } from "../../../lib/data/inflation/readBasketWeights";
import {
  BASKET_WEIGHTS_ROOT,
  latestBasketWeightVintage,
  readVerifiedBasketWeightFiles,
} from "../../../lib/data/inflation/basketWeightFiles";

async function workbook(language: "en" | "ka") {
  const vintage = await latestBasketWeightVintage();
  const files = await readVerifiedBasketWeightFiles(path.join(BASKET_WEIGHTS_ROOT, vintage));
  return files.find((file) => file.language === language)!.content;
}

const english = () => workbook("en");

describe("readGeostatBasketWeights", () => {
  // The Georgian twin is archived to prove identical values, so it has to be
  // readable, not just hashable: its sheet name and headers are Georgian.
  it("reads the Georgian twin to the same numbers", async () => {
    const en = readGeostatBasketWeights(await english());
    const ka = readGeostatBasketWeights(await workbook("ka"), "ka");
    expect(ka.map((row) => `${row.level}:${row.coicopCode}`)).toEqual(en.map((row) => `${row.level}:${row.coicopCode}`));
    expect(ka.map((row) => [...row.byYear])).toEqual(en.map((row) => [...row.byYear]));
  });

  it("reads twelve divisions and forty-one subgroups", async () => {
    const rows = readGeostatBasketWeights(await english());
    expect(rows.filter((row) => row.level === 2)).toHaveLength(12);
    expect(rows.filter((row) => row.level === 3)).toHaveLength(41);
  });

  it("covers 2012 to the current year", async () => {
    const rows = readGeostatBasketWeights(await english());
    const years = [...rows.find((row) => row.coicopCode === "1" && row.level === 2)!.byYear.keys()];
    expect(Math.min(...years)).toBe(2012);
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2026);
  });

  it("converts fractions to percentages", async () => {
    const rows = readGeostatBasketWeights(await english());
    const food = rows.find((row) => row.coicopCode === "1" && row.level === 2)!;
    expect(Number(food.byYear.get(2026))).toBeCloseTo(33.6, 1);
  });

  it("sums each level to 100 percent in every year", async () => {
    const rows = readGeostatBasketWeights(await english());
    const years = [...rows[0]!.byYear.keys()];
    for (const level of [2, 3] as const) {
      for (const year of years) {
        const total = rows
          .filter((row) => row.level === level)
          .reduce((sum, row) => sum.plus(row.byYear.get(year) ?? "0"), new Decimal(0));
        expect(Math.abs(total.minus(100).toNumber())).toBeLessThan(0.001);
      }
    }
  });

  it("omits the two subgroups that ended before weights began", async () => {
    const rows = readGeostatBasketWeights(await english());
    expect(rows.some((row) => row.level === 3 && row.coicopCode === "42")).toBe(false);
    expect(rows.some((row) => row.level === 3 && row.coicopCode === "81")).toBe(false);
  });
});

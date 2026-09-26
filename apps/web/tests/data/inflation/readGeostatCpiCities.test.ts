import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { periodKey } from "../../../lib/data/inflation/periods";
import { readGeostatCpiCitySheets, readGeostatCpiFile } from "../../../lib/data/inflation/readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage } from "../../../lib/data/inflation/sourceFiles";

// One parse per workbook: each costs about three seconds.
const buffers = new Map<string, Promise<Buffer>>();
function workbook(language: "en" | "ka", file: string): Promise<Buffer> {
  const key = `${language}/${file}`;
  if (!buffers.has(key)) {
    buffers.set(key, latestCpiVintage().then((vintage) => fs.readFile(path.join(INFLATION_RAW_ROOT, "geostat-cpi", vintage, language, file))));
  }
  return buffers.get(key)!;
}
const EN_CITIES = ["Tbilisi", "Kutaisi", "Batumi", "Gori", "Telavi", "Zugdidi"];
const first = (cells: { period: number }[]) => periodKey(cells[0]!.period);

describe("readGeostatCpiCitySheets", () => {
  it("reads Total and the 12 divisions from every city sheet", async () => {
    const sheets = readGeostatCpiCitySheets(await workbook("en", "cpi-yoy.xlsx"), "yoy", "en", EN_CITIES);
    for (const city of EN_CITIES) {
      const series = sheets.get(city)!;
      expect(series.map((row) => row.seriesId)).toEqual(["cpi.headline", ...Array.from({ length: 12 }, (_, i) => `cpi.cat.${String(i + 1).padStart(2, "0")}`)]);
    }
  });

  it("rebases the =100 index to percentage change", async () => {
    const batumi = readGeostatCpiCitySheets(await workbook("en", "cpi-yoy.xlsx"), "yoy", "en", ["Batumi"]).get("Batumi")!;
    const total = batumi.find((row) => row.seriesId === "cpi.headline")!;
    expect(periodKey(total.cells.at(-1)!.period)).toBe("2026-08");
    expect(total.cells.at(-1)!.value).toBe("7.0857");
  });

  it("accepts Zugdidi's late starts instead of treating them as gaps", async () => {
    const yoy = readGeostatCpiCitySheets(await workbook("en", "cpi-yoy.xlsx"), "yoy", "en", ["Zugdidi"]).get("Zugdidi")!;
    const mom = readGeostatCpiCitySheets(await workbook("en", "cpi-mom.xlsx"), "mom", "en", ["Zugdidi"]).get("Zugdidi")!;
    const avg12 = readGeostatCpiCitySheets(await workbook("en", "cpi-avg12.xlsx"), "avg12", "en", ["Zugdidi"]).get("Zugdidi")!;
    expect(first(yoy[0]!.cells)).toBe("2016-12");
    expect(first(mom[0]!.cells)).toBe("2016-01");
    expect(avg12.map((row) => row.seriesId)).toEqual(["cpi.headline"]);
    expect(first(avg12[0]!.cells)).toBe("2017-12");
  });

  // Both readers share the national sheet, so they must agree on it exactly.
  it("reads the national sheet exactly as the national reader does", async () => {
    const content = await workbook("en", "cpi-yoy.xlsx");
    const city = readGeostatCpiCitySheets(content, "yoy", "en", ["Georgia"]).get("Georgia")![0]!;
    const national = readGeostatCpiFile(content, "yoy", "en")[0]!;
    expect(city.cells.map((cell) => `${cell.period}=${cell.value}`)).toEqual(national.cells.map((cell) => `${cell.period}=${cell.value}`));
  });

  it("carries identical values in the Georgian workbook", async () => {
    const en = readGeostatCpiCitySheets(await workbook("en", "cpi-yoy.xlsx"), "yoy", "en", ["Batumi"]).get("Batumi")!;
    const ka = readGeostatCpiCitySheets(await workbook("ka", "cpi-yoy.xlsx"), "yoy", "ka", ["ბათუმი"]).get("ბათუმი")!;
    expect(ka.map((row) => row.cells.map((cell) => cell.value).join("|"))).toEqual(en.map((row) => row.cells.map((cell) => cell.value).join("|")));
  });

  it("refuses a sheet that is not there", async () => {
    expect(() => readGeostatCpiCitySheets(Buffer.alloc(0), "yoy", "en", ["Rustavi"])).toThrow();
  });
});

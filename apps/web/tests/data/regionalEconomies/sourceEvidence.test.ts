import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  loadRegionalSourceEvidence,
  REGIONAL_SOURCE_SHEETS,
} from "../../../lib/data/regionalEconomies/sourceEvidence";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const years = Array.from({ length: 15 }, (_, index) => 2010 + index);
const codes = "ABCDEFGHIJKLMNOPQRST".split("");

async function sha256(file: string) {
  return createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

describe("regional economy source evidence", () => {
  test("preserves the three reviewed source identities and immutable bytes", async () => {
    const evidence = await loadRegionalSourceEvidence(repositoryRoot);

    expect(evidence.manifest.sources.map((source) => source.role)).toEqual([
      "regional_totals",
      "regional_activities",
      "national_validation",
    ]);

    const activities = evidence.manifest.sources[1];
    expect(await sha256(path.join(repositoryRoot, activities.file))).toBe(
      "88e337bd82a5232ea5260f011b11cb2d82c2cec5115fddbe92d14d1ff3945337",
    );
    expect((await fs.stat(path.join(repositoryRoot, activities.file))).size).toBe(99_089);

    const totals = evidence.manifest.sources[0];
    expect(await sha256(path.join(repositoryRoot, totals.file))).toBe(
      "dd2042dff5e2c44b98b4bb140163b5736cf5a71f4683b9e6a359373907d59c35",
    );
    expect((await fs.stat(path.join(repositoryRoot, totals.file))).size).toBe(13_871);

    const national = evidence.manifest.sources[2];
    expect(await sha256(path.join(repositoryRoot, national.file))).toBe(
      "21a576c9c20434a87bcb32047cd143eef2b8d3f3ff360442b420c76b0da27d34",
    );
    expect((await fs.stat(path.join(repositoryRoot, national.file))).size).toBe(50_098);
  });

  test("maps exactly the eleven reviewed regional activity sheets", async () => {
    const evidence = await loadRegionalSourceEvidence(repositoryRoot);

    expect(REGIONAL_SOURCE_SHEETS).toEqual([
      ["Tbilisi", "region.tbilisi"],
      ["Adjara A.R.", "region.adjara"],
      ["Guria", "region.guria"],
      ["Imereti", "region.imereti"],
      ["Kakheti", "region.kakheti"],
      ["Mtskheta-Mtianeti", "region.mtskheta_mtianeti"],
      ["Racha", "region.racha_lechkhumi_kvemo_svaneti"],
      ["Samegrelo", "region.samegrelo_zemo_svaneti"],
      ["Samtskhe", "region.samtskhe_javakheti"],
      ["Kvemo Kartli", "region.kvemo_kartli"],
      ["Shida Kartli", "region.shida_kartli"],
    ]);
    expect(evidence.activitySheets.map((sheet) => sheet.sheetName)).toEqual(
      REGIONAL_SOURCE_SHEETS.map(([sheetName]) => sheetName),
    );
    expect(evidence.activitySheets.map((sheet) => sheet.regionId)).toEqual(
      REGIONAL_SOURCE_SHEETS.map(([, regionId]) => regionId),
    );
  });

  test("proves the shared annual, activity, accounting and metadata contract", async () => {
    const evidence = await loadRegionalSourceEvidence(repositoryRoot);

    for (const sheet of evidence.activitySheets) {
      expect(sheet.classification).toBe("NACE rev. 2");
      expect(sheet.years).toEqual(years);
      expect(sheet.activities.map((activity) => activity.code)).toEqual(codes);
      expect(sheet.activities.map((activity) => activity.officialName)).toEqual(
        evidence.sectors.map((sector) => sector.officialName),
      );
      expect(sheet.accountingRows).toEqual([
        { row: 23, label: "(=) GDP at basic prices" },
        { row: 24, label: "(+) Taxes on products" },
        { row: 25, label: "(-) Subsidies on products" },
        { row: 26, label: "(=) GDP at market prices" },
      ]);
      expect(sheet.lastUpdate).toBe("23.12.2025");
      expect(sheet.metadataUrl).toBe("https://www.geostat.ge/media/68649/0403_060225_EN.PDF");
      expect(sheet.cell(2010, 3).value).toMatch(/^-?\d+(?:\.\d+)?$/);
      expect(sheet.cell(2024, 26).locator).toBe(`${sheet.sheetName}!Q26 [2024]`);
    }
  });
});

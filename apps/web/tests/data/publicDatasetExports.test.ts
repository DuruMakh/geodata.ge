import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { loadServedSocialData } from "../../lib/data/social/importSocial";
import { loadServedUnemploymentRows } from "../../lib/data/unemployment/importUnemployment";
import { loadServedWagesData } from "../../lib/data/wages/importWages";
import { PUBLIC_DATASET_FILE_NAMES, preparePublicDatasets } from "../../lib/data/publicDatasetExports";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("public SEO dataset exports", () => {
  it("checks the written downloads and names a stale or missing file", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fiscal-public-data-"));
    tempRoots.push(root);
    const publicRoot = path.join(root, "public");
    await preparePublicDatasets({ repositoryRoot, publicRoot, mode: "write" });

    await expect(preparePublicDatasets({ repositoryRoot, publicRoot, mode: "check-output" })).resolves.toHaveLength(9);

    const target = path.join(publicRoot, "downloads", "data", "government-debt.csv");
    await writeFile(target, "year,family\n", "utf8");
    await expect(preparePublicDatasets({ repositoryRoot, publicRoot, mode: "check-output" })).rejects.toThrow("government-debt.csv");

    await rm(target);
    await expect(preparePublicDatasets({ repositoryRoot, publicRoot, mode: "check-output" })).rejects.toThrow("missing");
  });

  it("publishes deterministic BOM-prefixed national and municipal CSVs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fiscal-public-data-"));
    tempRoots.push(root);
    const publicRoot = path.join(root, "public");
    const validations = await preparePublicDatasets({ repositoryRoot, publicRoot, mode: "write" });

    expect(validations.map((row) => [row.datasetId, row.rowCount])).toEqual([
      // 286 actual 2004-2025 rows + 13 planned 2026 field rows (budget law, basis planned).
      ["national-expenditure", 299],
      ["national-revenue", 241],
      ["municipal-expenditure", 7865],
      ["government-debt", 126],
      ["general-government-balance", 37],
      ["population", 923],
      ["wages", 1929],
      ["unemployment", 3370],
      ["social-protection", 22087],
    ]);
    expect(validations.every((row) => row.status === "PASS")).toBe(true);

    const expenditure = await readFile(path.join(publicRoot, "downloads/data/national-expenditure.csv"));
    const revenue = await readFile(path.join(publicRoot, "downloads/data/national-revenue.csv"));
    const municipal = await readFile(path.join(publicRoot, "downloads/data/municipal-expenditure.csv"));
    const debt = await readFile(path.join(publicRoot, "downloads/data/government-debt.csv"));
    const deficit = await readFile(path.join(publicRoot, "downloads/data/general-government-balance.csv"));

    for (const bytes of [expenditure, revenue, municipal, debt, deficit]) {
      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    }
    expect(expenditure.toString("utf8")).toContain("year,side,item_id,amount_gel,basis,source_id");
    expect(municipal.toString("utf8")).toContain(
      "year,entity_id,row_type,category_id,functional_code,amount_gel,basis,source_id",
    );
    expect(municipal.toString("utf8")).toContain("country.georgia,total,municipal.total");
    expect(debt.toString("utf8")).toContain("year,family,series_id,value,value_kind,status,source_id,snapshot_date,last_reviewed_at");
    expect(debt.toString("utf8")).toContain("projection_existing_portfolio");
    const deficitText = deficit.toString("utf8");
    expect(deficitText).toContain(
      "year,general_government_balance_pct_gdp,general_government_balance_gel,status,source_id,last_reviewed_at",
    );
    expect(deficitText).toContain(
      "2025,-1.455,-1526000000,actual,source.imf_weo_april_2026_general_government_balance,2026-09-04",
    );
    expect(deficitText).toContain(
      "2026,-2.327,-2672000000,projection,source.imf_weo_april_2026_general_government_balance,2026-09-04",
    );
  });

  it("names every file it writes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fiscal-public-data-"));
    tempRoots.push(root);
    const publicRoot = path.join(root, "public");
    const validations = await preparePublicDatasets({ repositoryRoot, publicRoot, mode: "write" });

    expect([...PUBLIC_DATASET_FILE_NAMES]).toEqual(validations.map((row) => `${row.datasetId}.csv`));
    expect(PUBLIC_DATASET_FILE_NAMES).toHaveLength(9);
  });

  describe("population, wages, unemployment and social-protection CSVs", () => {
    const FORBIDDEN = ["source_sheet", "source_cell", "source_workbook", "source_number_format"];
    const served = {
      population: async () => (await loadServedDemographyData()).facts.filter((fact) => fact.seriesId === SERIES.populationTotal).length,
      wages: async () => (await loadServedWagesData()).facts.length,
      unemployment: async () => (await loadServedUnemploymentRows()).facts.length,
      "social-protection": async () => (await loadServedSocialData()).facts.length,
    };
    const headers = {
      population: "series_id,geography_id,year,value,unit,estimate_basis,status,source_id,source_locator,last_reviewed_at",
      wages: "year,indicator_id,dimension,group_id,sector_id,value,published_value,unit,basis,value_status,source_id,last_reviewed_at",
      unemployment:
        "year,frequency,dimension,group_id,group_label_en,indicator_id,sex,unit,value,published_value,basis,value_status,methodology_epoch,role,source_id",
      "social-protection": "year,indicator_id,geography_id,value,unit,months,basis,value_status,source_id,last_reviewed_at",
    } as const;

    async function writeAll() {
      const root = await mkdtemp(path.join(tmpdir(), "fiscal-public-data-"));
      tempRoots.push(root);
      const publicRoot = path.join(root, "public");
      const validations = await preparePublicDatasets({ repositoryRoot, publicRoot, mode: "write" });
      return { publicRoot, validations };
    }

    it.each(Object.keys(headers) as (keyof typeof headers)[])(
      "%s.csv has a BOM, its columns, no source-cell columns and one row per served row",
      async (id) => {
        const { publicRoot, validations } = await writeAll();
        const bytes = await readFile(path.join(publicRoot, "downloads/data", `${id}.csv`));
        expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
        const [headerLine] = bytes.toString("utf8").slice(1).split("\r\n");
        expect(headerLine).toBe(headers[id]);
        for (const name of FORBIDDEN) expect(headerLine.split(",")).not.toContain(name);

        const rowCount = validations.find((row) => row.datasetId === id)?.rowCount;
        expect(rowCount).toBe(await served[id]());
      },
    );

    it("population.csv carries the row for municipality 47", async () => {
      const { publicRoot } = await writeAll();
      const text = await readFile(path.join(publicRoot, "downloads/data/population.csv"), "utf8");
      expect(text).toContain("\r\ndemography.population_total,47,2015,52692,");
    });

    it("unemployment.csv leaves sex blank where a file has none", async () => {
      const { publicRoot } = await writeAll();
      const lines = (await readFile(path.join(publicRoot, "downloads/data/unemployment.csv"), "utf8")).split("\r\n");
      expect(lines).toContain("2010,annual,national,georgia,Georgia,hired,,thousand_persons,709.95890019469152,710.0,actual,survey_estimate,ilo19_20,primary,geostat_lfs_annual_total");
    });

    it("two runs produce identical bytes", async () => {
      const first = await writeAll();
      const second = await writeAll();
      for (const name of PUBLIC_DATASET_FILE_NAMES) {
        const left = await readFile(path.join(first.publicRoot, "downloads/data", name));
        const right = await readFile(path.join(second.publicRoot, "downloads/data", name));
        expect(left.equals(right)).toBe(true);
      }
    });

    it.each(["population", "wages", "unemployment", "social-protection"])(
      "check-output reports content differs when one byte of %s.csv changes",
      async (id) => {
        const { publicRoot } = await writeAll();
        const target = path.join(publicRoot, "downloads/data", `${id}.csv`);
        const bytes = await readFile(target);
        bytes[bytes.length - 3] ^= 0x01;
        await writeFile(target, bytes);
        await expect(preparePublicDatasets({ repositoryRoot, publicRoot, mode: "check-output" })).rejects.toThrow(
          `${id}.csv: content differs`,
        );
      },
    );
  });

  it("check mode returns the same hashes without writing public files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fiscal-public-data-check-"));
    tempRoots.push(root);
    const validations = await preparePublicDatasets({ repositoryRoot, publicRoot: root, mode: "check" });

    expect(validations).toHaveLength(9);
    expect(new Set(validations.map((row) => row.sha256)).size).toBe(9);
    await expect(readFile(path.join(root, "downloads/data/national-expenditure.csv"))).rejects.toThrow();
  });
});

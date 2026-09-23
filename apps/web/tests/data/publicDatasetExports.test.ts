import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { preparePublicDatasets } from "../../lib/data/publicDatasetExports";

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

    await expect(preparePublicDatasets({ repositoryRoot, publicRoot, mode: "check-output" })).resolves.toHaveLength(5);

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
      ["national-expenditure", 286],
      ["national-revenue", 241],
      ["municipal-expenditure", 7865],
      ["government-debt", 126],
      ["general-government-balance", 37],
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

  it("check mode returns the same hashes without writing public files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fiscal-public-data-check-"));
    tempRoots.push(root);
    const validations = await preparePublicDatasets({ repositoryRoot, publicRoot: root, mode: "check" });

    expect(validations).toHaveLength(5);
    expect(new Set(validations.map((row) => row.sha256)).size).toBe(5);
    await expect(readFile(path.join(root, "downloads/data/national-expenditure.csv"))).rejects.toThrow();
  });
});

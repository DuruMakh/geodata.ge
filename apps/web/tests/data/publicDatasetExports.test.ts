import { readFile } from "node:fs/promises";
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
    ]);
    expect(validations.every((row) => row.status === "PASS")).toBe(true);

    const expenditure = await readFile(path.join(publicRoot, "downloads/data/national-expenditure.csv"));
    const revenue = await readFile(path.join(publicRoot, "downloads/data/national-revenue.csv"));
    const municipal = await readFile(path.join(publicRoot, "downloads/data/municipal-expenditure.csv"));
    const debt = await readFile(path.join(publicRoot, "downloads/data/government-debt.csv"));

    for (const bytes of [expenditure, revenue, municipal, debt]) {
      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    }
    expect(expenditure.toString("utf8")).toContain("year,side,item_id,amount_gel,basis,source_id");
    expect(municipal.toString("utf8")).toContain(
      "year,entity_id,row_type,category_id,functional_code,amount_gel,basis,source_id",
    );
    expect(municipal.toString("utf8")).toContain("country.georgia,total,municipal.total");
    expect(debt.toString("utf8")).toContain("year,family,series_id,value,value_kind,status,source_id,snapshot_date,last_reviewed_at");
    expect(debt.toString("utf8")).toContain("projection_existing_portfolio");
  });

  it("check mode returns the same hashes without writing public files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fiscal-public-data-check-"));
    tempRoots.push(root);
    const validations = await preparePublicDatasets({ repositoryRoot, publicRoot: root, mode: "check" });

    expect(validations).toHaveLength(4);
    expect(new Set(validations.map((row) => row.sha256)).size).toBe(4);
    await expect(readFile(path.join(root, "downloads/data/national-expenditure.csv"))).rejects.toThrow();
  });
});

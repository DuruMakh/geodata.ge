import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { expect, test } from "vitest";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import { buildReport } from "../../../lib/data/procurement/report";

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "procurement-report-"));
  const clean = path.join(dataDir, "clean");
  fs.mkdirSync(clean);
  const gz = (name: string, rows: (string | number)[][]) => fs.writeFileSync(path.join(clean, name), gzipSync(serializeBomCsvRows(rows)));
  gz("tenders_2016.csv.gz", [["tender_number", "supplier_code"], ["T1", "111111111"], ["T2", "p_0123456789abcdef"], ["T3", ""]]);
  gz("purchases_2016.csv.gz", [["registration_number", "contract_value", "currency", "contract_date"], ["P1", "10.5", "GEL", "2016-03-01"], ["P2", "4", "USD", "2016-08-14"], ["P3", "2", "GEL", "2016-05-02"]]);
  fs.writeFileSync(path.join(clean, "stats.json"), JSON.stringify([
    { file: "originals/main_2016.xlsx", rows: 3, duplicateIds: 0, wonWithoutSupplier: 0, currencies: { GEL: 2 } },
    { file: "originals/simpified_2016.xlsx", rows: 3, duplicateIds: 1, wonWithoutSupplier: 0, currencies: { GEL: 2, USD: 1 } },
  ]));
  fs.writeFileSync(path.join(dataDir, "control-totals.csv"), serializeBomCsvRows([
    ["year", "tenders_announced", "simplified_total_gel", "report_file", "page"],
    [2016, 4, "12.5", "reports/spa_report_2016.pdf", 7],
  ]));
  fs.mkdirSync(path.join(dataDir, "registry"));
  fs.writeFileSync(path.join(dataDir, "registry", "status.csv"), "﻿code,status,retrieved_at\n111111111,failed,t1\n111111111,found,t2\n222222222,not_found,t3\n");
  return dataDir;
}

test("each year's tender rows are compared with the agency's count", async () => {
  const report = await buildReport(fixture());
  expect(report).toMatch(/\| 2016 \| 3 \| 4 \| −1 \|/);
});

test("direct-purchase GEL totals are compared with the agency's total, other currencies kept apart", async () => {
  const report = await buildReport(fixture());
  expect(report).toMatch(/\| 2016 \| 3 \| 12\.5 \| 12\.5 \| 0 \|/);
  expect(report).toContain("USD 1");
});

test("the registry coverage counts each company by its latest status", async () => {
  const report = await buildReport(fixture());
  expect(report).toContain("2 companies looked up: 1 found, 1 not found, 0 failed");
});

test("the report states the last direct-purchase date found", async () => {
  const report = await buildReport(fixture());
  expect(report).toContain("The last direct purchase in the files is dated 2016-08-14");
});

test("the report is written to data-report.md", async () => {
  const dataDir = fixture();
  const report = await buildReport(dataDir);
  expect(fs.readFileSync(path.join(dataDir, "data-report.md"), "utf8")).toBe(report);
});

test("a personal number anywhere in the cleaned data stops the report and names the file", async () => {
  const dataDir = fixture();
  fs.writeFileSync(path.join(dataDir, "clean", "suppliers.csv.gz"), gzipSync("supplier_code\n01019067930\n"));
  await expect(buildReport(dataDir)).rejects.toThrow("suppliers.csv.gz");
});

test("a personal number in a saved registry answer stops the report too", async () => {
  const dataDir = fixture();
  fs.mkdirSync(path.join(dataDir, "registry", "raw"));
  fs.writeFileSync(path.join(dataDir, "registry", "raw", "111111111.json"), JSON.stringify({ id: "01019067930" }));
  await expect(buildReport(dataDir)).rejects.toThrow("111111111.json");
});

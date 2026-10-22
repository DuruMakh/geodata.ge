import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { expect, test } from "vitest";
import { cleanFile } from "../../../lib/data/procurement/clean";
import { PURCHASE_COLUMNS, TENDER_COLUMNS } from "../../../lib/data/procurement/columns";
import type { SourceFile } from "../../../lib/data/procurement/paths";

const SECRET = "c".repeat(64);
const PERSON = "22222222222";
const COMPANY = "111111111";
const SIGNED = "ხელშეკრულება დადებულია";

type Cell = string | number | boolean | null;

async function writeWorkbook(file: string, header: readonly string[], rows: readonly Cell[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow([...header]);
  for (const row of rows) sheet.addRow(row);
  await workbook.xlsx.writeFile(file);
}

/** A row in file order from a few named source columns; the rest empty. */
const tenderRow = (values: Record<string, Cell>) => TENDER_COLUMNS.map(column => values[column.source] ?? null);
const tenderHeader = () => TENDER_COLUMNS.map(column => (column.source === "გარანტიის ოდენობა" ? "გარანტიის ოდენობა\t" : column.source));

function setup(kind: SourceFile["kind"]) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "procurement-clean-"));
  fs.mkdirSync(path.join(dataDir, "originals"));
  const name = kind === "tenders" ? "main_2016" : "simpified_2016";
  const file: SourceFile = { kind, year: 2016, url: `https://example.test/${name}.zip`, zipPath: `originals/${name}.zip`, xlsxPath: `originals/${name}.xlsx` };
  return { dataDir, file, xlsx: path.join(dataDir, file.xlsxPath) };
}

const readClean = (dataDir: string, name: string) => {
  const text = gunzipSync(fs.readFileSync(path.join(dataDir, "clean", name))).toString("utf8");
  return { text, rows: parse(text, { columns: true, bom: true }) as Record<string, string>[] };
};

const tenders = [
  tenderRow({ "რეგისტრაციის კოდი": "SPA1", "სტატუსი": SIGNED, "ვალუტა": "GEL", "საბოლოო ღირებულება": "100.00", "მიმწოდებლის Id": COMPANY, "შემსყიდველის კოდი": "204000000", "დამატებითი ინფორმაცია": "long text" }),
  tenderRow({ "რეგისტრაციის კოდი": "SPA2", "სტატუსი": SIGNED, "ვალუტა": "USD", "საბოლოო ღირებულება": "5.00", "მიმწოდებლის Id": PERSON }),
  tenderRow({ "რეგისტრაციის კოდი": "SPA2", "სტატუსი": SIGNED, "ვალუტა": "GEL", "მიმწოდებლის Id": null }),
  tenderRow({ "რეგისტრაციის კოდი": "SPA3", "სტატუსი": "არ შედგა" }).slice(0, TENDER_COLUMNS.length - 3),
];

test("a tender file is cleaned into its 26 kept fields with personal numbers replaced", async () => {
  const { dataDir, file, xlsx } = setup("tenders");
  await writeWorkbook(xlsx, tenderHeader(), tenders);
  await cleanFile(file, dataDir, SECRET);
  const { text, rows } = readClean(dataDir, "tenders_2016.csv.gz");
  expect(text.startsWith("﻿")).toBe(true);
  expect(Object.keys(rows[0])).toHaveLength(26);
  expect(Object.keys(rows[0])).not.toContain("additional_information");
  expect(text).not.toContain("long text");
  expect(text).not.toContain(PERSON);
  expect(rows[0].supplier_code).toBe(COMPANY);
  expect(rows[1].supplier_code).toMatch(/^p_[0-9a-f]{16}$/);
});

test("a row shorter than the header is kept with empty trailing fields", async () => {
  const { dataDir, file, xlsx } = setup("tenders");
  await writeWorkbook(xlsx, tenderHeader(), tenders);
  await cleanFile(file, dataDir, SECRET);
  const { rows } = readClean(dataDir, "tenders_2016.csv.gz");
  expect(rows).toHaveLength(4);
  expect(rows[3]).toMatchObject({ tender_number: "SPA3", supplier_code: "", supplier_country: "" });
});

test("the clean step counts duplicates, contracts without a supplier and currencies", async () => {
  const { dataDir, file, xlsx } = setup("tenders");
  await writeWorkbook(xlsx, tenderHeader(), tenders);
  expect(await cleanFile(file, dataDir, SECRET)).toEqual({
    file: "originals/main_2016.xlsx",
    rows: 4,
    duplicateIds: 1,
    wonWithoutSupplier: 1,
    currencies: { GEL: 2, USD: 1 },
  });
});

test("a renamed column stops the clean step and names both headers", async () => {
  const { dataDir, file, xlsx } = setup("tenders");
  const header = tenderHeader().map(name => (name === "ვალუტა" ? "ვალუტის კოდი" : name));
  await writeWorkbook(xlsx, header, tenders);
  await expect(cleanFile(file, dataDir, SECRET)).rejects.toThrow(/ვალუტა[\s\S]*ვალუტის კოდი/);
  expect(fs.existsSync(path.join(dataDir, "clean", "tenders_2016.csv.gz"))).toBe(false);
});

test("a direct-purchase file keeps all 25 fields and replaces personal numbers", async () => {
  const { dataDir, file, xlsx } = setup("purchases");
  const row = (values: Record<string, Cell>) => PURCHASE_COLUMNS.map(column => values[column.source] ?? null);
  await writeWorkbook(xlsx, PURCHASE_COLUMNS.map(column => column.source), [
    row({ "რეგისტრაციის ნომერი": "CMR1", "კონტრაქტის ღირებულება": 50, "ვალუტა": "GEL", "მიმწოდებელის კოდი": PERSON }),
    row({ "რეგისტრაციის ნომერი": "CMR2", "მიმწოდებელი": `ფ/პ (პ/ნ ${PERSON})`, "მიმწოდებელის კოდი": `09 / ${PERSON}-5`, "მთავარი დოკუმენტი": `# ${PERSON}` }),
  ]);
  await cleanFile(file, dataDir, SECRET);
  const { text, rows } = readClean(dataDir, "purchases_2016.csv.gz");
  expect(Object.keys(rows[0])).toHaveLength(25);
  expect(rows[0]).toMatchObject({ registration_number: "CMR1", contract_value: "50", currency: "GEL" });
  expect(rows[1]).toMatchObject({ supplier_name: "ფ/პ (პ/ნ [removed])", main_document: "# [removed]" });
  expect(rows[1].supplier_code).toMatch(/^p_[0-9a-f]{16}$/);
  expect(text).not.toContain(PERSON);
});

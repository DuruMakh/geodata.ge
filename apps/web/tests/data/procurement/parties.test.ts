import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { parse } from "csv-parse/sync";
import { expect, test } from "vitest";
import { buildParties, companyLookupQueue } from "../../../lib/data/procurement/parties";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";

const SIGNED = "ხელშეკრულება დადებულია";

function writeClean(dataDir: string, name: string, rows: Record<string, string>[]) {
  const header = Object.keys(rows[0]);
  fs.mkdirSync(path.join(dataDir, "clean"), { recursive: true });
  fs.writeFileSync(path.join(dataDir, "clean", name), gzipSync(serializeBomCsvRows([header, ...rows.map(r => header.map(h => r[h]))])));
}

const tender = (values: Partial<Record<string, string>>) => ({
  tender_number: "", status: SIGNED, buyer_code: "204000000", buyer_name: "Buyer", supplier_code: "", supplier_name: "",
  contract_value_start: "", contract_value_final: "", currency: "", ...values,
});
const purchase = (values: Partial<Record<string, string>>) => ({
  registration_number: "", buyer_code: "204000000", buyer_name: "Buyer", supplier_code: "", supplier_name: "", contract_value: "", currency: "", ...values,
});

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "procurement-parties-"));
  writeClean(dataDir, "tenders_2016.csv.gz", [
    tender({ tender_number: "T1", supplier_code: "111111111", supplier_name: "Alpha", contract_value_final: "100.10", currency: "GEL" }),
    tender({ tender_number: "T2", supplier_code: "333333333", supplier_name: "Gamma", contract_value_start: "40", currency: "GEL" }),
    tender({ tender_number: "T3", supplier_code: "444444444", supplier_name: "Delta", currency: "GEL" }),
    tender({ tender_number: "T4", status: "არ შედგა" }),
    tender({ tender_number: "T5", supplier_code: "p_0123456789abcdef", supplier_name: "A person", contract_value_final: "999999", currency: "GEL" }),
  ]);
  writeClean(dataDir, "purchases_2017.csv.gz", [
    purchase({ registration_number: "P1", supplier_code: "111111111", supplier_name: "Alpha Ltd", contract_value: "7", currency: "USD" }),
    purchase({ registration_number: "P2", supplier_code: "333333333", supplier_name: "Gamma", contract_value: "60.5", currency: "GEL" }),
  ]);
  return dataDir;
}

const readGz = (file: string) => parse(gunzipSync(fs.readFileSync(file)), { columns: true, bom: true }) as Record<string, string>[];

test("a supplier gets one row per year and currency, and currencies are never added together", async () => {
  const dataDir = fixture();
  await buildParties(dataDir);
  const alpha = readGz(path.join(dataDir, "clean", "suppliers.csv.gz")).filter(r => r.supplier_code === "111111111");
  expect(alpha).toEqual([
    { supplier_code: "111111111", names: "Alpha | Alpha Ltd", first_year: "2016", last_year: "2017", tenders_won: "1", purchases_won: "0", year: "2016", currency: "GEL", amount: "100.1" },
    { supplier_code: "111111111", names: "Alpha | Alpha Ltd", first_year: "2016", last_year: "2017", tenders_won: "0", purchases_won: "1", year: "2017", currency: "USD", amount: "7" },
  ]);
});

test("a tender with only a start value uses it, and one with no value is counted with an empty amount", async () => {
  const dataDir = fixture();
  await buildParties(dataDir);
  const suppliers = readGz(path.join(dataDir, "clean", "suppliers.csv.gz"));
  expect(suppliers.find(r => r.supplier_code === "333333333" && r.year === "2016")).toMatchObject({ tenders_won: "1", amount: "40" });
  expect(suppliers.find(r => r.supplier_code === "444444444")).toMatchObject({ tenders_won: "1", amount: "" });
});

test("a buyer counts tenders announced, tenders with a contract and direct purchases", async () => {
  const dataDir = fixture();
  expect(await buildParties(dataDir)).toEqual({ suppliers: 4, buyers: 1 });
  const buyer2016 = readGz(path.join(dataDir, "clean", "buyers.csv.gz")).filter(r => r.year === "2016");
  expect(buyer2016.find(r => r.currency === "GEL")).toMatchObject({ buyer_code: "204000000", names: "Buyer", tenders_announced: "4", tenders_contracted: "4", purchases: "0", amount: "1000139.1" });
  expect(buyer2016.find(r => r.currency === "")).toMatchObject({ tenders_announced: "1", tenders_contracted: "0", amount: "" });
});

test("the lookup queue holds company codes only, largest GEL winners first", async () => {
  const dataDir = fixture();
  await buildParties(dataDir);
  // 333333333 won 100.5 GEL in all, 111111111 won 100.1 GEL (its USD purchase does not count), 444444444 no GEL amount.
  expect(await companyLookupQueue(dataDir)).toEqual(["333333333", "111111111", "444444444"]);
});

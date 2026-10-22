import fs from "node:fs";
import path from "node:path";
import { createGunzip, gzipSync } from "node:zlib";
import { parse } from "csv-parse";
import Decimal from "decimal.js";
import { serializeBomCsvRows } from "../csvEscape";

type Row = Record<string, string>;
type Group = { counts: Record<string, number>; amount: Decimal | null };
type Party = { names: Set<string>; groups: Map<string, Group> };

const SUPPLIER_COUNTS = ["tenders_won", "purchases_won"] as const;
const BUYER_COUNTS = ["tenders_announced", "tenders_contracted", "purchases"] as const;

async function* readClean(file: string): AsyncGenerator<Row> {
  yield* fs.createReadStream(file).pipe(createGunzip()).pipe(parse({ bom: true, columns: true }));
}

function cleanFiles(dataDir: string) {
  return fs.readdirSync(path.join(dataDir, "clean"))
    .map(name => /^(tenders|purchases)_(\d{4})\.csv\.gz$/.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(match => ({ file: path.join(dataDir, "clean", match[0]), kind: match[1], year: match[2] }))
    .sort((a, b) => a.year.localeCompare(b.year) || a.kind.localeCompare(b.kind));
}

function add(parties: Map<string, Party>, code: string, name: string, year: string, currency: string, value: string, count: string): Group {
  const party = parties.get(code) ?? { names: new Set(), groups: new Map() };
  parties.set(code, party);
  if (name) party.names.add(name);
  const key = `${year}\u0001${currency}`;
  const group = party.groups.get(key) ?? { counts: {}, amount: null };
  party.groups.set(key, group);
  group.counts[count] = (group.counts[count] ?? 0) + 1;
  if (value) group.amount = (group.amount ?? new Decimal(0)).plus(value);
  return group;
}

function serialize(codeField: string, counts: readonly string[], parties: Map<string, Party>) {
  const rows: (string | number)[][] = [];
  for (const [code, party] of [...parties].sort(([a], [b]) => a.localeCompare(b))) {
    const keys = [...party.groups.keys()].sort();
    const years = keys.map(key => key.split("\u0001")[0]);
    for (const key of keys) {
      const [year, currency] = key.split("\u0001");
      const group = party.groups.get(key)!;
      rows.push([code, [...party.names].join(" | "), years[0], years.at(-1)!, ...counts.map(c => group.counts[c] ?? 0), year, currency, group.amount?.toString() ?? ""]);
    }
  }
  return gzipSync(serializeBomCsvRows([[codeField, "names", "first_year", "last_year", ...counts, "year", "currency", "amount"], ...rows]));
}

/**
 * Builds clean/suppliers.csv.gz and clean/buyers.csv.gz: one row per party, year and currency. A tender's amount is
 * its final contract value, else its start value; a direct purchase's is its contract value.
 */
export async function buildParties(dataDir: string): Promise<{ suppliers: number; buyers: number }> {
  const suppliers = new Map<string, Party>();
  const buyers = new Map<string, Party>();
  for (const { file, kind, year } of cleanFiles(dataDir)) {
    for await (const row of readClean(file)) {
      const value = kind === "tenders" ? row.contract_value_final || row.contract_value_start : row.contract_value;
      const won = row.supplier_code !== "";
      if (won) add(suppliers, row.supplier_code, row.supplier_name, year, row.currency, value, kind === "tenders" ? "tenders_won" : "purchases_won");
      if (!row.buyer_code) continue;
      if (kind === "purchases") add(buyers, row.buyer_code, row.buyer_name, year, row.currency, value, "purchases");
      else {
        const group = add(buyers, row.buyer_code, row.buyer_name, year, row.currency, won ? value : "", "tenders_announced");
        if (won) group.counts.tenders_contracted = (group.counts.tenders_contracted ?? 0) + 1;
      }
    }
  }
  fs.writeFileSync(path.join(dataDir, "clean", "suppliers.csv.gz"), serialize("supplier_code", SUPPLIER_COUNTS, suppliers));
  fs.writeFileSync(path.join(dataDir, "clean", "buyers.csv.gz"), serialize("buyer_code", BUYER_COUNTS, buyers));
  return { suppliers: suppliers.size, buyers: buyers.size };
}

/** 9-digit company codes, largest total GEL won first (ties by code); companies with no GEL amount last. */
export async function companyLookupQueue(dataDir: string): Promise<string[]> {
  const totals = new Map<string, Decimal | null>();
  for await (const row of readClean(path.join(dataDir, "clean", "suppliers.csv.gz"))) {
    if (!/^\d{9}$/.test(row.supplier_code)) continue;
    const previous = totals.get(row.supplier_code) ?? null;
    const gel = row.currency === "GEL" && row.amount ? new Decimal(row.amount) : null;
    totals.set(row.supplier_code, gel ? (previous ?? new Decimal(0)).plus(gel) : previous);
  }
  return [...totals].sort(([codeA, a], [codeB, b]) => {
    if (a && b && !a.equals(b)) return b.comparedTo(a);
    if (a && !b) return -1;
    if (b && !a) return 1;
    return codeA.localeCompare(codeB);
  }).map(([code]) => code);
}

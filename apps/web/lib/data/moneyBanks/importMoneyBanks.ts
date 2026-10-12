import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { moneyBanksFactKey, type ClientMoneyBanksFact, type MoneyBanksAcceptance, type MoneyBanksFact } from "./types";
import { moneyBanksDisplayDecimals, validateMoneyBanksFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];

export async function loadMoneyBanksFacts(): Promise<MoneyBanksFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/money-banks-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/money-banks-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as MoneyBanksAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Money and banks acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Money and banks canonical fields missing");
  const facts: MoneyBanksFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as MoneyBanksFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as MoneyBanksFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as MoneyBanksFact["valueStatus"],
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateMoneyBanksFacts(facts);
  if (facts.length !== report.observations) throw new Error("Money and banks acceptance count mismatch");
  return facts;
}

export function assertMoneyBanksParity(csv: readonly MoneyBanksFact[], mirror: readonly MoneyBanksFact[]): void {
  validateMoneyBanksFacts(csv);
  validateMoneyBanksFacts(mirror);
  const normalized = (facts: readonly MoneyBanksFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Money and banks", normalized(csv), normalized(mirror), moneyBanksFactKey);
}

let servedPromise: Promise<{ facts: MoneyBanksFact[] }> | null = null;
export function loadServedMoneyBanksData(): Promise<{ facts: MoneyBanksFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadMoneyBanksFacts();
    if (resolveServedDataSource() === "db") {
      const { loadMoneyBanksFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadMoneyBanksFactsFromDb();
      assertMoneyBanksParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** Client values are the figures NBG prints (published precision): amounts in lari, ratios and rates in percent. Exact stored values stay server-side. */
export function toClientMoneyBanksFact(fact: MoneyBanksFact): ClientMoneyBanksFact {
  const { year, indicatorId, sourceId, valueStatus } = fact;
  const published = Number(fact.publishedValue);
  const decimals = moneyBanksDisplayDecimals(indicatorId);
  return fact.unit === "gel_million"
    ? { year, indicatorId, sourceId, valueStatus, value: published * 1_000_000, unit: "gel", decimals }
    : { year, indicatorId, sourceId, valueStatus, value: published, unit: "percent", decimals };
}

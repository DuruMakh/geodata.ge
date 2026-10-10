import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { currentAccountFactKey, type CurrentAccountAcceptance, type CurrentAccountFact } from "./types";
import { validateCurrentAccountFacts } from "./currentAccountValidation";

export type ClientCurrentAccountFact = Pick<CurrentAccountFact, "seriesId" | "year" | "flow"> & { valueUsd: number };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function loadCurrentAccountFacts(): Promise<CurrentAccountFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/current-account-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/current-account-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as CurrentAccountAcceptance;
  if (report.status !== "passed" || report.scope !== "annual_current_account" || report.canonicalSha256 !== hash(csv)) throw new Error("Current account acceptance/canonical fingerprint mismatch");
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
  const required = ["series_id", "year", "flow", "value_usd", "unit", "basis", "source_id", "source_sheet", "source_cells", "source_unit", "vintage", "last_reviewed_at"];
  if (!rows.length || rows.some(row => required.some(field => !(field in row)))) throw new Error("Current account canonical fields missing");
  const facts: CurrentAccountFact[] = rows.map(row => ({
    seriesId: row.series_id as CurrentAccountFact["seriesId"], year: Number(row.year), flow: row.flow as CurrentAccountFact["flow"], valueUsd: new Decimal(row.value_usd).toFixed(), unit: row.unit as "usd", basis: row.basis as "actual",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCells: row.source_cells, sourceUnit: row.source_unit as "million_usd", vintage: row.vintage, lastReviewedAt: row.last_reviewed_at,
  }));
  validateCurrentAccountFacts(facts);
  if (facts.length !== report.observations) throw new Error("Current account acceptance counts mismatch");
  return facts;
}

export function assertCurrentAccountParity(csv: readonly CurrentAccountFact[], mirror: readonly CurrentAccountFact[]): void {
  const normalize = (facts: readonly CurrentAccountFact[]) => facts.map(fact => ({ ...fact, valueUsd: new Decimal(fact.valueUsd).toFixed() }));
  assertSameServedRows("Current account facts", normalize(csv), normalize(mirror), currentAccountFactKey);
}

let servedPromise: Promise<CurrentAccountFact[]> | null = null;
export function loadServedCurrentAccountFacts(): Promise<CurrentAccountFact[]> {
  servedPromise ??= (async () => {
    const csv = await loadCurrentAccountFacts();
    if (resolveServedDataSource() === "csv") return csv;
    const { loadCurrentAccountFactsFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadCurrentAccountFactsFromDb();
    assertCurrentAccountParity(csv, mirror);
    return mirror;
  })();
  return servedPromise;
}

export function toClientCurrentAccountFacts(facts: readonly CurrentAccountFact[]): ClientCurrentAccountFact[] {
  return facts.map(({ seriesId, year, flow, valueUsd }) => ({ seriesId, year, flow, valueUsd: Number(valueUsd) }));
}

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import {
  TAX_BREAKS_REFUNDS_CSV_PATH, TAX_BREAKS_REFUNDS_REPORT_PATH, taxBreaksRefundsFactKey,
  type ClientTaxBreaksRefundsFact, type TaxBreaksRefundsAcceptance, type TaxBreaksRefundsFact,
} from "./types";
import { validateTaxBreaksRefundsFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
const MILLION = new Decimal(1_000_000);

export async function loadTaxBreaksRefundsFacts(): Promise<TaxBreaksRefundsFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..", TAX_BREAKS_REFUNDS_CSV_PATH)),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..", TAX_BREAKS_REFUNDS_REPORT_PATH), "utf8"),
  ]);
  const report = JSON.parse(reportText) as TaxBreaksRefundsAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Tax breaks and refunds acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Tax breaks and refunds canonical fields missing");
  const facts: TaxBreaksRefundsFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as TaxBreaksRefundsFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as "gel_million", basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateTaxBreaksRefundsFacts(facts);
  if (facts.length !== report.observations) throw new Error("Tax breaks and refunds acceptance count mismatch");
  return facts;
}

export function assertTaxBreaksRefundsParity(csv: readonly TaxBreaksRefundsFact[], mirror: readonly TaxBreaksRefundsFact[]): void {
  validateTaxBreaksRefundsFacts(csv);
  validateTaxBreaksRefundsFacts(mirror);
  const normalized = (facts: readonly TaxBreaksRefundsFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Tax breaks and refunds", normalized(csv), normalized(mirror), taxBreaksRefundsFactKey);
}

let servedPromise: Promise<{ facts: TaxBreaksRefundsFact[] }> | null = null;
export function loadServedTaxBreaksRefundsData(): Promise<{ facts: TaxBreaksRefundsFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadTaxBreaksRefundsFacts();
    if (resolveServedDataSource() === "db") {
      const { loadTaxBreaksRefundsFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadTaxBreaksRefundsFactsFromDb();
      assertTaxBreaksRefundsParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** Client values are lari at the source's full precision, so a share of GDP divides the figure the Ministry stored. */
export function toClientTaxBreaksRefundsFact(fact: TaxBreaksRefundsFact): ClientTaxBreaksRefundsFact {
  const { year, indicatorId, sourceId } = fact;
  return { year, indicatorId, sourceId, value: new Decimal(fact.value).times(MILLION).toNumber(), unit: "gel" };
}

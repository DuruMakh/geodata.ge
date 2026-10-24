import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { afterEach, expect, test, vi } from "vitest";
import { loadTaxBreaksRefundsFactsFromMirror, taxBreaksRefundsMirrorCreateRows } from "../../../lib/db/mirrorRows";
import { assertTaxBreaksRefundsParity, loadTaxBreaksRefundsFacts, toClientTaxBreaksRefundsFact } from "../../../lib/data/taxBreaksRefunds/importTaxBreaksRefunds";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { TAX_BREAKS_REFUNDS_PUBLIC_SOURCES, taxBreaksRefundsSourceDocumentId } from "../../../lib/data/taxBreaksRefunds/types";

const root = path.resolve(process.cwd(), "../..");
afterEach(() => { vi.restoreAllMocks(); });

test("the loader serves the 123 accepted rows", async () => {
  const facts = await loadTaxBreaksRefundsFacts();
  expect(facts).toHaveLength(123);
  expect(facts.find(f => f.indicatorId === "tax_refunds.total" && f.year === 2025)?.value).toBe("2721.10");
});

test("a CSV that no longer matches its acceptance report is refused", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tax-breaks-refunds-load-"));
  try {
    await fs.mkdir(path.join(dir, "apps/web"), { recursive: true });
    for (const relative of ["data/imports/tax-breaks-refunds-annual.csv", "data/reports/tax-breaks-refunds-validation.json"]) {
      await fs.mkdir(path.dirname(path.join(dir, relative)), { recursive: true });
      await fs.copyFile(path.join(root, relative), path.join(dir, relative));
    }
    await fs.appendFile(path.join(dir, "data/imports/tax-breaks-refunds-annual.csv"), "\n");
    vi.spyOn(process, "cwd").mockReturnValue(path.join(dir, "apps/web"));
    await expect(loadTaxBreaksRefundsFacts()).rejects.toThrow(/fingerprint mismatch/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("client facts carry full-precision amounts in lari", async () => {
  const facts = await loadTaxBreaksRefundsFacts();
  expect(toClientTaxBreaksRefundsFact(facts.find(f => f.indicatorId === "tax_refunds.total" && f.year === 2025)!))
    .toEqual({ year: 2025, indicatorId: "tax_refunds.total", sourceId: "treasury_tax_refunds_chart", value: 2721100000, unit: "gel" });
  const total2024 = toClientTaxBreaksRefundsFact(facts.find(f => f.indicatorId === "tax_breaks.total" && f.year === 2024)!);
  expect(total2024.value).toBeCloseTo(6403176255.69, 1);
});

test("parity rejects a changed or missing value", async () => {
  const facts = await loadTaxBreaksRefundsFacts();
  expect(() => assertTaxBreaksRefundsParity(facts, facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(40) })))).not.toThrow();
  const changed = facts.map(f => ({ ...f }));
  changed[0].value = new Decimal(changed[0].value).plus("0.000001").toFixed();
  expect(() => assertTaxBreaksRefundsParity(facts, changed)).toThrow();
  expect(() => assertTaxBreaksRefundsParity(facts, facts.slice(1))).toThrow();
});

test("the database mirror round-trips exact decimals and source relations", async () => {
  const facts = await loadTaxBreaksRefundsFacts();
  const rows = taxBreaksRefundsMirrorCreateRows(facts, "tax-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const db = (list: typeof rows) => ({ taxBreaksRefundsFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "taxBreaksRefundsFact">;
  const mirror = await loadTaxBreaksRefundsFactsFromMirror(db(rows));
  expect(() => assertTaxBreaksRefundsParity(facts, mirror)).not.toThrow();
  expect(rows[0].importRunId).toBe("tax-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
  await expect(loadTaxBreaksRefundsFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
});

test("every archived source has a source-document row", async () => {
  const csv = await fs.readFile(path.join(root, "data/sources/source-documents.csv"));
  const ids = new Set((parse(csv, { columns: true, bom: true }) as Record<string, string>[]).map(r => r.source_id));
  expect(TAX_BREAKS_REFUNDS_PUBLIC_SOURCES.filter(id => !ids.has(taxBreaksRefundsSourceDocumentId(id)))).toEqual([]);
});

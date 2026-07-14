import Decimal from "decimal.js";

// Parity verification for the CSV -> database import: the reviewed CSVs under
// data/imports remain the canonical source of truth, and every import must
// prove that the database contents match them exactly (row counts and GEL
// totals per year/side and per year/level).

export type TotalsByKey = Record<string, string>;

export type CountComparison = {
  table: string;
  csvRows: number;
  dbRows: number;
};

export type TotalsMismatch = {
  key: string;
  csvTotal: string | null;
  dbTotal: string | null;
};

export type ParityReport = {
  status: "passed" | "failed";
  counts: CountComparison[];
  countMismatches: string[];
  budgetTotalsCsv: TotalsByKey;
  budgetTotalsDb: TotalsByKey;
  budgetTotalsMismatches: TotalsMismatch[];
  adminTotalsCsv: TotalsByKey;
  adminTotalsDb: TotalsByKey;
  adminTotalsMismatches: TotalsMismatch[];
};

export function buildTotalsByKey(
  rows: { key: string; amountGel: number | string }[],
): TotalsByKey {
  const totals = new Map<string, Decimal>();

  for (const row of rows) {
    const current = totals.get(row.key) ?? new Decimal(0);
    totals.set(row.key, current.add(new Decimal(row.amountGel)));
  }

  const result: TotalsByKey = {};
  for (const key of [...totals.keys()].sort()) {
    result[key] = totals.get(key)!.toFixed(2);
  }

  return result;
}

export function compareTotals(csv: TotalsByKey, db: TotalsByKey): TotalsMismatch[] {
  const mismatches: TotalsMismatch[] = [];
  const keys = new Set([...Object.keys(csv), ...Object.keys(db)]);

  for (const key of [...keys].sort()) {
    const csvTotal = csv[key] ?? null;
    const dbTotal = db[key] ?? null;
    if (csvTotal !== dbTotal) {
      mismatches.push({ key, csvTotal, dbTotal });
    }
  }

  return mismatches;
}

export function buildParityReport(input: {
  counts: CountComparison[];
  budgetTotalsCsv: TotalsByKey;
  budgetTotalsDb: TotalsByKey;
  adminTotalsCsv: TotalsByKey;
  adminTotalsDb: TotalsByKey;
}): ParityReport {
  const countMismatches = input.counts
    .filter((count) => count.csvRows !== count.dbRows)
    .map((count) => `${count.table}: csv=${count.csvRows} db=${count.dbRows}`);
  const budgetTotalsMismatches = compareTotals(input.budgetTotalsCsv, input.budgetTotalsDb);
  const adminTotalsMismatches = compareTotals(input.adminTotalsCsv, input.adminTotalsDb);
  const passed =
    countMismatches.length === 0 &&
    budgetTotalsMismatches.length === 0 &&
    adminTotalsMismatches.length === 0;

  return {
    status: passed ? "passed" : "failed",
    counts: input.counts,
    countMismatches,
    budgetTotalsCsv: input.budgetTotalsCsv,
    budgetTotalsDb: input.budgetTotalsDb,
    budgetTotalsMismatches,
    adminTotalsCsv: input.adminTotalsCsv,
    adminTotalsDb: input.adminTotalsDb,
    adminTotalsMismatches,
  };
}

function formatTotalsLines(lines: string[], csv: TotalsByKey, db: TotalsByKey): void {
  const keys = new Set([...Object.keys(csv), ...Object.keys(db)]);

  for (const key of [...keys].sort()) {
    const csvTotal = csv[key] ?? "(missing)";
    const dbTotal = db[key] ?? "(missing)";
    const marker = csv[key] !== undefined && csv[key] === db[key] ? "OK " : "FAIL";
    lines.push(`  [${marker}] ${key}: csv=${csvTotal} db=${dbTotal}`);
  }
}

export function formatParityReport(report: ParityReport): string {
  const lines: string[] = [];

  lines.push("Parity report (database vs reviewed CSVs)");
  lines.push("");
  lines.push("Row counts:");
  for (const count of report.counts) {
    const marker = count.csvRows === count.dbRows ? "OK " : "FAIL";
    lines.push(`  [${marker}] ${count.table}: csv=${count.csvRows} db=${count.dbRows}`);
  }

  lines.push("");
  lines.push("Budget fact GEL totals by year/side:");
  formatTotalsLines(lines, report.budgetTotalsCsv, report.budgetTotalsDb);

  lines.push("");
  lines.push("Admin spending GEL totals by year/level:");
  formatTotalsLines(lines, report.adminTotalsCsv, report.adminTotalsDb);

  lines.push("");
  lines.push(`Parity status: ${report.status.toUpperCase()}`);

  return lines.join("\n");
}

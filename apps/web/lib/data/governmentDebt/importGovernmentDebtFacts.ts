import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { z } from "zod";
import type {
  DebtFamily,
  DebtSeriesId,
  ServedGovernmentDebtFact,
} from "../../servedRows";
import { assertSameServedRows, governmentDebtFactParityKey } from "../servedDataParity";
import { readCsvRecords } from "../csv";
import { resolveServedDataSource } from "../servedDataSource";

const SERVING_PATH = "../../data/imports/government-debt-facts-2013-2030.csv";
const packagePath = "../../docs/Raw Data/Debt/government-debt-annual";
const families = ["stock", "service", "rate"] as const;
const seriesIds = [
  "debt.stock.total",
  "debt.stock.domestic",
  "debt.stock.external",
  "debt.service.total",
  "debt.service.principal",
  "debt.service.interest",
  "debt.rate.total",
  "debt.rate.domestic",
  "debt.rate.external",
] as const;
const outputHeaders = [
  "year",
  "family",
  "series_id",
  "value",
  "value_kind",
  "status",
  "source_id",
  "snapshot_date",
  "last_reviewed_at",
] as const;

const rowSchema = z.object({
  year: z.coerce.number().int().min(2013).max(2030),
  family: z.enum(families),
  series_id: z.enum(seriesIds),
  value: z.string(),
  value_kind: z.enum(["amount_gel", "percent"]),
  status: z.enum(["actual", "projection_existing_portfolio", "not_available"]),
  source_id: z.string(),
  snapshot_date: z.string(),
  last_reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type SourceRow = Record<string, string>;

function valueOrNull(value: string): number | null {
  return value === "" ? null : new Decimal(value).toNumber();
}

function amountGel(value: string): number {
  return new Decimal(value).times(1_000_000).toNumber();
}

function familyForSeries(seriesId: DebtSeriesId): DebtFamily {
  return seriesId.split(".")[1] as DebtFamily;
}

function assertFactShape(fact: ServedGovernmentDebtFact): void {
  if (familyForSeries(fact.seriesId) !== fact.family) {
    throw new Error(`${fact.seriesId} must belong to the ${fact.family} family`);
  }
  if (fact.family === "rate" && fact.valueKind !== "percent") {
    throw new Error(`Rate ${fact.seriesId} must use percent`);
  }
  if (fact.family !== "rate" && fact.valueKind !== "amount_gel") {
    throw new Error(`${fact.seriesId} must use amount_gel`);
  }
  if ((fact.status === "not_available") !== (fact.value === null)) {
    throw new Error(`${fact.seriesId} ${fact.year} must use null exactly for not_available`);
  }
  if (fact.status === "projection_existing_portfolio" && fact.snapshotDate === null) {
    throw new Error(`Projection ${fact.seriesId} ${fact.year} must retain its snapshot date`);
  }
}

function parseServingRow(row: SourceRow): ServedGovernmentDebtFact {
  const parsed = rowSchema.parse(row);
  const fact: ServedGovernmentDebtFact = {
    year: parsed.year,
    family: parsed.family,
    seriesId: parsed.series_id,
    value: valueOrNull(parsed.value),
    valueKind: parsed.value_kind,
    status: parsed.status,
    sourceId: parsed.source_id || null,
    snapshotDate: parsed.snapshot_date || null,
    lastReviewedAt: parsed.last_reviewed_at,
  };
  assertFactShape(fact);
  return fact;
}

export async function loadGovernmentDebtFacts(
  relativePath = SERVING_PATH,
): Promise<ServedGovernmentDebtFact[]> {
  const facts = (await readCsvRecords(relativePath)).map(parseServingRow);
  const keys = facts.map(governmentDebtFactParityKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Government Debt facts must be unique by year and series_id");
  }
  return facts;
}

function fact(
  row: SourceRow,
  family: DebtFamily,
  seriesId: DebtSeriesId,
  value: number | null,
  valueKind: ServedGovernmentDebtFact["valueKind"],
  status: ServedGovernmentDebtFact["status"],
  snapshotDate: string | null = null,
): ServedGovernmentDebtFact {
  const result: ServedGovernmentDebtFact = {
    year: Number(row.year ?? row.payment_year),
    family,
    seriesId,
    value,
    valueKind,
    status,
    sourceId: row.source_id || null,
    snapshotDate,
    lastReviewedAt: row.last_reviewed_at,
  };
  assertFactShape(result);
  return result;
}

export async function buildGovernmentDebtFactsFromPackage(): Promise<ServedGovernmentDebtFact[]> {
  const [stockRows, actualServiceRows, forecastRows, rateRows] = await Promise.all([
    readCsvRecords(`${packagePath}/government-debt-stock-annual-2013-2025.csv`),
    readCsvRecords(`${packagePath}/government-debt-service-actual-annual-2013-2025.csv`),
    readCsvRecords(`${packagePath}/government-debt-service-forecast-2026-2030.csv`),
    readCsvRecords(`${packagePath}/government-debt-interest-rates-annual-2015-2025.csv`),
  ]);
  const facts: ServedGovernmentDebtFact[] = [];

  for (const row of stockRows) {
    if (row.debt_scope === "total" || row.debt_scope === "domestic" || row.debt_scope === "external") {
      facts.push(
        fact(
          row,
          "stock",
          `debt.stock.${row.debt_scope}` as DebtSeriesId,
          valueOrNull(row.amount_gel),
          "amount_gel",
          "actual",
        ),
      );
    }
  }

  for (const row of actualServiceRows.filter((candidate) => candidate.debt_scope === "total")) {
    facts.push(
      fact(row, "service", "debt.service.principal", valueOrNull(row.principal_paid_gel), "amount_gel", "actual"),
      fact(row, "service", "debt.service.interest", valueOrNull(row.interest_paid_gel), "amount_gel", "actual"),
      fact(
        row,
        "service",
        "debt.service.total",
        new Decimal(row.principal_paid_gel).add(row.interest_paid_gel).toNumber(),
        "amount_gel",
        "actual",
      ),
    );
  }

  for (const row of forecastRows.filter((candidate) => candidate.debt_scope === "total")) {
    facts.push(
      fact(row, "service", "debt.service.principal", amountGel(row.principal_million_gel), "amount_gel", "projection_existing_portfolio", row.snapshot_date),
      fact(row, "service", "debt.service.interest", amountGel(row.interest_million_gel), "amount_gel", "projection_existing_portfolio", row.snapshot_date),
      fact(row, "service", "debt.service.total", amountGel(row.total_service_million_gel), "amount_gel", "projection_existing_portfolio", row.snapshot_date),
    );
  }

  for (const row of rateRows) {
    if (row.debt_scope === "total" || row.debt_scope === "domestic" || row.debt_scope === "external") {
      const value = valueOrNull(row.weighted_average_interest_rate_percent);
      facts.push(
        fact(
          row,
          "rate",
          `debt.rate.${row.debt_scope}` as DebtSeriesId,
          value,
          "percent",
          value === null ? "not_available" : "actual",
        ),
      );
    }
  }

  return facts.sort((left, right) =>
    left.year - right.year || left.seriesId.localeCompare(right.seriesId),
  );
}

function csvValue(value: string | number | null): string {
  return value === null ? "" : String(value);
}

export function serializeGovernmentDebtFacts(facts: ServedGovernmentDebtFact[]): string {
  const lines = [
    outputHeaders.join(","),
    ...facts.map((row) =>
      [
        row.year,
        row.family,
        row.seriesId,
        row.value,
        row.valueKind,
        row.status,
        row.sourceId,
        row.snapshotDate,
        row.lastReviewedAt,
      ]
        .map(csvValue)
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

export async function prepareGovernmentDebtFacts(options: { write: boolean }): Promise<number> {
  const facts = await buildGovernmentDebtFactsFromPackage();
  const outputPath = path.resolve(process.cwd(), SERVING_PATH);
  const content = serializeGovernmentDebtFacts(facts);

  if (options.write) {
    await writeFile(outputPath, content, "utf8");
  } else {
    const existing = await readFile(outputPath, "utf8");
    if (existing !== content) {
      throw new Error(
        "government-debt-facts-2013-2030.csv differs from the approved normalized package; " +
          "run `npm run data:prepare-government-debt`.",
      );
    }
  }

  return facts.length;
}

export async function loadServedGovernmentDebtData(): Promise<{
  facts: ServedGovernmentDebtFact[];
}> {
  if (resolveServedDataSource() === "csv") return { facts: await loadGovernmentDebtFacts() };

  const { loadGovernmentDebtFactsFromDb } = await import("../../db/servedDataDb");
  const [dbFacts, csvFacts] = await Promise.all([
    loadGovernmentDebtFactsFromDb(),
    loadGovernmentDebtFacts(),
  ]);
  assertSameServedRows("Government Debt facts", csvFacts, dbFacts, governmentDebtFactParityKey);
  return { facts: dbFacts };
}

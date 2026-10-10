import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { moneyTransferFactKey, type MoneyTransferEntity, type MoneyTransferFact, type MoneyTransfersAcceptance, type MoneyTransfersData } from "./types";
import { moneyTransfersEnglishLabels, validateMoneyTransfersData } from "./validation";

export type ClientMoneyTransferFact = Pick<MoneyTransferFact, "entityId" | "year" | "measure" | "valueStatus" | "monthsReported" | "sourceId" | "vintage"> & { valueUsd: number | null };
export type ClientMoneyTransfersData = { entities: MoneyTransferEntity[]; facts: ClientMoneyTransferFact[] };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function loadMoneyTransfersData(): Promise<MoneyTransfersData> {
  const [csv, catalogue, reportText, labelsText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/money-transfers-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/taxonomy/money-transfer-countries.json")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/money-transfers-validation.json"), "utf8"),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/localization/en/labels.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as MoneyTransfersAcceptance, entities = JSON.parse(catalogue.toString("utf8")) as MoneyTransferEntity[];
  if (report.status !== "passed" || report.scope !== "annual_money_transfers" || report.canonicalSha256 !== hash(csv) || report.catalogueSha256 !== hash(catalogue) || report.englishLabelsSha256 !== hash(moneyTransfersEnglishLabels(entities, JSON.parse(labelsText)))) throw new Error("Money transfers acceptance/catalogue/canonical fingerprint mismatch");
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
  const required = ["entity_id", "year", "measure", "value_usd", "unit", "basis", "value_status", "months_reported", "source_id", "source_sheet", "source_cells", "source_unit", "vintage", "last_reviewed_at"];
  if (!rows.length || rows.some(row => required.some(field => !(field in row)))) throw new Error("Money transfer canonical fields missing");
  const facts: MoneyTransferFact[] = rows.map(row => ({
    entityId: row.entity_id, year: Number(row.year), measure: row.measure as MoneyTransferFact["measure"], valueUsd: row.value_usd === "" ? null : new Decimal(row.value_usd).toFixed(),
    unit: row.unit as "usd", basis: row.basis as "actual", valueStatus: row.value_status as MoneyTransferFact["valueStatus"], monthsReported: row.months_reported === "" ? null : Number(row.months_reported),
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCells: row.source_cells, sourceUnit: row.source_unit as MoneyTransferFact["sourceUnit"], vintage: row.vintage, lastReviewedAt: row.last_reviewed_at,
  }));
  validateMoneyTransfersData({ entities, facts });
  if (facts.length !== report.transferObservations + report.estimateObservations) throw new Error("Money transfers acceptance counts mismatch");
  return { entities, facts };
}

export function assertMoneyTransfersParity(csv: MoneyTransfersData, mirror: MoneyTransfersData): void {
  assertSameServedRows("Money transfer catalogue", csv.entities, mirror.entities, entity => entity.id);
  const normalize = (facts: readonly MoneyTransferFact[]) => facts.map(fact => ({ ...fact, valueUsd: fact.valueUsd === null ? null : new Decimal(fact.valueUsd).toFixed() }));
  assertSameServedRows("Money transfer facts", normalize(csv.facts), normalize(mirror.facts), moneyTransferFactKey);
}

let servedPromise: Promise<MoneyTransfersData> | null = null;
export function loadServedMoneyTransfersData(): Promise<MoneyTransfersData> {
  servedPromise ??= (async () => {
    const csv = await loadMoneyTransfersData();
    if (resolveServedDataSource() === "csv") return csv;
    const { loadMoneyTransfersDataFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadMoneyTransfersDataFromDb();
    assertMoneyTransfersParity(csv, mirror);
    // Parity ignores order; the mirror returns entities by id, so serve the reviewed catalogue order (total first).
    return { entities: csv.entities, facts: mirror.facts };
  })();
  return servedPromise;
}

export function toClientMoneyTransfersData(data: MoneyTransfersData): ClientMoneyTransfersData {
  return { entities: data.entities, facts: data.facts.map(({ entityId, year, measure, valueStatus, monthsReported, sourceId, vintage, valueUsd }) => ({ entityId, year, measure, valueStatus, monthsReported, sourceId, vintage, valueUsd: valueUsd === null ? null : Number(valueUsd) })) };
}

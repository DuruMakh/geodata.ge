import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { foreignInvestmentFactKey, type ForeignInvestmentAcceptance, type ForeignInvestmentData, type ForeignInvestmentEntity, type ForeignInvestmentFact } from "./types";
import { foreignInvestmentEnglishLabels, validateForeignInvestmentData } from "./foreignInvestmentValidation";

export type ClientForeignInvestmentFact = Pick<ForeignInvestmentFact, "entityId" | "year"> & { valueUsd: number | null };
export type ClientForeignInvestmentData = { entities: ForeignInvestmentEntity[]; facts: ClientForeignInvestmentFact[] };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function loadForeignInvestmentData(): Promise<ForeignInvestmentData> {
  const [csv, catalogue, reportText, labelsText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/foreign-investment-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/taxonomy/foreign-investment.json")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/foreign-investment-validation.json"), "utf8"),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/localization/en/labels.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as ForeignInvestmentAcceptance, entities = JSON.parse(catalogue.toString("utf8")) as ForeignInvestmentEntity[];
  if (report.status !== "passed" || report.scope !== "annual_foreign_direct_investment" || report.canonicalSha256 !== hash(csv) || report.catalogueSha256 !== hash(catalogue) || report.englishLabelsSha256 !== hash(foreignInvestmentEnglishLabels(entities, JSON.parse(labelsText)))) throw new Error("Foreign investment acceptance/catalogue/canonical fingerprint mismatch");
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
  const required = ["entity_id", "year", "value_usd", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cells", "source_unit", "vintage", "last_reviewed_at"];
  if (!rows.length || rows.some(row => required.some(field => !(field in row)))) throw new Error("Foreign investment canonical fields missing");
  const facts: ForeignInvestmentFact[] = rows.map(row => ({
    entityId: row.entity_id, year: Number(row.year), valueUsd: row.value_usd === "" ? null : new Decimal(row.value_usd).toFixed(), unit: row.unit as "usd", basis: row.basis as "actual",
    valueStatus: row.value_status as ForeignInvestmentFact["valueStatus"], sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCells: row.source_cells,
    sourceUnit: row.source_unit as ForeignInvestmentFact["sourceUnit"], vintage: row.vintage, lastReviewedAt: row.last_reviewed_at,
  }));
  validateForeignInvestmentData({ entities, facts });
  if (facts.length !== report.observations) throw new Error("Foreign investment acceptance counts mismatch");
  return { entities, facts };
}

export function assertForeignInvestmentParity(csv: ForeignInvestmentData, mirror: ForeignInvestmentData): void {
  assertSameServedRows("Foreign investment catalogue", csv.entities, mirror.entities, entity => entity.id);
  const normalize = (facts: readonly ForeignInvestmentFact[]) => facts.map(fact => ({ ...fact, valueUsd: fact.valueUsd === null ? null : new Decimal(fact.valueUsd).toFixed() }));
  assertSameServedRows("Foreign investment facts", normalize(csv.facts), normalize(mirror.facts), foreignInvestmentFactKey);
}

let servedPromise: Promise<ForeignInvestmentData> | null = null;
export function loadServedForeignInvestmentData(): Promise<ForeignInvestmentData> {
  servedPromise ??= (async () => {
    const csv = await loadForeignInvestmentData();
    if (resolveServedDataSource() === "csv") return csv;
    const { loadForeignInvestmentDataFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadForeignInvestmentDataFromDb();
    assertForeignInvestmentParity(csv, mirror);
    // Parity ignores order; the mirror returns entities by id, so serve the reviewed catalogue order (total first).
    return { entities: csv.entities, facts: mirror.facts };
  })();
  return servedPromise;
}

export function toClientForeignInvestmentData(data: ForeignInvestmentData): ClientForeignInvestmentData {
  return { entities: data.entities, facts: data.facts.map(({ entityId, year, valueUsd }) => ({ entityId, year, valueUsd: valueUsd === null ? null : Number(valueUsd) })) };
}

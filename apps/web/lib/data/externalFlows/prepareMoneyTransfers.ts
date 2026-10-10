import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { MONEY_TRANSFER_SOURCES, MONEY_TRANSFER_TOTAL_ID, MONEY_TRANSFER_YEARS, PERSONAL_TRANSFERS_ID, moneyTransferFactKey, type MoneyTransferEntity, type MoneyTransferFact, type MoneyTransfersAcceptance } from "./types";
import { moneyTransfersEnglishLabels, validateMoneyTransfersData } from "./validation";

const D = Decimal.clone({ precision: 50 }), RESEARCH = "docs/Raw Data/External/2026-10-10", REVIEWED_AT = "2026-10-10";
const PROTECTED = ["money-transfers-annual.csv", "bop-annual.csv", "prepared-validation.json", "prepared-reconciliation.csv"];
type Row = Record<string, string>;
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const rows = (bytes: Buffer): Row[] => parse(bytes, { columns: true, bom: true, skip_empty_lines: true });
const fields = ["entity_id", "year", "measure", "value_usd", "unit", "basis", "value_status", "months_reported", "source_id", "source_sheet", "source_cells", "source_unit", "vintage", "last_reviewed_at"];

/** Copies the accepted annual money-transfer and personal-transfer rows from the frozen external-flows research package. */
export async function prepareMoneyTransfersData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH), inputSha256: Record<string, string> = {};
  const manifestBytes = await fs.readFile(path.join(directory, "artifact-manifest.csv"));
  inputSha256["artifact-manifest.csv"] = hash(manifestBytes);
  const manifest = new Map(rows(manifestBytes).map(row => [row.file, row]));
  const research: Record<string, Buffer> = {};
  for (const name of PROTECTED) {
    const entry = manifest.get(name);
    if (!entry) throw new Error(`Money transfer research artifact missing from manifest: ${name}`);
    const { bytes, sha256 } = await readVerifiedPackageFile(directory, name, { sha256: entry.sha256, bytes: Number(entry.bytes) }, `Money transfer research artifact hash mismatch: ${name}`);
    research[name] = bytes; inputSha256[name] = sha256;
  }
  const evidenceBytes = await fs.readFile(path.join(directory, "independent-verification.json"));
  const evidence = JSON.parse(evidenceBytes.toString("utf8")) as { result: string; input_artifact_sha256: Record<string, string> };
  if (evidence.result !== "pass" || ["money-transfers-annual.csv", "bop-annual.csv"].some(name => evidence.input_artifact_sha256?.[name] !== inputSha256[name])) throw new Error("Money transfer independent verification is not current and passing");
  inputSha256["independent-verification.json"] = hash(evidenceBytes);
  const validation = JSON.parse(research["prepared-validation.json"].toString("utf8")) as { checks: { fail: number } };
  if (validation.checks?.fail !== 0) throw new Error("Money transfer research package has failing checks");
  const identityBytes = await fs.readFile(path.join(directory, "money-transfer-country-identities.csv"));
  inputSha256["money-transfer-country-identities.csv"] = hash(identityBytes);
  const reviewedIds = new Set(rows(identityBytes).map(row => `transfer.${row.country_id}`));
  const catalogueBytes = await fs.readFile(path.join(repositoryRoot, "data/taxonomy/money-transfer-countries.json"));
  const entities = JSON.parse(catalogueBytes.toString("utf8")) as MoneyTransferEntity[];
  const labels = JSON.parse(await fs.readFile(path.join(repositoryRoot, "data/localization/en/labels.json"), "utf8"));
  const catalogued = new Set(entities.filter(e => e.kind === "country" || e.kind === "remainder").map(e => e.id));
  if (catalogued.size !== reviewedIds.size || [...reviewedIds].some(id => !catalogued.has(id)) || entities[0]?.id !== MONEY_TRANSFER_TOTAL_ID || entities[0].kind !== "total" || entities[1]?.id !== PERSONAL_TRANSFERS_ID || entities[1].kind !== "estimate" || entities.length !== reviewedIds.size + 2) throw new Error("Money transfer catalogue does not match the reviewed identities");

  const facts: MoneyTransferFact[] = [];
  for (const row of rows(research["money-transfers-annual.csv"])) {
    const year = Number(row.year);
    if (year > MONEY_TRANSFER_YEARS.last) continue;
    const entityId = `transfer.${row.item_id}`, entity = entities.find(e => e.id === entityId);
    if (!entity || entity.kind !== (row.role === "total" ? "total" : row.role) || row.family !== "money_transfers" || row.source_unit !== "thousand_usd" || row.derivation !== "sum_of_published_months") throw new Error(`Money transfer source identity/role mismatch: ${entityId}:${row.year}`);
    const blank = row.value_status === "blank";
    if (blank !== (row.value_usd === "")) throw new Error(`Money transfer blank/value mismatch: ${entityId}:${row.year}`);
    facts.push({ entityId, year, measure: row.flow === "inflow" ? "received" : row.flow === "outflow" ? "sent" : (() => { throw new Error(`Money transfer flow mismatch: ${row.flow}`); })(), valueUsd: blank ? null : new D(row.value_usd).toFixed(), unit: "usd", basis: "actual", valueStatus: row.value_status as MoneyTransferFact["valueStatus"], monthsReported: Number(row.months_reported), sourceId: MONEY_TRANSFER_SOURCES.transfers, sourceSheet: row.source_sheet, sourceCells: row.source_cells, sourceUnit: "thousand_usd", vintage: row.vintage, lastReviewedAt: REVIEWED_AT });
  }
  for (const row of rows(research["bop-annual.csv"])) {
    if (row.item_id !== "personal_transfers" || row.flow === "net" || Number(row.year) > MONEY_TRANSFER_YEARS.last) continue;
    if (row.source_unit !== "million_usd" || row.value_status !== "numeric" || !new D(row.source_value).mul(1000000).eq(row.value_usd)) throw new Error(`Personal transfer source mismatch: ${row.year}:${row.flow}`);
    facts.push({ entityId: PERSONAL_TRANSFERS_ID, year: Number(row.year), measure: row.flow === "credit" ? "received" : "sent", valueUsd: new D(row.value_usd).toFixed(), unit: "usd", basis: "actual", valueStatus: "numeric", monthsReported: null, sourceId: MONEY_TRANSFER_SOURCES.estimate, sourceSheet: row.source_sheet, sourceCells: row.source_cells, sourceUnit: "million_usd", vintage: row.vintage, lastReviewedAt: REVIEWED_AT });
  }
  validateMoneyTransfersData({ entities, facts });

  const byKey = new Map(facts.map(fact => [moneyTransferFactKey(fact), fact]));
  const years = Array.from({ length: MONEY_TRANSFER_YEARS.last - MONEY_TRANSFER_YEARS.first + 1 }, (_, i) => MONEY_TRANSFER_YEARS.first + i);
  const controls = rows(research["prepared-reconciliation.csv"]).filter(row => row.check === "money_transfers.countries_sum_to_total");
  for (const year of years) for (const measure of ["received", "sent"] as const) {
    const total = byKey.get(`${MONEY_TRANSFER_TOTAL_ID}:${measure}:${year}`), estimate = byKey.get(`${PERSONAL_TRANSFERS_ID}:${measure}:${year}`);
    const parts = facts.filter(f => f.year === year && f.measure === measure && f.entityId !== MONEY_TRANSFER_TOTAL_ID && f.entityId !== PERSONAL_TRANSFERS_ID && f.valueUsd !== null);
    const sum = parts.reduce((value, f) => value.plus(f.valueUsd!), new D(0));
    const control = controls.filter(row => Number(row.year) === year && row.flow === (measure === "received" ? "inflow" : "outflow"));
    if (!total?.valueUsd || !estimate || control.length !== 1 || control[0].result !== "pass" || !new D(control[0].expected_usd).eq(total.valueUsd) || sum.minus(total.valueUsd).abs().gt(control[0].tolerance_usd)) throw new Error(`Money transfer coverage/reconciliation mismatch: ${measure}:${year}`);
  }

  facts.sort((a, b) => a.entityId.localeCompare(b.entityId, "en") || a.year - b.year || a.measure.localeCompare(b.measure, "en"));
  const content = serializeBomCsvRows([fields, ...facts.map(f => [f.entityId, f.year, f.measure, f.valueUsd ?? "", f.unit, f.basis, f.valueStatus, f.monthsReported ?? "", f.sourceId, f.sourceSheet, f.sourceCells, f.sourceUnit, f.vintage, f.lastReviewedAt])]);
  const valueStatusCounts = { numeric: 0, blank: 0, partial_months: 0 };
  facts.forEach(f => valueStatusCounts[f.valueStatus]++);
  const report: MoneyTransfersAcceptance = { status: "passed", scope: "annual_money_transfers", years, countryEntities: entities.filter(e => e.kind === "country").length, remainderEntities: entities.filter(e => e.kind === "remainder").length, transferObservations: facts.filter(f => f.entityId !== PERSONAL_TRANSFERS_ID).length, estimateObservations: facts.filter(f => f.entityId === PERSONAL_TRANSFERS_ID).length, valueStatusCounts, inputSha256, canonicalSha256: hash(content), catalogueSha256: hash(catalogueBytes), englishLabelsSha256: hash(moneyTransfersEnglishLabels(entities, labels)), reviewedAt: REVIEWED_AT };
  const outputs = [["data/imports/money-transfers-annual.csv", content], ["data/reports/money-transfers-validation.json", JSON.stringify(report, null, 2) + "\n"]] as const;
  for (const [name, expected] of outputs) {
    const target = path.join(repositoryRoot, name);
    if (mode === "check") await assertGeneratedArtifactMatches("Money transfers", target, expected);
    else { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, expected); }
  }
}

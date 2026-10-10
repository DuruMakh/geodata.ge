import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { CURRENT_ACCOUNT_FLOWS, CURRENT_ACCOUNT_SOURCE, CURRENT_ACCOUNT_YEARS, type CurrentAccountAcceptance, type CurrentAccountFact, type CurrentAccountSeriesId } from "./types";
import { validateCurrentAccountFacts } from "./currentAccountValidation";

const D = Decimal.clone({ precision: 50 }), RESEARCH = "docs/Raw Data/External/2026-10-10", REVIEWED_AT = "2026-10-10";
const PROTECTED = ["bop-annual.csv", "prepared-validation.json", "prepared-reconciliation.csv"];
const SERIES_BY_ITEM: Record<string, CurrentAccountSeriesId> = { current_account: "ca.balance", goods: "ca.goods", services: "ca.services", primary_income: "ca.primary_income", secondary_income: "ca.secondary_income" };
type Row = Record<string, string>;
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const rows = (bytes: Buffer): Row[] => parse(bytes, { columns: true, bom: true, skip_empty_lines: true });
const fields = ["series_id", "year", "flow", "value_usd", "unit", "basis", "source_id", "source_sheet", "source_cells", "source_unit", "vintage", "last_reviewed_at"];

/** Copies NBG's annual current account and its four parts (credit, debit, net) from the frozen external-flows research package. */
export async function prepareCurrentAccountData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH), inputSha256: Record<string, string> = {};
  const manifestBytes = await fs.readFile(path.join(directory, "artifact-manifest.csv"));
  inputSha256["artifact-manifest.csv"] = hash(manifestBytes);
  const manifest = new Map(rows(manifestBytes).map(row => [row.file, row]));
  const research: Record<string, Buffer> = {};
  for (const name of PROTECTED) {
    const entry = manifest.get(name);
    if (!entry) throw new Error(`Current account research artifact missing from manifest: ${name}`);
    const { bytes, sha256 } = await readVerifiedPackageFile(directory, name, { sha256: entry.sha256, bytes: Number(entry.bytes) }, `Current account research artifact hash mismatch: ${name}`);
    research[name] = bytes; inputSha256[name] = sha256;
  }
  const evidenceBytes = await fs.readFile(path.join(directory, "independent-verification.json"));
  const evidence = JSON.parse(evidenceBytes.toString("utf8")) as { result: string; input_artifact_sha256: Record<string, string> };
  if (evidence.result !== "pass" || evidence.input_artifact_sha256?.["bop-annual.csv"] !== inputSha256["bop-annual.csv"]) throw new Error("Current account independent verification is not current and passing");
  inputSha256["independent-verification.json"] = hash(evidenceBytes);
  const validation = JSON.parse(research["prepared-validation.json"].toString("utf8")) as { checks: { fail: number } };
  if (validation.checks?.fail !== 0) throw new Error("Current account research package has failing checks");

  const facts: CurrentAccountFact[] = [];
  for (const row of rows(research["bop-annual.csv"])) {
    const seriesId = SERIES_BY_ITEM[row.item_id], year = Number(row.year);
    if (row.family !== "bop" || !seriesId || !CURRENT_ACCOUNT_FLOWS.includes(row.flow as CurrentAccountFact["flow"]) || year > CURRENT_ACCOUNT_YEARS.last) continue;
    if (row.source_unit !== "million_usd" || row.value_status !== "numeric" || !new D(row.source_value).mul(1000000).eq(row.value_usd)) throw new Error(`Current account source mismatch: ${seriesId}:${row.flow}:${row.year}`);
    facts.push({ seriesId, year, flow: row.flow as CurrentAccountFact["flow"], valueUsd: new D(row.value_usd).toFixed(), unit: "usd", basis: "actual", sourceId: CURRENT_ACCOUNT_SOURCE, sourceSheet: row.source_sheet, sourceCells: row.source_cells, sourceUnit: "million_usd", vintage: row.vintage, lastReviewedAt: REVIEWED_AT });
  }
  validateCurrentAccountFacts(facts);
  // The research package's own identity checks for these lines must have passed too.
  const items = new Set(Object.keys(SERIES_BY_ITEM));
  const controls = rows(research["prepared-reconciliation.csv"]).filter(row => (row.check === "bop.net_is_credit_minus_debit" && items.has(row.item_id)) || row.check === "bop.current_account_parts");
  const years = Array.from({ length: CURRENT_ACCOUNT_YEARS.last - CURRENT_ACCOUNT_YEARS.first + 1 }, (_, i) => CURRENT_ACCOUNT_YEARS.first + i);
  for (const year of years) if (controls.filter(row => Number(row.year) === year && row.result === "pass").length !== items.size + 1) throw new Error(`Current account reconciliation mismatch: ${year}`);

  facts.sort((a, b) => a.seriesId.localeCompare(b.seriesId, "en") || a.year - b.year || a.flow.localeCompare(b.flow, "en"));
  const content = serializeBomCsvRows([fields, ...facts.map(f => [f.seriesId, f.year, f.flow, f.valueUsd, f.unit, f.basis, f.sourceId, f.sourceSheet, f.sourceCells, f.sourceUnit, f.vintage, f.lastReviewedAt])]);
  const report: CurrentAccountAcceptance = { status: "passed", scope: "annual_current_account", years, observations: facts.length, inputSha256, canonicalSha256: hash(content), reviewedAt: REVIEWED_AT };
  const outputs = [["data/imports/current-account-annual.csv", content], ["data/reports/current-account-validation.json", JSON.stringify(report, null, 2) + "\n"]] as const;
  for (const [name, expected] of outputs) {
    const target = path.join(repositoryRoot, name);
    if (mode === "check") await assertGeneratedArtifactMatches("Current account", target, expected);
    else { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, expected); }
  }
}

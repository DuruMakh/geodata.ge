import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { FOREIGN_INVESTMENT_DIMENSIONS, FOREIGN_INVESTMENT_SOURCES, FOREIGN_INVESTMENT_TOTAL_ID, FOREIGN_INVESTMENT_YEARS, foreignInvestmentFactKey, type ForeignInvestmentAcceptance, type ForeignInvestmentDimension, type ForeignInvestmentEntity, type ForeignInvestmentFact } from "./types";
import { foreignInvestmentEnglishLabels, validateForeignInvestmentData } from "./foreignInvestmentValidation";

const D = Decimal.clone({ precision: 50 }), RESEARCH = "docs/Raw Data/External/2026-10-10", REVIEWED_AT = "2026-10-10";
const PROTECTED = ["fdi-flows-annual.csv", "prepared-validation.json", "prepared-reconciliation.csv"];
type Row = Record<string, string>;
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const rows = (bytes: Buffer): Row[] => parse(bytes, { columns: true, bom: true, skip_empty_lines: true });
const fields = ["entity_id", "year", "value_usd", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cells", "source_unit", "vintage", "last_reviewed_at"];
const SERVED_ROLES: Record<"total" | ForeignInvestmentDimension, string[]> = { total: ["total"], country: ["country", "unallocated", "remainder"], sector: ["component"], region: ["region", "region_part"] };
// Research item ids that differ from the served catalogue's id suffix.
const RENAMED: Record<string, string> = { other_countries_remainder: "other_remainder", racha_lechkhumi_and_kvemo_svaneti: "racha_lechkhumi_kvemo_svaneti" };

function entityIdFor(row: Row): string {
  if (row.dimension === "total") return FOREIGN_INVESTMENT_TOTAL_ID;
  const suffix = RENAMED[row.item_id] ?? (row.dimension === "sector" ? row.item_id.replace(/^nace_/, "") : row.item_id);
  return `fdi.${row.dimension}.${suffix}`;
}

/** Copies Geostat's accepted annual FDI inflows (total, countries, sectors, regions) from the frozen external-flows research package. */
export async function prepareForeignInvestmentData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH), inputSha256: Record<string, string> = {};
  const manifestBytes = await fs.readFile(path.join(directory, "artifact-manifest.csv"));
  inputSha256["artifact-manifest.csv"] = hash(manifestBytes);
  const manifest = new Map(rows(manifestBytes).map(row => [row.file, row]));
  const research: Record<string, Buffer> = {};
  for (const name of PROTECTED) {
    const entry = manifest.get(name);
    if (!entry) throw new Error(`Foreign investment research artifact missing from manifest: ${name}`);
    const { bytes, sha256 } = await readVerifiedPackageFile(directory, name, { sha256: entry.sha256, bytes: Number(entry.bytes) }, `Foreign investment research artifact hash mismatch: ${name}`);
    research[name] = bytes; inputSha256[name] = sha256;
  }
  const evidenceBytes = await fs.readFile(path.join(directory, "independent-verification.json"));
  const evidence = JSON.parse(evidenceBytes.toString("utf8")) as { result: string; input_artifact_sha256: Record<string, string> };
  if (evidence.result !== "pass" || evidence.input_artifact_sha256?.["fdi-flows-annual.csv"] !== inputSha256["fdi-flows-annual.csv"]) throw new Error("Foreign investment independent verification is not current and passing");
  inputSha256["independent-verification.json"] = hash(evidenceBytes);
  const validation = JSON.parse(research["prepared-validation.json"].toString("utf8")) as { checks: { fail: number } };
  if (validation.checks?.fail !== 0) throw new Error("Foreign investment research package has failing checks");
  const catalogueBytes = await fs.readFile(path.join(repositoryRoot, "data/taxonomy/foreign-investment.json"));
  const entities = JSON.parse(catalogueBytes.toString("utf8")) as ForeignInvestmentEntity[];
  const labels = JSON.parse(await fs.readFile(path.join(repositoryRoot, "data/localization/en/labels.json"), "utf8"));
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));
  if (entities[0]?.id !== FOREIGN_INVESTMENT_TOTAL_ID) throw new Error("Foreign investment catalogue must start with the total");

  const facts: ForeignInvestmentFact[] = [];
  for (const row of rows(research["fdi-flows-annual.csv"])) {
    const scope = row.dimension as "total" | ForeignInvestmentDimension;
    if (row.family !== "fdi_flows" || !SERVED_ROLES[scope]?.includes(row.role)) continue;
    const entityId = entityIdFor(row), entity = entityMap.get(entityId);
    if (!entity || (entity.dimension ?? "total") !== scope) throw new Error(`Foreign investment catalogue identity missing: ${entityId}`);
    const sourceUnit = scope === "total" ? "million_usd" : "thousand_usd", applicable = row.value_status === "numeric";
    if (row.flow !== "inflow" || row.derivation !== "published" || row.source_unit !== sourceUnit) throw new Error(`Foreign investment source identity/unit mismatch: ${entityId}:${row.year}`);
    if (applicable ? !new D(row.source_value).mul(scope === "total" ? 1000000 : 1000).eq(row.value_usd) : row.value_status !== "not_applicable" || row.value_usd !== "" || row.source_value !== "-") throw new Error(`Foreign investment value/status mismatch: ${entityId}:${row.year}`);
    facts.push({ entityId, year: Number(row.year), valueUsd: applicable ? new D(row.value_usd).toFixed() : null, unit: "usd", basis: "actual", valueStatus: applicable ? "numeric" : "not_applicable", sourceId: FOREIGN_INVESTMENT_SOURCES[scope], sourceSheet: row.source_sheet, sourceCells: row.source_cells, sourceUnit, vintage: row.vintage, lastReviewedAt: REVIEWED_AT });
  }
  validateForeignInvestmentData({ entities, facts });

  const byKey = new Map(facts.map(fact => [foreignInvestmentFactKey(fact), fact]));
  const yearsFrom = (first: number) => Array.from({ length: FOREIGN_INVESTMENT_YEARS.last - first + 1 }, (_, i) => first + i);
  for (const entity of entities) for (const year of yearsFrom(FOREIGN_INVESTMENT_YEARS[entity.dimension ?? "total"])) if (!byKey.has(`${entity.id}:${year}`)) throw new Error(`Foreign investment coverage mismatch: ${entity.id}:${year}`);
  // Each breakdown must still add up to Geostat's annual total within the research package's recorded rounding tolerances.
  const controls = rows(research["prepared-reconciliation.csv"]);
  for (const dimension of FOREIGN_INVESTMENT_DIMENSIONS) for (const year of yearsFrom(dimension === "region" ? 2016 : FOREIGN_INVESTMENT_YEARS[dimension])) {
    const own = controls.filter(row => Number(row.year) === year && row.dimension === dimension && (row.check === `fdi_flows.${dimension}.children` || row.check === "fdi_flows.table_total_matches_annual_total"));
    const total = byKey.get(`${FOREIGN_INVESTMENT_TOTAL_ID}:${year}`)!;
    const sum = facts.filter(f => f.year === year && entityMap.get(f.entityId)!.dimension === dimension && f.valueUsd !== null).reduce((value, f) => value.plus(f.valueUsd!), new D(0));
    const tolerance = own.reduce((value, row) => value.plus(row.tolerance_usd), new D(0));
    if (!own.some(row => row.check === "fdi_flows.table_total_matches_annual_total") || own.some(row => row.result !== "pass") || sum.minus(total.valueUsd!).abs().gt(tolerance)) throw new Error(`Foreign investment reconciliation mismatch: ${dimension}:${year}`);
  }

  facts.sort((a, b) => a.entityId.localeCompare(b.entityId, "en") || a.year - b.year);
  const content = serializeBomCsvRows([fields, ...facts.map(f => [f.entityId, f.year, f.valueUsd ?? "", f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCells, f.sourceUnit, f.vintage, f.lastReviewedAt])]);
  const valueStatusCounts = { numeric: 0, not_applicable: 0 };
  facts.forEach(f => valueStatusCounts[f.valueStatus]++);
  const count = (dimension: ForeignInvestmentDimension) => entities.filter(e => e.dimension === dimension).length;
  const report: ForeignInvestmentAcceptance = {
    status: "passed", scope: "annual_foreign_direct_investment",
    years: { total: yearsFrom(FOREIGN_INVESTMENT_YEARS.total), country: yearsFrom(FOREIGN_INVESTMENT_YEARS.country), sector: yearsFrom(FOREIGN_INVESTMENT_YEARS.sector), region: yearsFrom(FOREIGN_INVESTMENT_YEARS.region) },
    entities: { country: count("country"), sector: count("sector"), region: count("region") }, observations: facts.length, valueStatusCounts,
    inputSha256, canonicalSha256: hash(content), catalogueSha256: hash(catalogueBytes), englishLabelsSha256: hash(foreignInvestmentEnglishLabels(entities, labels)), reviewedAt: REVIEWED_AT,
  };
  const outputs = [["data/imports/foreign-investment-annual.csv", content], ["data/reports/foreign-investment-validation.json", JSON.stringify(report, null, 2) + "\n"]] as const;
  for (const [name, expected] of outputs) {
    const target = path.join(repositoryRoot, name);
    if (mode === "check") await assertGeneratedArtifactMatches("Foreign investment", target, expected);
    else { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, expected); }
  }
}

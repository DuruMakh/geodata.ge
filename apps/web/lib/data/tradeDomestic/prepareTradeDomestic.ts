import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { serializeBomCsvRows } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readVerifiedPackageFile } from "../sourcePackage";
import { readTradeSourceWorksheet } from "../parsing/tradeSourceWorkbook";
import { tradeProductCategory, type TradeProductCategoryId } from "../tradeProducts/types";
import { TRADE_DOMESTIC_SOURCES, tradeDomesticFactKey, type TradeDomesticData, type TradeDomesticEntity, type TradeDomesticFact, type TradeDomesticAcceptance } from "./types";

const D = Decimal.clone({ precision: 50 }), RESEARCH = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07", REVIEWED = "2026-10-10";
type Row = Record<string, string>;
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };
type LayoutRow = { row_index: number; role: string; item_id: string; dimensions: Row; label_cells: { cell: string; value: string; format: string }[]; code_cells: { cell: string; value: string; format: string }[] };
type Layout = { family: string; source_id: string; source_sheet: string; source_unit: string; year_columns: Row; rows: LayoutRow[] };
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
export const TRADE_DOMESTIC_FIELDS = ["entity_id", "year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "source_block", "last_reviewed_at"];
export function tradeDomesticCsv(data: TradeDomesticData): string {
  return serializeBomCsvRows([TRADE_DOMESTIC_FIELDS, ...data.facts.map(f => [f.entityId, f.year, f.indicatorId, f.valueUsd, f.unit, f.basis, f.valueStatus, f.publicationStatus, f.role, f.sourceId, f.sourceRefs, f.sourceValue ?? "", f.sourceUnit ?? "", f.sourceLabel ?? "", f.sourceNumberFormat ?? "", f.sourceBlock, f.lastReviewedAt])]);
}

export async function buildTradeDomesticData(root: string): Promise<{ data: TradeDomesticData; report: TradeDomesticAcceptance }> {
  const directory = path.join(root, RESEARCH), inputSha256: Record<string, string> = {}, sourceSha256: Record<string, string> = {};
  const read = async (name: string) => { const bytes = await fs.readFile(path.join(root, name)); inputSha256[name] = hash(bytes); return bytes; };
  const research = async (name: string) => read(`${RESEARCH}/${name}`);
  const csv = (bytes: Buffer): Row[] => parse(bytes, { columns: true, bom: true, skip_empty_lines: true });
  const sources = JSON.parse((await research("full-source-manifest.json")).toString()) as Source[];
  const layouts = JSON.parse((await research("source-layouts.json")).toString()) as Layout[];
  const inventory = JSON.parse((await research("expected-observation-inventory.json")).toString());
  if (inventory.full_manifest_sha256 !== inputSha256[`${RESEARCH}/full-source-manifest.json`] || inventory.layout_sha256 !== inputSha256[`${RESEARCH}/source-layouts.json`]) throw new Error("Domestic source inventory fingerprint mismatch");
  const packageReport = JSON.parse((await research("prepared-validation.json")).toString());
  const issues = JSON.parse((await research("unresolved-source-issues.json")).toString()).issues as { family: string; year: string }[];
  const relevant = (issue: { family: string; year: string }) => ["goods_domestic", "goods_national", "goods_countries"].includes(issue.family) && Number(issue.year) >= 2014 && Number(issue.year) <= 2025;
  if ([...issues, ...packageReport.unresolved_source_issues].some(relevant)) throw new Error("Domestic export source acceptance hold requires resolution");
  const rows = csv(await research("goods-domestic-annual.csv")), reviews = csv(await research("identity-review.csv"));
  const derived = csv(await research("derived-annual.csv")), coverage = csv(await research("coverage.csv"));
  const national = csv(await read("data/imports/trade-overview-annual.csv")), partners = csv(await read("data/imports/trade-partners-annual.csv"));
  for (const [name, bytesKey] of [["trade-overview", "data/imports/trade-overview-annual.csv"], ["trade-partners", "data/imports/trade-partners-annual.csv"]]) {
    const accepted = JSON.parse((await read(`data/reports/${name}-validation.json`)).toString());
    if (accepted.status !== "passed" || accepted.canonicalSha256 !== inputSha256[bytesKey]) throw new Error("Domestic export national/partner reference acceptance mismatch");
  }
  const countryCatalogue = JSON.parse((await read("data/taxonomy/trade-partners.json")).toString()) as { id: string; sourceCode: string; labelKa: string }[];
  const products = csv(await read("data/imports/trade-products-catalogue.csv"));
  const entities = new Map<string, TradeDomesticEntity>(), facts: TradeDomesticFact[] = [];
  entities.set("goods.total", { id: "goods.total", kind: "national", code: null, labelKa: "საქართველო სულ", labelEn: "Georgia total", sourceBlock: "2014-2025", categoryId: null, aliasesKa: [], aliasesEn: [] });
  const selectedLayouts = layouts.filter(layout => layout.family === "goods_domestic" && (layout.source_id === TRADE_DOMESTIC_SOURCES.country || layout.source_sheet === "2020-2025-years"));
  if (selectedLayouts.length !== 2) throw new Error("Domestic source layout coverage mismatch");
  const selectedRows: Row[] = [];
  for (const layout of selectedLayouts) {
    const source = sources.find(source => source.source_id === layout.source_id)!;
    const verified = await readVerifiedPackageFile(directory, source.local_file, source, "Domestic source capture/hash mismatch");
    sourceSha256[source.source_id] = verified.sha256;
    const { sheet, storedValues } = readTradeSourceWorksheet(verified.bytes, layout.source_sheet);
    const original = rows.filter(row => row.source_id === layout.source_id && row.source_sheet === layout.source_sheet);
    const byKey = new Map(original.map(row => [`${row.item_id}:${row.year}`, row]));
    const years = Object.keys(layout.year_columns).map(Number).sort((a, b) => a - b);
    if (layout.source_unit !== "thousand_usd" || original.length !== layout.rows.length * years.length || byKey.size !== original.length || years.length !== (layout.source_id === TRADE_DOMESTIC_SOURCES.country ? 12 : 6)) throw new Error("Domestic source coverage/duplicate mismatch");
    for (const declared of layout.rows) {
      for (const token of [...declared.label_cells, ...declared.code_cells]) if (String(sheet[token.cell]?.v) !== token.value || (sheet[token.cell]?.z ?? "General") !== token.format) throw new Error("Domestic source label/code/format mismatch");
      for (const year of years) {
        if (Number(sheet[`${layout.year_columns[year]}4`]?.v) !== year) throw new Error("Domestic source year header mismatch");
        const cell = `${layout.year_columns[year]}${declared.row_index}`, native = sheet[cell], row = byKey.get(`${declared.item_id}:${year}`);
        const stored = storedValues.get(cell), value = stored && native?.t === "n" ? new D(stored).mul(1000).toFixed() : null;
        if (!row || value === null || row.value_status !== "numeric" || row.publication_status !== "unspecified" || row.flow !== "domestic_export" || row.role !== declared.role || row.source_cell !== cell || row.source_unit !== "thousand_usd" || row.source_value !== stored || row.source_number_format !== (native?.z ?? "General") || row.source_label !== declared.label_cells[0]?.value || !new D(row.value_usd).eq(value) || Object.entries(declared.dimensions).some(([key, text]) => !["source_group_id", "source_group_label_en"].includes(key) && row[key] !== text)) throw new Error(`Domestic source cell/status/metadata mismatch: ${layout.source_id}:${cell}`);
        selectedRows.push(row);
        const block = inventory.blocks.find((block: Row) => block.source_id === layout.source_id && block.source_sheet === layout.source_sheet && Number(block.year) === year);
        const covered = coverage.find(block => block.source_id === layout.source_id && block.source_sheet === layout.source_sheet && Number(block.year) === year);
        if (!block || !covered || Number(block.source_key_count) !== layout.rows.length || covered.key_sha256 !== block.key_sha256 || row.source_block !== block.source_block) throw new Error("Domestic reviewed coverage mismatch");
        const country = row.dimension === "country";
        if (country ? !["detail", "total"].includes(row.role) : !["detail", "residual"].includes(row.role)) continue;
        if (row.role !== "total" && !entities.has(row.item_id)) {
          const review = reviews.find(review => review.family === (country ? "reexports_country" : "reexports_product") && review.right_identity === row.item_id && review.disposition === "verified_equivalent");
          const countryLabel = countryCatalogue.find(entity => entity.id === review?.left_identity);
          const product = country ? undefined : products.find(product => product.code === row.product_code && product.source_label_en === row.product_label_en && product.source_block === "2020-2025") ?? products.find(product => product.code === row.product_code && product.source_label_en === row.product_label_en);
          const labelKa = country ? countryLabel?.labelKa ?? (row.partner_code === "807" ? "მაკედონია (ყოფილი იუგოსლავიის რესპუბლიკა)" : "") : product?.label_ka ?? (row.product_code === "8803" ? "საფრენი აპარატების ნაწილები" : row.role === "residual" ? "სხვა საქონელი" : "");
          if (!labelKa) throw new Error(`Domestic reviewed Georgian label missing: ${row.item_id}`);
          entities.set(row.item_id, { id: row.item_id, kind: country ? "country" : "product", code: (country ? row.partner_code : row.product_code) || null, labelKa, labelEn: country ? row.partner_label_en : row.product_label_en, sourceBlock: row.source_block, categoryId: country ? null : product?.category_id as TradeProductCategoryId ?? (row.role === "residual" ? "other_products" : tradeProductCategory(row.product_code)), aliasesKa: product ? JSON.parse(product.aliases_ka) : [], aliasesEn: product ? JSON.parse(product.aliases_en) : [] });
        }
        facts.push({ entityId: row.item_id, year, indicatorId: "trade.domestic_exports", valueUsd: value, unit: "usd", basis: "actual", valueStatus: "numeric", publicationStatus: "unspecified", role: row.role as TradeDomesticFact["role"], sourceId: row.source_id, sourceRefs: JSON.stringify([[row.source_id, row.source_sheet, cell]]), sourceValue: stored!, sourceUnit: "thousand_usd", sourceLabel: row.source_label, sourceNumberFormat: row.source_number_format, sourceBlock: row.source_block, lastReviewedAt: REVIEWED });
      }
    }
  }
  for (const row of selectedRows.filter(row => row.dimension === "country" && ["total", "detail"].includes(row.role))) {
    const family = row.role === "total" ? "national" : "country";
    const review = reviews.find(review => review.family === `reexports_${family}` && review.right_source_id === row.source_id && review.right_identity === row.item_id && review.disposition === "verified_equivalent" && Number(row.year) >= Number(review.first_year) && Number(row.year) <= Number(review.last_year));
    if (!review) continue;
    const exported = family === "national" ? national.find(f => f.year === row.year && f.indicator_id === "trade.exports") : partners.find(f => f.entity_id === review.left_identity && f.year === row.year && f.indicator_id === "trade.exports");
    if (!exported || !exported.value_usd) continue;
    if (exported.source_id !== review.left_source_id) throw new Error("Domestic re-export reviewed source binding mismatch");
    const value = new D(exported.value_usd).minus(row.value_usd).toFixed();
    const expected = derived.find(f => f.indicator_id === "reexports" && f.dimension === family && f.item_id === review.left_identity && f.year === row.year);
    const refs = [...JSON.parse(exported.source_refs), [row.source_id, row.source_sheet, row.source_cell]];
    if (!expected || !new D(expected.value_usd).eq(value) || JSON.stringify(refs) !== expected.input_source_refs || new D(value).lt(-1)) throw new Error("Domestic re-export reviewed source binding/calculation mismatch");
    facts.push({ entityId: row.item_id, year: Number(row.year), indicatorId: "trade.reexports", valueUsd: value, unit: "usd", basis: "actual", valueStatus: "numeric", publicationStatus: "unspecified", role: "derived", sourceId: exported.source_id, sourceRefs: JSON.stringify(refs), sourceValue: null, sourceUnit: null, sourceLabel: null, sourceNumberFormat: null, sourceBlock: row.source_block, lastReviewedAt: REVIEWED });
  }
  for (const year of Array.from({ length: 12 }, (_, index) => 2014 + index)) {
    const total = facts.find(f => f.entityId === "goods.total" && f.year === year && f.indicatorId === "trade.domestic_exports")!;
    for (const dimension of year >= 2020 ? ["country", "product"] : ["country"]) {
      const sum = selectedRows.filter(row => row.dimension === dimension && Number(row.year) === year && ["detail", "residual"].includes(row.role)).reduce((sum, row) => sum.plus(row.value_usd), new D(0));
      if (sum.minus(total.valueUsd).abs().gt(1)) throw new Error("Domestic national/detail reconciliation mismatch");
    }
  }
  facts.sort((a, b) => tradeDomesticFactKey(a).localeCompare(tradeDomesticFactKey(b), "en"));
  const data = { entities: [...entities.values()].sort((a, b) => a.id.localeCompare(b.id, "en")), facts };
  const catalogue = JSON.stringify(data.entities, null, 2) + "\n";
  return { data, report: { status: "passed", scope: "annual_domestic_exports", years: [...new Set(facts.filter(f => f.entityId === "goods.total").map(f => f.year))].sort((a, b) => a - b), productYears: [...new Set(facts.filter(f => entities.get(f.entityId)?.kind === "product").map(f => f.year))].sort((a, b) => a - b), primaryObservations: facts.filter(f => f.role !== "derived").length, derivedObservations: facts.filter(f => f.role === "derived").length, countryEntities: data.entities.filter(e => e.kind === "country").length, productEntities: data.entities.filter(e => e.kind === "product").length, canonicalSha256: hash(tradeDomesticCsv(data)), catalogueSha256: hash(catalogue), inputSha256, sourceSha256, researchPackageStatus: packageReport.status, outsideScopeHoldCount: issues.filter(issue => !relevant(issue)).length, reviewedAt: REVIEWED } };
}

export async function prepareTradeDomesticData(root: string, mode: "write" | "check"): Promise<void> {
  const { data, report } = await buildTradeDomesticData(root);
  for (const [name, content] of [["data/imports/trade-domestic-annual.csv", tradeDomesticCsv(data)], ["data/taxonomy/trade-domestic.json", JSON.stringify(data.entities, null, 2) + "\n"], ["data/reports/trade-domestic-validation.json", JSON.stringify(report, null, 2) + "\n"]]) {
    const target = path.join(root, name);
    if (mode === "check") await assertGeneratedArtifactMatches("Domestic exports", target, content);
    else { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content); }
  }
}

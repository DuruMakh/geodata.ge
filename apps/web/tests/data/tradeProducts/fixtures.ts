import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { serializeBomCsvRows } from "../../../lib/data/csvEscape";
import type { TradeProductEntity, TradeProductFact, TradeProductsAcceptance } from "../../../lib/data/tradeProducts/types";
import { tradePartnerNationalFacts } from "../tradePartners/fixtures";

export const TRADE_RESEARCH = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07";
const root = path.resolve(process.cwd(), "../.."), scratch = path.join(root, ".superpowers/sdd/2026-10-09-trade-products");
const directories: string[] = [];
const blocks = ["1995-1999", "2000-2014", "2015-2019", "2020-2025"];
const originals = ["Export-Product-by-4-digit-1995-1999.xlsx", "Export-Product-by-4-digit-2000-2014.xlsx", "Export-Product-by-4-digit-2015-2026.xlsx", "Import-products--1995-1999_eng.xlsx", "Import-Product-by-4-digit-2000-2014.xlsx", "Import-Product-by-4-digit-2015-2026.xlsx"];

export async function createTradeProductsPackageFixture(): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, "fixture-")); directories.push(directory);
  const files = ["full-source-manifest.json", "source-layouts.json", "expected-observation-inventory.json", "coverage.csv", "prepared-validation.json", "prepared-reconciliation.csv", "unresolved-source-issues.json", "identity-review.csv", ...originals.map(file => `official/${file}`), ...blocks.map(block => `goods-products-annual/hs4-${block}.csv`)];
  for (const file of files) {
    const target = path.join(directory, TRADE_RESEARCH, file);
    await mkdir(path.dirname(target), { recursive: true }); await cp(path.join(root, TRADE_RESEARCH, file), target);
  }
  for (const file of ["data/imports/trade-overview-annual.csv", "data/reports/trade-overview-validation.json", "data/localization/en/labels.json"]) {
    const target = path.join(directory, file); await mkdir(path.dirname(target), { recursive: true }); await cp(path.join(root, file), target);
  }
  const entities = new Map<string, Record<string, string>>();
  const labels = JSON.parse(await readFile(path.join(directory, "data/localization/en/labels.json"), "utf8"));
  const ranges = [[24, "food_agriculture"], [27, "minerals_fuels"], [40, "chemicals_materials"], [67, "clothing_wood_paper"], [83, "metals_stone_glass"], [85, "machinery_electronics"], [89, "vehicles_transport"], [99, "other_products"]] as const;
  for (const block of blocks) {
    const rows = parse(await readFile(path.join(directory, TRADE_RESEARCH, `goods-products-annual/hs4-${block}.csv`)), { columns: true, bom: true }) as Record<string, string>[];
    for (const row of rows.filter(row => row.role === "detail")) if (!entities.has(row.item_id)) {
      const prefix = Number(row.product_code.slice(0, 2));
      entities.set(row.item_id, { entity_id: row.item_id, source_block: block, code: row.product_code, label_ka: `საქონელი ${row.product_code}`, source_label_en: row.product_label_en, category_id: row.product_code === "7700" ? "other_products" : ranges.find(([max]) => prefix > 0 && prefix <= max)?.[1] ?? "other_products", aliases_ka: "[]", aliases_en: "[]" });
      labels[row.item_id] = { text: row.product_label_en, reviewedAt: "2026-10-09" };
    }
  }
  const headers = ["entity_id", "source_block", "code", "label_ka", "source_label_en", "category_id", "aliases_ka", "aliases_en"];
  await writeFile(path.join(directory, "data/imports/trade-products-catalogue.csv"), serializeBomCsvRows([headers, ...[...entities.values()].map(entity => headers.map(field => entity[field]))]));
  await writeFile(path.join(directory, "data/localization/en/labels.json"), JSON.stringify(labels));
  return directory;
}
export async function cleanupTradeProductsFixtures() {
  for (const directory of directories) {
    if (!path.resolve(directory).startsWith(`${scratch}${path.sep}`)) throw new Error("Trade products fixture outside owned workspace");
    await rm(directory, { recursive: true, force: true });
  }
}
export async function readTradeProductsReport(directory: string): Promise<TradeProductsAcceptance> {
  return JSON.parse(await readFile(path.join(directory, "data/reports/trade-products-validation.json"), "utf8"));
}
export function tradeProductEntities(): TradeProductEntity[] {
  return [
    { id: "goods.hs4.2015-2019.8703", sourceBlock: "2015-2019", code: "8703", labelKa: "მსუბუქი ავტომობილები", sourceLabelEn: "Motor cars", categoryId: "vehicles_transport", aliasesKa: ["მანქანა"], aliasesEn: ["cars"] },
    { id: "goods.hs4.2020-2025.8703", sourceBlock: "2020-2025", code: "8703", labelKa: "მსუბუქი ავტომობილები", sourceLabelEn: "Motor cars", categoryId: "vehicles_transport", aliasesKa: ["მანქანა"], aliasesEn: ["cars"] },
    { id: "goods.hs4.2020-2025.2204", sourceBlock: "2020-2025", code: "2204", labelKa: "ღვინო", sourceLabelEn: "Wine of fresh grapes", categoryId: "food_agriculture", aliasesKa: [], aliasesEn: ["wine"] },
    { id: "goods.hs4.2020-2025.0101", sourceBlock: "2020-2025", code: "0101", labelKa: "ცოცხალი ცხენები", sourceLabelEn: "Live horses", categoryId: "food_agriculture", aliasesKa: [], aliasesEn: [] },
  ];
}
export function tradeProductFacts(): TradeProductFact[] {
  return tradeProductEntities().flatMap((entity, index) => {
    const years = entity.sourceBlock === "2015-2019" ? [2019] : [2024, 2025];
    return years.flatMap(year => (["trade.exports", "trade.imports"] as const).map(indicatorId => {
      const sourceId = `geostat_trade_${indicatorId === "trade.exports" ? "export" : "import"}-product-by-4-digit-2015-2026`;
      const value = index === 0 ? "100" : index === 1 ? indicatorId === "trade.exports" ? "200" : "300" : index === 2 ? "0" : null;
      return { entityId: entity.id, year, indicatorId, valueUsd: value, unit: "usd", basis: "actual", valueStatus: value === null ? "not_applicable" : "numeric", publicationStatus: "unspecified", role: "detail", sourceId, sourceRefs: JSON.stringify([[sourceId, `${entity.sourceBlock}-years`, `C${7 + index}`]]), sourceValue: value === null ? "-" : String(Number(value) / 1000), sourceUnit: "thousand_usd", sourceLabel: entity.sourceLabelEn, sourceNumberFormat: "#,##0.0", sourceBlock: entity.sourceBlock, lastReviewedAt: "2026-10-09" } as TradeProductFact;
    }));
  });
}
export const tradeProductNationalFacts = tradePartnerNationalFacts;

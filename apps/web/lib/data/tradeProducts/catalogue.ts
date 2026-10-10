import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { TradeProductEntity } from "./types";

export async function readTradeProductCatalogue(repositoryRoot: string): Promise<TradeProductEntity[]> {
  const rows = parse(await readFile(path.join(repositoryRoot, "data/imports/trade-products-catalogue.csv")), { columns: true, bom: true }) as Record<string, string>[];
  return rows.map(row => ({ id: row.entity_id, sourceBlock: row.source_block as TradeProductEntity["sourceBlock"], code: row.code, labelKa: row.label_ka, sourceLabelEn: row.source_label_en, categoryId: row.category_id as TradeProductEntity["categoryId"], aliasesKa: JSON.parse(row.aliases_ka), aliasesEn: JSON.parse(row.aliases_en) }));
}

import type { ClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { TRADE_PRODUCT_CATEGORIES, type TradeProductCategoryId } from "../data/tradeProducts/types";
import type { Presentation } from "../i18n/types";
import { publicLabel } from "../i18n/labels";
import { matchesLabelQuery } from "../i18n/search";
import type { TradeProductsModel, TradeProductRankingRow } from "./tradeProducts";

export type TradeProductsBrowseView = "categories" | "all" | "selected";
export function findTradeProducts(input: { data: ClientTradeProductsData; model: TradeProductsModel; presentation: Presentation; view: TradeProductsBrowseView; categoryId: TradeProductCategoryId | null; query: string; selectedIds: readonly string[]; page: number }): { rows: TradeProductRankingRow[]; totalMatches: number; page: number; pageCount: number; categoryCounts: Record<TradeProductCategoryId, number> } {
  const { data, model, presentation, view, categoryId } = input;
  const query = input.query.normalize("NFC").trim().toLocaleLowerCase("en"), selected = new Set(input.selectedIds);
  const categoryCounts = Object.fromEntries(TRADE_PRODUCT_CATEGORIES.map(id => [id, 0])) as Record<TradeProductCategoryId, number>;
  data.entities.forEach(entity => { categoryCounts[entity.categoryId]++; });
  const rowsById = new Map([...model.ranking, ...model.missingRanking].map(row => [row.entityId, row]));
  const matches = data.entities.filter(entity => (view !== "selected" || selected.has(entity.id)) && (!categoryId || entity.categoryId === categoryId)).map(entity => {
    const label = publicLabel(presentation.locale, entity.id, entity.labelKa, presentation.englishLabels);
    const names = [label, entity.labelKa, entity.sourceLabelEn, entity.code, ...entity.aliasesKa, ...entity.aliasesEn];
    const exact = names.slice(0, 4).some(name => name.normalize("NFC").trim().toLocaleLowerCase("en") === query);
    return { row: rowsById.get(entity.id)!, matches: matchesLabelQuery(query, names), exact };
  }).filter(item => item.matches);
  const labelOrder = (a: (typeof matches)[number], b: (typeof matches)[number]) => a.row.label.localeCompare(b.row.label, presentation.locale) || a.row.entityId.localeCompare(b.row.entityId, "en");
  matches.sort((a, b) => {
    if (query) return Number(b.exact) - Number(a.exact) || labelOrder(a, b);
    if (a.row.valueUsd === null || b.row.valueUsd === null) return Number(a.row.valueUsd === null) - Number(b.row.valueUsd === null) || labelOrder(a, b);
    return b.row.valueUsd - a.row.valueUsd || labelOrder(a, b);
  });
  const pageCount = Math.ceil(matches.length / 25), page = Math.max(0, Math.min(input.page, Math.max(0, pageCount - 1)));
  const showCategories = view === "categories" && !categoryId && !query;
  return { rows: showCategories ? [] : matches.slice(page * 25, (page + 1) * 25).map(item => item.row), totalMatches: matches.length, page, pageCount, categoryCounts };
}

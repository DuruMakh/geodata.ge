import type { TradeOverviewFact } from "../../../lib/data/tradeOverview/types";

const sourceId = "geostat_trade_ftrade-1995-2026";
const sheet = "1995-2026";

export function tradeFixtureFacts(): TradeOverviewFact[] {
  return [
    { year: 2024, column: "AE", exports: "80", imports: "150", exportNative: "0.00008", importNative: "0.00015", turnover: "230", balance: "-70" },
    { year: 2025, column: "AF", exports: "100.25", imports: "200.5", exportNative: "0.00010025", importNative: "0.0002005", turnover: "300.75", balance: "-100.25" },
  ].flatMap(row => {
    const exportRef = [sourceId, sheet, `${row.column}5`];
    const importRef = [sourceId, sheet, `${row.column}20`];
    const common = { year: row.year, unit: "usd" as const, basis: "actual" as const, valueStatus: "numeric" as const, publicationStatus: "unspecified" as const, sourceId, lastReviewedAt: "2026-10-08" };
    return [
      { ...common, indicatorId: "trade.exports" as const, valueUsd: row.exports, role: "total" as const, sourceRefs: JSON.stringify([exportRef]), sourceValue: row.exportNative, sourceUnit: "million_usd", sourceLabel: "Total Exports", sourceNumberFormat: "#,##0.0" },
      { ...common, indicatorId: "trade.imports" as const, valueUsd: row.imports, role: "total" as const, sourceRefs: JSON.stringify([importRef]), sourceValue: row.importNative, sourceUnit: "million_usd", sourceLabel: "Total Imports", sourceNumberFormat: "#,##0.0" },
      { ...common, indicatorId: "trade.turnover" as const, valueUsd: row.turnover, role: "derived" as const, sourceRefs: JSON.stringify([exportRef, importRef]), sourceValue: null, sourceUnit: null, sourceLabel: null, sourceNumberFormat: null },
      { ...common, indicatorId: "trade.balance" as const, valueUsd: row.balance, role: "derived" as const, sourceRefs: JSON.stringify([exportRef, importRef]), sourceValue: null, sourceUnit: null, sourceLabel: null, sourceNumberFormat: null },
    ];
  });
}

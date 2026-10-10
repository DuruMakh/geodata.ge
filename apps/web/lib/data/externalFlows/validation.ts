import Decimal from "decimal.js";
import { MONEY_TRANSFER_MEASURES, MONEY_TRANSFER_SOURCES, MONEY_TRANSFER_YEARS, moneyTransferFactKey, type MoneyTransferEntity, type MoneyTransfersData } from "./types";

const D = Decimal.clone({ precision: 50 });
export function moneyTransfersEnglishLabels(entities: readonly MoneyTransferEntity[], labels: Record<string, { text: string; reviewedAt: string }>): string {
  return JSON.stringify(Object.fromEntries([...entities].sort((a, b) => a.id.localeCompare(b.id, "en")).map(entity => {
    const entry = labels[entity.id];
    if (!entry?.text || !/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt)) throw new Error(`Money transfer English companion missing: ${entity.id}`);
    return [entity.id, { text: entry.text, reviewedAt: entry.reviewedAt }];
  })));
}
export function validateMoneyTransfersData({ entities, facts }: MoneyTransfersData): void {
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));
  if (!entities.length || entityMap.size !== entities.length) throw new Error("Money transfer catalogue identity duplicate or missing");
  for (const entity of entities) {
    if (!entity.labelKa || !/[Ⴀ-ჿ]/.test(entity.labelKa)) throw new Error(`Missing reviewed money transfer label: ${entity.id}`);
    const prefix = entity.kind === "estimate" ? "bop." : "transfer.";
    if (!entity.id.startsWith(prefix) || !/^[a-z]+\.[a-z0-9_]+$/.test(entity.id)) throw new Error(`Money transfer catalogue identity mismatch: ${entity.id}`);
  }
  const keys = new Set<string>();
  for (const fact of facts) {
    const entity = entityMap.get(fact.entityId), key = moneyTransferFactKey(fact);
    if (!entity || !MONEY_TRANSFER_MEASURES.includes(fact.measure) || keys.has(key)) throw new Error(`Money transfer identity/measure/duplicate mismatch: ${key}`);
    if (!Number.isInteger(fact.year) || fact.year < MONEY_TRANSFER_YEARS.first || fact.year > MONEY_TRANSFER_YEARS.last) throw new Error(`Money transfer coverage mismatch: ${key}`);
    if (fact.unit !== "usd" || fact.basis !== "actual" || !/^\d{4}-\d{2}-\d{2}$/.test(fact.vintage) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt) || !fact.sourceSheet || !/^[A-Z]+\d+(;[A-Z]+\d+)*$/.test(fact.sourceCells)) throw new Error(`Money transfer status/source contract mismatch: ${key}`);
    const estimate = entity.kind === "estimate";
    if (fact.sourceId !== (estimate ? MONEY_TRANSFER_SOURCES.estimate : MONEY_TRANSFER_SOURCES.transfers) || fact.sourceUnit !== (estimate ? "million_usd" : "thousand_usd")) throw new Error(`Money transfer source binding mismatch: ${key}`);
    if (fact.valueStatus === "blank") {
      if (fact.valueUsd !== null || (!estimate && fact.monthsReported !== 0)) throw new Error(`Money transfer blank became a value: ${key}`);
    } else {
      if (fact.valueUsd === null) throw new Error(`Missing money transfer value: ${key}`);
      const value = new D(fact.valueUsd);
      if (!value.isFinite() || value.decimalPlaces() > 20 || value.abs().gte("100000000000000000000")) throw new Error(`Money transfer database precision mismatch: ${key}`);
      const months = fact.valueStatus === "numeric" ? fact.monthsReported === 12 : fact.monthsReported !== null && fact.monthsReported >= 1 && fact.monthsReported <= 11;
      if (estimate ? fact.valueStatus !== "numeric" || fact.monthsReported !== null : !months) throw new Error(`Money transfer months reported mismatch: ${key}`);
    }
    keys.add(key);
  }
}

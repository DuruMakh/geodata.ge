import Decimal from "decimal.js";
import { FOREIGN_INVESTMENT_SOURCES, FOREIGN_INVESTMENT_YEARS, foreignInvestmentFactKey, type ForeignInvestmentData, type ForeignInvestmentEntity } from "./types";

const D = Decimal.clone({ precision: 50 });
export function foreignInvestmentEnglishLabels(entities: readonly ForeignInvestmentEntity[], labels: Record<string, { text: string; reviewedAt: string }>): string {
  return JSON.stringify(Object.fromEntries([...entities].sort((a, b) => a.id.localeCompare(b.id, "en")).map(entity => {
    const entry = labels[entity.id];
    if (!entry?.text || !/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt)) throw new Error(`Foreign investment English companion missing: ${entity.id}`);
    return [entity.id, { text: entry.text, reviewedAt: entry.reviewedAt }];
  })));
}
export function validateForeignInvestmentData({ entities, facts }: ForeignInvestmentData): void {
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));
  if (!entities.length || entityMap.size !== entities.length) throw new Error("Foreign investment catalogue identity duplicate or missing");
  for (const entity of entities) {
    if (!entity.labelKa || !/[Ⴀ-ჿ]/.test(entity.labelKa)) throw new Error(`Missing reviewed foreign investment label: ${entity.id}`);
    const expected = entity.dimension === null ? "fdi.total" : `fdi.${entity.dimension}.`;
    if (!(entity.dimension === null ? entity.id === expected && entity.kind === "total" : entity.id.startsWith(expected) && entity.kind !== "total") || !/^fdi\.[a-z]+(\.[a-z0-9_]+)?$/.test(entity.id)) throw new Error(`Foreign investment catalogue identity mismatch: ${entity.id}`);
  }
  const keys = new Set<string>();
  for (const fact of facts) {
    const entity = entityMap.get(fact.entityId), key = foreignInvestmentFactKey(fact);
    if (!entity || keys.has(key)) throw new Error(`Foreign investment identity/duplicate mismatch: ${key}`);
    const scope = entity.dimension ?? "total";
    if (!Number.isInteger(fact.year) || fact.year < FOREIGN_INVESTMENT_YEARS[scope] || fact.year > FOREIGN_INVESTMENT_YEARS.last) throw new Error(`Foreign investment coverage mismatch: ${key}`);
    if (fact.unit !== "usd" || fact.basis !== "actual" || !/^\d{4}-\d{2}-\d{2}$/.test(fact.vintage) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt) || !fact.sourceSheet || !/^[A-Z]+\d+$/.test(fact.sourceCells)) throw new Error(`Foreign investment status/source contract mismatch: ${key}`);
    if (fact.sourceId !== FOREIGN_INVESTMENT_SOURCES[scope] || fact.sourceUnit !== (scope === "total" ? "million_usd" : "thousand_usd")) throw new Error(`Foreign investment source binding mismatch: ${key}`);
    if (fact.valueStatus === "not_applicable") {
      if (fact.valueUsd !== null) throw new Error(`Foreign investment not-applicable cell became a value: ${key}`);
    } else {
      if (fact.valueStatus !== "numeric" || fact.valueUsd === null) throw new Error(`Missing foreign investment value: ${key}`);
      const value = new D(fact.valueUsd);
      if (!value.isFinite() || value.decimalPlaces() > 20 || value.abs().gte("100000000000000000000")) throw new Error(`Foreign investment database precision mismatch: ${key}`);
    }
    keys.add(key);
  }
}

import type { ServedGovernmentDebtFact } from "../../servedRows";
import { GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS } from "./types";

/**
 * The source registry's form of a debt document id. The debt package keeps its
 * manifest's bare ids (mof_…); data/sources/source-documents.csv registers the same
 * documents as source.mof_…. Idempotent, so it is safe on either form.
 */
export function registryDebtSourceId(id: string): string {
  return id.startsWith("source.") ? id : `source.${id}`;
}

// Actual external service is read from the public debt bulletins, one bulletin
// per window of years, while the fact's own source is the domestic table.
function externalServiceSourceId(year: number): string | null {
  if (year >= 2013 && year <= 2016) return "source.mof_public_debt_bulletin_n7";
  if (year <= 2019) return "source.mof_public_debt_bulletin_n13";
  if (year <= 2022) return "source.mof_public_debt_bulletin_n19";
  if (year <= 2025) return "source.mof_public_debt_bulletin_n25";
  return null;
}

/** Every registry source a debt fact rests on, de-duplicated, in citation order. */
export function sourcesForDebtFact(fact: ServedGovernmentDebtFact): string[] {
  const ids: string[] = fact.sourceId ? [registryDebtSourceId(fact.sourceId)] : [];
  // An unpublished rate cites every document that was checked for it.
  if (fact.family === "rate" && fact.status === "not_available" && !fact.sourceId) {
    ids.push(...GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS.map(registryDebtSourceId));
  }
  if (fact.family === "service" && fact.status === "actual") {
    const external = externalServiceSourceId(fact.year);
    if (external) ids.push(external);
  }
  return [...new Set(ids)];
}

import { MIXED_SOURCE_ID } from "./aggregateMunicipalFacts";

export function assertMunicipalAggregateSourceIds(
  label: string,
  sourceIds: Iterable<string>,
  registeredSourceIds: Set<string>,
): void {
  const unknownSourceIds = Array.from(
    new Set(
      [...sourceIds].filter(
        (sourceId) => sourceId !== MIXED_SOURCE_ID && !registeredSourceIds.has(sourceId),
      ),
    ),
  ).sort();

  if (unknownSourceIds.length > 0) {
    throw new Error(`${label} reference unknown source documents: ${unknownSourceIds.join(", ")}`);
  }
}

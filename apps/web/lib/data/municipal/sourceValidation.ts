import { MIXED_SOURCE_ID } from "./aggregateMunicipalFacts";
import { MUNICIPAL_YEARS } from "../coverage";
import { MUNICIPAL_COUNTRY_ID, type MunicipalFunctionFact, type MunicipalTotalFact } from "./types";

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

function assertExactPanelKeys(label: string, actualKeys: string[], expectedKeys: string[]): void {
  const actual = new Set(actualKeys);
  const expected = new Set(expectedKeys);
  const missing = [...expected].filter((key) => !actual.has(key));
  const unexpected = [...actual].filter((key) => !expected.has(key));
  const duplicate = [...new Set(actualKeys.filter((key, index) => actualKeys.indexOf(key) !== index))];

  if (missing.length > 0 || duplicate.length > 0 || unexpected.length > 0) {
    throw new Error(
      `${label} mismatch; missing: ${missing.join(", ") || "none"}; ` +
        `duplicate: ${duplicate.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}`,
    );
  }
}

export function assertMunicipalCountryPanel(input: {
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
  categoryIds: Set<string>;
  registeredSourceIds: Set<string>;
}): void {
  const expectedFunctionKeys = MUNICIPAL_YEARS.flatMap((year) =>
    [...input.categoryIds].map((categoryId) => `${year}:${MUNICIPAL_COUNTRY_ID}:${categoryId}`),
  );
  const expectedTotalKeys = MUNICIPAL_YEARS.map((year) => `${year}:${MUNICIPAL_COUNTRY_ID}`);

  assertExactPanelKeys(
    "Georgia municipal function facts",
    input.functionFacts.map((fact) => `${fact.year}:${fact.municipalityCode}:${fact.categoryId}`),
    expectedFunctionKeys,
  );
  assertExactPanelKeys(
    "Georgia municipal total facts",
    input.totalFacts.map((fact) => `${fact.year}:${fact.municipalityCode}`),
    expectedTotalKeys,
  );
  assertMunicipalAggregateSourceIds(
    "Georgia municipal facts",
    [...input.functionFacts, ...input.totalFacts].map((fact) => fact.sourceId),
    input.registeredSourceIds,
  );
}

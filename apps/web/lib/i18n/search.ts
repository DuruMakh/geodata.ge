/**
 * Folds text for matching: canonical decomposition, accents dropped, runs of white space
 * collapsed to one space, lower case. "Türkiye" and "turkiye" fold to the same text; Georgian
 * letters carry no accents and fold to themselves.
 */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").toLocaleLowerCase("en");

/** True when one of `values` contains the query. Pass every name a row can be found by, in both languages. */
export function matchesLabelQuery(query: string, values: readonly string[]): boolean {
  const normalized = fold(query.trim());
  return normalized === "" || values.some((value) => fold(value).includes(normalized));
}

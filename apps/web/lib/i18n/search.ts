/**
 * Folds text for matching: canonical decomposition, accents dropped, runs of white space
 * collapsed to one space, dashes to a hyphen, lower case. "Türkiye" and "turkiye" fold to the same text, and a
 * typed "15-19" finds the label "15–19"; Georgian letters carry no accents and fold to themselves.
 */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").replace(/[\u2010-\u2015\u2212]/g, "-").toLocaleLowerCase("en");

/** True when one of `values` contains the query. Pass every name a row can be found by, in both languages. */
export function matchesLabelQuery(query: string, values: readonly string[]): boolean {
  const normalized = fold(query.trim());
  return normalized === "" || values.some((value) => fold(value).includes(normalized));
}

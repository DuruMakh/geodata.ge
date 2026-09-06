export function matchesLabelQuery(query: string, values: readonly string[]): boolean {
  const normalized = query.normalize("NFC").trim().toLocaleLowerCase("en");
  return normalized === "" || values.some((value) => value.normalize("NFC").toLocaleLowerCase("en").includes(normalized));
}

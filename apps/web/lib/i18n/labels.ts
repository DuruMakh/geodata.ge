import type { EnglishCatalogue, Locale } from "./types";

export function publicLabel(locale: Locale, id: string, labelKa: string, englishLabels: Readonly<Record<string, string>>): string {
  if (locale === "ka") return labelKa;
  const label = Object.hasOwn(englishLabels, id) ? englishLabels[id] : undefined;
  if (!label?.trim()) throw new Error(`Missing English label: ${id}`);
  return label;
}

export function pickEnglishLabels(catalogue: EnglishCatalogue, ids: readonly string[]): Record<string, string> {
  return Object.fromEntries([...new Set(ids)].map((id) => {
    const label = Object.hasOwn(catalogue.labels, id) ? catalogue.labels[id].text : undefined;
    if (!label?.trim()) throw new Error(`Missing English label: ${id}`);
    return [id, label];
  }));
}

import { z } from "zod";
import { SERVICE_MESSAGE_KEYS, SERVICE_MESSAGE_PARAMETERS } from "../factQuery/localization";
import type { EnglishCatalogue, Messages, TranslationInventory } from "./types";

const georgianText = /\p{Script=Georgian}/u;
const reviewedAt = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "A review date must be a real calendar date");
const reviewedText = z.strictObject({
  text: z.string().trim().min(1).refine((value) => !georgianText.test(value), "English text contains untranslated Georgian"),
  reviewedAt,
});
const id = z.string().min(1);

export const englishCatalogueSchema = z.strictObject({
  labels: z.record(id, reviewedText),
  programmeHistory: z.record(id, z.record(z.string().regex(/^\d{4}$/), reviewedText.extend({ originalKa: z.string().min(1) }))),
  sources: z.record(id, z.strictObject({ name: reviewedText, derivation: reviewedText.nullable() })),
  documents: z.record(id, z.strictObject({
    title: reviewedText,
    publisher: reviewedText,
    attribution: reviewedText.nullable(),
    documentLanguage: z.enum(["ka", "en", "mul"]).nullable(),
  })),
});

export function validateCatalogue(catalogue: EnglishCatalogue, inventory: TranslationInventory): string[] {
  const parsed = englishCatalogueSchema.safeParse(catalogue);
  if (!parsed.success) return parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  const errors: string[] = [];
  for (const [section, ids] of [
    ["labels", inventory.labelIds], ["sources", inventory.sourceIds], ["documents", inventory.documentIds],
  ] as const) {
    for (const key of ids) {
      if (!Object.hasOwn(catalogue[section], key)) errors.push(`Missing ${section} translation: ${key}`);
    }
  }
  for (const row of inventory.programmeHistory) {
    const translated = catalogue.programmeHistory[row.seriesId]?.[row.year];
    if (!translated) errors.push(`Missing programme history: ${row.seriesId}:${row.year}`);
    else if (translated.originalKa !== row.originalKa) errors.push(`Changed original programme label: ${row.seriesId}:${row.year}`);
  }
  for (const key of inventory.derivedSourceIds) {
    if (!catalogue.sources[key]?.derivation) errors.push(`Missing source derivation: ${key}`);
  }
  for (const key of inventory.attributedDocumentIds) {
    if (!catalogue.documents[key]?.attribution) errors.push(`Missing document attribution: ${key}`);
  }
  return errors;
}

function parameters(template: string): string {
  return [...new Set([...template.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]))].sort().join(",");
}

export function validateMessages(ka: Messages, en: Messages): string[] {
  const errors: string[] = [];
  for (const key of new Set([...Object.keys(ka), ...Object.keys(en)])) {
    const kaValue = Object.hasOwn(ka, key) ? ka[key] : undefined;
    const enValue = Object.hasOwn(en, key) ? en[key] : undefined;
    if (!kaValue?.trim()) errors.push(`Missing or blank Georgian message: ${key}`);
    if (!enValue?.trim()) errors.push(`Missing or blank English message: ${key}`);
    if (kaValue && enValue && parameters(kaValue) !== parameters(enValue)) errors.push(`Mismatched translation parameters: ${key}`);
    if (enValue && georgianText.test(enValue)) errors.push(`Untranslated Georgian in English message: ${key}`);
  }
  return errors;
}

export const serviceMessagesSchema = z.record(z.string().min(1), z.string().trim().min(1));

export function validateServiceMessages(ka: Messages, en: Messages): string[] {
  const errors: string[] = [];
  for (const key of SERVICE_MESSAGE_KEYS) {
    for (const [locale, messages] of [["ka", ka], ["en", en]] as const) {
      if (!Object.hasOwn(messages, key) || !messages[key]?.trim()) errors.push(`Missing service message: ${locale}:${key}`);
      else {
        const expected = [...(SERVICE_MESSAGE_PARAMETERS[key]?.[locale] ?? [])].sort().join(",");
        if (parameters(messages[key]) !== expected) errors.push(`Changed service parameters: ${locale}:${key}`);
        if (locale === "en" && georgianText.test(messages[key])) errors.push(`Untranslated service message: ${key}`);
      }
    }
  }
  for (const key of new Set([...Object.keys(ka), ...Object.keys(en)])) {
    if ((SERVICE_MESSAGE_KEYS as readonly string[]).includes(key)) continue;
    if (!/^(sources\..+\.(name|derivation)|documents\..+\.(title|publisher|attribution))$/.test(key)) errors.push(`Unknown service message key: ${key}`);
    if (!ka[key]?.trim() || !en[key]?.trim()) errors.push(`Missing service source companion: ${key}`);
    if (en[key] && georgianText.test(en[key])) errors.push(`Untranslated service source companion: ${key}`);
  }
  return errors;
}

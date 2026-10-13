import path from "node:path";
import { loadEnglishCatalogue } from "./catalogue.server";
import { pickEnglishLabels } from "./labels";
import { getMessages } from "./messages.server";
import type { Locale, MessageScope, Presentation } from "./types";

/**
 * `ids` are the series an English page names. A Georgian page shows Georgian names, so it receives only `kaIds`: the
 * English names it still reads, for a bilingual search box or a model that builds the English label beside the Georgian.
 */
export async function getPresentation(locale: Locale, scopes: readonly MessageScope[], ids: readonly string[], kaIds: readonly string[] = []): Promise<Presentation> {
  const [catalogue, messages] = await Promise.all([
    loadEnglishCatalogue(path.resolve(process.cwd(), "../..")), getMessages(locale, scopes),
  ]);
  return { locale, messages, englishLabels: pickEnglishLabels(catalogue, locale === "en" ? ids : kaIds) };
}

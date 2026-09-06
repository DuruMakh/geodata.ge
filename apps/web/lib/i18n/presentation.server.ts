import path from "node:path";
import { loadEnglishCatalogue } from "./catalogue.server";
import { pickEnglishLabels } from "./labels";
import { getMessages } from "./messages.server";
import type { Locale, MessageScope, Presentation } from "./types";

export async function getPresentation(locale: Locale, scopes: readonly MessageScope[], ids: readonly string[]): Promise<Presentation> {
  const [catalogue, messages] = await Promise.all([
    loadEnglishCatalogue(path.resolve(process.cwd(), "../..")), getMessages(locale, scopes),
  ]);
  return { locale, messages, englishLabels: pickEnglishLabels(catalogue, ids) };
}

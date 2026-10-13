import path from "node:path";
import { loadEnglishCatalogue } from "./catalogue.server";
import { pickEnglishLabels } from "./labels";
import { getMessages } from "./messages.server";
import type { Locale, Messages, MessageScope, Presentation } from "./types";

/**
 * The namespaces the layouts' I18nProviders already hold: the root layout's `common` on every page, and the explorer
 * layout's `controls` (lib/pages/explorer-layout.tsx). A page's own I18nProvider adds to them (lib/i18n/provider.tsx),
 * so what a page ships leaves them out: see clientPresentation.
 */
export const LAYOUT_SCOPES = ["common", "controls"] as const satisfies readonly MessageScope[];

/**
 * `scopes` are the page's own namespaces; the layout's are always loaded too, for the text the server renders.
 * `ids` are the series an English page names. A Georgian page shows Georgian names, so it receives only `kaIds`: the
 * English names it still reads, for a bilingual search box or a model that builds the English label beside the Georgian.
 */
export async function getPresentation(locale: Locale, scopes: readonly MessageScope[], ids: readonly string[], kaIds: readonly string[] = []): Promise<Presentation> {
  const [catalogue, messages] = await Promise.all([
    loadEnglishCatalogue(path.resolve(process.cwd(), "../..")), getMessages(locale, [...LAYOUT_SCOPES, ...scopes]),
  ]);
  return { locale, messages, englishLabels: pickEnglishLabels(catalogue, locale === "en" ? ids : kaIds) };
}

/** Messages without the layout's namespaces: what a page hands an I18nProvider. */
export function withoutLayoutMessages(messages: Messages): Messages {
  return Object.fromEntries(Object.entries(messages).filter(([key]) => !LAYOUT_SCOPES.some((scope) => key.startsWith(`${scope}.`))));
}

/** The presentation a page hands its client components: they read the layout's namespaces from its provider. */
export function clientPresentation(presentation: Presentation): Presentation {
  return { ...presentation, messages: withoutLayoutMessages(presentation.messages) };
}

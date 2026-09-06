import ka from "../i18n/messages/ka/seo.json";
import en from "../i18n/messages/en/seo.json";
import type { Locale } from "../i18n/types";

const messages = { ka, en };
export function seoMessage(locale: Locale, key: keyof typeof ka): string {
  return messages[locale][key];
}

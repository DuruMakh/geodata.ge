import ka from "./messages/ka/workbook.json";
import en from "./messages/en/workbook.json";
import { message } from "./messages";
import type { Locale, TemplateValues } from "./types";

// The synchronous export model and lazy writer share this small, browser-safe scope.
export function workbookMessage(locale: Locale, key: keyof typeof ka, values?: TemplateValues): string {
  return message(locale === "ka" ? ka : en, key, values);
}

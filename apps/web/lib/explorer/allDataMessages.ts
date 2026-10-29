import { getMessages } from "../i18n/messages.server";
import type { Locale, Messages } from "../i18n/types";

/**
 * `common` and `allData` in one language: the names and search words `buildSearchPages` reads. Shared by the All data page and
 * the MCP snapshot build, which cannot import the page (it pulls in `server-only` and React).
 */
export function allDataMessages(locale: Locale): Promise<Messages> {
  return getMessages(locale, ["common", "allData"]);
}

import "server-only";

import ka from "./messages/ka/groups.json";
import en from "./messages/en/groups.json";
import type { Locale, Messages } from "./types";

/** The group pages' strings, for the components that render on them without a page-level `getMessages`. */
export function getGroupsMessages(locale: Locale): Messages {
  return locale === "en" ? en : ka;
}

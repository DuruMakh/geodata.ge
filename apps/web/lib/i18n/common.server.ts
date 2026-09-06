import ka from "./messages/ka/common.json";
import en from "./messages/en/common.json";
import type { Locale, Messages } from "./types";

export function getCommonMessages(locale: Locale): Messages {
  return locale === "en" ? en : ka;
}

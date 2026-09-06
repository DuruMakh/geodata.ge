import type { Locale, Messages, MessageScope } from "./types";

const dictionaries = {
  ka: {
    common: () => import("./messages/ka/common.json"),
    format: () => import("./messages/ka/format.json"),
    controls: () => import("./messages/ka/controls.json"),
    main: () => import("./messages/ka/main.json"),
    workbook: () => import("./messages/ka/workbook.json"),
    methodology: () => import("./messages/ka/methodology.json"),
    analysis: () => import("./messages/ka/analysis.json"),
    municipal: () => import("./messages/ka/municipal.json"),
  },
  en: {
    common: () => import("./messages/en/common.json"),
    format: () => import("./messages/en/format.json"),
    controls: () => import("./messages/en/controls.json"),
    main: () => import("./messages/en/main.json"),
    workbook: () => import("./messages/en/workbook.json"),
    methodology: () => import("./messages/en/methodology.json"),
    analysis: () => import("./messages/en/analysis.json"),
    municipal: () => import("./messages/en/municipal.json"),
  },
} satisfies Record<Locale, Record<MessageScope, () => Promise<{ default: Messages }>>>;

export async function getMessages(locale: Locale, scopes: readonly MessageScope[]): Promise<Messages> {
  const loaded = await Promise.all([...new Set(scopes)].map((scope) => dictionaries[locale][scope]()));
  const result: Record<string, string> = {};
  for (const dictionary of loaded) {
    for (const [key, value] of Object.entries(dictionary.default)) {
      if (Object.hasOwn(result, key)) throw new Error(`Duplicate translation key: ${key}`);
      result[key] = value;
    }
  }
  return result;
}

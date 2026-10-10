import type { Locale, Messages, MessageScope } from "./types";

const dictionaries = {
  ka: {
    wages: () => import("./messages/ka/wages.json"),
    trade: () => import("./messages/ka/trade.json"),
    unemployment: () => import("./messages/ka/unemployment.json"),
    sectors: () => import("./messages/ka/sectors.json"),
    regionalEconomies: () => import("./messages/ka/regional-economies.json"),
    gdp: () => import("./messages/ka/gdp.json"),
    common: () => import("./messages/ka/common.json"),
    format: () => import("./messages/ka/format.json"),
    controls: () => import("./messages/ka/controls.json"),
    main: () => import("./messages/ka/main.json"),
    workbook: () => import("./messages/ka/workbook.json"),
    methodology: () => import("./messages/ka/methodology.json"),
    analysis: () => import("./messages/ka/analysis.json"),
    municipal: () => import("./messages/ka/municipal.json"),
    debt: () => import("./messages/ka/debt.json"),
    deficit: () => import("./messages/ka/deficit.json"),
    landing: () => import("./messages/ka/landing.json"),
    hub: () => import("./messages/ka/hub.json"),
    about: () => import("./messages/ka/about.json"),
    connect: () => import("./messages/ka/connect.json"),
    seo: () => import("./messages/ka/seo.json"),
    inflation: () => import("./messages/ka/inflation.json"),
    demography: () => import("./messages/ka/demography.json"),
  },
  en: {
    wages: () => import("./messages/en/wages.json"),
    trade: () => import("./messages/en/trade.json"),
    unemployment: () => import("./messages/en/unemployment.json"),
    sectors: () => import("./messages/en/sectors.json"),
    regionalEconomies: () => import("./messages/en/regional-economies.json"),
    gdp: () => import("./messages/en/gdp.json"),
    common: () => import("./messages/en/common.json"),
    format: () => import("./messages/en/format.json"),
    controls: () => import("./messages/en/controls.json"),
    main: () => import("./messages/en/main.json"),
    workbook: () => import("./messages/en/workbook.json"),
    methodology: () => import("./messages/en/methodology.json"),
    analysis: () => import("./messages/en/analysis.json"),
    municipal: () => import("./messages/en/municipal.json"),
    debt: () => import("./messages/en/debt.json"),
    deficit: () => import("./messages/en/deficit.json"),
    landing: () => import("./messages/en/landing.json"),
    hub: () => import("./messages/en/hub.json"),
    about: () => import("./messages/en/about.json"),
    connect: () => import("./messages/en/connect.json"),
    seo: () => import("./messages/en/seo.json"),
    inflation: () => import("./messages/en/inflation.json"),
    demography: () => import("./messages/en/demography.json"),
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

import type { Locale } from "../i18n/types";

// Georgian display copy for the municipalities section.
//
// These live in the UI, not in data/taxonomy/municipal-regions.json, on purpose:
// that file is mirrored by the MunicipalRegion Prisma model and parity-checked
// on {id, kaLabel, sortOrder}, so adding a field there would mean a migration,
// a live import and a parity re-verification for one word in one headline.

/**
 * Genitive forms for region headlines ("იმერეთის მუნიციპალური ბიუჯეტები").
 * Reviewed once and stored, for the same reason municipalities carry a reviewed
 * display_name_ka: deriving Georgian genitives mechanically produces wrong
 * forms. A unit test asserts this covers every region in the served taxonomy.
 */
export const REGION_GENITIVE_KA: Record<string, string> = {
  "region.tbilisi": "თბილისის",
  "region.adjara": "აჭარის",
  "region.guria": "გურიის",
  "region.imereti": "იმერეთის",
  "region.kakheti": "კახეთის",
  "region.mtskheta_mtianeti": "მცხეთა-მთიანეთის",
  "region.racha_lechkhumi_kvemo_svaneti": "რაჭა-ლეჩხუმისა და ქვემო სვანეთის",
  "region.samegrelo_zemo_svaneti": "სამეგრელო-ზემო სვანეთის",
  "region.samtskhe_javakheti": "სამცხე-ჯავახეთის",
  "region.kvemo_kartli": "ქვემო ქართლის",
  "region.shida_kartli": "შიდა ქართლის",
};

/**
 * "-ში" ("in") forms for region page titles ("იმერეთში მოსახლეობა"). Reviewed once and stored, for the same reason as
 * REGION_GENITIVE_KA: the compound region takes "-სა" on its first part, which no suffix rule derives.
 */
export const REGION_LOCATIVE_KA: Record<string, string> = {
  "region.tbilisi": "თბილისში",
  "region.adjara": "აჭარაში",
  "region.guria": "გურიაში",
  "region.imereti": "იმერეთში",
  "region.kakheti": "კახეთში",
  "region.mtskheta_mtianeti": "მცხეთა-მთიანეთში",
  "region.racha_lechkhumi_kvemo_svaneti": "რაჭა-ლეჩხუმსა და ქვემო სვანეთში",
  "region.samegrelo_zemo_svaneti": "სამეგრელო-ზემო სვანეთში",
  "region.samtskhe_javakheti": "სამცხე-ჯავახეთში",
  "region.kvemo_kartli": "ქვემო ქართლში",
  "region.shida_kartli": "შიდა ქართლში",
};

/**
 * Georgian ordinal for a rank. First place is პირველი, never მე-1. Georgian counts in twenties:
 * 2–20 and whole twenties take the prefix (მე-20, მე-40), the rest the suffix (21-ე, 37-ე).
 */
export function georgianOrdinal(rank: number): string {
  if (rank === 1) return "პირველი";
  return rank <= 20 || rank % 20 === 0 ? `მე-${rank}` : `${rank}-ე`;
}

export function municipalRankLabel(rank: number, locale: Locale): string {
  return locale === "en" ? String(rank) : georgianOrdinal(rank);
}

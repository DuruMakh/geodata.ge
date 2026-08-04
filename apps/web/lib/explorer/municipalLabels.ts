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

/** Georgian ordinal for a rank. First place is პირველი, never მე-1. */
export function georgianOrdinal(rank: number): string {
  return rank === 1 ? "პირველი" : `მე-${rank}`;
}

/**
 * AcadNusx legacy-font transliteration: Latin letters -> Georodian (Mkhedruli) script.
 *
 * Pre-2008 mof.ge expenditure workbooks store Georgian text in the AcadNusx font, where
 * each Georgian glyph is encoded as a Latin character. The mapping is deterministic and
 * 1:1 (verified: "saqarTvelos" -> "საქართველოს", "finansTa" -> "ფინანსთა",
 * "ekonomikuri ganviTarebis" -> "ეკონომიკური განვითარების"). We transliterate these
 * labels back to Mkhedruli so the shared Georgian-keyword classifier can read them.
 *
 * Only letters map; digits, spaces, and punctuation pass through unchanged.
 */
const ACAD_NUSX_TO_GEORGIAN: Record<string, string> = {
  a: "ა", b: "ბ", g: "გ", d: "დ", e: "ე", v: "ვ", z: "ზ", T: "თ", i: "ი", k: "კ",
  l: "ლ", m: "მ", n: "ნ", o: "ო", p: "პ", J: "ჟ", r: "რ", s: "ს", t: "ტ", u: "უ",
  f: "ფ", q: "ქ", R: "ღ", y: "ყ", S: "შ", C: "ჩ", c: "ც", Z: "ძ", w: "წ", W: "ჭ",
  x: "ხ", j: "ჯ", h: "ჰ",
};

export function transliterateAcadNusx(value: string): string {
  return Array.from(value)
    .map((character) => ACAD_NUSX_TO_GEORGIAN[character] ?? character)
    .join("");
}

/** True if the text still contains Latin letters that the AcadNusx map covers (i.e. it looks untransliterated). */
export function looksLikeAcadNusx(value: string): boolean {
  return Array.from(value).some((character) => character in ACAD_NUSX_TO_GEORGIAN);
}

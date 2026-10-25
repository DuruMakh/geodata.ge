// Georgian for search (spec 2026-10-24-explorer-regroup §7.2): case endings and the Georgian keyboard.

/** The standard Georgian keyboard: the letter each Latin key types, with Shift where it gives another letter. */
const KEYBOARD: Readonly<Record<string, string>> = {
  q: "ქ", w: "წ", e: "ე", r: "რ", t: "ტ", y: "ყ", u: "უ", i: "ი", o: "ო", p: "პ", a: "ა", s: "ს", d: "დ", f: "ფ", g: "გ", h: "ჰ", j: "ჯ",
  k: "კ", l: "ლ", z: "ზ", x: "ხ", c: "ც", v: "ვ", b: "ბ", n: "ნ", m: "მ", W: "ჭ", R: "ღ", T: "თ", S: "შ", J: "ჟ", Z: "ძ", C: "ჩ",
};

/** What a Latin query types on a Georgian keyboard: `xelfasebi` → `ხელფასები`. Keys with no letter stay as they are. */
export function latinToGeorgian(text: string): string {
  return [...text].map((char) => KEYBOARD[char] ?? KEYBOARD[char.toLowerCase()] ?? char).join("");
}

/** True for text with Latin letters and no Georgian ones. */
export function isLatin(text: string): boolean {
  return /[a-z]/i.test(text) && !/[ა-ჰ]/.test(text);
}

/**
 * A word without its common Georgian ending and final vowel, so `ხელფასების` and `ხელფასები` share `ხელფას`.
 * Words under five letters are kept whole. The prototype's endings plus the plural `ები`, without which a plural and
 * its genitive (`ხელფასები`, `ხელფასების`) had different stems.
 */
export function stem(word: string): string {
  return word.length < 5 ? word : word.replace(/(ისთვის|იდან|ამდე|ებში|ებით|ების|ებს|ები|ში|ზე|ით|ად|ის|მა|ს)$/, "").replace(/[იაეოუ]$/, "");
}

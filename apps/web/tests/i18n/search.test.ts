import { describe, expect, it } from "vitest";
import { matchesLabelQuery } from "../../lib/i18n/search";

describe("reviewed bilingual label search", () => {
  it.each(["Batumi", " BATUMI ", "ბათუმი", "ბათ", "  "])("matches the reviewed name using %j", (query) => {
    expect(matchesLabelQuery(query, ["ბათუმი", "Batumi"])).toBe(true);
  });

  it("does not combine different label fields into a fictitious phrase", () => {
    expect(matchesLabelQuery("Batumi Gori", ["Batumi", "Gori"])).toBe(false);
    expect(matchesLabelQuery("Kutaisi", ["ბათუმი", "Batumi"])).toBe(false);
  });

  it("normalizes equivalent Unicode text without inventing transliteration aliases", () => {
    expect(matchesLabelQuery("Cafe\u0301", ["Café"])).toBe(true);
    expect(matchesLabelQuery("Batum", ["ბათუმი"])).toBe(false);
  });
});

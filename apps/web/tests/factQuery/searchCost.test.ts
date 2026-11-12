// apps/web/tests/factQuery/searchCost.test.ts
//
// The cost bound of describe_coverage's search (full review RS-1): a repeated word is read once, and a search reads at
// most 16 different words, saying so when it leaves any out. The answers themselves are pinned by searchQuality.
import { beforeAll, describe, expect, it } from "vitest";
import { testSnapshot } from "../helpers/factQuerySnapshot";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(() => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

type Noted = { searchMatch?: string; searchMatchNoteKa?: string; searchMatchNoteEn?: string; series: unknown[]; entities: unknown[] };
const dataOf = (search: string) => (describeCoverage(snapshot, { search }) as { data: Noted }).data;
const leftOutNote = (language: "ka" | "en", omitted: number) =>
  snapshot.localization.messages[language]["catalogue.searchWordsLeftOut"]!.replace("{limit}", "16").replace("{omitted}", String(omitted));

describe("describe_coverage search cost", () => {
  it("reads a repeated word once", () => {
    expect(dataOf("pension pension pension pension")).toEqual(dataOf("pension pension"));
    expect(dataOf("ვალი ვალი ვალი")).toEqual(dataOf("ვალი ვალი"));
  });

  it("reads at most 16 different words and says how many it left out", () => {
    const letters = "a b c d e f g h i j k l m n o p q r s t u v w x y z";
    const found = dataOf(letters);
    expect(found.searchMatchNoteEn).toBe(leftOutNote("en", 10));
    expect(found.searchMatchNoteKa).toBe(leftOutNote("ka", 10));
    // The same 16 words, typed alone, answer the same entries without the note.
    const first16 = dataOf(letters.split(" ").slice(0, 16).join(" "));
    expect(first16.searchMatchNoteEn).toBeUndefined();
    expect(found.series).toEqual(first16.series);
    expect(found.entities).toEqual(first16.entities);
  });

  it("adds the left-out note after the some-words note", () => {
    const found = dataOf("pension tax wine school hospital bank loan export import tourism doctor teacher prison police forest water river");
    expect(found.searchMatch).toBe("some_words");
    expect(found.searchMatchNoteEn).toBe(`${snapshot.localization.messages.en["catalogue.someWords"]} ${leftOutNote("en", 1)}`);
  });

  it("does not note a search of 16 different words", () => {
    expect(dataOf("What was Batumi's annual inflation in the latest reviewed month? If that detail is unavailable").searchMatchNoteEn ?? "").not.toContain("left out");
  });
});

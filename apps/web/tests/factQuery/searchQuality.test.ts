// apps/web/tests/factQuery/searchQuality.test.ts
//
// describe_coverage search quality (audit finding F08): the 139 hand-labelled queries of the audit, scored the way the
// audit's score.mjs scored them. A query is "full recall" when every id in `req` is returned; a returned id is a false
// positive when it is neither in `req` nor accepted by `ok`, and an inside-word one when no query word starts any word
// of the entry's fields (the entry matched only on letters in the middle of a word).
import { beforeAll, describe, expect, it } from "vitest";
import { testSnapshot } from "../helpers/factQuerySnapshot";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { stem } from "../../lib/explorer/search/georgian";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import { QUERIES, type SearchQuery } from "./fixtures/searchQueries";
import { outputSchemaFor } from "../../lib/mcp/outputSchema";
import { renderText } from "../../lib/mcp/result";

type Hit = { key: string; label: string; fields: (string | null)[] };
type Found = { status: string; searchMatch?: string; hits: Hit[] };

let snapshot: FactQuerySnapshot;
beforeAll(() => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

const searchMatchOf = (response: ReturnType<typeof describeCoverage>) => (response as { data: { searchMatch?: string } }).data.searchMatch;

function search(query: string): Found {
  const response = describeCoverage(snapshot, { search: query });
  if (response.kind !== "catalogue") throw new Error(`expected a catalogue for ${query}`);
  const data = response.data as {
    searchMatch?: string;
    series?: { seriesId: string; labelKa: string; labelEn: string }[];
    entities?: { entityId: string; labelKa: string; labelEn: string; entitySlug: string | null }[];
  };
  const hits: Hit[] = [
    ...(data.series ?? []).map((s) => ({ key: s.seriesId, label: `${s.seriesId} | ${s.labelEn} | ${s.labelKa}`, fields: [s.seriesId, s.labelKa, s.labelEn] })),
    ...(data.entities ?? []).map((e) => ({ key: `E:${e.entityId}`, label: `E:${e.entityId} | ${e.labelEn} | ${e.labelKa}`, fields: [e.entityId, e.labelKa, e.labelEn, e.entitySlug] })),
  ];
  return { status: response.status, searchMatch: data.searchMatch, hits };
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en");
const words = (text: string | null) => fold(text ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const keysOf = (query: string) => search(query).hits.map((hit) => hit.key);

function isAccepted(item: SearchQuery, hit: Hit): boolean {
  return item.req.includes(hit.key) || (item.ok ?? []).some((ok) => (typeof ok === "string" ? ok === hit.key : ok.test(hit.label)));
}

// A hit is justified when some query word is a word-start of a hit word, or the two share a Georgian stem the way
// the matcher allows: equal stems, or one stem plus a final vowel or "ს", or plus "ებ" of a noun in -ება. The audit's own check
// also accepted a hit word starting with the query word minus its last two letters, which let `საგარეჯო` stand for
// `საგარეო` and `ფარში` for `ფარდა`; it is gone.
function sharesStem(t: string, w: string): boolean {
  const [a, b] = [stem(t), stem(w)];
  const [shorter, longer, longerWord] = a.length <= b.length ? [a, b, w] : [b, a, t];
  if (shorter.length < 3 || !longer.startsWith(shorter)) return false;
  const rest = longer.slice(shorter.length);
  return rest === "" || /^[იაეოუს]$/.test(rest) || (rest === "ებ" && longerWord === `${shorter}ება`);
}

function isInsideWord(query: string, hit: Hit): boolean {
  const queryWords = words(query);
  const hitWords = hit.fields.flatMap(words);
  return !queryWords.some((t) => hitWords.some((w) => w.startsWith(t) || sharesStem(t, w) || (isEnglish(t) && singular(t) === singular(w))));
}

const isEnglish = (word: string) => /^[a-z]+$/.test(word);
const singular = (word: string) => (word.length >= 5 ? word.replace(/(x|s|ch|sh)es$/, "$1").replace(/([^s])s$/, "$1") : word);

const insideWordHits = (query: string) => search(query).hits.filter((hit) => isInsideWord(query, hit)).map((hit) => hit.label);

describe("catalogue search matches words, not letters inside words", () => {
  it.each(["VAT", "grants", "oil", "Oni", "port", "ვალი", "ხორცი", "პური"])("%s returns nothing that matched only inside a word", (query) => {
    expect(insideWordHits(query)).toEqual([]);
  });

  it.each([
    ["food inflation", "cpi.cat.01"],
    ["annual inflation", "cpi.headline"],
    ["წლიური ინფლაცია", "cpi.headline"],
    ["სახელმწიფო ვალი", "debt.stock.total"],
    ["Batumi budget", "E:06"],
    ["განათლებისთვის", "spending.education"],
    ["pensions", "admin_program.57_11.c2eeef9e"],
  ])("%s finds %s", (query, target) => {
    expect(keysOf(query)).toContain(target);
  });

  it.each(["wages", "salary", "unemployment", "exports", "zzz-no-such-series", "constructor", "__proto__"])("%s stays empty", (query) => {
    const found = search(query);
    expect(found.status).toBe("empty");
    expect(found.hits).toEqual([]);
  });
});

describe("catalogue search keeps unrelated Georgian words apart", () => {
  it("does not read საგარეჯო (Sagarejo) as foreign", () => {
    const keys = keysOf("საგარეჯო");
    expect(keys).toContain("E:17");
    expect(keys).not.toContain("debt.stock.external");
    expect(keys).not.toContain("admin_spending.foreign_affairs");
  });

  it("does not read საგარეო (foreign) as Sagarejo", () => {
    const keys = keysOf("საგარეო");
    expect(keys).toContain("debt.stock.external");
    expect(keys).not.toContain("E:17");
  });

  it("does not read ფარში (mince) as a curtain", () => {
    const curtain = search("ფარდა").hits.map((hit) => hit.key);
    expect(curtain.length).toBeGreaterThan(0);
    const keys = keysOf("ფარში");
    for (const key of curtain) expect(keys).not.toContain(key);
  });

  it.each(["ვალი", "ვალის"])("does not read %s as a currency word", (query) => {
    for (const hit of search(query).hits) expect(hit.fields.flatMap(words).filter((word) => word.startsWith("ვალუტ"))).toEqual([]);
  });

  it.each([
    ["სახლი", "სახის"],
    ["საშუალო", "საშუალებებით"],
  ])("does not read %s as %s", (query, other) => {
    for (const hit of search(query).hits) expect(hit.fields.flatMap(words)).not.toContain(other);
  });
});

describe("catalogue search with nothing to look for", () => {
  it.each(["", "   ", "-", "."])("treats %j as no search", (query) => {
    const plain = describeCoverage(snapshot, { datasetId: "inflation" });
    const blank = describeCoverage(snapshot, { datasetId: "inflation", search: query });
    expect(blank.status).toBe("ok");
    expect(blank).toEqual(plain);
    expect(searchMatchOf(blank)).toBeUndefined();
    expect(describeCoverage(snapshot, { search: query })).toEqual(describeCoverage(snapshot, {}));
  });
});

describe("catalogue search answers a phrase that no entry matches in full", () => {
  it("returns nothing when most of the phrase is unknown to the catalogue", () => {
    expect(search("unreviewed-retired-product").status).toBe("empty");
    const scoped = describeCoverage(snapshot, { datasetId: "inflation-products", search: "unreviewed-retired-product" });
    expect(scoped.status).toBe("empty");
  });

  it.each(["public debt", "government debt", "debt zzzz"])("still finds a dataset's own keyword in %s", (query) => {
    const found = describeCoverage(snapshot, { datasetId: "government-debt", search: query });
    expect(found.status).toBe("ok");
    expect(searchMatchOf(found)).toBe("some_words");
    expect(((found as { data: { series: unknown[] } }).data.series).length).toBeGreaterThan(0);
  });

  it("reports all_words when one entry has every word and some_words when none has", () => {
    expect(search("income tax").searchMatch).toBe("all_words");
    expect(search("zzzznotathing").searchMatch).toBe("all_words");
    const some = search("debt zzzznotathing");
    expect(some.searchMatch).toBe("some_words");
    expect(some.status).toBe("ok");
    expect(some.hits.length).toBeGreaterThan(0);
  });

  it("omits searchMatch when no search was given", () => {
    const response = describeCoverage(snapshot, {});
    expect(searchMatchOf(response)).toBeUndefined();
  });

  it("chooses all_words or some_words once across datasets, not per dataset", () => {
    const everywhere = search("debt");
    const scoped = describeCoverage(snapshot, { datasetId: "government-debt", search: "debt" });
    expect(searchMatchOf(scoped)).toBe("all_words");
    expect(everywhere.searchMatch).toBe("all_words");
  });
});

// A some-words answer can be about another subject ("average wage" finds weighted-average debt rates), so it says so,
// and a word the catalogue does not hold still looks for its own website page (audit F08 section 5.2, F01).
describe("a some-words answer says that only some words matched", () => {
  const SOME_WORDS_EN =
    "Only some words of this search matched, so these entries may be about something else. If none of them fits, this connection does not serve that data; websitePages, when given, show it on Fiscal.ge.";
  const SOME_WORDS_KA =
    "ამ ძიების მხოლოდ ზოგიერთი სიტყვა დაემთხვა, ამიტომ ეს ჩანაწერები შესაძლოა სხვა თემას ეხებოდეს. თუ არცერთი არ შეესაბამება, ამ მონაცემებს ეს კავშირი არ გასცემს; websitePages, თუ მოცემულია, მათ Fiscal.ge-ზე აჩვენებს.";
  type Noted = { searchMatch?: string; searchMatchNoteKa?: string; searchMatchNoteEn?: string; websitePages?: { topicId: string; labelEn: string; urlKa: string }[] };
  const dataOf = (response: ReturnType<typeof describeCoverage>) => (response as { data: Noted }).data;

  it.each(["poverty rate", "average wage", "საშუალო ხელფასი", "trade balance"])("notes it on %s", (query) => {
    const response = describeCoverage(snapshot, { search: query });
    expect(response.status).toBe("ok");
    expect(dataOf(response).searchMatch).toBe("some_words");
    expect(dataOf(response).searchMatchNoteEn).toBe(SOME_WORDS_EN);
    expect(dataOf(response).searchMatchNoteKa).toBe(SOME_WORDS_KA);
    expect(renderText(response)).toContain(SOME_WORDS_EN);
  });

  it("notes it inside one dataset too", () => {
    const found = dataOf(describeCoverage(snapshot, { datasetId: "government-debt", search: "public debt" }));
    expect(found.searchMatch).toBe("some_words");
    expect(found.searchMatchNoteEn).toBe(SOME_WORDS_EN);
  });

  it.each(["income tax", "zzzznotathing"])("adds no note to the all-words answer for %s", (query) => {
    const found = dataOf(describeCoverage(snapshot, { search: query }));
    expect(found).not.toHaveProperty("searchMatchNoteEn");
    expect(found).not.toHaveProperty("searchMatchNoteKa");
  });

  it("links the poverty page for poverty rate, whose word rate alone matched served series", () => {
    const poverty = snapshot.website.pages.find((page) => page.name.en === "Poverty")!;
    const pages = dataOf(describeCoverage(snapshot, { search: "poverty rate" })).websitePages ?? [];
    expect(pages.map((page) => page.urlKa)).toContain(poverty.urlKa);
    for (const page of pages) expect(page.topicId).toBe("living-standards");
  });

  it("validates against the published describe_coverage output schema", () => {
    for (const query of ["poverty rate", "average wage"]) {
      expect(outputSchemaFor("describe_coverage").safeParse(describeCoverage(snapshot, { search: query })).success, query).toBe(true);
    }
  });
});

describe("the labelled queries", () => {
  const scored = QUERIES.filter((item) => item.req.length > 0);
  let rows: { q: string; missing: string[]; inside: string[] }[] = [];
  beforeAll(() => {
    rows = scored.map((item) => {
      const found = search(item.q);
      const returned = new Set(found.hits.map((hit) => hit.key));
      const missing = item.req.filter((key) => !returned.has(key));
      const inside = found.hits.filter((hit) => !isAccepted(item, hit) && isInsideWord(item.q, hit));
      return { q: item.q, missing, inside: inside.map((hit) => hit.label) };
    });
  });

  it("holds 139 queries, 134 of which name a target", () => {
    expect(QUERIES).toHaveLength(139);
    expect(scored).toHaveLength(134);
  });

  // The audit's target was 120 of 134 (its "R" variant scored 123), but R also made the aliases two-way and corrected
  // typos. Without a synonym list (spec section 33), the two reviewed aliases only, and no typo correction, the
  // 23 queries stay out of reach: `healthcare`, `defense`, `police`, `petrol`, `ჯანდაცვა`, `პენსია` and the rest
  // are different words for a label, not forms of it. Raising this number needs the owner's approval of those additions.
  it("reaches full recall on at least 111 of 134", () => {
    const failing = rows.filter((row) => row.missing.length > 0).map((row) => `${row.q} -> missing ${row.missing.join(", ")}`);
    expect(rows.length - failing.length, failing.join("\n")).toBeGreaterThanOrEqual(111);
  });

  it("returns at most 4 inside-word false positives", () => {
    const inside = rows.flatMap((row) => row.inside.map((label) => `${row.q} -> ${label}`));
    expect(inside.length, inside.join("\n")).toBeLessThanOrEqual(4);
  });
});

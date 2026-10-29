// apps/web/tests/factQuery/searchQuality.test.ts
//
// describe_coverage search quality (audit finding F08): the 139 hand-labelled queries of the audit, scored the way the
// audit's score.mjs scored them. A query is "full recall" when every id in `req` is returned; a returned id is a false
// positive when it is neither in `req` nor accepted by `ok`, and an inside-word one when no query word starts any word
// of the entry's fields (the entry matched only on letters in the middle of a word).
import { beforeAll, describe, expect, it } from "vitest";
import { testSnapshot } from "../helpers/factQuerySnapshot";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import { QUERIES, type SearchQuery } from "./fixtures/searchQueries";

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

function isInsideWord(query: string, hit: Hit): boolean {
  const queryWords = words(query);
  const hitWords = hit.fields.flatMap(words);
  return !queryWords.some((t) => hitWords.some((w) => w.startsWith(t) || (t.length > 3 && w.startsWith(t.slice(0, -2)))));
}

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

describe("catalogue search answers a phrase that no entry matches in full", () => {
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

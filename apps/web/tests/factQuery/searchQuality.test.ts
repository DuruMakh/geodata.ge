// apps/web/tests/factQuery/searchQuality.test.ts
//
// describe_coverage search quality (audit finding F08): the 139 hand-labelled queries of the audit, scored the way the
// audit's score.mjs scored them. A query is "full recall" when every id in `req` is returned; a returned id is a false
// positive when it is neither in `req` nor accepted by `ok`, and an inside-word one when no query word starts any word
// of the entry's fields, a topic series' heading and dataset title among them (the entry matched only on letters in the
// middle of a word).
import { beforeAll, describe, expect, it } from "vitest";
import { testSnapshot } from "../helpers/factQuerySnapshot";
import { describeCoverage, searchCatalogue } from "../../lib/factQuery/describeCoverage";
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

/** A topic dataset's search names, which its total series are searched under too (R26). */
const topicTitles = (datasetId: string | undefined, level: string | undefined) => {
  const dataset = level === "total" ? snapshot.topics.datasets.find((entry) => entry.page.datasetId === datasetId) : undefined;
  return dataset ? [dataset.searchKa, dataset.searchEn] : [];
};

function search(query: string): Found {
  const response = describeCoverage(snapshot, { search: query });
  if (response.kind !== "catalogue") throw new Error(`expected a catalogue for ${query}`);
  const data = response.data as {
    searchMatch?: string;
    series?: { seriesId: string; labelKa: string; labelEn: string; headingKa?: string; headingEn?: string; datasetId?: string; level?: string }[];
    entities?: { entityId: string; labelKa: string; labelEn: string; entitySlug: string | null }[];
  };
  const hits: Hit[] = [
    ...(data.series ?? []).map((s) => ({ key: s.seriesId, label: `${s.seriesId} | ${s.labelEn} | ${s.labelKa}`, fields: [s.seriesId, s.labelKa, s.labelEn, s.headingKa ?? null, s.headingEn ?? null, ...topicTitles(s.datasetId, s.level)] })),
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
  it.each(["VAT", "grants", "oil", "Oni", "port", "exports", "ვალი", "ხორცი", "პური"])("%s returns nothing that matched only inside a word", (query) => {
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
    ["wages", "average_monthly_nominal_earnings"],
    ["unemployment", "unemployment_rate"],
  ])("%s finds %s", (query, target) => {
    expect(keysOf(query)).toContain(target);
  });

  it.each(["salary", "zzz-no-such-series", "constructor", "__proto__"])("%s stays empty", (query) => {
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

// A some-words answer can be about another subject ("average salary" finds weighted-average debt rates), so it says so,
// and a word the catalogue does not hold still looks for its own website page (audit F08 section 5.2, F01).
describe("a some-words answer says that only some words matched", () => {
  // The note's wording is the service message's own; what it must say is pinned below.
  const SOME_WORDS_EN = () => snapshot.localization.messages.en["catalogue.someWords"];
  const SOME_WORDS_KA = () => snapshot.localization.messages.ka["catalogue.someWords"];
  type Noted = { searchMatch?: string; searchMatchNoteKa?: string; searchMatchNoteEn?: string; websitePages?: { topicId: string; labelEn: string; urlKa: string }[] };
  const dataOf = (response: ReturnType<typeof describeCoverage>) => (response as { data: Noted }).data;

  it.each(["poverty rate", "average salary", "საშუალო ქირა", "trade deficit"])("notes it on %s", (query) => {
    const response = describeCoverage(snapshot, { search: query });
    expect(response.status).toBe("ok");
    expect(dataOf(response).searchMatch).toBe("some_words");
    expect(dataOf(response).searchMatchNoteEn).toBe(SOME_WORDS_EN());
    expect(dataOf(response).searchMatchNoteKa).toBe(SOME_WORDS_KA());
    expect(renderText(response)).toContain(SOME_WORDS_EN());
  });

  it("notes it inside one dataset too", () => {
    const found = dataOf(describeCoverage(snapshot, { datasetId: "government-debt", search: "public debt" }));
    expect(found.searchMatch).toBe("some_words");
    expect(found.searchMatchNoteEn).toBe(SOME_WORDS_EN());
  });

  // "defense budget" finds only the municipal total, while defence spending is served: the note must not say
  // that what is missing is not served, only that the entries may be about something else (owner review D-2).
  it("does not claim that the missing part is not served", () => {
    const found = dataOf(describeCoverage(snapshot, { search: "defense budget" }));
    expect(found.searchMatch).toBe("some_words");
    expect(found.searchMatchNoteEn).toContain("before saying it is not served");
    expect(found.searchMatchNoteEn).not.toContain("does not serve that data");
    expect(found.searchMatchNoteKa).toContain("ეს კავშირი");
    expect(found.searchMatchNoteKa).not.toContain("არ გასცემს");
  });

  it.each(["income tax", "zzzznotathing"])("adds no note to the all-words answer for %s", (query) => {
    const found = dataOf(describeCoverage(snapshot, { search: query }));
    expect(found).not.toHaveProperty("searchMatchNoteEn");
    expect(found).not.toHaveProperty("searchMatchNoteKa");
  });

  // Spec §5.4: the Poverty page is served, so "poverty rate" answers with its dataset's rates, not a link to the page.
  it("lists the served poverty rates first for poverty rate, and links no page of their topic", () => {
    const found = describeCoverage(snapshot, { search: "poverty rate" }) as { data: Noted & { series: { seriesId: string; datasetId?: string }[] } };
    expect(found.data.series[0]).toMatchObject({ datasetId: "living-standards-poverty", seriesId: "poverty.absolute" });
    expect((found.data.websitePages ?? []).map((page) => page.topicId)).not.toContain("living-standards");
  });

  it("validates against the published describe_coverage output schema", () => {
    for (const query of ["poverty rate", "average salary"]) {
      expect(outputSchemaFor("describe_coverage").safeParse(describeCoverage(snapshot, { search: query })).success, query).toBe(true);
    }
  });
});

// A some-words answer puts the entries of the dataset a query word names first: "rate" alone meets the three debt
// rates, which are rarer than inflation or tax series, but they are not the subject (owner review A-I3).
describe("a some-words answer puts the subject first", () => {
  const firstOf = (query: string) => (describeCoverage(snapshot, { search: query }) as { data: { searchMatch?: string; series: { seriesId: string; datasetId?: string }[] } }).data;

  it("lists an inflation series first for inflation rate", () => {
    const found = firstOf("inflation rate");
    expect(found.searchMatch).toBe("some_words");
    expect(found.series[0]?.datasetId).toBe("inflation");
  });

  it("lists real GDP growth first for economic growth", () => {
    expect(firstOf("economic growth").series[0]?.seriesId).toBe("real_growth_percent");
  });

  // A trailing "total" ("Total taxes" is "გადასახადები სულ") does not name the entry, so a total is not halved.
  it("lists total taxes first for გადასახადები თბილისში", () => {
    expect(firstOf("გადასახადები თბილისში").series[0]?.seriesId).toBe("revenue.taxes_total");
  });

  it("lists the total interest rate first for interest rate on debt", () => {
    expect(firstOf("interest rate on debt").series[0]?.seriesId).toBe("debt.rate.total");
  });

  it("lists a tax series first for tax rate", () => {
    const found = firstOf("tax rate");
    expect(found.searchMatch).toBe("some_words");
    expect(found.series[0]?.datasetId).toBe("national-revenue");
    expect(found.series[0]?.seriesId).toMatch(/tax/);
  });

  // The rule behind "tax rate" on a small catalogue: "pear" is the commonest word, "apple" the rarer one.
  type Entry = { label: string; dataset: string };
  const order = (query: string, entries: Entry[]) =>
    searchCatalogue(query, entries, (entry) => [entry.label], { ahead: (entry) => [entry.dataset] }).matches.map((entry) => entry.label);

  it("puts a dataset ahead on a rarer word its label meets, never on the commonest word alone", () => {
    const found = order("apple pear", [
      { label: "pear juice", dataset: "Pear drinks" }, { label: "apple pie", dataset: "Desserts" }, { label: "pear tart", dataset: "Apple orchard" },
      { label: "pear cake", dataset: "Other" }, { label: "pear salad", dataset: "Other" },
    ]);
    expect(found[0]).toBe("pear tart");
    expect(found.indexOf("apple pie")).toBeLessThan(found.indexOf("pear juice"));
  });

  it("leaves out only one of two equally common words, so the other still puts its dataset ahead", () => {
    const found = order("apple pear", [
      { label: "apple x", dataset: "Pear drinks" }, { label: "pear y", dataset: "Apple orchard" }, { label: "apple", dataset: "Other" }, { label: "pear", dataset: "Other" },
    ]);
    // The first of the tied words ("apple") is the one left out: "Pear drinks" goes ahead, "Apple orchard" does not.
    expect(found[0]).toBe("apple x");
    expect(found.indexOf("pear y")).toBeGreaterThan(0);
  });

  // "personal income tax" holds Income tax in full, with its last word; "Personal" lacks the tax, and a phrase with a
  // joining word ("share of income tax") names what comes before it, so nothing joins it.
  it("lets an entry the query names in full, with its last word, join an all-words answer after the full matches", () => {
    const entries = [{ label: "Personal income tax", dataset: "Breaks" }, { label: "Income tax", dataset: "Revenue" }, { label: "Personal", dataset: "Revenue" }, { label: "Share of income tax", dataset: "Breaks" }];
    const joined = (query: string) => searchCatalogue(query, entries, (entry) => [entry.label], { joins: (entry) => entry.dataset === "Revenue" });
    expect(joined("personal income tax")).toMatchObject({ searchMatch: "all_words", matches: [entries[0], entries[1]] });
    expect(joined("share of income tax").matches).toEqual([entries[3]]);
  });
});

// Ruling R26: a topic dataset is searched under "<topic> — <page title>", not its one-word page title, so a budget
// function's spending is not answered with a household's ("Living standards — Spending"); the topic's name alone
// ("Education", "Health and social protection") neither lists its pages first nor puts them ahead of the budget's.
describe("a topic dataset is searched under its topic's name and its page title", () => {
  const firstOf = (query: string) => (describeCoverage(snapshot, { search: query }) as { data: { series: { seriesId: string; datasetId?: string }[] } }).data.series[0];

  it.each([
    ["ჯანდაცვის ხარჯები", "national-expenditure", "spending.health"],
    ["განათლების ხარჯები", "national-expenditure", "spending.education"],
    ["food prices", "inflation", "cpi.cat.01_1"],
    ["education", "national-expenditure", "spending.education"],
    ["health", "national-expenditure", "spending.health"],
    ["social protection", "national-expenditure", "spending.social_protection"],
    ["სოციალური დაცვა", "national-expenditure", "spending.social_protection"],
    // The Trade pages' imports do not take the import tax's place.
    ["import tax", "national-revenue", "revenue.import_tax"],
    ["იმპორტის გადასახადი", "national-revenue", "revenue.import_tax"],
  ])("lists the budget's or inflation's series first for %s", (query, datasetId, seriesId) => {
    expect(firstOf(query)).toMatchObject({ datasetId, seriesId });
  });

  // A topic page whose title shares one word with a budget or economy query does not take its place: Tax breaks and
  // refunds, Spending by type and GDP by expenditure are not the answer to "tax", "spending" in general or "GDP"; a Foreign
  // debt title does not answer "debt" alone (the pinned fiscal suite below).
  it.each([
    ["GDP", "gdp-overview"], ["მშპ", "gdp-overview"], ["tax", "national-revenue"], ["taxes", "national-revenue"], ["tax revenue", "national-revenue"],
    ["VAT", "national-revenue"], ["დღგ", "national-revenue"], ["health spending", "national-expenditure"],
  ])("keeps the core answer first for %s", (query, datasetId) => {
    expect(firstOf(query)?.datasetId).toBe(datasetId);
  });

  // After the core datasets, a topic whose search name meets every word comes before another topic's matching row.
  it.each([
    ["wages", "wages-overview", "average_monthly_nominal_earnings"],
    ["investment", "business-investment-profit", "business.investment.total"],
    ["exports", "trade-domestic-exports", "trade.exports"],
  ])("lists the topic the query names before another topic's row for %s", (query, datasetId, seriesId) => {
    expect(firstOf(query)).toMatchObject({ datasetId, seriesId });
  });

  // The country's foreign debt (NBG, External flows) is not the government's debt (the core Government debt dataset).
  it.each([
    ["public debt", "government-debt", "debt.stock.total"],
    ["სახელმწიფო ვალი", "government-debt", "debt.stock.total"],
  ])("keeps the government's debt first for %s, not the country's foreign debt", (query, datasetId, seriesId) => {
    expect(firstOf(query)).toMatchObject({ datasetId, seriesId });
  });

  it.each(["external debt", "საგარეო ვალი"])("lists the country's foreign debt first for %s and still finds the government's external debt", (query) => {
    expect(firstOf(query)).toMatchObject({ datasetId: "external-foreign-debt", seriesId: "ext_debt.total" });
    expect(keysOf(query)).toContain("debt.stock.external");
  });

  it.each([
    ["spending", "living-standards-spending", "spending.consumption.per_household"],
    ["income", "living-standards-income", "income.total.per_household"],
    ["poverty", "living-standards-poverty", "poverty.absolute"],
    ["home prices", "housing-prices", "housing.price_index.total"],
    ["building permits", "housing-permits", "housing.permits_count.total"],
    ["Gini", "living-standards-inequality", "gini.total_income"],
  ])("still lists the page a query names first for %s", (query, datasetId, seriesId) => {
    expect(firstOf(query)).toMatchObject({ datasetId, seriesId });
  });

  it.each([
    ["school pupils", "education-schools", "education.pupils_national.total"],
    ["doctors", "health-doctors-hospitals", "health.staff.doctors"],
    ["housing prices", "housing-prices", "housing.price_index.total"],
    ["internet users", "internet-users", "internet.used_3m.total"],
    ["registered vehicles", "transport-regions", "transport.registered"],
    ["trade balance", "trade-overview", "trade.balance"],
    ["imports from China", "trade-partners", "trade.imports.partner.1995-2025.156"],
    ["wine exports", "trade-products", "trade.exports.goods.hs4.2020-2025.2204"],
    ["current account", "external-current-account", "ca.balance.net"],
    ["money transfers", "external-money-from-abroad", "transfer.total.received"],
    ["foreign investment", "external-foreign-investment", "fdi.total"],
    ["international reserves", "external-reserves", "reserves.total"],
    ["tax breaks", "tax-breaks-refunds", "tax_breaks.total"],
    ["საგადასახადო შეღავათები", "tax-breaks-refunds", "tax_breaks.total"],
    ["spending by type", "expenditure-types", "spending_type.total.nominal"],
    ["wages and salaries", "expenditure-types", "spending_type.compensation.nominal"],
    ["შრომის ანაზღაურება", "expenditure-types", "spending_type.compensation.nominal"],
    ["household consumption", "economy-expenditure", "gdp_use.households.nominal"],
    ["GDP by expenditure", "economy-expenditure", "economy.gdp_total.nominal"],
    ["მშპ დანახარჯების მიხედვით", "economy-expenditure", "economy.gdp_total.nominal"],
  ])("keeps a topic's own answer first for %s", (query, datasetId, seriesId) => {
    expect(firstOf(query)).toMatchObject({ datasetId, seriesId });
  });

  // A some-words answer puts ahead the series whose page title meets a word, not those whose topic's name does: by
  // the topic's name ("Education — Universities") every Education series would come before the ministry's spending.
  it("lists the budget's series first for ministry of education, not an Education page's", () => {
    expect(firstOf("ministry of education")).toMatchObject({ datasetId: "national-expenditure", seriesId: "spending.education" });
  });

  it("names every topic dataset for search by its topic's name, then its published title", () => {
    for (const dataset of snapshot.topics.datasets) {
      expect(dataset.searchKa.endsWith(` — ${dataset.titleKa}`), dataset.page.datasetId).toBe(true);
      expect(dataset.searchEn.endsWith(` — ${dataset.titleEn}`), dataset.page.datasetId).toBe(true);
      expect(dataset.searchKa.length).toBeGreaterThan(` — ${dataset.titleKa}`.length);
      expect(dataset.searchEn.length).toBeGreaterThan(` — ${dataset.titleEn}`.length);
    }
  });

  it("keeps the published title apart from the search name", () => {
    const spending = snapshot.topics.datasets.find((dataset) => dataset.page.datasetId === "living-standards-spending")!;
    expect(spending).toMatchObject({ titleEn: "Spending", searchEn: "Living standards — Spending", titleKa: "ხარჯები", searchKa: "ცხოვრების დონე — ხარჯები" });
    const summary = (describeCoverage(snapshot, {}) as { data: { datasets: { datasetId: string; labelEn: string; labelKa: string }[] } }).data.datasets.find((dataset) => dataset.datasetId === "living-standards-spending");
    expect(summary).toMatchObject({ labelEn: "Spending", labelKa: "ხარჯები" });
  });
});

// Ruling R31: Fiscal.ge is a fiscal site first, so a budget question finds the core budget data first, and a topic's own
// question still finds its topic. Each query's first dataset and, where named, its first series.
describe("the pinned fiscal query suite", () => {
  type Answer = { datasets: { datasetId: string }[]; series?: { datasetId?: string; seriesId: string }[]; entities?: { datasetId?: string; entityId: string }[] };
  const answerOf = (query: string) => (describeCoverage(snapshot, { search: query }) as { data: Answer }).data;

  // "დეფიციტი" is in no served label (the deficit is General government balance, id `deficit.general_government.balance`),
  // so it finds no series without an owner-approved alias. "debt" alone is the government's debt, not the budget's debt
  // service or the country's foreign debt.
  it.each([
    ["personal income tax", "national-revenue", "revenue.income_tax"], ["საშემოსავლო გადასახადი", "national-revenue", "revenue.income_tax"],
    ["government debt", "government-debt", "debt.stock.total"], ["public debt", "government-debt", "debt.stock.total"],
    ["სახელმწიფო ვალი", "government-debt", "debt.stock.total"], ["debt", "government-debt", "debt.stock.total"], ["ვალი", "government-debt", "debt.stock.total"],
    ["budget balance", "general-government-balance", "deficit.general_government.balance"], ["deficit", "general-government-balance", "deficit.general_government.balance"],
    ["import duties", "national-revenue", "revenue.import_tax"], ["import tax", "national-revenue", "revenue.import_tax"], ["იმპორტის გადასახადი", "national-revenue", "revenue.import_tax"],
    ["VAT", "national-revenue", "revenue.vat"], ["დღგ", "national-revenue", "revenue.vat"], ["tax revenue", "national-revenue", "revenue.taxes_total"],
    ["health spending", "national-expenditure", "spending.health"], ["ჯანდაცვის ხარჯები", "national-expenditure", "spending.health"],
    ["education spending", "national-expenditure", "spending.education"], ["განათლების ხარჯები", "national-expenditure", "spending.education"],
    ["spending on culture", "national-expenditure", "spending.culture"], ["კულტურის ხარჯები", "national-expenditure", "spending.culture"],
    ["agriculture spending", "national-expenditure", "spending.agriculture_environment"], ["agriculture", "national-expenditure", "spending.agriculture_environment"],
    ["GDP", "gdp-overview"], ["მშპ", "gdp-overview"],
  ])("answers the budget question %s with %s first", (query, datasetId, seriesId?: string) => {
    const found = answerOf(query);
    expect(found.datasets[0]?.datasetId).toBe(datasetId);
    expect(found.series?.[0]?.datasetId).toBe(datasetId);
    if (seriesId !== undefined) expect(found.series?.[0]?.seriesId).toBe(seriesId);
  });

  // A search that holds a topic page's title in full is aimed at the page: "პენსია" is Pensions and "სოფლის მეურნეობა"
  // is Farming, whose Georgian title it is (the budget's Agriculture and environment comes next). "pension" is a reviewed
  // alias for the funded pension programme's word, so its first series is that programme, but its first dataset is Pensions.
  it.each([
    ["school pupils", "education-schools", "education.pupils_national.total"], ["doctors", "health-doctors-hospitals", "health.staff.doctors"],
    ["housing prices", "housing-prices", "housing.price_index.total"], ["unemployment rate", "unemployment-overview", "unemployment_rate"],
    ["average wage", "wages-overview", "average_monthly_nominal_earnings"], ["pension", "health-pensions"], ["პენსია", "health-pensions", "social.pension.recipients"],
    ["wine exports", "trade-products", "trade.exports.goods.hs4.2020-2025.2204"], ["remittances", "living-standards-income", "income.remittances.per_household"],
    ["FDI", "external-foreign-investment", "fdi.total"], ["crime", "crime-recorded", "crime.recorded.total"], ["crime rate", "crime-recorded", "crime.recorded.total"],
    ["museums", "science-culture-museums", "science_culture.museum_visitors"], ["air quality Tbilisi", "environment-air-quality"],
    ["temperature", "environment-climate", "environment.climate.temperature.georgia"], ["სოფლის მეურნეობა", "energy-food-farming", "farming.output.total"],
    ["waste Adjara", "environment-waste", "environment.waste.collected"],
  ])("answers the topic question %s with %s first", (query, datasetId, seriesId?: string) => {
    const found = answerOf(query);
    expect(found.datasets[0]?.datasetId).toBe(datasetId);
    if (seriesId !== undefined) expect(found.series?.[0]).toMatchObject({ datasetId, seriesId });
  });

  // A place's name is where, not what: the place leads, in the budget's municipalities first.
  it.each([
    ["Shuakhevi", "10"], ["შუახევი", "10"], ["Batumi", "06"], ["Kutaisi", "20"], ["Tbilisi", "region.tbilisi"],
  ])("answers the place %s with the municipality first", (query, entityId) => {
    const found = answerOf(query);
    expect(found.datasets[0]?.datasetId).toBe("municipal-expenditure");
    expect(found.entities?.[0]).toMatchObject({ datasetId: "municipal-expenditure", entityId });
  });

  it("finds the place first among the City air quality entries for air quality Tbilisi", () => {
    expect(answerOf("air quality Tbilisi").entities?.[0]).toMatchObject({ datasetId: "environment-air-quality", entityId: "city.tbilisi" });
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
  // `government debt` and `personal income tax` also meet every word of a topic row (the NBG's "Government" row of foreign
  // debt, the "Personal income tax" break); the core series they name in full, Total debt and Income tax, join their answers.
  it("reaches full recall on at least 111 of 134", () => {
    const failing = rows.filter((row) => row.missing.length > 0).map((row) => `${row.q} -> missing ${row.missing.join(", ")}`);
    expect(rows.length - failing.length, failing.join("\n")).toBeGreaterThanOrEqual(111);
  });

  // The audit allowed 4; whole-word matching reaches none (owner review D-9).
  it("returns no inside-word false positives", () => {
    const inside = rows.flatMap((row) => row.inside.map((label) => `${row.q} -> ${label}`));
    expect(inside).toEqual([]);
  });
});

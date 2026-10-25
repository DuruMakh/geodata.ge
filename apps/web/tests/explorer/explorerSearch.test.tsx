import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ push() {}, replace() {} }) }));

import kaAllData from "../../lib/i18n/messages/ka/allData.json";
import { ExplorerSearch, PLACES_TIMEOUT_MS } from "../../components/explorer-groups/explorer-search";
import { searchMessages } from "../../lib/explorer/allDataIndex";
import { allDataPageMetadata, renderAllDataPage } from "../../lib/pages/all-data";
import type { SearchPage } from "../../lib/explorer/search/searchExplorer";
import { renderPageMarkup } from "../helpers/render-localized";
import { PAGE_COUNT } from "../../lib/navigation/navTree";

const PAGE: SearchPage = {
  href: "/explorer/wages/overview", group: "labour", topic: "wages",
  name: { ka: "მიმოხილვა", en: "Overview" }, topicName: { ka: "ხელფასები", en: "Wages" }, groupName: { ka: "შრომის ბაზარი", en: "Labour market" },
  words: "salary", value: "2,165 ₾", period: "2025", caption: "", spark: [1, 2, 3],
};
const PLACES = { places: [], entries: [] };

const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeAll(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterAll(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

describe("the search box, rendered on the server", () => {
  // The page's own provider ships the All data strings; `common` comes from the root layout's.
  const html = renderPageMarkup("ka", (
    <ExplorerSearch locale="ka" pages={[PAGE]} shortcuts={[]}>
      <p data-testid="az-children">A to Z</p>
    </ExplorerSearch>
  ), searchMessages(kaAllData));

  it("is a labelled combobox the sidebar's search can focus", () => {
    const input = /<input[^>]*>/.exec(html)![0];
    expect(input).toContain('role="combobox"');
    expect(input).toContain('id="explorer-q"');
    expect(input).toContain('aria-expanded="false"');
    expect(input).toContain('placeholder="ინფლაცია, ბათუმი, ხელფასები…"');
    expect(html).toMatch(/<label[^>]*for="explorer-q"[^>]*>მოძებნეთ მონაცემები<\/label>/);
  });

  it("offers the five example words", () => {
    const chips = [...html.matchAll(/<button[^>]*data-testid="search-chip"[^>]*>([^<]*)<\/button>/g)].map((match) => match[1]);
    expect(chips).toEqual(["ბათუმი", "ინფლაცია", "ხელფასები", "მშპ", "ადგილობრივი ექსპორტი"]);
  });

  it("hides the box and its example words without JavaScript, which they need", () => {
    expect(html).toContain('<noscript><style>[data-testid="all-data-search"]{display:none}</style></noscript>');
  });

  it("shows the A to Z list while the box is empty, and no results or error text", () => {
    expect(html).toContain('data-testid="az-children"');
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain('data-testid="search-none"');
  });
});

describe("the places file (Review Focus 4)", () => {
  const ok = (body: unknown) => vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status: 200 }));
  // The file is kept for the page's life, so each test loads the module afresh and reads an empty cache.
  let loadPlaces: typeof import("../../components/explorer-groups/explorer-search").loadPlaces;
  beforeEach(async () => {
    vi.resetModules();
    ({ loadPlaces } = await import("../../components/explorer-groups/explorer-search"));
  });

  it("waits for a slow file rather than cancelling it, with every call on the one request", async () => {
    vi.useFakeTimers();
    try {
      let arrive!: () => void;
      const slow = vi.fn((_url: string) => new Promise<Response>((resolve) => { arrive = () => resolve(new Response(JSON.stringify(PLACES), { status: 200 })); }));
      const first = loadPlaces(slow, "ka");
      await vi.advanceTimersByTimeAsync(PLACES_TIMEOUT_MS * 3);
      const second = loadPlaces(slow, "ka");
      arrive();
      await expect(first).resolves.toEqual(PLACES);
      await expect(second).resolves.toEqual(PLACES);
      expect(slow).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves null when the fetch is rejected", async () => {
    const fetchImpl = vi.fn(async (_url: string): Promise<Response> => { throw new TypeError("network"); });
    await expect(loadPlaces(fetchImpl, "ka")).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith("/explorer-places.ka.json");
  });

  it("resolves null on a response that is not OK, or not JSON", async () => {
    await expect(loadPlaces(vi.fn(async () => new Response("missing", { status: 404 })), "ka")).resolves.toBeNull();
    await expect(loadPlaces(vi.fn(async () => new Response("<html>", { status: 200 })), "ka")).resolves.toBeNull();
  });

  it("fetches again after a failure, then keeps the first success", async () => {
    await expect(loadPlaces(vi.fn(async () => new Response("missing", { status: 404 })), "ka")).resolves.toBeNull();
    const first = ok(PLACES);
    await expect(loadPlaces(first, "ka")).resolves.toEqual(PLACES);
    const second = ok({ places: [{ id: "other" }], entries: [] });
    await expect(loadPlaces(second, "ka")).resolves.toEqual(PLACES);
    expect(second).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("keeps each language's file apart", async () => {
    await loadPlaces(ok(PLACES), "ka");
    const english = ok(PLACES);
    await loadPlaces(english, "en");
    expect(english).toHaveBeenCalledWith("/explorer-places.en.json");
  });
});

describe.each(["ka", "en"] as const)("the All data page (%s)", async (locale) => {
  const html = renderPageMarkup(locale, await renderAllDataPage(locale));
  const prefix = locale === "en" ? "/en" : "";

  it("has the one H1, one line under it and the page count in the breadcrumb row", () => {
    expect([...html.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
    expect(/<h1[^>]*>([^<]*)<\/h1>/.exec(html)![1]).toBe(locale === "ka" ? "ყველა მონაცემი" : "All data");
    const below = html.slice(html.indexOf("</h1>"), html.indexOf('data-testid="all-data-search"'));
    expect([...below.matchAll(/<p[\s>]/g)]).toHaveLength(1);
    expect(html).toMatch(new RegExp(locale === "ka" ? `${PAGE_COUNT} გვერდი · განახლდა \\d` : `${PAGE_COUNT} pages · Updated \\d`));
  });

  it("lists every page A to Z in its HTML, each linking to the page in the page's language", () => {
    const rows = [...html.matchAll(/<a[^>]*data-testid="az-row"[^>]*>/g)].map((match) => /href="([^"]+)"/.exec(match[0])![1]);
    expect(rows).toHaveLength(PAGE_COUNT);
    expect(rows.every((href) => href.startsWith(`${prefix}/explorer/`))).toBe(true);
    expect(rows).toContain(`${prefix}/explorer/wages/regions`);
    const letters = [...html.matchAll(/<a[^>]*data-testid="az-letter"[^>]*>([^<]*)<\/a>/g)].map((match) => match[1]);
    expect(letters[0]).toBe(locale === "ka" ? "ა" : "A");
  });

  it("starts with the search box and no results", () => {
    expect(html).toContain('id="explorer-q"');
    expect(html).not.toContain('data-testid="search-result"');
  });

  it("is the explorer's root in its metadata", async () => {
    const metadata = await allDataPageMetadata(locale);
    expect(metadata.alternates?.canonical).toBe(`https://fiscal.ge${prefix}/explorer`);
    expect(String(metadata.title)).toContain(locale === "ka" ? "ყველა მონაცემი" : "All data");
  });
});

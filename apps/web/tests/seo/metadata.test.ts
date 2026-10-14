import type { Metadata } from "next";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";
import { NAV_TREE } from "../../lib/navigation/navTree";
import { municipalPageMetadata, municipalRegionStaticParams, municipalityStaticParams } from "../../lib/pages/municipal";
import {
  coverageFromYears,
  fiscalMetadata,
  municipalityBudgetTitleKa,
} from "../../lib/seo/metadata";
import { appRoutes, routeFor } from "../helpers/appRoutes";

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge"));
afterAll(() => vi.unstubAllEnvs());

describe("Fiscal.ge SEO metadata", () => {
  it("derives coverage without assuming input order", () => {
    expect(coverageFromYears([{ year: 2025 }, { year: 2004 }, { year: 2012 }])).toEqual({
      firstYear: 2004,
      lastYear: 2025,
    });
  });

  it("rejects empty coverage rather than publishing invented years", () => {
    expect(() => coverageFromYears([])).toThrow(/served year/i);
  });

  it("builds canonical, Open Graph, and large Twitter metadata", () => {
    const metadata = fiscalMetadata({ locale: "ka",
      title: "საქართველოს ბიუჯეტის ხარჯები 2004–2025 | Fiscal.ge",
      description:
        "საქართველოს სახელმწიფო ბიუჯეტის ფაქტობრივი ხარჯები სფეროებისა და უწყებების მიხედვით, 2004–2025.",
      path: "/explorer/expenditure",
    });

    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/expenditure");
    expect(metadata.openGraph).toMatchObject({
      siteName: "Fiscal.ge",
      locale: "ka_GE",
      url: "https://fiscal.ge/explorer/expenditure",
      images: [expect.objectContaining({ width: 1200, height: 630 })],
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("keeps the canonical root slash in absolute root metadata", () => {
    const metadata = fiscalMetadata({ locale: "ka",
      title: "Fiscal.ge",
      description: "საქართველოს ბიუჯეტის გადამოწმებული მონაცემები.",
      path: "/",
    });
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/");
    expect(metadata.openGraph).toMatchObject({ url: "https://fiscal.ge/" });
  });

  it("uses the full official municipality name for possessive budget copy", () => {
    expect(municipalityBudgetTitleKa("ქალაქ თბილისის მუნიციპალიტეტი", 2015, 2025)).toBe(
      "ქალაქ თბილისის მუნიციპალიტეტის ბიუჯეტი 2015–2025 | Fiscal.ge",
    );
  });

  it("rejects a short display label because its Georgian ending is not reviewed", () => {
    expect(() => municipalityBudgetTitleKa("თბილისი", 2015, 2025)).toThrow(/მუნიციპალიტეტი/);
  });
});

/**
 * The public pages whose metadata the walk checks, in both languages. As tests/seo/structuredData.test.ts does, a
 * dynamic route file is sampled rather than walked: every static page and methodology article is kept; of each dynamic
 * route, the first page, the page with the longest place slug (the longest name, for the 160-character limit) and any
 * page an assertion below names.
 */
const NAMED_PAGES = new Set(["/explorer/municipalities/region/imereti", "/explorer/municipalities/region/adjara"]);
async function sampledPageMetadata(): Promise<{ page: string; locale: Locale; metadata: Metadata }[]> {
  const routes = appRoutes();
  const byFile = new Map<string, { page: string; dynamic: boolean }[]>();
  for (const page of await listPublicPagePaths()) {
    const route = routeFor(routes, page);
    const dynamic = Object.keys(route.params).length > 0 && !page.startsWith("/methodology/");
    byFile.set(route.file, [...(byFile.get(route.file) ?? []), { page, dynamic }]);
  }
  const slug = (page: string) => page.split("/").at(-1)!.length;
  const sampled = [...byFile.values()].flatMap((group) => {
    if (!group[0].dynamic) return group.map(({ page }) => page);
    const longest = group.reduce((best, entry) => (slug(entry.page) > slug(best.page) ? entry : best));
    return [...new Set([group[0].page, longest.page, ...group.filter(({ page }) => NAMED_PAGES.has(page)).map(({ page }) => page)])];
  });
  // Concurrently: the cost is the route modules' imports and the loaders' first reads, which overlap.
  return Promise.all(sampled.flatMap((page) => (["ka", "en"] as const).map(async (locale) => {
    const route = routeFor(routes, pageHref(page, locale));
    const pageModule = (await import(route.file)) as { generateMetadata: (props: { params: Promise<Record<string, string>> }) => Promise<Metadata> | Metadata };
    return { page, locale, metadata: await pageModule.generateMetadata({ params: Promise.resolve(route.params) }) };
  })));
}

describe("every page's search snippet and share card", () => {
  let pages: Awaited<ReturnType<typeof sampledPageMetadata>>;
  beforeAll(async () => { pages = await sampledPageMetadata(); }, 60_000);
  const where = ({ page, locale }: { page: string; locale: Locale }) => pageHref(page, locale);

  it("keeps every meta description within 160 characters, in both languages", () => {
    expect(pages.length).toBeGreaterThan(100);
    expect(pages.filter(({ metadata }) => String(metadata.description).length > 160).map((entry) => `${where(entry)} (${String(entry.metadata.description).length})`)).toEqual([]);
  });

  // A municipal description's length follows its place name and data, not its slug, so the sample above can miss the
  // longest (Task 45: Georgian borjomi, 158 characters, has no long slug). Every municipality and region is checked.
  it("keeps every municipality's and region's description within 160 characters, in both languages", async () => {
    const [municipalities, regions] = await Promise.all([municipalityStaticParams(), municipalRegionStaticParams()]);
    const places = [...municipalities.map(({ slug }) => ["municipality", slug] as const), ...regions.map(({ id }) => ["region", id] as const)];
    expect(places.length).toBeGreaterThan(60);
    const long = (await Promise.all(places.flatMap(([kind, id]) => (["ka", "en"] as const).map(async (locale) => {
      const length = String((await municipalPageMetadata(kind, id, locale)).description).length;
      return length > 160 ? `${locale} ${kind} ${id} (${length})` : null;
    })))).filter(Boolean);
    expect(long).toEqual([]);
  }, 60_000);

  it("ends every title with the brand, the hubs' included, and shares it with the card", () => {
    expect(pages.filter(({ metadata }) => !String(metadata.title).endsWith("Fiscal.ge")).map(where)).toEqual([]);
    for (const hub of NAV_TREE) {
      for (const { metadata } of pages.filter((entry) => entry.page === hub.href)) expect(String(metadata.title), hub.href).toMatch(/ \| Fiscal\.ge$/);
    }
    for (const entry of pages) {
      expect(entry.metadata.openGraph?.title, where(entry)).toBe(entry.metadata.title);
      expect(entry.metadata.twitter?.title, where(entry)).toBe(entry.metadata.title);
    }
  });

  it("describes the share image as the whole site's, never as budget data alone", () => {
    for (const entry of pages) {
      const [image] = [entry.metadata.openGraph?.images ?? []].flat() as { alt?: string }[];
      expect(image.alt, where(entry)).not.toMatch(/budget|ბიუჯეტ/i);
    }
  });

  it("names the site's datasets on the home page, not the budget alone (U01-13)", () => {
    for (const { locale, metadata } of pages.filter((entry) => entry.page === "/")) {
      for (const term of locale === "en" ? ["budget", "GDP", "inflation", "unemployment", "trade"] : ["ბიუჯეტი", "მშპ", "ინფლაცია", "უმუშევრობა", "ვაჭრობა"]) {
        expect(metadata.description).toContain(term);
      }
      expect(String(metadata.title)).not.toMatch(/deficit|დეფიციტი/);
    }
  });

  it("titles say what each page holds, no more (U21-18, U29-09, U09-12)", () => {
    const title = (page: string, locale: Locale) => String(pages.find((entry) => entry.page === page && entry.locale === locale)!.metadata.title);
    expect(title("/explorer/trade/overview", "en")).toMatch(/goods/);
    expect(title("/explorer/trade/overview", "ka")).toMatch(/საქონ/);
    expect(title("/methodology", "en")).not.toMatch(/budget/i);
    expect(title("/methodology", "ka")).not.toMatch(/ბიუჯეტ/);
    expect(title("/explorer/municipalities/region/imereti", "en")).toMatch(/municipal budgets/);
    expect(title("/explorer/municipalities/region/imereti", "ka")).toMatch(/მუნიციპალური ბიუჯეტი/);
    expect(title("/explorer/municipalities/region/adjara", "en")).toMatch(/consolidated budget/);
    expect(title("/explorer/municipalities/region/adjara", "ka")).toMatch(/გაერთიანებული ბიუჯეტი/);
    // An article whose name already says "methodology" does not say it twice.
    for (const entry of pages.filter(({ page }) => page.startsWith("/methodology/"))) {
      expect(String(entry.metadata.title).match(/methodology|მეთოდოლოგია/gi)?.length ?? 0, where(entry)).toBeLessThanOrEqual(1);
    }
  });
});

describe("the single-year analysis title follows the basis of its year (U05-12)", () => {
  afterAll(() => {
    vi.doUnmock("../../lib/data/servedData");
    vi.resetModules();
  });

  it("calls a year with no actual row a plan, and a year with one actuals", async () => {
    const served = { facts: [{ year: 2025, basis: "actual" }, { year: 2026, basis: "planned" }] };
    vi.doMock("../../lib/data/servedData", async (original) => ({ ...(await original<object>()), loadServedExplorerData: async () => served }));
    vi.resetModules();
    const { analysisPageMetadata } = await import("../../lib/pages/analysis");
    expect(String((await analysisPageMetadata("en")).title)).toBe("Georgia budget analysis — 2026 plan | Fiscal.ge");
    expect(String((await analysisPageMetadata("ka")).description)).toContain("დაგეგმილი");
    served.facts.push({ year: 2026, basis: "actual" });
    expect(String((await analysisPageMetadata("en")).title)).toBe("Georgia budget analysis — 2026 actuals | Fiscal.ge");
  });
});

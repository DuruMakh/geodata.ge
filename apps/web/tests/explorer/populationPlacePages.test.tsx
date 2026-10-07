import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
// notFound() stays real so an unknown place really is "not found"; only the router hooks are stubbed.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push() {} }),
  usePathname: () => "/",
}));

import { PopulationPlaceExplorer } from "../../components/demography/population-place-explorer";
import { GEORGIA_PLACE_ID } from "../../lib/explorer/demographyAreas";
import {
  populationMunicipalityParams,
  populationPlaceMetadata,
  populationRegionParams,
  renderPopulationPlacePage,
} from "../../lib/pages/demography-population-place";

const GEORGIAN = /\p{Script=Georgian}/u;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;
const page = async (route: Parameters<typeof renderPopulationPlacePage>[0], locale: "ka" | "en" = "en") =>
  renderToStaticMarkup(await renderPopulationPlacePage(route, locale));

describe("route parameters", () => {
  it("are the 11 regions and the 63 municipalities, closed sets", async () => {
    const regions = (await populationRegionParams()).map((param) => param.id).sort();
    expect(regions).toEqual([
      "adjara", "guria", "imereti", "kakheti", "kvemo_kartli", "mtskheta_mtianeti",
      "racha_lechkhumi_kvemo_svaneti", "samegrelo_zemo_svaneti", "samtskhe_javakheti", "shida_kartli", "tbilisi",
    ]);
    const slugs = populationMunicipalityParams().map((param) => param.slug);
    expect(slugs).toHaveLength(63);
    expect(slugs).not.toContain("tbilisi");
  });
});

describe("place pages", () => {
  it("Georgia: no neighbours, 12 tick-list rows, the 64-municipality meta line and a breadcrumb", async () => {
    const html = await page({ kind: "country" });
    expect(html).toContain('data-testid="population-place-workspace"');
    expect(html).not.toContain('data-testid="municipal-entity-navigation"');
    expect(count(html, /data-testid="series-row"/g)).toBe(12);
    expect(html).toContain("11 regions · 64 municipalities · 2004–2026");
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain("region-member-row");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("a region: Adjara has neighbours, its six municipalities as links and its rank", async () => {
    const html = await page({ kind: "region", id: "adjara" });
    expect(count(html, /data-testid="series-row"/g)).toBe(7);
    expect(count(html, /data-testid="region-member-row"/g)).toBe(6);
    expect(html).toContain("Municipalities in this region");
    expect(html).toContain('href="/en/explorer/demography/population/batumi"');
    expect(html).toContain("6 municipalities · Rank 4 of 11 · 1 January 2026");
    expect(html).toContain('data-testid="municipal-entity-navigation"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("a municipality: Batumi's meta line names its region, the crumbs link to the region page and nothing is below it", async () => {
    const html = await page({ kind: "municipality", slug: "batumi" });
    expect(html).toContain("Adjara · Rank 2 of 64 · 1 January 2026");
    expect(html).toContain('href="/en/explorer/demography/population/region/adjara"');
    expect(count(html, /data-testid="series-row"/g)).toBe(1);
    expect(html).not.toContain("region-member-row");
    expect(html).toContain('data-testid="municipal-entity-navigation"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("Tbilisi is a region page with the singular count and no member rows", async () => {
    const html = await page({ kind: "region", id: "tbilisi" });
    expect(html).toContain("1 municipality · Rank 1 of 11 · 1 January 2026");
    expect(html).not.toContain("region-member-row");
    expect(count(html, /data-testid="series-row"/g)).toBe(1);
    expect(html).not.toMatch(GEORGIAN);
  });

  it("renders in Georgian with the Georgian ordinal", async () => {
    const html = await page({ kind: "municipality", slug: "batumi" }, "ka");
    expect(html).toContain("მე-2 ადგილი 64-დან · 1 იანვარი 2026");
    expect(html).toContain('href="/explorer/demography/population/region/adjara"');
  });

  it("carries no dataset markup and no download link", async () => {
    for (const route of [{ kind: "country" }, { kind: "region", id: "imereti" }, { kind: "municipality", slug: "khulo" }] as const) {
      const html = await page(route);
      expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
      expect(html).not.toContain("/downloads/data/");
      expect(html).toContain('href="/en/methodology/demography"');
    }
  });
});

// The rule in docs/data-methodology/demography.md: a page that shows a density says which area it uses for Tbilisi.
// Georgia's page (densest region) and a region's page (density) show one; a municipality's page shows none.
describe("the density note", () => {
  const noteOf = (html: string) => html.match(/<p data-testid="population-density-note"[^>]*>(.*?)<\/p>/)?.[1] ?? "";

  it.each([
    ["Georgia", { kind: "country" }],
    ["Adjara", { kind: "region", id: "adjara" }],
    ["Tbilisi", { kind: "region", id: "tbilisi" }],
  ] as const)("%s's page names the area it uses for Tbilisi, in English without Georgian and in Georgian", async (_name, route) => {
    const english = noteOf(await page(route, "en"));
    expect(english).toContain("504.24");
    expect(english).not.toMatch(GEORGIAN);
    const georgian = noteOf(await page(route, "ka"));
    expect(georgian).toContain("504.24");
    expect(georgian).toMatch(GEORGIAN);
  });

  it("is not on a municipality's page, in either language", async () => {
    for (const locale of ["en", "ka"] as const) {
      expect(await page({ kind: "municipality", slug: "batumi" }, locale), locale).not.toContain("population-density-note");
    }
  });
});

describe("place metadata", () => {
  it("has the page's own canonical address and reciprocal alternates in both languages", async () => {
    const en = await populationPlaceMetadata({ kind: "municipality", slug: "batumi" }, "en");
    expect(en.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/demography/population/batumi");
    expect(en.alternates?.languages).toMatchObject({
      ka: "https://fiscal.ge/explorer/demography/population/batumi",
      en: "https://fiscal.ge/en/explorer/demography/population/batumi",
    });
    expect(String(en.title)).toContain("Batumi");
    const ka = await populationPlaceMetadata({ kind: "region", id: "adjara" }, "ka");
    expect(ka.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/population/region/adjara");
    expect(String(ka.title)).toContain("მოსახლეობა");
    const georgia = await populationPlaceMetadata({ kind: "country" }, "en");
    expect(georgia.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/demography/population/georgia");
  });

  it("carries no Georgian text in English, for a region or a municipality", async () => {
    for (const route of [{ kind: "region", id: "adjara" }, { kind: "municipality", slug: "batumi" }] as const) {
      expect(JSON.stringify(await populationPlaceMetadata(route, "en")), JSON.stringify(route)).not.toMatch(GEORGIAN);
    }
  });
});

// Beyond the plan's checks: what the page module wires up that a reader's markup does not show on its own.
type ExplorerElement = ReactElement<ComponentProps<typeof PopulationPlaceExplorer>>;
/** The explorer in a page's element tree, found without rendering it: its key and its props are not in the markup. */
function explorerIn(node: ReactNode): ExplorerElement | null {
  if (Array.isArray(node)) return node.map(explorerIn).find((found) => found !== null) ?? null;
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  return node.type === PopulationPlaceExplorer ? (node as ExplorerElement) : explorerIn(node.props.children);
}
const previousAndNext = (html: string) => {
  const found = html.match(/data-testid="municipal-entity-navigation"[^>]*><a href="([^"]*)"[^>]*>← ([^<]*)<\/a><a href="([^"]*)"[^>]*>([^<]*) →<\/a>/);
  return found ? [[found[1], found[2]], [found[3], found[4]]] : null;
};
const breadcrumbUrls = (html: string): string[] => {
  const json = html.match(/<script[^>]*data-testid="breadcrumb-json-ld"[^>]*>(.*?)<\/script>/)?.[1] ?? "{}";
  return (JSON.parse(json).itemListElement as Array<{ item: string }>).map((entry) => entry.item);
};

describe("what each page hands on", () => {
  it("never offers a slug that another route of the section owns", () => {
    const slugs = populationMunicipalityParams().map((param) => param.slug);
    for (const reserved of ["georgia", "region"]) expect(slugs).not.toContain(reserved);
  });

  it("answers an unknown address with Next's 404, in the page and in its metadata, not with a crash", async () => {
    for (const route of [{ kind: "region", id: "nowhere" }, { kind: "municipality", slug: "nowhere" }, { kind: "municipality", slug: "tbilisi" }] as const) {
      await expect(renderPopulationPlacePage(route, "en"), JSON.stringify(route)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
      await expect(populationPlaceMetadata(route, "en"), JSON.stringify(route)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    }
  });

  it("names the years the place itself has: Georgia from 2004, a region and a municipality from 2015", async () => {
    const georgia = await page({ kind: "country" });
    expect(georgia).toContain("2004–2026 · as of 1 January");
    expect(georgia).toContain("density by region, 2004–2026.");
    for (const route of [{ kind: "region", id: "adjara" }, { kind: "municipality", slug: "batumi" }] as const) {
      const html = await page(route);
      expect(html, JSON.stringify(route)).toContain("2015–2026 · as of 1 January");
      expect(html, JSON.stringify(route)).toContain("density by region, 2015–2026.");
    }
  });

  it("says in its title and description what the page is, with the years the place has", async () => {
    const batumi = await populationPlaceMetadata({ kind: "municipality", slug: "batumi" }, "en");
    expect(batumi.title).toBe("Batumi — Population | Fiscal.ge");
    expect(batumi.description).toBe("Batumi: population on 1 January, 2015–2026, from Geostat data.");
    const georgia = await populationPlaceMetadata({ kind: "country" }, "en");
    expect(georgia.title).toBe("Georgia — Population | Fiscal.ge");
    expect(georgia.description).toBe("Georgia: population on 1 January, 2004–2026, from Geostat data.");
    const adjara = await populationPlaceMetadata({ kind: "region", id: "adjara" }, "ka");
    expect(adjara.title).toBe("აჭარა — მოსახლეობა | Fiscal.ge");
    expect(adjara.description).toBe("აჭარა: მოსახლეობა 1 იანვრის მდგომარეობით, 2015–2026, საქსტატის მონაცემებით.");
  });

  it("lists a region's municipalities largest first, numbered from 01, each with its persons", async () => {
    const html = await page({ kind: "region", id: "adjara" });
    const rows = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*data-testid="region-member-row"[^>]*>(.*?)<\/a>/g)].map((row) => [
      row[1],
      row[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    ]);
    expect(rows).toEqual([
      ["/en/explorer/demography/population/batumi", "01 Batumi 246,267"],
      ["/en/explorer/demography/population/kobuleti", "02 Kobuleti 73,897"],
      ["/en/explorer/demography/population/khelvachauri", "03 Khelvachauri 51,286"],
      ["/en/explorer/demography/population/khulo", "04 Khulo 16,098"],
      ["/en/explorer/demography/population/keda", "05 Keda 14,636"],
      ["/en/explorer/demography/population/shuakhevi", "06 Shuakhevi 11,030"],
    ]);
  });

  it("steps to the neighbours of its own level, round the ends, in the page's language", async () => {
    expect(previousAndNext(await page({ kind: "region", id: "adjara" }))).toEqual([
      ["/en/explorer/demography/population/region/tbilisi", "Tbilisi"],
      ["/en/explorer/demography/population/region/guria", "Guria"],
    ]);
    // Batumi is the first of the 63 municipalities, so its previous is the last one.
    expect(previousAndNext(await page({ kind: "municipality", slug: "batumi" }))).toEqual([
      ["/en/explorer/demography/population/tsageri", "Tsageri"],
      ["/en/explorer/demography/population/kobuleti", "Kobuleti"],
    ]);
    expect(previousAndNext(await page({ kind: "municipality", slug: "batumi" }, "ka"))).toEqual([
      ["/explorer/demography/population/tsageri", "ცაგერი"],
      ["/explorer/demography/population/kobuleti", "ქობულეთი"],
    ]);
  });

  it("gives its structured breadcrumb the same trail as the visible one, through the region for a municipality", async () => {
    const root = "https://fiscal.ge/en/explorer/demography/population";
    const trail = ["https://fiscal.ge/en", "https://fiscal.ge/en/explorer/demography", root];
    expect(breadcrumbUrls(await page({ kind: "country" }))).toEqual([...trail, `${root}/georgia`]);
    expect(breadcrumbUrls(await page({ kind: "region", id: "adjara" }))).toEqual([...trail, `${root}/region/adjara`]);
    expect(breadcrumbUrls(await page({ kind: "municipality", slug: "batumi" }))).toEqual([...trail, `${root}/region/adjara`, `${root}/batumi`]);
  });

  it("sets the place picker up for persons: every place's address, the persons figure and the 11 regions", async () => {
    const explorer = explorerIn(await renderPopulationPlacePage({ kind: "municipality", slug: "batumi" }, "en"));
    expect(explorer?.props.pickerOverrides?.valueFormat).toBe("persons");
    expect(explorer?.props.pickerOverrides?.hrefById).toMatchObject({
      "06": "/explorer/demography/population/batumi",
      "04": "/explorer/demography/population/region/tbilisi",
      "region.adjara": "/explorer/demography/population/region/adjara",
      [GEORGIA_PLACE_ID]: "/explorer/demography/population/georgia",
    });
    expect(explorer?.props.pickerOverrides?.countryDetail).toBe("3,941,103 · 64 municipalities");
    expect(explorer?.props.pickerCountry).toMatchObject({ id: GEORGIA_PLACE_ID, valueGel: 3941103, budgetCount: 64 });
    expect(explorer?.props.pickerGroups).toHaveLength(11);
  });

  it("keys the explorer by its place, so a reader who moves to another place starts afresh, and names the Excel file after it", async () => {
    for (const [route, key, scope] of [
      [{ kind: "country" }, GEORGIA_PLACE_ID, "georgia"],
      [{ kind: "region", id: "kvemo_kartli" }, "region.kvemo_kartli", "region-kvemo_kartli"],
      [{ kind: "municipality", slug: "batumi" }, "06", "batumi"],
    ] as const) {
      const explorer = explorerIn(await renderPopulationPlacePage(route, "en"));
      expect(explorer?.key, JSON.stringify(route)).toBe(key);
      expect(explorer?.props.workbookScope, JSON.stringify(route)).toBe(scope);
    }
  });
});

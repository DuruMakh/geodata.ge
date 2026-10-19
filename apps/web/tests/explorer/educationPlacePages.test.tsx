import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
// notFound() stays real so an unknown place really is "not found"; only the router hooks are stubbed.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push() {} }),
  usePathname: () => "/",
}));

import { EducationPlaceExplorer } from "../../components/education/education-place-explorer";
import {
  educationIndexMetadata,
  educationMunicipalityParams,
  educationPlaceMetadata,
  educationRegionParams,
  renderEducationIndexPage,
  renderEducationPlacePage,
} from "../../lib/pages/education-places";
import { educationPlaceSeries } from "../../lib/explorer/educationPlaces";
import { renderPageMarkup } from "../helpers/render-localized";

const GEORGIAN = /\p{Script=Georgian}/u;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
const latest = (html: string) => text(html.match(/<p data-testid="education-latest"[^>]*>(.*?)<\/p>/)?.[1] ?? "");
type Route = Parameters<typeof renderEducationPlacePage>[0];
const place = async (route: Route, set: "schools" | "kindergartens" = "schools", locale: "ka" | "en" = "en") =>
  renderPageMarkup(locale, await renderEducationPlacePage(route, locale, set));
const index = async (set: "schools" | "kindergartens", locale: "ka" | "en" = "en") => renderPageMarkup(locale, await renderEducationIndexPage(locale, set));

describe("route parameters", () => {
  it("are the 11 regions and the 63 municipalities other than Tbilisi", async () => {
    expect((await educationRegionParams()).map(param => param.id)).toHaveLength(11);
    expect((await educationRegionParams()).map(param => param.id)).toContain("tbilisi");
    const slugs = educationMunicipalityParams().map(param => param.slug);
    expect(slugs).toHaveLength(63);
    expect(slugs).not.toContain("tbilisi");
  });
});

describe("the indexes", () => {
  it("Schools: the one latest line in thousands, the map, Georgia first in thousands, every place linked, no indicators", async () => {
    const html = await index("schools");
    expect(latest(html)).toBe("2025/26: 644.2 thousand pupils in 2,292 schools");
    expect(count(html, /data-testid="education-latest"/g)).toBe(1);
    expect(html).toContain('data-testid="education-index-schools"');
    expect(html).toContain("Map: Pupils by municipality, 2025/26");
    expect(html).not.toContain('data-testid="index-kpi-grid"');
    expect(html).toMatch(/href="\/en\/explorer\/education\/schools\/georgia"[^>]*>.*?644\.2 thousand/);
    expect(html).toContain('href="/en/explorer/education/schools/region/tbilisi"');
    expect(html).toContain('href="/en/explorer/education/schools/lanchkhuti"');
    expect(text(html)).toContain("Source: Geostat, general education · 2025/26 · Methodology and sources.");
    // Abkhazia AR and the occupied-territory units count in Georgia's totals but get no row and no page.
    const listed = [...html.matchAll(/data-testid="municipal-row-name"[^>]*>([^<]*)</g)].map(row => row[1]);
    expect(listed.length).toBeGreaterThan(0);
    for (const name of ["Abkhazia", "Akhalgori", "Eredvi", "Tighva", "Kurta"]) expect(listed.join("|"), name).not.toContain(name);
    // (The map's occupied-territory overlay is drawn from its own definitions file, not linked.)
    expect(html).not.toMatch(/href="\/en\/explorer\/education[^"]*(unit\.|abkhazia|akhalgori|eredvi|tighva|kurta)/i);
    expect(html).not.toMatch(GEORGIAN);
  });

  it("Kindergartens: children in public kindergartens, in both languages", async () => {
    expect(latest(await index("kindergartens"))).toBe("2025/26: 130,337 children in 1,717 public kindergartens");
    const ka = await index("kindergartens", "ka");
    expect(latest(ka)).toBe("2025/26: 130,337 ბავშვი 1,717 საჯარო საბავშვო ბაღში");
    expect(ka).toContain('href="/explorer/education/kindergartens/region/tbilisi"');
  });

  it("have the set's title and summary as metadata", async () => {
    const metadata = await educationIndexMetadata("en", "schools");
    expect(metadata.title).toBe("Schools in Georgia | Fiscal.ge");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/education/schools");
  });
});

describe("place pages", () => {
  it("a region: Guria's latest line, three headings, its municipalities ranked by pupils and its neighbours", async () => {
    const html = await place({ kind: "region", id: "guria" });
    expect(html).toContain('data-testid="education-place-schools"');
    expect(latest(html)).toBe("2025/26: 13,743 pupils · Guria");
    expect(count(html, /data-testid="series-heading"/g)).toBe(3);
    expect(count(html, /data-testid="series-row"/g)).toBe(5);
    expect(html).toContain('data-testid="education-excel-download"');
    expect(html).toContain('data-testid="municipal-entity-navigation"');
    // Previous and next carry the page's mode, years and selection (Review Focus 5).
    expect(html).toContain('href="/en/explorer/education/schools/region/adjara#view=line&amp;sel=education.pupils.total&amp;range=all"');
    expect(html).toContain('href="/en/explorer/education/schools/region/imereti#view=line&amp;sel=education.pupils.total&amp;range=all"');
    const rows = [...html.matchAll(/<a([^>]*data-testid="region-member-row"[^>]*)>(.*?)<\/a>/g)].map(row => [row[1]!.match(/href="([^"]*)"/)?.[1], row[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()]);
    expect(rows).toEqual([
      ["/en/explorer/education/schools/ozurgeti", "01 Ozurgeti 8,065"],
      ["/en/explorer/education/schools/lanchkhuti", "02 Lanchkhuti 3,460"],
      ["/en/explorer/education/schools/chokhatauri", "03 Chokhatauri 2,218"],
    ]);
    // School years everywhere: the range strip's ends, never a bare year.
    expect(html).toContain('data-testid="year-range-strip"');
    expect(text(html.slice(html.indexOf('data-testid="year-range-strip"')))).toMatch(/Range 2005\/06–2025\/26/);
    expect(text(html)).toContain("Source: Geostat, general education");
    expect(html).toContain('href="/en/methodology/education"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("Georgia: pupils in thousands, the public and private split, no neighbours and no member list", async () => {
    const html = await place({ kind: "country" });
    expect(latest(html)).toBe("2025/26: 644.2 thousand pupils · Georgia");
    expect(count(html, /data-testid="series-row"/g)).toBe(11);
    expect(html).toContain("Private schools");
    expect(html).toContain("thousand pupils");
    expect(html).not.toContain('data-testid="municipal-entity-navigation"');
    expect(html).not.toContain("region-member-row");
    expect(html).toContain("2000/01");
    // The list prints Georgia's pupils as Geostat's thousands.
    expect(html).toMatch(/>644\.2</);
    expect(html).not.toContain("644,200");
  });

  it("a municipality: its crumbs pass through its region; Tbilisi and unknown places are not found", async () => {
    const html = await place({ kind: "municipality", slug: "ozurgeti" });
    expect(latest(html)).toBe("2025/26: 8,065 pupils · Ozurgeti");
    expect(html).toContain('href="/en/explorer/education/schools/region/guria"');
    for (const route of [{ kind: "region", id: "nowhere" }, { kind: "municipality", slug: "nowhere" }, { kind: "municipality", slug: "tbilisi" }] as const) {
      await expect(renderEducationPlacePage(route, "en", "schools"), JSON.stringify(route)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
      await expect(educationPlaceMetadata(route, "en", "schools"), JSON.stringify(route)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    }
  });

  it("Kindergartens: Tbilisi's page starts in 2017/18, with children, staff and kindergartens", async () => {
    const html = await place({ kind: "region", id: "tbilisi" }, "kindergartens");
    expect(html).toContain('data-testid="education-place-kindergartens"');
    expect(latest(html)).toBe("2025/26: 48,912 children · Tbilisi");
    expect(count(html, /data-testid="series-row"/g)).toBe(3);
    expect(html).toContain("2017/18");
    expect(html).not.toContain("2016/17");
    const ka = await place({ kind: "region", id: "tbilisi" }, "kindergartens", "ka");
    expect(latest(ka)).toBe("2025/26: 48,912 ბავშვი · თბილისი");
  });

  it("has the section and place as its title", async () => {
    const metadata = await educationPlaceMetadata({ kind: "region", id: "guria" }, "en", "schools");
    expect(metadata.title).toBe("Schools — Guria | Fiscal.ge");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/education/schools/region/guria");
  });
});

type ExplorerElement = ReactElement<ComponentProps<typeof EducationPlaceExplorer>>;
function explorerIn(node: ReactNode): ExplorerElement | null {
  if (Array.isArray(node)) return node.map(explorerIn).find(found => found !== null) ?? null;
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  return node.type === EducationPlaceExplorer ? (node as ExplorerElement) : explorerIn(node.props.children);
}

describe("what each page hands on", () => {
  it("only its own place's shown facts, every place's address and the workbook scope", async () => {
    const explorer = explorerIn(await renderEducationPlacePage({ kind: "region", id: "guria" }, "en", "schools"));
    expect(explorer?.key).toBe("region.guria");
    expect(explorer?.props.workbookScope).toBe("region-guria");
    expect(new Set(explorer?.props.facts.map(f => f.geographyId))).toEqual(new Set(["region.guria"]));
    expect(explorer?.props.pickerOverrides.hrefById).toMatchObject({
      "04": "/explorer/education/schools/region/tbilisi",
      "56": "/explorer/education/schools/ozurgeti",
      "country.georgia": "/explorer/education/schools/georgia",
    });
    expect(explorer?.props.pickerOverrides.countryDetail).toBe("644.2 thousand · 64 municipalities");
    // The places with no page are offered nowhere: not as an address, not in the picker's groups.
    const offered = [...Object.keys(explorer?.props.pickerOverrides.hrefById ?? {}), ...(explorer?.props.pickerGroups ?? []).flatMap(group => [group.regionId, ...group.members.map(member => member.code)])];
    expect(offered).toHaveLength(Object.keys(explorer?.props.pickerOverrides.hrefById ?? {}).length + 11 + 64);
    expect(offered.filter(id => id.startsWith("unit."))).toEqual([]);
    expect(explorer?.props.labels["education.teachers.women"]).toBe("Women");
    expect(explorer?.props.headingLabels.teachers).toBe("Teachers");
  });

  it("only the facts of the series the place lists", async () => {
    const shipped = async (route: Route, set: "schools" | "kindergartens") => new Set(explorerIn(await renderEducationPlacePage(route, "en", set))?.props.facts.map(f => f.indicatorId));
    const georgia = await shipped({ kind: "country" }, "schools");
    expect(georgia).toEqual(new Set(educationPlaceSeries("schools", "country.georgia").map(series => series.id)));
    expect(georgia.size).toBe(11);
    expect([...georgia].filter(id => /\.(he|vet|kg)_|\.kindergartens\.|\.pupils\./.test(id))).toEqual([]);
    const guria = await shipped({ kind: "region", id: "guria" }, "kindergartens");
    expect(guria).toEqual(new Set(["education.kg_children.total", "education.kg_staff.total", "education.kindergartens.total"]));
  });

  it("builds every place page of both sets", async () => {
    for (const set of ["schools", "kindergartens"] as const) {
      for (const route of [{ kind: "country" } as const, ...(await educationRegionParams()).map(({ id }) => ({ kind: "region", id }) as const), ...educationMunicipalityParams().map(({ slug }) => ({ kind: "municipality", slug }) as const)]) {
        expect(explorerIn(await renderEducationPlacePage(route, "en", set)), `${set} ${JSON.stringify(route)}`).not.toBeNull();
      }
    }
  });
});

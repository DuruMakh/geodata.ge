import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
// notFound() stays real so an unknown place really is "not found"; only the router hooks are stubbed.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push() {} }),
  usePathname: () => "/",
}));

import { SocialPlaceExplorer } from "../../components/social/social-place-explorer";
import { buildSocialWorkbookExportModel } from "../../lib/explorer/socialWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import { socialPlaceSeries } from "../../lib/explorer/socialPlaces";
import {
  renderSocialIndexPage, renderSocialPlacePage, socialIndexMetadata, socialMunicipalityParams, socialPlaceMetadata, socialRegionParams,
} from "../../lib/pages/social-places";
import { renderPageMarkup } from "../helpers/render-localized";

const GEORGIAN = /\p{Script=Georgian}/u;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
const latest = (html: string) => text(html.match(/<p data-testid="social-latest"[^>]*>(.*?)<\/p>/)?.[1] ?? "");
type Set = "pensions" | "subsistence-allowance";
type Route = Parameters<typeof renderSocialPlacePage>[0];
const place = async (route: Route, set: Set = "pensions", locale: "ka" | "en" = "en") => renderPageMarkup(locale, await renderSocialPlacePage(route, locale, set));
const index = async (set: Set, locale: "ka" | "en" = "en") => renderPageMarkup(locale, await renderSocialIndexPage(locale, set));

describe("the indexes", () => {
  it("Pensions: the one latest line, the map of pensioners per 100 residents, Georgia first, every place linked, no indicators", async () => {
    const html = await index("pensions");
    expect(latest(html)).toBe("2025: 888,518 pensioners");
    expect(count(html, /data-testid="social-latest"/g)).toBe(1);
    expect(html).toContain('data-testid="social-index-pensions"');
    expect(html).toContain("Map: Pensioners per 100 residents by municipality, 2025");
    expect(html).toContain("pensioners per 100 residents, 2025");
    expect(html).not.toContain('data-testid="index-kpi-grid"');
    expect(html).toMatch(/href="\/en\/explorer\/health\/pensions\/georgia"[^>]*>.*?\d+\.\d%/);
    expect(html).toContain('href="/en/explorer/health/pensions/region/tbilisi"');
    expect(html).toContain('href="/en/explorer/health/pensions/lanchkhuti"');
    expect(text(html)).toContain("Source: Social Service Agency · 2025 · Methodology and sources.");
    expect(html).toContain('href="/en/methodology/social-protection"');
    const listed = [...html.matchAll(/data-testid="municipal-row-name"[^>]*>([^<]*)</g)].map(row => row[1]);
    expect(listed.length).toBeGreaterThan(0);
    for (const name of ["Abkhazia", "Akhalgori", "Eredvi", "Tighva", "Kurta"]) expect(listed.join("|"), name).not.toContain(name);
    expect(html).not.toMatch(/href="\/en\/explorer\/health[^"]*(unit\.|abkhazia|akhalgori|eredvi|tighva|kurta)/i);
    expect(html).not.toMatch(GEORGIAN);
  });

  it("Subsistence allowance: families on the line, people in receiving families on the map, in both languages", async () => {
    const html = await index("subsistence-allowance");
    expect(latest(html)).toBe("2025: 129,506 families receive the allowance");
    expect(html).toContain("people in receiving families per 100 residents, 2025");
    const ka = await index("subsistence-allowance", "ka");
    expect(latest(ka)).toMatch(/^2025: 129,506 /);
    expect(ka).toContain('href="/explorer/health/subsistence-allowance/region/tbilisi"');
  });

  it("have the set's title and summary as metadata", async () => {
    const metadata = await socialIndexMetadata("en", "pensions");
    expect(metadata.title).toBe("Pensions in Georgia | Fiscal.ge");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/health/pensions");
  });
});

describe("place pages", () => {
  it("a region: Guria's latest line, four headings, its municipalities ranked by share and its neighbours", async () => {
    const html = await place({ kind: "region", id: "guria" });
    expect(html).toContain('data-testid="social-place-pensions"');
    expect(latest(html)).toMatch(/^2025: [\d,]+ pensioners$/);
    expect(count(html, /data-testid="series-heading"/g)).toBe(4);
    expect(count(html, /data-testid="series-row"/g)).toBe(10);
    expect(html).toContain('data-testid="social-excel-download"');
    expect(html).toContain('data-testid="municipal-entity-navigation"');
    expect(html).toContain('href="/en/explorer/health/pensions/region/adjara"');
    expect(html).toContain('href="/en/explorer/health/pensions/region/imereti"');
    const rows = [...html.matchAll(/<a([^>]*data-testid="region-member-row"[^>]*)>(.*?)<\/a>/g)].map(row => [row[1]!.match(/href="([^"]*)"/)?.[1], text(row[2]!).trim()]);
    expect(rows.map(row => row[0]).sort()).toEqual(["/en/explorer/health/pensions/chokhatauri", "/en/explorer/health/pensions/lanchkhuti", "/en/explorer/health/pensions/ozurgeti"]);
    const shares = rows.map(row => Number(row[1]!.match(/([\d.]+)%$/)![1]));
    expect(shares).toEqual([...shares].sort((a, b) => b - a));
    expect(text(html)).toContain("Source: Social Service Agency");
    expect(html).toContain('href="/en/methodology/social-protection"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("Georgia: no neighbours and no member list; Subsistence lists five headings", async () => {
    const html = await place({ kind: "country" });
    expect(latest(html)).toBe("2025: 888,518 pensioners");
    expect(html).not.toContain('data-testid="municipal-entity-navigation"');
    expect(html).not.toContain("region-member-row");
    const subsistence = await place({ kind: "country" }, "subsistence-allowance");
    expect(latest(subsistence)).toBe("2025: 129,506 families");
    expect(count(subsistence, /data-testid="series-heading"/g)).toBe(5);
    expect(count(subsistence, /data-testid="series-row"/g)).toBe(10);
  });

  it("a municipality: its crumbs pass through its region; Tbilisi and unknown places are not found", async () => {
    const html = await place({ kind: "municipality", slug: "ozurgeti" });
    expect(latest(html)).toMatch(/^2025: [\d,]+ pensioners$/);
    expect(html).toContain('href="/en/explorer/health/pensions/region/guria"');
    for (const route of [{ kind: "region", id: "nowhere" }, { kind: "municipality", slug: "nowhere" }, { kind: "municipality", slug: "tbilisi" }] as const) {
      await expect(renderSocialPlacePage(route, "en", "pensions"), JSON.stringify(route)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
      await expect(socialPlaceMetadata(route, "en", "pensions"), JSON.stringify(route)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    }
  });

  it("has the section and place as its title", async () => {
    const metadata = await socialPlaceMetadata({ kind: "region", id: "guria" }, "en", "pensions");
    expect(metadata.title).toBe("Pensions — Guria | Fiscal.ge");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/health/pensions/region/guria");
  });
});

type ExplorerElement = ReactElement<ComponentProps<typeof SocialPlaceExplorer>>;
function explorerIn(node: ReactNode): ExplorerElement | null {
  if (Array.isArray(node)) return node.map(explorerIn).find(found => found !== null) ?? null;
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  return node.type === SocialPlaceExplorer ? (node as ExplorerElement) : explorerIn(node.props.children);
}

describe("what each page hands on", () => {
  it("only its own place's facts of the set's series and population, the price index, every place's address and the workbook scope", async () => {
    const explorer = explorerIn(await renderSocialPlacePage({ kind: "region", id: "guria" }, "en", "pensions"));
    expect(explorer?.key).toBe("region.guria");
    expect(explorer?.props.workbookScope).toBe("region-guria");
    expect(new Set(explorer?.props.facts.map(f => f.geographyId))).toEqual(new Set(["region.guria"]));
    const served = new Set(socialPlaceSeries("pensions").filter(series => !series.calculated).map(series => series.id));
    expect(new Set(explorer?.props.facts.map(f => f.indicatorId))).toEqual(served);
    expect(new Set(explorer?.props.population.map(row => row.geographyId))).toEqual(new Set(["region.guria"]));
    expect(explorer?.props.cpi.some(row => row.year === 2025)).toBe(true);
    expect(explorer?.props.populationSources.length).toBe(1);
    expect(explorer?.props.cpiSources.length).toBe(1);
    expect(explorer?.props.pickerOverrides.hrefById).toMatchObject({
      "04": "/explorer/health/pensions/region/tbilisi",
      "56": "/explorer/health/pensions/ozurgeti",
      "country.georgia": "/explorer/health/pensions/georgia",
    });
    expect(explorer?.props.pickerOverrides.countryDetail).toMatch(/^\d+\.\d% · 64 municipalities$/);
    expect(explorer?.props.labels["social.pension.avg_monthly#real"]).toBe("Average pension at 2025 prices");
    expect(explorer?.props.headingLabels.share).toBe("Share of residents");
  });

  it("hands on every SSA table as its archived topic page, so a workbook of every heading builds with real links", async () => {
    for (const [set, page] of [["pensions", "ssa-page-pension.html.txt"], ["subsistence-allowance", "ssa-page-tsa_allowance.html.txt"]] as const) {
      for (const locale of ["en", "ka"] as const) {
        const { props } = explorerIn(await renderSocialPlacePage({ kind: "region", id: "guria" }, locale, set))!;
        const presentation = { locale, englishLabels: {}, messages: await getMessages(locale, ["workbook", "format", "common", "social"]) };
        const urls = new Set<string>();
        for (const heading of new Set(socialPlaceSeries(set).map(series => series.heading))) {
          const selectedIds = socialPlaceSeries(set).filter(series => series.heading === heading).map(series => series.id);
          const model = buildSocialWorkbookExportModel({
            set, placeId: props.place.id, scope: props.workbookScope, facts: props.facts, extras: { population: props.population, cpi: props.cpi },
            labels: props.labels, headingLabels: props.headingLabels, sources: props.sources, populationSources: props.populationSources, cpiSources: props.cpiSources,
            gdpSources: [], siteOrigin: "https://fiscal.ge", title: "Title", state: { mode: "table", range: { kind: "all" }, selectedIds },
          }, presentation);
          expect(model.sources.length, `${set} ${heading}`).toBeGreaterThan(0);
          for (const source of model.sources) urls.add(source.absoluteUrl);
        }
        expect([...urls].every(url => /^https:\/\/fiscal\.ge\/downloads\/methodology\/(social-protection|demography|inflation)\/files\//.test(url)), [...urls].join(" ")).toBe(true);
        expect(urls).toContain(`https://fiscal.ge/downloads/methodology/social-protection/files/${page}`);
        if (set === "subsistence-allowance") expect(urls).toContain("https://fiscal.ge/downloads/methodology/social-protection/files/ssa-page-tsa_db.html.txt");
      }
    }
  });

  it("carries Dataset markup: the index is the set's dataset and a place page a slice of it", async () => {
    const dataset = (html: string) => JSON.parse(html.match(/<script data-testid="explorer-dataset-json-ld"[^>]*>(.*?)<\/script>/)![1]!);
    const indexNode = dataset(await index("pensions"));
    expect(indexNode).toMatchObject({ "@type": "Dataset", name: "Pensions", temporalCoverage: "2013/2025" });
    expect(JSON.stringify(indexNode)).toContain("Social Service Agency");
    const placeNode = dataset(await place({ kind: "region", id: "guria" }));
    expect(placeNode).toMatchObject({ "@type": "Dataset", name: "Pensions — Guria", isPartOf: { url: "https://fiscal.ge/en/explorer/health/pensions" } });
    expect(placeNode.variableMeasured).toEqual(["Pensioners", "Share of residents", "Money paid", "Average per month"]);
    const ka = dataset(await place({ kind: "municipality", slug: "ozurgeti" }, "subsistence-allowance", "ka"));
    expect(ka).toMatchObject({ "@type": "Dataset", isPartOf: { url: "https://fiscal.ge/explorer/health/subsistence-allowance" } });
  });

  it("builds every place page of both sets", async () => {
    for (const set of ["pensions", "subsistence-allowance"] as const) {
      for (const route of [{ kind: "country" } as const, ...(await socialRegionParams()).map(({ id }) => ({ kind: "region", id }) as const), ...socialMunicipalityParams().map(({ slug }) => ({ kind: "municipality", slug }) as const)]) {
        expect(explorerIn(await renderSocialPlacePage(route, "en", set)), `${set} ${JSON.stringify(route)}`).not.toBeNull();
      }
    }
  });
});

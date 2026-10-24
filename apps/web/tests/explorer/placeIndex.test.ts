import { readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push() {} }),
  usePathname: () => "/",
}));

import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { buildVitalPlaceModel, vitalFactsForPlace } from "../../lib/explorer/demographyVital";
import { SERIES } from "../../lib/data/demography/series";
import { formatAmount, formatInUnit, MISSING, UNIT_PERSONS } from "../../lib/explorer/format";
import { aggregateFactsForEntity, applyAdjaraBudgetAdjustment, regionFactsFor } from "../../lib/explorer/municipalData";
import { municipalityCodeForSlug } from "../../lib/explorer/municipalityRoutes";
import { buildPlaceIndex, entriesForPage } from "../../lib/explorer/places/buildPlaceIndex.server";
import type { PlaceIndex } from "../../lib/explorer/places/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { NAV_TREE } from "../../lib/navigation/navTree";
import { renderEducationPlacePage } from "../../lib/pages/education-places";
import { renderHouseholdRegionPage } from "../../lib/pages/household";
import { renderUnemploymentRegionPage } from "../../lib/pages/unemployment-regions";
import { renderWagesRegionPage } from "../../lib/pages/wages";
import { renderPageMarkup } from "../helpers/render-localized";

const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeAll(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterAll(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

const APP = path.resolve(__dirname, "../../app/(ka)");
const BATUMI = municipalityCodeForSlug("batumi")!;
const ZESTAFONI = municipalityCodeForSlug("zestafoni")!;

/** Every explorer address the build generates: the static pages, and each dynamic page's `generateStaticParams`. */
async function staticExplorerPaths(): Promise<Set<string>> {
  const pages = (readdirSync(path.join(APP, "explorer"), { recursive: true }) as string[])
    .filter((file) => path.basename(file) === "page.tsx")
    .map((file) => path.join("explorer", path.dirname(file)).split(path.sep));
  const paths = new Set<string>();
  for (const segments of pages) {
    const route = `/${segments.join("/")}`;
    if (!route.includes("[")) { paths.add(route); continue; }
    const page = await import(path.join(APP, ...segments, "page.tsx")) as { generateStaticParams: () => Promise<Record<string, string>[]> | Record<string, string>[] };
    for (const params of await page.generateStaticParams()) {
      paths.add(route.replace(/\[(\w+)\]/g, (_, name: string) => params[name]!));
    }
  }
  return paths;
}

/** The text of the latest line a rendered page carries under its heading. */
function latestLine(html: string, testId: string): string {
  const match = new RegExp(`<p data-testid="${testId}"[^>]*>(.*?)</p>`).exec(html);
  if (!match) throw new Error(`No ${testId} line`);
  return match[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

describe.each(["ka", "en"] as const)("place index (%s)", (locale) => {
  let index: PlaceIndex;
  const own = (placeId: string) => index.entries.filter((entry) => entry.placeId === placeId);
  const hrefs = (placeId: string) => own(placeId).map((entry) => entry.href);
  const entry = (placeId: string, page: string) => {
    const found = index.entries.filter((candidate) => candidate.placeId === placeId && candidate.page === page);
    expect(found, `${placeId} on ${page}`).toHaveLength(1);
    return found[0]!;
  };

  beforeAll(async () => { index = await buildPlaceIndex(locale); }, 180_000);

  it("is built once per language", async () => {
    expect(await buildPlaceIndex(locale)).toBe(index);
  });

  it("lists the 11 regions, Tbilisi as the capital, and the 63 other municipalities, named in both languages", async () => {
    const { regions, municipalities } = await loadServedMunicipalData();
    expect(index.places).toHaveLength(74);
    expect(index.places.filter((place) => place.kind === "region").map((place) => place.id)).toEqual(regions.map((region) => region.id));
    expect(index.places.filter((place) => place.kind === "municipality").map((place) => place.id).sort())
      .toEqual(municipalities.map((municipality) => municipality.code).filter((code) => code !== "04").sort());
    expect(index.places.filter((place) => place.capital).map((place) => place.id)).toEqual(["region.tbilisi"]);
    const adjara = index.places.find((place) => place.id === "region.adjara")!;
    expect(adjara.municipalityCount).toBe(municipalities.filter((municipality) => municipality.regionId === "region.adjara").length);
    expect(index.places.find((place) => place.id === "region.tbilisi")!.municipalityCount).toBeUndefined();
    const batumi = index.places.find((place) => place.id === BATUMI)!;
    expect(batumi).toMatchObject({ kind: "municipality", regionId: "region.adjara", capital: false, nameKa: "ბათუმი", nameEn: "Batumi" });
    expect(batumi.municipalityCount).toBeUndefined();
    for (const place of index.places) {
      expect(place.nameKa, place.id).toMatch(/\p{Script=Georgian}/u);
      expect(place.nameEn, place.id).toMatch(/^[A-Z][A-Za-z -]+$/);
    }
  });

  it("gives every place its four card facts, each with a value and a year", () => {
    for (const place of index.places) {
      expect(place.facts.map((fact) => fact.label), place.id).toEqual(["population", "budget", "perResident", "birthsPer100Deaths"]);
      for (const fact of place.facts) {
        expect(fact.value, `${place.id} ${fact.label}`).not.toBe("");
        expect(fact.value, `${place.id} ${fact.label}`).not.toBe(MISSING);
        expect(fact.period, `${place.id} ${fact.label}`).toMatch(/^\d{4}$/);
      }
    }
    const batumi = index.places.find((place) => place.id === BATUMI)!;
    // The card's population, budget and births figures are the ones the Population, Budget and Births pages give Batumi.
    expect(batumi.facts[0]).toEqual({ label: "population", value: entry(BATUMI, "/explorer/demography/population").value, period: entry(BATUMI, "/explorer/demography/population").period });
    expect(batumi.facts[1]).toEqual({ label: "budget", value: entry(BATUMI, "/explorer/municipalities").value, period: entry(BATUMI, "/explorer/municipalities").period });
    expect(batumi.facts[3]).toEqual({ label: "birthsPer100Deaths", value: entry(BATUMI, "/explorer/demography/births-deaths").value, period: entry(BATUMI, "/explorer/demography/births-deaths").period });
  });

  it("links Batumi to its own pages", () => {
    expect(hrefs(BATUMI)).toEqual(expect.arrayContaining([
      "/explorer/municipalities/batumi",
      "/explorer/demography/population/batumi",
      "/explorer/education/schools/batumi",
      "/explorer/inflation/cities/batumi",
      "/explorer/environment/air-quality/batumi",
    ]));
  });

  it("links Adjara to its region pages", () => {
    expect(hrefs("region.adjara")).toEqual(expect.arrayContaining(["/explorer/wages/regions/adjara", "/explorer/municipalities/region/adjara"]));
  });

  it("gives Tbilisi its Budget page, Population region page and both city pages, with no row twice", () => {
    expect(hrefs("region.tbilisi")).toEqual(expect.arrayContaining([
      "/explorer/municipalities/tbilisi",
      "/explorer/inflation/cities/tbilisi",
      "/explorer/environment/air-quality/tbilisi",
      "/explorer/demography/population/region/tbilisi",
    ]));
    expect(hrefs("region.tbilisi")).not.toContain("/explorer/municipalities/region/tbilisi");
    expect(index.entries.some((candidate) => candidate.placeId === "04")).toBe(false);
    const pairs = index.entries.map((candidate) => `${candidate.placeId} ${candidate.href}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    const pages = index.entries.map((candidate) => `${candidate.placeId} ${candidate.page}`);
    expect(new Set(pages).size).toBe(pages.length);
  });

  it("gives Zestafoni the Zestaponi air-quality page", () => {
    expect(entry(ZESTAFONI, "/explorer/environment/air-quality").href).toBe("/explorer/environment/air-quality/zestaponi");
  });

  it("names only known places and pages, and links only to generated addresses", async () => {
    const ids = new Set(["country.georgia", ...index.places.map((place) => place.id)]);
    const pages = new Set<string>(NAV_TREE.flatMap((hub) => hub.sections.map((section) => section.href)));
    const generated = await staticExplorerPaths();
    for (const candidate of index.entries) {
      expect(ids.has(candidate.placeId), candidate.placeId).toBe(true);
      expect(pages.has(candidate.page), candidate.page).toBe(true);
      expect(generated.has(candidate.href.split("#")[0]!), candidate.href).toBe(true);
      expect(candidate.href.startsWith(`${candidate.page}/`) || candidate.href === candidate.page || candidate.page.startsWith("/explorer/demography/"), candidate.href).toBe(true);
      expect(candidate.value, candidate.href).not.toBe("");
      expect(candidate.value, candidate.href).not.toBe(MISSING);
      expect(Number.isFinite(candidate.number), candidate.href).toBe(true);
      expect(candidate.period, candidate.href).toMatch(/\d{4}/);
    }
  }, 120_000);

  it("covers each page's places", () => {
    const count = (page: string, kind: "region" | "municipality" | "country") => entriesForPage(index, page).filter((candidate) =>
      kind === "country" ? candidate.placeId === "country.georgia" : kind === "region" ? candidate.placeId.startsWith("region.") : /^\d{2}$/.test(candidate.placeId)).length;
    expect(entriesForPage(index, "/explorer/wages/regions").every((candidate) => candidate.page === "/explorer/wages/regions")).toBe(true);
    for (const page of ["/explorer/municipalities", "/explorer/demography/population", "/explorer/education/schools", "/explorer/health/pensions"]) {
      expect([count(page, "region"), count(page, "municipality"), count(page, "country")], page).toEqual([11, 63, 1]);
    }
    for (const page of ["/explorer/wages/regions", "/explorer/business/regions", "/explorer/living-standards/income", "/explorer/health/causes-of-death"]) {
      expect([count(page, "region"), count(page, "municipality"), count(page, "country")], page).toEqual([11, 0, 1]);
    }
    expect(entriesForPage(index, "/explorer/inflation/cities")).toHaveLength(6);
    expect(entriesForPage(index, "/explorer/environment/air-quality")).toHaveLength(9);
  });

  it("states births per 100 deaths as each place's Population page does", async () => {
    const { facts } = await loadServedDemographyData();
    for (const id of ["country.georgia", ...index.places.map((place) => place.id)]) {
      const latest = buildVitalPlaceModel(vitalFactsForPlace(facts, id), id)!.latest;
      const vital = entry(id, "/explorer/demography/births-deaths");
      expect([vital.value, vital.period], id).toEqual([formatInUnit(Math.round(latest.ratio!), UNIT_PERSONS), String(latest.year)]);
      expect(vital.href).toBe(`${entry(id, "/explorer/demography/population").href}#births-deaths`);
    }
  });

  it("states each place's population as the latest served figure its Population page shows", async () => {
    const { facts } = await loadServedDemographyData();
    for (const id of ["country.georgia", ...index.places.map((place) => place.id)]) {
      const latest = facts.filter((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === id).sort((a, b) => a.year - b.year).at(-1)!;
      expect([entry(id, "/explorer/demography/population").value, entry(id, "/explorer/demography/population").period], id)
        .toEqual([formatInUnit(latest.value, UNIT_PERSONS), String(latest.year)]);
    }
  });

  it("states each region's budget as its region page sums it, Adjara with the republican adjustment", async () => {
    const { regions, municipalities, functionFacts, totalFacts, adjaraBudgetAdjustments } = await loadServedMunicipalData();
    for (const region of regions.filter((candidate) => candidate.id !== "region.tbilisi")) {
      const members = regionFactsFor(region.id, municipalities, functionFacts, totalFacts);
      const rolled = aggregateFactsForEntity(region.id, members.functionFacts, members.totalFacts).totalFacts;
      const own = region.id === "region.adjara" ? applyAdjaraBudgetAdjustment(rolled, adjaraBudgetAdjustments) : rolled;
      const latest = own.sort((a, b) => a.year - b.year).at(-1)!;
      expect([entry(region.id, "/explorer/municipalities").value, entry(region.id, "/explorer/municipalities").period], region.id)
        .toEqual([formatAmount(latest.publicTotalGel, locale), String(latest.year)]);
    }
  });

  it("states the figure each sampled place page's latest line renders", async () => {
    const pages = [
      { placeId: "region.adjara", page: "/explorer/wages/regions", testId: "wages-latest", render: () => renderWagesRegionPage("adjara", locale) },
      { placeId: BATUMI, page: "/explorer/education/schools", testId: "education-latest", render: () => renderEducationPlacePage({ kind: "municipality", slug: "batumi" }, locale, "schools") },
      { placeId: "region.adjara", page: "/explorer/living-standards/income", testId: "household-latest", render: () => renderHouseholdRegionPage("income", "adjara", locale) },
      { placeId: "region.adjara", page: "/explorer/unemployment/regions", testId: "unemployment-latest", render: () => renderUnemploymentRegionPage("adjara", locale) },
    ];
    for (const sample of pages) {
      const line = latestLine(renderPageMarkup(locale, await sample.render()), sample.testId);
      const { value, period } = entry(sample.placeId, sample.page);
      expect(line, sample.page).toContain(value);
      expect(line, sample.page).toContain(period);
    }
  }, 120_000);
});

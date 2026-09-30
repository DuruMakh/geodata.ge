import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { JsonLd } from "../../components/seo/json-ld";
import type { Locale } from "../../lib/i18n/types";
import { renderMunicipalCountry } from "../../lib/pages/municipal-country";
import { renderMunicipalIndex } from "../../lib/pages/municipal-index";
import { renderMunicipalRegion } from "../../lib/pages/municipal-region";
import { renderMunicipality } from "../../lib/pages/municipality";
import { renderRegionalEconomiesPage, renderRegionalEconomyPage } from "../../lib/pages/regional-economy";

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge"));
afterAll(() => vi.unstubAllEnvs());

function datasetFromPage(page: ReactNode) {
  function findScript(node: ReactNode): ReactNode {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ children?: ReactNode; testId?: string }>(child)) continue;
      if (child.type === JsonLd && child.props.testId === "explorer-dataset-json-ld") return child;
      const found = findScript(child.props.children);
      if (found) return found;
    }
  }
  const script = findScript(page);
  if (!script) throw new Error("The page must emit its Dataset JSON-LD");
  const html = renderToStaticMarkup(script);
  return JSON.parse(html.match(/>(.*?)<\/script>/)![1]);
}

const municipalPages: [string, (locale: Locale) => Promise<ReactNode>][] = [
  ["municipality", (locale) => renderMunicipality("tbilisi", locale)],
  ["region", (locale) => renderMunicipalRegion("imereti", locale)],
  ["country", renderMunicipalCountry],
];

describe.each(["ka", "en"] as const)("localized Dataset relationships: %s", (locale) => {
  it.each(municipalPages)("the municipal %s page describes its parent as a complete Dataset", async (_kind, renderPage) => {
    const parent = datasetFromPage(await renderMunicipalIndex(locale));
    const subset = datasetFromPage(await renderPage(locale));
    expect(subset.isPartOf).toEqual({
      "@type": "Dataset",
      "@id": "https://fiscal.ge/explorer/municipalities#dataset",
      url: `https://fiscal.ge${locale === "en" ? "/en" : ""}/explorer/municipalities`,
      name: parent.name,
      description: parent.description,
      creator: { "@type": "Organization", "@id": "https://fiscal.ge/#organization", name: "Fiscal.ge" },
      license: "https://creativecommons.org/licenses/by/4.0/",
    });
    expect(subset.isPartOf.name).toBe(locale === "en" ? "Municipal budgets in Georgia" : "საქართველოს მუნიციპალიტეტების ბიუჯეტები");
    expect(subset.isPartOf.description.length).toBeGreaterThanOrEqual(50);
    expect(subset).not.toHaveProperty("includedInDataCatalog");
    expect(subset).not.toHaveProperty("distribution");
    if (locale === "en") expect(JSON.stringify(subset.isPartOf)).not.toMatch(/\p{Script=Georgian}/u);
  });

  it("a regional economy describes the complete all-regions parent", async () => {
    const parent = datasetFromPage(await renderRegionalEconomiesPage(locale));
    const subset = datasetFromPage(await renderRegionalEconomyPage("tbilisi", locale));
    expect(subset.isPartOf).toEqual({
      "@type": "Dataset",
      "@id": "https://fiscal.ge/explorer/economy/regions#dataset",
      url: `https://fiscal.ge${locale === "en" ? "/en" : ""}/explorer/economy/regions`,
      name: parent.name,
      description: parent.description,
      creator: { "@type": "Organization", "@id": "https://fiscal.ge/#organization", name: "Fiscal.ge" },
      license: "https://creativecommons.org/licenses/by/4.0/",
    });
    expect(subset.isPartOf.name).toBe(locale === "en" ? "Regional economies" : "რეგიონების ეკონომიკა");
    expect(subset.isPartOf.description.length).toBeGreaterThanOrEqual(50);
    if (locale === "en") expect(JSON.stringify(subset.isPartOf)).not.toMatch(/\p{Script=Georgian}/u);
  });

  it("different regions keep their own identities while only the parent shares the methodology identity", async () => {
    const parent = datasetFromPage(await renderRegionalEconomiesPage(locale));
    for (const slug of ["tbilisi", "adjara"]) {
      const subset = datasetFromPage(await renderRegionalEconomyPage(slug, locale));
      expect(subset["@id"]).toBe(`https://fiscal.ge/explorer/economy/regions/${slug}#dataset`);
      expect(subset.url).toBe(`https://fiscal.ge${locale === "en" ? "/en" : ""}/explorer/economy/regions/${slug}`);
      expect(subset).not.toHaveProperty("sameAs");
      expect(subset.isPartOf["@id"]).toBe(parent["@id"]);
    }
    expect(parent.sameAs).toBe(`https://fiscal.ge${locale === "en" ? "/en" : ""}/methodology/regional-economies`);
  });
});

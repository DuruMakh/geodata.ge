import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));

import {
  demographyPageMetadata,
  renderDemographyPage,
} from "../../lib/pages/demography";
import {
  demographyPopulationPageMetadata,
  renderDemographyPopulationPage,
} from "../../lib/pages/demography-population";

const GEORGIAN = /\p{Script=Georgian}/u;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

describe("demography hub page", () => {
  it("renders the four cards with a breadcrumb and no Georgian text in English", async () => {
    const html = renderToStaticMarkup(await renderDemographyPage("en"));
    expect(html).toContain('data-testid="demography-hub"');
    expect((html.match(/data-testid="hub-card"/g) ?? []).length).toBe(4);
    expect((html.match(/aria-disabled="true"/g) ?? []).length).toBe(3);
    expect(html).toContain('href="/en/explorer/demography/population"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toContain("/downloads/data/");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("has metadata that is canonical to its own language and reciprocal", async () => {
    const metadata = await demographyPageMetadata("en");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/demography");
    expect(metadata.alternates?.languages).toMatchObject({ ka: "https://fiscal.ge/explorer/demography", en: "https://fiscal.ge/en/explorer/demography" });
  });
});

describe("population page", () => {
  it("renders the heading, coverage, explorer and breadcrumb, with no download and no Georgian text in English", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    expect(html).toContain('data-testid="population-explorer"');
    expect(html).toContain("2004–2026 · as of 1 January");
    expect(html).toContain("persons, on 1 January");
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toContain("/downloads/data/");
    expect(html).toContain('href="/en/methodology/demography"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("renders in Georgian with the same structure", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("ka"));
    expect(html).toContain('data-testid="population-explorer"');
    expect(html).toContain("2004–2026 · 1 იანვრის მდგომარეობით");
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toContain("/downloads/data/");
    expect(html).toContain('href="/methodology/demography"');
  });

  it("has metadata with the page's own canonical address", async () => {
    const metadata = await demographyPopulationPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/population");
    expect(String(metadata.title)).toContain("მოსახლეობა");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderExplorerLayout } from "../../lib/pages/explorer-layout";
import { SiteFooter } from "../../components/site/site-footer";

const route = vi.hoisted(() => ({ pathname: "/en/explorer/deficit" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

function footerText(markup: string) {
  const footer = markup.match(/<footer[\s\S]*?<\/footer>/)?.[0];
  expect(footer).toBeDefined();
  return footer!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("dataset footer attribution", () => {
  it.each([
    ["/en/explorer/deficit", "IMF", "Ministry of Finance"],
    ["/en/explorer/economy/regions/tbilisi", "Geostat", "World Bank"],
    ["/en/explorer/economy/sectors", "Geostat", "World Bank"],
    ["/en/explorer/economy/gdp", "World Bank and Geostat", "Ministry of Finance"],
    ["/en/explorer/inflation/overview", "Geostat and the National Bank", "Ministry of Finance"],
    ["/en/explorer/inflation/categories", "Geostat", "National Bank"],
    ["/en/explorer/inflation/products", "Geostat", "National Bank"],
    ["/en/explorer/unemployment", "Geostat", "Ministry of Finance"],
    ["/en/explorer/demography", "Geostat", "World Bank"],
    ["/en/explorer/demography/population", "Geostat", "Ministry of Finance"],
  ])("uses the sources for %s without an unrelated site-wide date", async (pathname, source, unrelatedSource) => {
    route.pathname = pathname;
    const footer = footerText(renderToStaticMarkup(await renderExplorerLayout("en", null)));
    expect(footer).toContain(source);
    expect(footer).not.toContain(unrelatedSource);
    expect(footer).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(footer).toContain("CC BY 4.0");
  });

  it("uses Georgian deficit attribution after removing the language prefix", async () => {
    route.pathname = "/explorer/deficit";
    const footer = footerText(renderToStaticMarkup(await renderExplorerLayout("ka", null)));
    expect(footer).toContain("IMF");
    expect(footer).not.toContain("ფინანსთა სამინისტრო");
  });

  it("labels the generic footer date as a site-wide source review", () => {
    const footer = footerText(renderToStaticMarkup(<SiteFooter locale="en" updatedAt="2026-09-13" />));
    expect(footer).toContain("Latest source review across Fiscal.ge:");
    expect(footer).toContain("2026-09-13");
    expect(footer).not.toContain("Ministry of Finance");
  });

  it("credits the Georgian unemployment survey to Geostat", async () => {
    route.pathname = "/explorer/unemployment";
    const footer = footerText(renderToStaticMarkup(await renderExplorerLayout("ka", null)));
    expect(footer).toContain("საქსტატი");
    expect(footer).not.toContain("ფინანსთა სამინისტრო");
  });
});

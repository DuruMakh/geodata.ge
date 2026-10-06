import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderExplorerLayout } from "../../lib/pages/explorer-layout";

const route = vi.hoisted(() => ({ pathname: "/en/explorer/demography/population" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

const render = async (pathname: string, locale: "ka" | "en" = "en") => {
  route.pathname = pathname;
  return renderToStaticMarkup(await renderExplorerLayout(locale, null));
};

describe("sidebar demography group", () => {
  it("opens with the live pages nested and the current page marked", async () => {
    const markup = await render("/en/explorer/demography/population");
    expect(markup).toContain('data-testid="demography-link"');
    expect(markup).toContain('data-testid="demography-population-link" aria-current="page"');
    expect(markup).not.toContain('data-testid="demography-age-sex-link"');
    expect(markup).toContain("Unemployment");
    expect((markup.match(/Coming soon/g) ?? []).length).toBe(1);
  });

  it("marks the hub link current on the hub and nests the live pages", async () => {
    const markup = await render("/en/explorer/demography");
    expect(markup).toContain('data-testid="demography-link" aria-current="page"');
    expect(markup).toContain('data-testid="demography-population-link"');
  });

  it("stays closed on other sections and keeps the budget group out of demography", async () => {
    const markup = await render("/en/explorer/economy");
    expect(markup).toContain('data-testid="demography-link"');
    expect(markup).not.toContain('data-testid="demography-population-link"');
    const onDemography = await render("/en/explorer/demography/population");
    expect(onDemography).not.toContain('data-testid="section-link-expenditure"');
  });
});

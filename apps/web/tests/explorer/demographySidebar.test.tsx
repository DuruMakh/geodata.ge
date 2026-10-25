import { describe, expect, it, vi } from "vitest";
import { renderExplorerLayout } from "../../lib/pages/explorer-layout";
import { renderPageMarkup } from "../helpers/render-localized";

const route = vi.hoisted(() => ({ pathname: "/en/explorer/demography/population" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => ({ push: () => {} }) }));

const render = async (pathname: string, locale: "ka" | "en" = "en") => {
  route.pathname = pathname;
  return renderPageMarkup(locale, await renderExplorerLayout(locale, null));
};

describe("sidebar Demography group", () => {
  it("opens with the live pages nested and the current page marked", async () => {
    const markup = await render("/en/explorer/demography/population");
    expect(markup).toContain('data-testid="group-panel-demography"');
    expect(markup).toMatch(/data-testid="group-toggle-demography"[^>]*aria-expanded="true"/);
    // The current group carries the accent border; its link is current only on the group page itself.
    const groupLink = /<a\b[^>]*data-testid="group-link-demography"[^>]*>/.exec(markup)![0];
    expect(groupLink).toContain('href="/en/explorer/demography"');
    expect(groupLink).toContain("shadow-[inset_2px_0_0_var(--accent)]");
    expect(groupLink).not.toContain("aria-current");
    expect(markup).toContain('data-testid="demography-population-link" aria-current="page"');
    expect(markup).toContain('data-testid="demography-age-sex-link"');
    expect(markup).toContain("Labour market");
    expect((markup.match(/Coming soon/g) ?? []).length).toBe(0);
  });

  it("marks the Migration link current on the Migration page and leaves Population unmarked", async () => {
    const markup = await render("/en/explorer/demography/migration");
    expect(markup).toContain('data-testid="demography-migration-link" aria-current="page"');
    expect(markup).toContain('data-testid="demography-population-link"');
    expect(markup).not.toContain('data-testid="demography-population-link" aria-current="page"');
  });

  it("marks the Births, deaths and fertility link current on its page", async () => {
    const markup = await render("/en/explorer/demography/births-deaths");
    expect(markup).toContain('data-testid="demography-births-deaths-link" aria-current="page"');
    expect(markup).not.toContain('data-testid="demography-population-link" aria-current="page"');
  });

  it("marks the Age and sex link current on its page", async () => {
    const markup = await render("/en/explorer/demography/age-sex");
    expect(markup).toContain('data-testid="demography-age-sex-link" aria-current="page"');
    expect(markup).not.toContain('data-testid="demography-population-link" aria-current="page"');
  });

  it("lists the five demography pages and marks Marriages and divorces current on its page", async () => {
    const markup = await render("/en/explorer/demography/marriages-divorces");
    for (const page of ["population", "age-sex", "migration", "births-deaths"]) expect(markup).toContain(`data-testid="demography-${page}-link"`);
    expect(markup).toContain('data-testid="demography-marriages-divorces-link" aria-current="page"');
    expect(markup).not.toContain('data-testid="demography-population-link" aria-current="page"');
  });

  it("keeps the Population link current on every place page, in both languages", async () => {
    for (const [pathname, locale] of [
      ["/explorer/demography/population/georgia", "ka"],
      ["/explorer/demography/population/region/adjara", "ka"],
      ["/en/explorer/demography/population/batumi", "en"],
    ] as const) {
      const markup = await render(pathname, locale);
      expect(markup, pathname).toContain('data-testid="demography-population-link" aria-current="page"');
      expect(markup, pathname).not.toMatch(/data-testid="group-link-demography"[^>]*aria-current="page"/);
    }
  });

  it("marks the group link current on the group page and nests the live pages", async () => {
    const markup = await render("/en/explorer/demography");
    expect(markup).toMatch(/data-testid="group-link-demography"[^>]*aria-current="page"/);
    expect(markup).toContain('data-testid="demography-population-link"');
    // The match runs one way: a place page's path contains the Population path, the hub's address does not.
    expect(markup).not.toContain('data-testid="demography-population-link" aria-current="page"');
  });

  it("stays closed on other sections and keeps the budget group out of demography", async () => {
    const markup = await render("/en/explorer/economy");
    expect(markup).toContain('data-testid="group-link-demography"');
    expect(markup).not.toContain('data-testid="demography-population-link"');
    const onDemography = await render("/en/explorer/demography/population");
    expect(onDemography).not.toContain('data-testid="section-link-expenditure"');
  });
});

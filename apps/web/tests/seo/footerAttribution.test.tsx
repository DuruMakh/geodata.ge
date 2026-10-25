import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderExplorerLayout } from "../../lib/pages/explorer-layout";
import { SiteFooter } from "../../components/site/site-footer";
import { renderPageMarkup } from "../helpers/render-localized";

const route = vi.hoisted(() => ({ pathname: "/en/explorer/deficit" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => ({ push: () => {} }) }));

function footerText(markup: string) {
  const footer = markup.match(/<footer[\s\S]*?<\/footer>/)?.[0];
  expect(footer).toBeDefined();
  return footer!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("dataset footer attribution", () => {
  // Explorer routes render no footer; their sources sit in each page's own source note.
  it.each([
    ["en", "/en/explorer/deficit"],
    ["ka", "/explorer/deficit"],
    ["en", "/en/explorer/labour"],
    ["ka", "/explorer"],
  ] as const)("renders no footer on the %s explorer route %s", async (locale, pathname) => {
    route.pathname = pathname;
    expect(renderPageMarkup(locale, await renderExplorerLayout(locale, null))).not.toMatch(/<footer[\s>]/);
  });

  // U01-21: the year is the build's.
  it("dates the copyright line by the build, not a literal year", () => {
    // A build some years on: only the clock moves, so the footer must follow it.
    const later = new Date().getFullYear() + 5;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(later, 5, 1));
    try {
      expect(footerText(renderToStaticMarkup(<SiteFooter locale="ka" />))).toContain(`© ${later} Fiscal.ge`);
    } finally {
      vi.useRealTimers();
    }
  });

  it("labels the generic footer date as a site-wide source review", () => {
    const footer = footerText(renderToStaticMarkup(<SiteFooter locale="en" updatedAt="2026-09-13" />));
    expect(footer).toContain("Latest source review across Fiscal.ge:");
    expect(footer).toContain("2026-09-13");
    expect(footer).not.toContain("Ministry of Finance");
  });
});

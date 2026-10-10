import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { renderRegionalEconomiesPage } from "../../lib/pages/regional-economies";
import { renderUnemploymentRegionsPage } from "../../lib/pages/unemployment-regions";

vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), notFound: () => { throw new Error("not found"); } }));

/** The region index (map, summary, list, source note) of a rendered page. */
function regionIndex(markup: string): string {
  const start = markup.indexOf('data-testid="regional-index-workspace"');
  const end = markup.indexOf("geoBoundaries</a>", start);
  if (start < 0 || end < 0) throw new Error("region index not found");
  return markup.slice(start, end);
}

const digest = (html: string) => `${html.length}:${createHash("sha256").update(html).digest("hex")}`;

// The two pages that keep linked regions. Their region index markup is pinned, so the optional no-links mode
// added for Age and sex cannot change a byte of what these pages emitted before it existed.
const LINKED_PAGES = [
  ["unemployment regions ka", () => renderUnemploymentRegionsPage("ka")],
  ["unemployment regions en", () => renderUnemploymentRegionsPage("en")],
  ["regional economies ka", () => renderRegionalEconomiesPage("ka")],
  ["regional economies en", () => renderRegionalEconomiesPage("en")],
] as const;

const PINNED: Record<string, string> = {
  "unemployment regions ka": "37211:044956ba5e70e69021fcfb72eddfdc4ec2982575dd9b8e92200c60b897732b18",
  "unemployment regions en": "37219:0e7c65b673be1c98c200d21238e5fbc2c1bfb2233e22ac282018d4c9f22e3637",
  "regional economies ka": "36917:84ad9a25722cf69fc58bdcc0ba22ae3f86a313e6a92ec8d3c4de1046d1e528e6",
  "regional economies en": "36966:2a37c2b93086c2afe217b2b5555bfbda5f6e2d095ef673221ff094fadb8963e2",
};

test.each(LINKED_PAGES)("%s: region index markup is unchanged", async (name, render) => {
  const html = regionIndex(renderToStaticMarkup(await render()));
  if (process.env.REGION_INDEX_DUMP) {
    mkdirSync(process.env.REGION_INDEX_DUMP, { recursive: true });
    writeFileSync(join(process.env.REGION_INDEX_DUMP, `${name.replace(/ /g, "-")}.html`), html);
  }
  expect(digest(html)).toBe(PINNED[name]);
});

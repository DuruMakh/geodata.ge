import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { renderDemographyAgeSexPage } from "../../lib/pages/demography-age-sex";

vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), notFound: () => { throw new Error("not found"); } }));

// Age and sex shows the same index with no link metric: the regions are shapes and rows to look at, not doors.
test("age and sex regional glance: no links, no arrows and no tab stops in the map or the list", async () => {
  const page = renderToStaticMarkup(await renderDemographyAgeSexPage("en"));
  // The section opens with the same ink rule as the pyramid and the heat map above it.
  expect(page).toMatch(/data-testid="age-sex-regions" class="[^"]*mt-16 border-t-2 border-\[var\(--ink\)\]/);
  const start = page.indexOf('data-testid="regional-index-workspace"');
  const end = page.indexOf('data-testid="regional-source-note"', start);
  expect(start).toBeGreaterThan(-1);
  const html = page.slice(start, end);
  expect(html).not.toContain("<a ");
  expect(html).not.toContain("href=");
  expect(html).not.toContain("→");
  expect(html).not.toContain('tabindex="0"');
  expect(html).not.toContain("data-region-map-target");
  // Everything else survives: eleven shapes, eleven rows, the search and the legend.
  expect(html.match(/data-testid="regional-map-path"/g) ?? []).toHaveLength(11);
  expect(html.match(/data-testid="regional-list-row"/g) ?? []).toHaveLength(11);
  expect(html).toContain('data-testid="age-sex-region-map"');
  expect(html).toContain('data-testid="regional-map-legend"');
  expect(html).toContain("<input");
});

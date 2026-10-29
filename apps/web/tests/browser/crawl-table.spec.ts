import { expect, test, type Page } from "@playwright/test";
import { UNIT_PERSONS, formatInUnit } from "../../lib/explorer/format";
import { TEST_BASE_URL } from "./test-base-url";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

// Each place page also carries its yearly table in the HTML, hidden in chart mode, so crawlers read the numbers.
// `panel` scopes the table lookups where the page holds other explorers with tables of their own.
const PAGES = [
  { path: "/explorer/demography/population/khashuri", tab: "population-mode-table", panel: "population-chart-panel", figure: formatInUnit(52692, UNIT_PERSONS) },
  { path: "/en/explorer/education/schools/khashuri", tab: "chart-mode-table", panel: "chart-panel", figure: null },
  { path: "/explorer/health/pensions/khashuri", tab: "chart-mode-table", panel: "chart-panel", figure: null },
  { path: "/explorer/municipalities/khashuri", tab: "municipal-mode-table", panel: null, figure: null },
  { path: "/en/explorer/unemployment/regions/imereti", tab: "chart-mode-table", panel: "chart-panel", figure: "20.9" },
  { path: "/explorer/money/regions/imereti", tab: "chart-mode-table", panel: "chart-panel", figure: null },
  { path: "/explorer/economy/regions/imereti", tab: "regional-mode-table", panel: "regional-chart-panel", figure: null },
  { path: "/explorer/expenditure", tab: "chart-mode-table", panel: "chart-panel", figure: null },
  { path: "/en/explorer/trade/partners", tab: "chart-mode-table", panel: "chart-panel", figure: null },
] as const;

for (const { path, tab, panel, figure } of PAGES) {
  const scope = (page: Page) => (panel ? page.getByTestId(panel) : page.locator("body"));

  test(`${path}: the raw HTML carries the yearly table`, async ({ request }) => {
    const response = await request.get(`${TEST_BASE_URL}${path}`);
    expect(response.ok()).toBe(true);
    // Scripts are stripped so a figure found only in the data payload does not count.
    const serverHtml = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
    expect(serverHtml).toContain("explorer-table-crawl");
    if (figure) expect(serverHtml).toContain(figure);
  });

  test(`${path}: the crawl copy is hidden in chart mode`, async ({ page }) => {
    await page.goto(path);
    await ready(page);
    await expect(scope(page).getByTestId("explorer-table-crawl")).toHaveCount(1);
    await expect(scope(page).getByTestId("explorer-table-crawl")).toBeHidden();
    await expect(scope(page).getByTestId("explorer-table")).toHaveCount(0);
  });

  test(`${path}: the table tab shows one visible table and no crawl copy`, async ({ page }) => {
    await page.goto(path);
    await ready(page);
    await page.getByTestId(tab).click();
    await expect(scope(page).getByTestId("explorer-table")).toBeVisible();
    await expect(scope(page).getByTestId("explorer-table")).toHaveCount(1);
    await expect(scope(page).getByTestId("explorer-table-crawl")).toHaveCount(0);
  });
}

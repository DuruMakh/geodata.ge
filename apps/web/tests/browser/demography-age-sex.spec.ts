import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

const NATIONAL = `${TEST_BASE_URL}/en/explorer/demography/age-sex`;
const IMERETI = `${TEST_BASE_URL}/en/explorer/demography/population/region/imereti`;

const expectAppReady = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const hasNoSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/** The pyramid's axis labels: the drawing's text nodes that are a bare percent. */
const percentTicks = (page: Page) => page.getByTestId("age-sex-pyramid-figure").locator("svg text").filter({ hasText: /^\d+(\.\d+)?%$/ });

test.describe("the Age and sex page", () => {
  test("renders its three parts in order, with 2026 pressed in a row of 23 years", async ({ page }) => {
    await page.goto(NATIONAL);
    await expectAppReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Age and sex");
    for (const id of ["age-sex-pyramid", "age-sex-heatmap", "age-sex-regions"]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await expect(page.getByTestId("age-sex-bands")).toHaveCount(0);
    // Pyramid first, the heat map second, the regional glance last.
    const tops = await Promise.all(["age-sex-pyramid", "age-sex-heatmap", "age-sex-regions"].map(async (id) => (await page.getByTestId(id).boundingBox())!.y));
    expect(tops[0]).toBeLessThan(tops[1]!);
    expect(tops[1]).toBeLessThan(tops[2]!);
    const years = page.getByTestId("age-sex-year-row").getByRole("button");
    await expect(years).toHaveCount(23);
    await expect(years.filter({ hasText: /^2026$/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("age-sex-pyramid-summary")).toContainText("65+: 18.1%");
  });

  test("a pyramid row moves focus to the next one with ArrowUp", async ({ page }) => {
    await page.goto(NATIONAL);
    await expectAppReady(page);
    const figure = page.getByTestId("age-sex-pyramid-figure");
    const row = figure.locator('[data-pyramid-row="5"]');
    await row.focus();
    await expect(row).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(figure.locator('[data-pyramid-row="6"]')).toBeFocused();
  });

  test("choosing a year writes the hash and changes the summary", async ({ page }) => {
    await page.goto(NATIONAL);
    await expectAppReady(page);
    const summary = page.getByTestId("age-sex-pyramid-summary");
    const before = await summary.textContent();
    await page.getByTestId("age-sex-year-row").getByRole("button", { name: "2010", exact: true }).click();
    await expect(page).toHaveURL(/#.*year=2010/);
    await expect(summary).not.toHaveText(before ?? "");
  });

  test("comparing within one census basis draws the outline; across the re-base it keeps shares and says why", async ({ page }) => {
    await page.goto(`${NATIONAL}#year=2010`);
    await expectAppReady(page);
    await page.getByTestId("age-sex-compare-toggle").click();
    await expect(page.getByTestId("pyramid-legend")).toContainText("2004");
    await expect(page.getByTestId("pyramid-outline-left")).toBeAttached();
    await expect(page.getByTestId("age-sex-compare-note")).toHaveCount(0);
    await expect(page.getByTestId("age-sex-measure-persons")).not.toHaveAttribute("aria-disabled", "true");

    await page.getByTestId("age-sex-year-row").getByRole("button", { name: "2026", exact: true }).click();
    await expect(page.getByTestId("age-sex-compare-note")).toContainText("2026 and 2004");
    await expect(page.getByTestId("age-sex-measure-persons")).toHaveAttribute("aria-disabled", "true");
  });

  test("a saved link across the re-base opens on shares, not people", async ({ page }) => {
    await page.goto(`${NATIONAL}#year=2026&cmp=2004&measure=persons`);
    await expectAppReady(page);
    await expect(page.getByTestId("age-sex-pyramid-panel")).toHaveAttribute("data-measure", "share");
    await expect(page.getByTestId("age-sex-measure-persons")).toHaveAttribute("aria-disabled", "true");
    expect(await percentTicks(page).count()).toBeGreaterThan(2);
    await expect(page.getByTestId("age-sex-pyramid-figure").locator("svg text").filter({ hasText: /thousand/i })).toHaveCount(0);
  });

  test("the pyramid has a table twin that shows the published total", async ({ page }) => {
    await page.goto(NATIONAL);
    await expectAppReady(page);
    await page.getByTestId("age-sex-pyramid-mode-table").click();
    await expect(page.getByTestId("age-sex-pyramid-panel").getByRole("table")).toContainText("3,941,103");
    await expect(page.getByTestId("age-sex-pyramid-figure")).toHaveCount(0);
  });

  test("the heat map carries the re-base label", async ({ page }) => {
    await page.goto(NATIONAL);
    await expectAppReady(page);
    await expect(page.getByTestId("age-sex-heatmap").getByRole("columnheader", { name: /^2025.*Census re-base/ })).toBeVisible();
  });

  test("an old link to the removed age-groups table is ignored", async ({ page }) => {
    await page.goto(`${NATIONAL}#bands=table`);
    await expectAppReady(page);
    await expect(page.getByTestId("age-sex-bands")).toHaveCount(0);
  });

  test("the regional glance has no links, no tab stops and no arrows, but still ranks and searches", async ({ page }) => {
    await page.goto(NATIONAL);
    await expectAppReady(page);
    const glance = page.getByTestId("age-sex-regions");
    await glance.scrollIntoViewIfNeeded();
    const map = page.getByTestId("age-sex-region-map");
    await expect(map.locator("a")).toHaveCount(0);
    await expect(map.locator('[tabindex]:not(svg)')).toHaveCount(0);
    await expect(map.locator('[data-region-id]')).toHaveCount(11);
    const rows = page.getByTestId("regional-list-row");
    await expect(rows).toHaveCount(11);
    await expect(rows.first()).toContainText("Racha-Lechkhumi");
    await expect(rows.first()).toContainText("31.2%");
    await expect(glance.locator('a[href*="/explorer/demography/"]')).toHaveCount(0);
    await expect(rows.first()).not.toContainText("→");
    // Hovering a row highlights its region on the map.
    await rows.nth(2).hover();
    await expect(map.locator(`[data-region-id="${await rows.nth(2).getAttribute("data-region-id")}"]`)).toHaveAttribute("data-active", "true");
    // The search still narrows the list.
    await glance.locator("input").fill("Imereti");
    await expect(rows).toHaveCount(1);
  });

  test("the Georgian page renders", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/demography/age-sex`);
    await expectAppReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ასაკი და სქესი");
    await expect(page.getByTestId("age-sex-heatmap")).toBeVisible();
  });
});

test.describe("the pyramid header on a phone", () => {
  for (const width of [320, 390]) {
    test(`the Georgian pyramid keeps its sex labels apart at ${width}px, in persons with a comparison`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${TEST_BASE_URL}/explorer/demography/age-sex#year=2004&cmp=2010&measure=persons`);
      await expectAppReady(page);
      const figure = page.getByTestId("age-sex-pyramid-figure");
      await expect(figure).toBeVisible();
      const male = await figure.getByTestId("pyramid-header-male").boundingBox();
      const female = await figure.getByTestId("pyramid-header-female").boundingBox();
      expect(male).not.toBeNull();
      expect(female).not.toBeNull();
      const apart = male!.x + male!.width <= female!.x || female!.x + female!.width <= male!.x || male!.y + male!.height <= female!.y || female!.y + female!.height <= male!.y;
      expect(apart).toBe(true);
      // Neither label may run past the drawing's frame, which a phone's clipping would hide.
      const frame = (await figure.boundingBox())!;
      for (const box of [male!, female!]) {
        expect(box.x).toBeGreaterThanOrEqual(frame.x - 0.5);
        expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 0.5);
      }
      expect(await hasNoSidewaysScroll(page)).toBe(true);
    });
  }
});

test.describe("the Age and sex block on a place page", () => {
  test("Imereti switches between all settlements, cities and villages, and the headline count stays", async ({ page }) => {
    await page.goto(IMERETI);
    await expectAppReady(page);
    const section = page.getByTestId("age-sex-section");
    await section.getByTestId("age-sex-mode-table").click();
    const total = section.getByTestId("age-sex-panel").locator("tbody tr").last().locator("td").nth(2);
    await expect(total).toHaveText("510,741");
    await section.getByTestId("age-sex-settlement-urban").click();
    await expect(total).toHaveText("273,742");
    await section.getByTestId("age-sex-settlement-rural").click();
    await expect(total).toHaveText("236,999");
    await expect(section.getByTestId("age-sex-highlights")).toContainText("510,741");
    await section.getByTestId("age-sex-settlement-total").click();
    await expect(total).toHaveText("510,741");
  });

  test("a municipality has no Age and sex block", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/en/explorer/demography/population/batumi`);
    await expectAppReady(page);
    await expect(page.locator("#age-sex")).toHaveCount(0);
  });

  test("the block downloads an Excel workbook", async ({ page }) => {
    await page.goto(IMERETI);
    await expectAppReady(page);
    const pending = page.waitForEvent("download");
    await page.getByTestId("age-sex-excel-download").click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("the block links to the national page", async ({ page }) => {
    await page.goto(IMERETI);
    await expectAppReady(page);
    await expect(page.getByTestId("age-sex-national-link")).toHaveAttribute("href", "/en/explorer/demography/age-sex");
  });
});

test.describe("at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the national page has no sideways scroll, and its heat map scrolls from the newest years", async ({ page }) => {
    await page.goto(NATIONAL);
    await expectAppReady(page);
    expect(await hasNoSidewaysScroll(page)).toBe(true);
    const scroller = page.getByTestId("age-sex-heatmap").getByTestId("age-heatmap-scroller");
    await scroller.scrollIntoViewIfNeeded();
    await expect
      .poll(() => scroller.evaluate((element) => ({ wide: element.scrollWidth > element.clientWidth, atEnd: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 })))
      .toEqual({ wide: true, atEnd: true });
  });

  test("Imereti has no sideways scroll", async ({ page }) => {
    await page.goto(IMERETI);
    await expectAppReady(page);
    expect(await hasNoSidewaysScroll(page)).toBe(true);
  });
});

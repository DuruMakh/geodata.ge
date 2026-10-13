import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

const NATIONAL = `${TEST_BASE_URL}/en/explorer/demography/age-sex`;
const IMERETI = `${TEST_BASE_URL}/en/explorer/demography/population/region/imereti`;

const expectAppReady = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const hasNoSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/** Opens a year picker by its trigger and returns its year grid. */
const openPicker = async (page: Page, testId: string) => {
  await page.getByTestId(testId).click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  return list;
};
const pick = async (page: Page, testId: string, name: string) => {
  const list = await openPicker(page, testId);
  await list.getByRole("option", { name, exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
};
/** The year grid's keyboard-active option is the named one. */
const expectActive = async (page: Page, name: string) => {
  const list = page.getByRole("listbox");
  const id = await list.getByRole("option", { name, exact: true }).getAttribute("id");
  await expect(list).toHaveAttribute("aria-activedescendant", id!);
};
/** The pyramid's axis labels: the drawing's text nodes that are a bare percent. */
const percentTicks = (page: Page) => page.getByTestId("age-sex-pyramid-figure").locator("svg text").filter({ hasText: /^\d+(\.\d+)?%$/ });

test.describe("the Age and sex page", () => {
  test("renders its three parts in order, with 2026 chosen in a picker of 23 years and no comparison", async ({ page }) => {
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
    // Each part opens with the same 2px ink rule, the regional glance included.
    for (const id of ["age-sex-pyramid", "age-sex-heatmap", "age-sex-regions"]) {
      await expect(page.getByTestId(id)).toHaveCSS("border-top-width", "2px");
    }
    const year = page.getByTestId("age-sex-year-select");
    await expect(year).toHaveText("2026");
    await expect(year).toHaveAttribute("aria-expanded", "false");
    const yearGrid = await openPicker(page, "age-sex-year-select");
    await expect(year).toHaveAttribute("aria-expanded", "true");
    await expect(yearGrid.getByRole("option")).toHaveCount(23);
    await expect(yearGrid.getByRole("option", { selected: true })).toHaveText("2026");
    await expect(yearGrid.getByRole("option", { name: "2025 (Census re-base)" })).toBeVisible();
    await expect(page.getByTestId("age-sex-year-select-panel")).toContainText("* 2025 — Census re-base");
    await page.keyboard.press("Escape");
    const compare = page.getByTestId("age-sex-compare-select");
    await expect(compare).toHaveText("None");
    const compareGrid = await openPicker(page, "age-sex-compare-select");
    const options = compareGrid.getByRole("option");
    await expect(options).toHaveCount(23);
    await expect(options.first()).toHaveText("None");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect(compareGrid.getByRole("option", { name: "2026", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    for (const gone of ["age-sex-year-row", "age-sex-compare-row", "age-sex-compare-toggle", "age-sex-pyramid-mode-table"]) await expect(page.getByTestId(gone)).toHaveCount(0);
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
    await pick(page, "age-sex-year-select", "2010");
    await expect(page).toHaveURL(/#.*year=2010/);
    await expect(summary).not.toHaveText(before ?? "");
    await expect(page.getByTestId("age-sex-year-select")).toHaveText("2010");
  });

  test("the year grid works from the keyboard and closes on Escape or an outside click", async ({ page }) => {
    await page.goto(`${NATIONAL}#year=2010`);
    await expectAppReady(page);
    const trigger = page.getByTestId("age-sex-year-select");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const list = page.getByRole("listbox");
    await expect(list).toBeFocused();
    await expect(list).toHaveAttribute("aria-activedescendant", (await list.getByRole("option", { name: "2010", exact: true }).getAttribute("id"))!);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(list).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/#.*year=2011/);

    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveText("2011");
    await expect(page).toHaveURL(/#.*year=2011/);

    // Space chooses too, and its key release on the trigger does not open the grid again.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/#.*year=2010/);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await trigger.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(trigger).toHaveText("2010");
  });

  test("the year grid's keys move a row, jump to the ends and reach the none row; Tab closes onto the trigger", async ({ page }) => {
    await page.goto(`${NATIONAL}#year=2010`);
    await expectAppReady(page);
    const year = page.getByTestId("age-sex-year-select");
    await year.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toBeFocused();
    await expectActive(page, "2010");
    await page.keyboard.press("ArrowDown");
    await expectActive(page, "2014");
    await page.keyboard.press("End");
    await expectActive(page, "2026");
    await page.keyboard.press("Home");
    await expectActive(page, "2004");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(year).toBeFocused();
    await expect(year).toHaveText("2010");

    const compare = page.getByTestId("age-sex-compare-select");
    await compare.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toBeFocused();
    await expectActive(page, "None");
    await page.keyboard.press("End");
    await page.keyboard.press("Home");
    await expectActive(page, "None");
    await page.keyboard.press("ArrowDown");
    await expectActive(page, "2004");
    await page.keyboard.press("Escape");
    await expect(compare).toBeFocused();
    await expect(compare).toHaveText("None");
  });

  test("an open year grid is named by its trigger's aria-controls, and closes when focus moves to another control", async ({ page }) => {
    await page.goto(NATIONAL);
    await expectAppReady(page);
    const trigger = page.getByTestId("age-sex-year-select");
    await expect(trigger).not.toHaveAttribute("aria-controls", /.+/);
    const list = await openPicker(page, "age-sex-year-select");
    await expect(trigger).toHaveAttribute("aria-controls", (await list.getAttribute("id"))!);
    // Focus leaving for another control closes the grid and stays there; it is not pulled back to the trigger.
    await page.getByTestId("age-sex-compare-select").focus();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByTestId("age-sex-compare-select")).toBeFocused();
    await expect(trigger).not.toHaveAttribute("aria-controls", /.+/);
  });

  test("a grid opened by mouse shows the ring after the arrows, and a click on its footer keeps Escape working", async ({ page }) => {
    await page.goto(`${NATIONAL}#year=2010`);
    await expectAppReady(page);
    const list = await openPicker(page, "age-sex-year-select");
    await page.getByTestId("age-sex-year-select-panel").getByText("* 2025 — Census re-base").click();
    await expect(list).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expectActive(page, "2011");
    await expect(list.getByRole("option", { name: "2011", exact: true })).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByTestId("age-sex-year-select")).toBeFocused();
  });

  test("choosing the compared year to be the shown year drops the comparison", async ({ page }) => {
    await page.goto(`${NATIONAL}#year=2010&cmp=2004`);
    await expectAppReady(page);
    await expect(page.getByTestId("age-sex-compare-select")).toHaveText("2004");
    await pick(page, "age-sex-year-select", "2004");
    await expect(page.getByTestId("age-sex-compare-select")).toHaveText("None");
    await expect(page.getByTestId("pyramid-outline-left")).toHaveCount(0);
    await expect(page).toHaveURL(/#.*year=2004/);
    await expect(page).not.toHaveURL(/cmp=/);
  });

  test("comparing within one census basis draws the outline; across the re-base it keeps shares and says why", async ({ page }) => {
    await page.goto(`${NATIONAL}#year=2010`);
    await expectAppReady(page);
    await pick(page, "age-sex-compare-select", "2004");
    await expect(page.getByTestId("pyramid-legend")).toContainText("2004");
    await expect(page.getByTestId("pyramid-outline-left")).toBeAttached();
    await expect(page.getByTestId("age-sex-compare-note")).toHaveCount(0);
    await expect(page.getByTestId("age-sex-measure-persons")).not.toHaveAttribute("aria-disabled", "true");

    await pick(page, "age-sex-year-select", "2026");
    await expect(page.getByTestId("age-sex-compare-note")).toContainText("2026 and 2004");
    await expect(page.getByTestId("age-sex-measure-persons")).toHaveAttribute("aria-disabled", "true");

    await pick(page, "age-sex-compare-select", "None");
    await expect(page.getByTestId("pyramid-outline-left")).toHaveCount(0);
    await expect(page.getByTestId("age-sex-compare-note")).toHaveCount(0);
    await expect(page.getByTestId("age-sex-measure-persons")).not.toHaveAttribute("aria-disabled", "true");
  });

  test("a saved link across the re-base opens on shares, not people", async ({ page }) => {
    await page.goto(`${NATIONAL}#year=2026&cmp=2004&measure=persons`);
    await expectAppReady(page);
    await expect(page.getByTestId("age-sex-pyramid-panel")).toHaveAttribute("data-measure", "share");
    await expect(page.getByTestId("age-sex-measure-persons")).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByTestId("age-sex-year-select")).toHaveText("2026");
    await expect(page.getByTestId("age-sex-compare-select")).toHaveText("2004");
    expect(await percentTicks(page).count()).toBeGreaterThan(2);
    await expect(page.getByTestId("age-sex-pyramid-figure").locator("svg text").filter({ hasText: /thousand/i })).toHaveCount(0);
  });

  test("an old link to the removed pyramid table is ignored", async ({ page }) => {
    await page.goto(`${NATIONAL}#pyramid=table`);
    await expectAppReady(page);
    await expect(page.getByTestId("age-sex-pyramid-figure")).toBeVisible();
    await expect(page.getByTestId("age-sex-pyramid-panel").getByRole("table")).toHaveCount(0);
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
    // The open year grid fits the phone and adds no sideways scroll.
    for (const picker of ["age-sex-year-select", "age-sex-compare-select"]) {
      await openPicker(page, picker);
      const panel = (await page.getByTestId(`${picker}-panel`).boundingBox())!;
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(390);
      // The open grid is brought fully into view, footer included.
      await expect.poll(async () => {
        const box = (await page.getByTestId(`${picker}-panel`).boundingBox())!;
        return box.y >= 0 && box.y + box.height <= 844;
      }).toBe(true);
      expect(await hasNoSidewaysScroll(page)).toBe(true);
      const cell = (await page.getByRole("listbox").getByRole("option").nth(1).boundingBox())!;
      expect(cell.height).toBeGreaterThanOrEqual(44);
      await page.keyboard.press("Escape");
    }
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

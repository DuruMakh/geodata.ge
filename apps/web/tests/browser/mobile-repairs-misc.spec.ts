import { expect, test, type Page } from "@playwright/test";

// Mobile repairs from the 2026-10-07 phone review (owner decisions D6, D7, D9
// and the related repairs). Phone checks run at 390x844 with touch emulation.

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

// The economy regions index does not mark the body ready; wait for React to
// attach its handlers to the map instead.
async function mapHydrated(page: Page) {
  await page.waitForFunction(() => {
    const target = document.querySelector("[data-region-map-target]");
    return target !== null && Object.keys(target).some((key) => key.startsWith("__reactProps"));
  });
}

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("analysis structure is a stacked bar and a full list on phones (D6)", async ({ page }) => {
    await page.goto("/explorer/analysis");
    await ready(page);
    const treemap = page.getByTestId("snapshot-treemap");
    await expect(treemap.getByTestId("snapshot-structure-grid")).toBeHidden();
    await expect(treemap.getByTestId("snapshot-structure-bar")).toBeVisible();

    // Same items, same order as the desktop tiles.
    const tileNames = await treemap.getByTestId("snapshot-structure-card").evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute("title")!.split(" — ")[0]));
    const rowNames = await treemap.getByTestId("snapshot-structure-row").locator("th").allInnerTexts();
    expect(rowNames.map((name) => name.trim())).toEqual(tileNames);
    expect(rowNames.length).toBeGreaterThan(5);

    // Full names wrap instead of truncating, and nothing crosses the right gutter.
    const geometry = await treemap.evaluate((root) => {
      const width = document.documentElement.clientWidth;
      const bar = root.querySelector("[data-testid='snapshot-structure-bar']")!.getBoundingClientRect();
      const rows = [...root.querySelectorAll("[data-testid='snapshot-structure-row']")];
      return {
        width,
        barRight: bar.right,
        rowRight: Math.max(...rows.map((row) => row.getBoundingClientRect().right)),
        clipped: rows.filter((row) => {
          const name = row.querySelector("th span span:last-child")!;
          return name.scrollWidth > name.clientWidth + 1;
        }).length,
        pageOverflow: document.documentElement.scrollWidth - width,
      };
    });
    expect(geometry.barRight).toBeLessThanOrEqual(geometry.width - 16);
    expect(geometry.rowRight).toBeLessThanOrEqual(geometry.width - 16);
    expect(geometry.clipped).toBe(0);
    expect(geometry.pageOverflow).toBeLessThanOrEqual(0);
  });

  test("economy map: Tbilisi gets a fingertip target, the first tap previews and the second opens (D7)", async ({ page }) => {
    await page.goto("/explorer/economy/regions");
    await mapHydrated(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    const disk = page.locator("[data-map-touch-target='region.tbilisi']");
    const box = (await disk.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);

    await disk.tap();
    const strip = page.getByTestId("map-touch-preview");
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("თბილისი ·");
    await expect(strip).toHaveAttribute("href", "/explorer/economy/regions/tbilisi");
    expect((await strip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(new URL(page.url()).pathname).toBe("/explorer/economy/regions");
    await expect(page.locator("[data-region-map-target][data-region-id='region.tbilisi']")).toHaveAttribute("data-active", "true");

    // A different place replaces the preview; tapping it again opens it.
    const kakheti = page.locator("[data-region-map-target][data-region-id='region.kakheti']");
    await kakheti.tap();
    await expect(strip).toContainText("კახეთი ·");
    expect(new URL(page.url()).pathname).toBe("/explorer/economy/regions");
    await kakheti.tap();
    await page.waitForURL("**/explorer/economy/regions/kakheti");
  });

  test("unemployment map: the preview strip is a link to the region (D7), and the legend keeps min and max on one row", async ({ page }) => {
    await page.goto("/en/explorer/unemployment/regions");
    await ready(page);
    const scale = page.getByTestId("regional-map-legend-scale");
    const [minimum, ramp, maximum] = await scale.locator(":scope > span").evaluateAll((parts) => parts.map((part) => part.getBoundingClientRect()));
    expect(Math.abs(minimum!.top + minimum!.height / 2 - (maximum!.top + maximum!.height / 2))).toBeLessThan(2);
    expect(minimum!.right).toBeLessThanOrEqual(ramp!.left);
    expect(ramp!.right).toBeLessThanOrEqual(maximum!.left);

    await page.locator("[data-map-touch-target='region.tbilisi']").tap();
    const strip = page.getByTestId("map-touch-preview");
    await expect(strip).toContainText(/^Tbilisi · \d+\.\d%/);
    await strip.tap();
    await page.waitForURL("**/en/explorer/unemployment/regions/tbilisi");
  });

  test("age heatmap opens on the newest years and its darkest cells read paper on accent", async ({ page }) => {
    await page.goto("/explorer/unemployment/age");
    await ready(page);
    const scroller = page.getByTestId("age-heatmap-scroller");
    await expect.poll(() => scroller.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft)).toBeLessThanOrEqual(1);
    expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    const newest = await page.locator("[data-heatmap-cell='age.20_24:2025']").evaluate((cell) => {
      const box = cell.getBoundingClientRect(), frame = cell.closest("[data-testid='age-heatmap-scroller']")!.getBoundingClientRect();
      return box.left >= frame.left && box.right <= frame.right + 1;
    });
    expect(newest).toBe(true);
    const darkest = page.locator("[data-heatmap-cell][data-bin='5']").first();
    await expect(darkest).toHaveCSS("background-color", "rgb(179, 64, 42)");
    await expect(darkest).toHaveCSS("color", "rgb(247, 242, 233)");
  });

  test("municipal map: city markers preview on the first tap and the list scrolls with the page (D7)", async ({ page }) => {
    await page.goto("/explorer/municipalities");
    await ready(page);
    const list = page.getByTestId("municipal-list-muni");
    const scroll = await list.evaluate((element) => ({ client: element.clientHeight, scroll: element.scrollHeight, overflow: getComputedStyle(element).overflowY }));
    expect(scroll.overflow).toBe("visible");
    expect(scroll.client).toBe(scroll.scroll);

    const disk = page.locator("[data-map-touch-target='04']");
    expect(Math.min(...Object.values((await disk.boundingBox())!).slice(2))).toBeGreaterThanOrEqual(15);
    await disk.tap();
    const strip = page.getByTestId("map-touch-preview");
    await expect(strip).toContainText(/^თბილისი · .+ ₾ ერთ მოსახლეზე/);
    await expect(page.getByTestId("municipality-marker-04")).toHaveAttribute("data-active", "true");
    expect(new URL(page.url()).pathname).toBe("/explorer/municipalities");

    // Rustavi's dot sits under its fingertip disk, which takes the tap.
    const rustavi = page.locator("[data-map-touch-target='48']");
    await rustavi.tap();
    await expect(strip).toContainText("რუსთავი");
    await rustavi.tap();
    await page.waitForURL("**/explorer/municipalities/rustavi");
  });
});

test("mouse clicks still open a map place at once and the touch disks ignore the mouse", async ({ page }) => {
  await page.goto("/explorer/economy/regions");
  await mapHydrated(page);
  expect(await page.locator("[data-map-touch-target='region.tbilisi']").evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
  await page.locator("[data-region-map-target][data-region-id='region.kakheti']").click();
  await page.waitForURL("**/explorer/economy/regions/kakheti");
  await expect(page.getByTestId("map-touch-preview")).toHaveCount(0);
});

test("treemap tiles stay inside the treemap at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1000 });
  for (const hash of ["", "#as=revenue"]) {
    await page.goto(`/explorer/analysis${hash}`);
    await ready(page);
    const grid = page.getByTestId("snapshot-structure-grid");
    await expect(grid).toBeVisible();
    const overflow = await grid.evaluate((root) => {
      const box = root.getBoundingClientRect();
      return Math.max(...[...root.querySelectorAll("[data-testid='snapshot-structure-card']")].map((tile) => tile.getBoundingClientRect().right - box.right));
    });
    expect(overflow).toBeLessThanOrEqual(0.5);
  }
});

import { expect, test, type Page } from "@playwright/test";

// Mobile repairs from the 2026-10-07 phone review (owner decisions D6, D7, D9
// and the related repairs). Phone checks run at 390x844 with touch emulation.

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

// The year in review's spending-type treemap (section 03): the drawn layout's tiles inside the drawing and the page's
// gutters, and no labelled tile cutting off its own text.
async function treemapFit(page: Page) {
  return page.locator('#year-review-where [data-panel="buys"] [role="img"]').evaluate((root) => {
    const box = root.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const tiles = [...root.querySelectorAll<HTMLElement>("[data-tile]")].filter((tile) => tile.getClientRects().length > 0);
    return {
      tiles: tiles.length,
      outside: tiles.filter((tile) => {
        const rect = tile.getBoundingClientRect();
        return rect.left < box.left - 0.5 || rect.right > box.right + 0.5 || rect.right > width - 16 + 0.5;
      }).map((tile) => tile.dataset.tile),
      clipped: tiles.filter((tile) => tile.hasAttribute("data-labelled") && (tile.scrollHeight > tile.clientHeight + 1 || tile.scrollWidth > tile.clientWidth + 1)).map((tile) => tile.dataset.tile),
    };
  });
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

  test("year in review: the spending-type treemap draws its tall layout inside the phone's gutters", async ({ page }) => {
    await page.goto("/explorer/analysis");
    await ready(page);
    const fit = await treemapFit(page);
    // Eight spending types, seven labelled: a selector that finds no tile must not pass.
    expect(fit.tiles).toBeGreaterThan(3);
    expect(fit).toEqual({ tiles: fit.tiles, outside: [], clipped: [] });
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

  test("unemployment region pages link their neighbours like economy regions, with 44px targets", async ({ page }) => {
    const slugs = async (testId: string) => {
      const links = page.getByTestId(testId).getByRole("link");
      await expect(links).toHaveCount(2);
      for (const box of await links.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
      return (await links.evaluateAll((elements) => elements.map((element) => element.getAttribute("href")!))).map((href) => href.split("/").at(-1));
    };
    await page.goto("/explorer/economy/regions/adjara");
    const economy = await slugs("regional-entity-navigation");
    await page.goto("/explorer/unemployment/regions/adjara");
    await ready(page);
    expect(await slugs("unemployment-region-navigation")).toEqual(economy);
    await page.getByTestId("unemployment-region-navigation").getByRole("link").last().tap();
    await page.waitForURL(`**/explorer/unemployment/regions/${economy[1]}`);
    await page.goto("/en/explorer/unemployment/regions/adjara");
    await expect(page.getByTestId("unemployment-region-navigation").getByRole("link").first()).toHaveText(/^← \S/);
  });

  test("municipal map: city markers preview on the first tap and the list scrolls with the page (D7)", async ({ page }) => {
    await page.goto("/explorer/municipalities");
    await ready(page);
    const list = page.getByTestId("municipal-list-muni");
    const scroll = await list.evaluate((element) => ({ client: element.clientHeight, scroll: element.scrollHeight, overflow: getComputedStyle(element).overflowY }));
    expect(scroll.overflow).toBe("visible");
    expect(scroll.client).toBe(scroll.scroll);

    const disk = page.locator("[data-map-touch-target='04']");
    expect(Math.min(...Object.values((await disk.boundingBox())!).slice(2))).toBeGreaterThanOrEqual(24);
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

  test("municipal map: every city marker's touch disk is at least 24px at the map's drawn width (U08-02)", async ({ page }) => {
    await page.goto("/explorer/municipalities");
    await ready(page);
    // 320px is the narrowest phone: a disk sized for an assumed 350px map would be 19px there.
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const code of ["04", "06", "20", "32", "48"]) {
        await expect.poll(async () => (await page.locator(`[data-map-touch-target='${code}']`).boundingBox())?.width ?? 0, `${code} at ${width}px`).toBeGreaterThanOrEqual(23.9);
      }
    }
  });
});

test("mouse clicks still open a map place at once and the touch disks ignore the mouse", async ({ page }) => {
  // Disks are sized at the map's drawn width: a desktop-wide map has none, so a phone-wide window with a mouse.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explorer/economy/regions");
  await mapHydrated(page);
  expect(await page.locator("[data-map-touch-target='region.tbilisi']").evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
  await page.locator("[data-region-map-target][data-region-id='region.kakheti']").click();
  await page.waitForURL("**/explorer/economy/regions/kakheti");
  await expect(page.getByTestId("map-touch-preview")).toHaveCount(0);
});

test("year in review: the spending-type treemap tiles stay inside it, their labels unclipped, at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1000 });
  await page.goto("/explorer/analysis");
  await ready(page);
  const fit = await treemapFit(page);
  expect(fit.tiles).toBeGreaterThan(3);
  expect(fit).toEqual({ tiles: fit.tiles, outside: [], clipped: [] });
});

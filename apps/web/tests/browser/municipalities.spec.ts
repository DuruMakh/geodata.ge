import { expect, test, type Page } from "@playwright/test";

async function expectMunicipalAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

// Municipalities index map: keyboard-accessibility regression coverage for the
// review finding that region <path>/city <circle> elements were click-only
// (no tabIndex, no role, no onKeyDown — .focus() left document.activeElement
// as BODY). Full section e2e coverage is Task 14's; this pins only the
// specific behaviour the finding closed.

test("region shapes and city markers are keyboard-focusable and activate on Enter/Space", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  await expect(page.getByTestId("region-map")).toBeVisible();

  // A real region shape: focusable, shows a visible focus ring, and Space
  // activates it (same as a click) without also scrolling the page.
  const region = page.locator('[data-testid^="region-shape-"]:not([data-no-data])').first();
  await region.focus();
  await expect(region).toBeFocused();

  const outline = await region.evaluate((el) => {
    const style = getComputedStyle(el as Element);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
  expect(outline.style).toBe("solid");
  expect(outline.width).not.toBe("0px");
  // Pins the actual rendered colour, not just "some outline exists": the
  // finding this closes is that the ring was rgba(179, 64, 42, 0.4) — a
  // translucent --accent that composites to the same colour as the ramp's
  // own darkest step (MAP_RAMP[5] IS --accent) and disappears. --map-focus-
  // ring is solid black, verified >=3:1 against every ramp step,
  // MAP_NO_DATA_FILL and --paper in tests/explorer/themeTokens.test.ts.
  expect(outline.color).toBe("rgb(0, 0, 0)");

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/\/explorer\/municipalities\/region\//);
  const scrollAfter = await page.evaluate(() => window.scrollY);
  expect(scrollAfter).toBe(scrollBefore);

  // A city marker: same story, Enter this time.
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const city = page.locator('[data-testid^="self-gov-city-"]').first();
  await city.focus();
  await expect(city).toBeFocused();
  const cityOutline = await city.evaluate((el) => {
    const style = getComputedStyle(el as Element);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
  expect(cityOutline.style).toBe("solid");
  expect(cityOutline.width).not.toBe("0px");
  expect(cityOutline.color).toBe("rgb(0, 0, 0)");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/explorer\/municipalities\/[^/]+$/);
});

test("the no-data region shape is excluded from the tab order", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);

  const noData = page.getByTestId("region-shape-GE-AB");
  await expect(noData).toHaveAttribute("data-no-data", "true");
  await expect(noData).not.toHaveAttribute("tabindex");

  await noData.evaluate((el) => (el as unknown as HTMLElement).focus());
  await expect(noData).not.toBeFocused();
});

test("focusing a list row highlights the map, matching mouse hover", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);

  const readout = page.getByTestId("map-readout");
  await expect(readout).toHaveText("გადაატარე კურსორი რუკაზე");

  await page.getByTestId("municipal-list-row").first().focus();
  await expect(readout).not.toHaveText("გადაატარე კურსორი რუკაზე");

  await page.getByTestId("municipal-list-row").first().blur();
  await expect(readout).toHaveText("გადაატარე კურსორი რუკაზე");
});

test("the map exposes an accessible group around its interactive shapes", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);

  const svg = page.getByTestId("region-map").locator("svg");
  await expect(svg).toHaveAttribute("role", "group");
  await expect(svg).toHaveAccessibleName(/.+/);
  await expect(svg.locator('[role="button"]')).not.toHaveCount(0);
});

test("region hover and keyboard focus show an anchored name-and-value tooltip", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);

  const map = page.getByTestId("region-map");
  const region = map.locator('[data-testid^="region-shape-"]:not([data-no-data])').first();
  const accessibleName = await region.getAttribute("aria-label");
  expect(accessibleName).toBeTruthy();
  const [name, value] = accessibleName!.split(" · ");

  await region.hover();
  const tooltip = page.getByTestId("region-map-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(name);
  await expect(tooltip).toContainText(value);
  await expect(page.getByTestId("map-readout")).toContainText(name);

  const [mapBox, regionBox, tooltipBox] = await Promise.all([
    map.boundingBox(),
    region.boundingBox(),
    tooltip.boundingBox(),
  ]);
  expect(mapBox).not.toBeNull();
  expect(regionBox).not.toBeNull();
  expect(tooltipBox).not.toBeNull();
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(mapBox!.x);
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(mapBox!.x + mapBox!.width + 1);
  expect(tooltipBox!.y).toBeGreaterThanOrEqual(mapBox!.y);
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(mapBox!.y + mapBox!.height + 1);
  expect(
    Math.abs(
      tooltipBox!.x + tooltipBox!.width / 2 - (regionBox!.x + regionBox!.width / 2),
    ),
  ).toBeLessThan(mapBox!.width / 2);

  await page.mouse.move(mapBox!.x, mapBox!.y);
  await expect(tooltip).toBeHidden();
  await region.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(name);
  await expect(tooltip).toContainText(value);
});

test("region tooltip preserves independent pointer and keyboard interactions", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);

  const map = page.getByTestId("region-map");
  const regions = map.locator('[data-testid^="region-shape-"]:not([data-no-data])');
  const pointerRegion = regions.nth(0);
  const focusRegion = regions.nth(1);
  const pointerName = (await pointerRegion.getAttribute("aria-label"))!.split(" · ")[0];
  const focusName = (await focusRegion.getAttribute("aria-label"))!.split(" · ")[0];
  const tooltip = page.getByTestId("region-map-tooltip");

  await pointerRegion.hover();
  await focusRegion.focus();
  await expect(tooltip).toContainText(focusName);
  await expect(focusRegion).toHaveAttribute("aria-describedby", "region-map-tooltip");
  await expect(pointerRegion).not.toHaveAttribute("aria-describedby");

  const heading = page.getByRole("heading", { level: 1 });
  await heading.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(focusName);
  await expect(page.getByTestId("map-readout")).toContainText(focusName);

  await pointerRegion.hover();
  await expect(tooltip).toContainText(focusName);
  await focusRegion.evaluate((element) => (element as unknown as HTMLElement).blur());
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(pointerName);
  await expect(pointerRegion).toHaveAttribute("aria-describedby", "region-map-tooltip");
  await expect(page.getByTestId("map-readout")).toContainText(pointerName);
});

test("focused lower-edge tooltip stays inside the SVG after a narrow viewport resize", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);

  const svg = page.getByTestId("region-map").locator("svg");
  const regions = svg.locator('[data-testid^="region-shape-"]:not([data-no-data])');
  const boxes = await regions.evaluateAll((elements) =>
    elements.map((element, index) => {
      const box = element.getBoundingClientRect();
      return { index, bottom: box.bottom };
    }),
  );
  const lowerEdgeIndex = boxes.sort((a, b) => b.bottom - a.bottom)[0]!.index;
  const lowerEdgeRegion = regions.nth(lowerEdgeIndex);
  await lowerEdgeRegion.focus();

  const tooltip = page.getByTestId("region-map-tooltip");
  await expect(tooltip).toBeVisible();

  const expectInsideSvg = async () => {
    const [svgBox, tooltipBox] = await Promise.all([svg.boundingBox(), tooltip.boundingBox()]);
    expect(svgBox).not.toBeNull();
    expect(tooltipBox).not.toBeNull();
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(svgBox!.x);
    expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(svgBox!.x + svgBox!.width + 1);
    expect(tooltipBox!.y).toBeGreaterThanOrEqual(svgBox!.y);
    expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(svgBox!.y + svgBox!.height + 1);
  };

  await expectInsideSvg();
  const beforeResize = await tooltip.getAttribute("style");
  await page.setViewportSize({ width: 340, height: 844 });
  await expect(tooltip).toBeVisible();
  await expect.poll(() => tooltip.getAttribute("style")).not.toBe(beforeResize);
  await expectInsideSvg();
});

// Task 14: the full index-page e2e coverage the header comment above defers
// to this task ("Full section e2e coverage is Task 14's").
test.describe("municipalities index", () => {
  test("renders the region map with an explicit no-data shape", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("region-map")).toBeVisible();
    await expect(page.locator("[data-testid^='region-shape-']")).toHaveCount(12);
    await expect(page.getByTestId("region-shape-GE-AB")).toHaveAttribute("data-no-data", "true");
    await expect(page.locator("[data-testid^='self-gov-city-']")).toHaveCount(5);
  });

  test("lists all municipalities and switches grain", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(64);
    await page.getByTestId("level-region").click();
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(11);
    await expect(page).toHaveURL(/#lvl=region/);
  });

  test("filters and clears the search", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await page.getByTestId("municipal-search").fill("თელავი");
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(1);
    await page.getByTestId("municipal-search").fill("ზზზზ");
    await expect(page.getByTestId("municipal-empty")).toBeVisible();
  });

  test("keeps row bars normalized to the unfiltered leader while searching", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);

    const rows = page.getByTestId("municipal-list-row");
    const comparisonRow = rows.nth(1);
    const query = await comparisonRow.getByTestId("municipal-row-name").textContent();
    const widthBefore = await comparisonRow.getByTestId("municipal-row-bar").getAttribute("style");
    expect(query).toBeTruthy();
    expect(widthBefore).toMatch(/^width:\s*(?!100(?:\.0)?%).+%$/);

    await page.getByTestId("municipal-search").fill(query!);
    await expect(rows).toHaveCount(1);
    const widthAfter = await rows.first().getByTestId("municipal-row-bar").getAttribute("style");
    expect(widthAfter).toBe(widthBefore);
  });

  test("opens a municipality from the list", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await page.getByTestId("municipal-list-row").first().click();
    await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/04");
  });

  test("shows four KPIs", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("index-kpi")).toHaveCount(4);
  });

  test("describes regions on the map and municipalities in the list", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await expect(page.locator("main > div > p").first()).toContainText(
      "აირჩიე რეგიონი რუკაზე ან მუნიციპალიტეტი სიაში",
    );
  });

  test("keeps the index workspace stacked until its content container reaches 1100px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "true");

    const columns = await page.getByTestId("municipal-index-workspace").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
    );
    const kpiColumns = await page.getByTestId("index-kpi-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
    );
    expect(columns).toHaveLength(1);
    expect(kpiColumns).toHaveLength(2);
  });
});

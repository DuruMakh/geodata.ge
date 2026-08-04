import { expect, test } from "@playwright/test";

// Municipalities index map: keyboard-accessibility regression coverage for the
// review finding that region <path>/city <circle> elements were click-only
// (no tabIndex, no role, no onKeyDown — .focus() left document.activeElement
// as BODY). Full section e2e coverage is Task 14's; this pins only the
// specific behaviour the finding closed.

test("region shapes and city markers are keyboard-focusable and activate on Enter/Space", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expect(page.getByTestId("region-map")).toBeVisible();

  // A real region shape: focusable, shows a visible focus ring, and Space
  // activates it (same as a click) without also scrolling the page.
  const region = page.locator('[data-testid^="region-shape-"]:not([data-no-data])').first();
  await region.focus();
  await expect(region).toBeFocused();

  const outline = await region.evaluate((el) => {
    const style = getComputedStyle(el as Element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).toBe("solid");
  expect(outline.width).not.toBe("0px");

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/\/explorer\/municipalities\/region\//);
  const scrollAfter = await page.evaluate(() => window.scrollY);
  expect(scrollAfter).toBe(scrollBefore);

  // A city marker: same story, Enter this time.
  await page.goto("http://localhost:3100/explorer/municipalities");
  const city = page.locator('[data-testid^="self-gov-city-"]').first();
  await city.focus();
  await expect(city).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/explorer\/municipalities\/[^/]+$/);
});

test("the no-data region shape is excluded from the tab order", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");

  const noData = page.getByTestId("region-shape-GE-AB");
  await expect(noData).toHaveAttribute("data-no-data", "true");
  await expect(noData).not.toHaveAttribute("tabindex");

  await noData.evaluate((el) => (el as unknown as HTMLElement).focus());
  await expect(noData).not.toBeFocused();
});

test("focusing a list row highlights the map, matching mouse hover", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");

  const readout = page.getByTestId("map-readout");
  await expect(readout).toHaveText("გადაატარე კურსორი რუკაზე");

  await page.getByTestId("municipal-list-row").first().focus();
  await expect(readout).not.toHaveText("გადაატარე კურსორი რუკაზე");

  await page.getByTestId("municipal-list-row").first().blur();
  await expect(readout).toHaveText("გადაატარე კურსორი რუკაზე");
});

import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

// DESIGN.md §7.17: the share button under each chart makes a 1200px card at double sharpness.

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

/** The years the page shows, as the file name spells them: `1995-2025`. */
async function shownYears(page: Page): Promise<string> {
  const text = await page.getByTestId("year-range-strip").textContent();
  const [, start, end] = /(\d{4})\s*[–-]\s*(\d{4})/.exec(text ?? "") ?? [];
  return `${start}-${end}`;
}

/** Downloads the picture through the menu and returns its file name and pixel size. */
async function downloadPicture(page: Page, testId = "chart-share") {
  await page.getByTestId(testId).click();
  await expect(page.getByTestId(`${testId}-menu`)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId(`${testId}-download`).click()]);
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  return { name: download.suggestedFilename(), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("download makes a 2400px wide PNG named after the page", async ({ page }) => {
  await open(page, "/explorer/wages/overview");
  const picture = await downloadPicture(page);
  expect(picture.name).toBe(`fiscal-wages-overview-${await shownYears(page)}.png`);
  expect(picture.width).toBe(2400);
  await expect(page.getByTestId("chart-share")).toBeFocused();
});

test("the English page names the file with -en", async ({ page }) => {
  await open(page, "/en/explorer/wages/overview");
  await expect(page.getByTestId("chart-share")).toHaveText("Share");
  const picture = await downloadPicture(page);
  expect(picture.name).toBe(`fiscal-wages-overview-${await shownYears(page)}-en.png`);
});

test("a phone gets the same wide picture as a computer", async ({ page }) => {
  await open(page, "/explorer/wages/overview");
  const desktop = await downloadPicture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/explorer/wages/overview");
  const phone = await downloadPicture(page);
  expect(phone.width).toBe(2400);
  expect(phone.height).toBe(desktop.height);
});

test("a double click on download produces one file", async ({ page }) => {
  await open(page, "/explorer/wages/overview");
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await page.getByTestId("chart-share").click();
  await page.getByTestId("chart-share-download").dblclick();
  await expect.poll(() => downloads.length).toBe(1);
  await page.waitForTimeout(2000);
  expect(downloads).toHaveLength(1);
  await expect(page.getByTestId("share-card")).toHaveCount(0);
});

test("copy puts a PNG on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, "/explorer/wages/overview");
  await page.getByTestId("chart-share").click();
  await page.getByTestId("chart-share-copy").click();
  await expect(page.getByTestId("chart-share-status")).toHaveText("სურათი დაკოპირდა");
  expect(await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((item) => item.types))).toContain("image/png");
});

test("Escape and an outside click close the menu and return focus", async ({ page }) => {
  await open(page, "/explorer/wages/overview");
  const button = page.getByTestId("chart-share");
  await button.click();
  await expect(page.getByTestId("chart-share-download")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("chart-share-menu")).toHaveCount(0);
  await expect(button).toBeFocused();
  await button.click();
  // An outside press lands on the menu's overlay, as the year picker's does.
  await page.mouse.click(600, 100);
  await expect(page.getByTestId("chart-share-menu")).toHaveCount(0);
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("the share item is hidden where the browser cannot share files", async ({ page }) => {
  await open(page, "/explorer/wages/overview");
  await page.evaluate(() => Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }));
  await page.getByTestId("chart-share").click();
  await expect(page.getByTestId("chart-share-download")).toBeVisible();
  await expect(page.getByTestId("chart-share-native")).toHaveCount(0);
});

test("the button sits on the source line, not in the chart's control row", async ({ page }) => {
  await open(page, "/explorer/wages/overview");
  await expect(page.getByTestId("chart-panel").getByTestId("chart-share")).toHaveCount(0);
  await expect(page.getByTestId("source-row").getByTestId("chart-share")).toHaveCount(1);
});

test("a picture with every Budget series ticked grows taller and keeps every name", async ({ page }) => {
  await open(page, "/explorer/expenditure");
  const few = await downloadPicture(page);
  const toggleAll = page.getByTestId("series-toggle-all");
  while ((await toggleAll.getAttribute("data-state")) !== "true") await toggleAll.click();
  const all = await downloadPicture(page);
  expect(all.width).toBe(2400);
  expect(all.height).toBeGreaterThan(few.height);
});

for (const [name, path, testId] of [
  ["the region map", "/explorer/wages/regions", "chart-share"],
  ["the municipality map", "/explorer/municipalities", "chart-share"],
  ["the population pyramid", "/explorer/demography/age-sex", "chart-share"],
  ["the age-sex region map", "/explorer/demography/age-sex", "region-map-share"],
  ["a municipality page", "/explorer/municipalities/batumi", "chart-share"],
  ["a region page", "/explorer/economy/regions/adjara", "chart-share"],
] as const) {
  test(`${name} makes a wide picture on a computer and a phone`, async ({ page }) => {
    await open(page, path);
    expect((await downloadPicture(page, testId)).width).toBe(2400);
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, path);
    expect((await downloadPicture(page, testId)).width).toBe(2400);
  });
}

// A page with several charts gives each its own button, so no two share a test id or a menu.
for (const [path, testIds] of [
  ["/explorer/demography/population/georgia", ["chart-share", "vital-share", "marriage-share", "age-sex-share"]],
  ["/explorer/demography/births-deaths", ["chart-share", "tfr-share", "asfr-share", "life-share"]],
  ["/explorer/demography/marriages-divorces", ["chart-share", "map-share"]],
  ["/explorer/demography/age-sex", ["chart-share", "region-map-share"]],
] as const) {
  test(`every chart on ${path} has one button of its own`, async ({ page }) => {
    await open(page, path);
    for (const testId of testIds) await expect(page.getByTestId(testId), testId).toHaveCount(1);
    expect((await downloadPicture(page, testIds.at(-1))).width).toBe(2400);
  });
}

test("a stacked column chart makes a picture too", async ({ page }) => {
  await open(page, "/explorer/external/current-account");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-tab", "balance");
  expect((await downloadPicture(page)).width).toBe(2400);
});

import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

async function expectEnglish(page: Page) {
  expect((await page.locator("body").innerText()).replaceAll("ქართული", "")).not.toMatch(/\p{Script=Georgian}/u);
  const descriptions = await page.locator("[aria-label], [title], svg title").evaluateAll(elements => elements.flatMap(element => [element.getAttribute("aria-label") ?? "", element.getAttribute("title") ?? "", element.tagName.toLowerCase() === "title" ? element.textContent ?? "" : ""]));
  expect(descriptions.filter(text => text !== "ქართული").join(" ")).not.toMatch(/\p{Script=Georgian}/u);
}

for (const route of ["/en", "/en/explorer", "/en/about", "/en/connect"]) test(`${route} serves complete English initial HTML`, async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: TEST_BASE_URL });
  try {
    const page = await context.newPage();
    expect((await page.goto(route))?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toBeVisible();
    await expectEnglish(page);
  } finally { await context.close(); }
});

test("the English reader journey keeps human pages English and copies the shared endpoint", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { document.documentElement.dataset.testClipboard = value; } } });
  });
  await page.goto("/en");
  await page.getByTestId("landing-header").getByRole("link", { name: "Data", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer$/);
  await page.getByTestId("budget-hub").locator('a[href="/en/explorer/expenditure"]').click();
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.getByTestId("site-footer").getByRole("link", { name: "Methodology", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/methodology$/);
  await page.locator('main a[href="/en/methodology/expenditure"]').click();
  await expect(page).toHaveURL(/\/en\/methodology\/expenditure$/);
  await page.locator('header a[href="/en/connect"]').click();
  await expect(page).toHaveURL(/\/en\/connect$/);
  await expectEnglish(page);
  await expect(page.getByTestId("connect-endpoint")).toHaveText("https://fiscal.ge/mcp");
  await expect(page.locator('a[href="/en/mcp"]')).toHaveCount(0);
  const copy = page.getByTestId("connect-copy");
  await copy.focus();
  await copy.press("Enter");
  await expect(copy).toHaveAttribute("aria-label", "Address copied");
  await expect(page.locator("html")).toHaveAttribute("data-test-clipboard", "https://fiscal.ge/mcp");
  await page.getByTestId("connect-copy-prompt").click();
  await expect(page.locator("html")).toHaveAttribute("data-test-clipboard", "Answer my question using Fiscal.ge’s published data:");
  await expectEnglish(page);
});

test("homepage and hub figures stay identical when switching languages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en#data");
  const figures = () => page.locator('[data-testid="landing-data"] table td, [data-testid="landing-dataset-total"] p, [data-testid="landing-debt"] dd, [data-testid="landing-deficit-history"] strong').evaluateAll(elements => elements.map(element => element.textContent?.match(/[−+]?\d[\d,.]*%?/g) ?? []));
  const before = await figures();
  await page.getByTestId("landing-header").getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
  expect(new URL(page.url()).hash).toBe("#data");
  expect(await figures()).toEqual(before);
  await page.goto("/en/explorer");
  const sparklines = () => page.getByTestId("budget-hub").locator("svg polyline, svg path").evaluateAll(elements => elements.map(element => element.getAttribute("points") ?? element.getAttribute("d")));
  const englishSparklines = await sparklines();
  expect(englishSparklines.length).toBeGreaterThan(0);
  await page.goto("/explorer");
  expect(await sparklines()).toEqual(englishSparklines);
});

for (const width of [320, 390, 768, 1440]) test(`English public pages remain readable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ["/en", "/en/explorer", "/en/about", "/en/connect"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expectEnglish(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("English homepage retains the desktop hero, English peak labels and English fallback", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/en");
  await expect(page.locator(".landing-hero-frame canvas")).toBeVisible();
  await expect(page.locator('[data-gid="shkh"]')).toHaveText("Shkhara · 5193 m");
  await expect(page.locator('[data-gid="mkin"]')).toHaveText("Mount Kazbek · 5054 m");
  await expectEnglish(page);
  const context = await browser.newContext({ baseURL: TEST_BASE_URL, viewport: { width: 1440, height: 1000 } });
  try {
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value(type: string, ...args: unknown[]) {
        return type.includes("webgl") ? null : Reflect.apply(original, this, [type, ...args]);
      } });
    });
    const fallback = await context.newPage();
    await fallback.goto("/en");
    await expect(fallback.getByText("The visual could not load — data is available in the explorer", { exact: true })).toBeVisible();
    await expectEnglish(fallback);
  } finally { await context.close(); }
});

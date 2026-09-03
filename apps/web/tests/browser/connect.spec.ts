import { expect, test } from "@playwright/test";

const BASE_URL = process.env.SEO_BASE_URL ?? "http://localhost:3100";
const ENDPOINT = "https://fiscal.ge/mcp";

test.describe("connection page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/connect`);
  });

  test("leads in Georgian with what the service is", async ({ page }) => {
    const heading = page.getByRole("heading", { level: 1 });

    await expect(heading).toBeVisible();
    // Georgian-first: the h1 is Georgian script, not a Latin product name.
    await expect(heading).toHaveText(/[Ⴀ-ჿ]/);
    await expect(page.getByTestId("connect-intro")).toBeVisible();
  });

  test("shows the endpoint and can copy it from the keyboard", async ({ page }) => {
    await expect(page.getByTestId("connect-endpoint")).toContainText(ENDPOINT);

    const copy = page.getByTestId("connect-copy");
    await expect(copy).toBeVisible();
    // An icon-only control with no accessible name is unusable by a screen
    // reader, and this is the one action on the page.
    const label = (await copy.getAttribute("aria-label")) ?? (await copy.innerText());
    expect(label.trim().length).toBeGreaterThan(3);
    expect(label).toMatch(/[Ⴀ-ჿ]/);

    await copy.focus();
    await expect(copy).toBeFocused();

    const box = await copy.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(24);
    expect(box!.width).toBeGreaterThanOrEqual(24);
  });

  test("gives per-application connection steps for at least two clients", async ({ page }) => {
    const clients = page.getByTestId("connect-client");

    expect(await clients.count()).toBeGreaterThanOrEqual(2);
    for (const client of await clients.all()) {
      await expect(client).toBeVisible();
      expect((await client.innerText()).trim().length).toBeGreaterThan(30);
    }
  });

  test("offers example questions in Georgian", async ({ page }) => {
    const examples = page.getByTestId("connect-example");

    expect(await examples.count()).toBeGreaterThanOrEqual(3);
    for (const example of await examples.all()) await expect(example).toHaveText(/[Ⴀ-ჿ]/);
  });

  // Spec 12.3: the coverage statement is what stops a user asking for
  // out-of-scope data and concluding the tool is broken.
  test("states both what is served and what is not", async ({ page }) => {
    const served = page.getByTestId("connect-coverage-served");
    const missing = page.getByTestId("connect-coverage-excluded");

    await expect(served).toBeVisible();
    await expect(missing).toBeVisible();

    const servedText = await served.innerText();
    expect(servedText).toContain("2004");
    expect(servedText).toContain("2015");
    expect(servedText).toContain("2025");

    const missingText = await missing.innerText();
    // Quarterly, monthly, debt, capital projects - named explicitly.
    expect(missingText.length).toBeGreaterThan(40);
    await expect(missing).toHaveText(/[Ⴀ-ჿ]/);
  });

  test("is reachable from the site footer", async ({ page }) => {
    await page.goto(`${BASE_URL}/about`);
    const link = page.locator('footer a[href="/connect"]');

    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(new RegExp("/connect$"));
  });

  test("stays readable on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/connect`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("connect-endpoint")).toBeVisible();
    // No horizontal scroll: the endpoint URL is the usual culprit on mobile.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("carries its own canonical metadata", async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${"https://fiscal.ge"}/connect`);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect((description ?? "").length).toBeGreaterThan(40);
  });
});

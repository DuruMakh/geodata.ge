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

  // Spec 12.3: the coverage statement is what stops a user asking for
  // out-of-scope data and concluding the tool is broken.
  test("states both what is served and what is not", async ({ page }) => {
    const served = page.getByTestId("connect-coverage-served");
    const missing = page.getByTestId("connect-coverage-excluded");

    await expect(served).toBeVisible();
    await expect(missing).toBeVisible();

    // Per LINE, not per block. Asserting that the block as a whole contains
    // "2004" cannot tell which dataset supplied it: if ministries silently
    // drifted to 2005, national still contributes a 2004 and the test stays
    // green - which is the exact drift this page exists to prevent.
    const servedLines = (await served.innerText()).split("\n").filter((line) => line.includes("—"));
    expect(servedLines).toHaveLength(6);

    // Debt and the balance are served now, so the page must not still deny
    // them, and their ranges must be real rather than borrowed from a
    // neighbour: the balance reaches back further than anything else here.
    expect(servedLines.some((line) => line.startsWith("სახელმწიფო ვალი"))).toBe(true);
    const balance = servedLines.find((line) => line.includes("ბალანსი"))!;
    expect(balance).toContain("1995–2031");
    for (const line of servedLines) expect(line).toMatch(/\d{4}–\d{4}\s*$/);

    const municipal = servedLines.find((line) => line.includes("მუნიციპალური"))!;
    expect(municipal).toContain("2015–2025");
    // The counts are derived too, so they must be present and non-zero.
    expect(municipal).toMatch(/\d+ მუნიციპალიტეტი და \d+ რეგიონი/);

    // Revenue is consolidated receipts, NOT state-budget revenue. Getting this
    // wrong on the page that addresses AI clients hands them the premise for a
    // deficit subtraction that the data does not support.
    expect(servedLines.some((line) => line.startsWith("ნაერთი ბიუჯეტის შემოსულობები"))).toBe(true);

    const missingText = await missing.innerText();
    // Quarterly, monthly, capital projects - named explicitly. Debt was on
    // this list until the endpoint began serving it.
    expect(missingText).not.toContain("სახელმწიფო ვალი");
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

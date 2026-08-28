import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const productionOrigin = "https://fiscal.ge";
const googleScript = "https://www.googletagmanager.com/gtag/js?id=G-RRS446MKJW";
const clarityScript = "https://www.clarity.ms/tag/y9my6v583o";

test.afterEach(async ({ page }) => {
  // Keep prefetches off production; ignore only route callbacks cancelled during teardown.
  await page.context().setOffline(true);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

async function serveLocalSite(page: Page, origin: string) {
  // Exercise the real application under the public hostname without contacting production.
  await page.route(`${origin}/**`, async (route) => {
    const url = route.request().url().replace(origin, baseUrl);
    const response = await route.fetch({ url });
    await route.fulfill({ response });
  });
}

async function interceptAnalytics(page: Page, blocked = false) {
  const requests: string[] = [];
  await page.route(/https:\/\/(?:www\.googletagmanager\.com|www\.clarity\.ms)\//, async (route) => {
    requests.push(route.request().url());
    if (blocked) {
      await route.abort("blockedbyclient");
    } else {
      // Stub only the external vendors so tests never send visits to either account.
      await route.fulfill({ contentType: "application/javascript", body: "" });
    }
  });
  return requests;
}

async function googleCommands(page: Page) {
  return page.evaluate(() => {
    const analyticsWindow = window as unknown as { dataLayer?: ArrayLike<unknown>[] };
    return analyticsWindow.dataLayer?.map((command) => Array.from(command)) ?? [];
  });
}

test("loads both analytics projects on Fiscal.ge without a consent step or duplicate initialization", async ({ page }) => {
  await serveLocalSite(page, productionOrigin);
  const requests = await interceptAnalytics(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(productionOrigin);
  await expect.poll(() => requests).toHaveLength(2);
  expect(requests).toEqual(expect.arrayContaining([googleScript, clarityScript]));
  await expect.poll(() => googleCommands(page)).toContainEqual(["config", "G-RRS446MKJW"]);

  for (const src of [googleScript, clarityScript]) {
    await expect(page.locator(`script[src="${src}"]`)).toHaveCount(1);
    await expect(page.locator(`script[src="${src}"]`)).toHaveJSProperty("async", true);
  }

  await page.getByRole("link", { name: "ხარჯების მონაცემები →", exact: true }).click();
  await expect(page).toHaveURL(`${productionOrigin}/explorer/expenditure`);
  await expect(page.getByRole("heading", { name: "როგორ იხარჯება საქართველოს ბიუჯეტი", exact: true })).toBeVisible();

  expect(requests).toHaveLength(2);
  const commands = await googleCommands(page);
  expect(commands.filter(([command]) => command === "config")).toEqual([["config", "G-RRS446MKJW"]]);
  // Loading without a banner must not be implemented by inventing visitor consent.
  expect(commands.some(([command]) => command === "consent")).toBe(false);
  expect(await page.evaluate(() => (window as unknown as { clarity?: { q?: unknown[] } }).clarity?.q ?? [])).toEqual([]);
  expect(errors).toEqual([]);
});

for (const origin of [baseUrl, "https://geodata-preview.vercel.app"]) {
  test(`does not load analytics on ${origin}`, async ({ page }) => {
    if (origin !== baseUrl) await serveLocalSite(page, origin);
    const requests = await interceptAnalytics(page);

    await page.goto(`${origin}/explorer/expenditure`);
    await expect(page.locator("#google-analytics")).toHaveCount(1);
    await expect(page.locator("#microsoft-clarity")).toHaveCount(1);
    expect(requests).toEqual([]);
    expect(await googleCommands(page)).toEqual([]);
    expect(await page.evaluate(() => typeof (window as unknown as { clarity?: unknown }).clarity)).toBe("undefined");
  });
}

test("keeps the explorer usable when analytics scripts are blocked", async ({ page }) => {
  await serveLocalSite(page, productionOrigin);
  const requests = await interceptAnalytics(page, true);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${productionOrigin}/explorer/expenditure`);
  await expect.poll(() => requests).toHaveLength(2);
  await expect(page.getByRole("heading", { name: "როგორ იხარჯება საქართველოს ბიუჯეტი", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ცხრილი", exact: true }).click();
  await expect(page.getByRole("button", { name: "ცხრილი", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

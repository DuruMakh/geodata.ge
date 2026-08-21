import { expect, test } from "@playwright/test";

const BASE_URL = process.env.SEO_BASE_URL ?? "http://localhost:3100";

const representativeRoutes = [
  "/",
  "/explorer/expenditure",
  "/explorer/revenue",
  "/explorer/analysis",
  "/explorer/municipalities",
  "/explorer/municipalities/04",
  "/explorer/municipalities/region/imereti",
  "/methodology",
  "/methodology/expenditure",
  "/about",
] as const;

for (const route of representativeRoutes) {
  test(`${route} exposes Fiscal.ge search metadata`, async ({ page }) => {
    await page.goto(`${BASE_URL}${route}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https:\/\/fiscal\.ge/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/fiscal\.ge\//);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
  });
}

test("municipality navigation uses crawlable links", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/municipalities`);
  await expect(page.getByTestId("municipal-list-row").first()).toHaveAttribute(
    "href",
    /\/explorer\/municipalities\/\d+/,
  );
});

test("methodology exposes a stable processed-data download", async ({ page, request }) => {
  await page.goto(`${BASE_URL}/methodology/expenditure`);
  await expect(page.getByTestId("processed-dataset-download")).toHaveAttribute(
    "href",
    "/downloads/data/national-expenditure.csv",
  );
  const response = await request.get(`${BASE_URL}/downloads/data/national-expenditure.csv`);
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
});

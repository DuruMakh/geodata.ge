import { expect, test } from "@playwright/test";

test("English expenditure is a real page with an English document language", async ({ request }) => {
  const response = await request.get("/en/explorer/expenditure");
  expect(response.status()).toBe(200);
  expect(await response.text()).toMatch(/<html[^>]*lang="en"/);
});

test("language switching preserves the current query and explorer settings", async ({ page }) => {
  await page.goto("/explorer/expenditure?source=shared#g=ministries&m=table&r=2020-2025&sel=admin_spending.defence");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const before = new URL(page.url());
  await page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  expect(new URL(page.url()).pathname).toBe("/en/explorer/expenditure");
  expect(new URL(page.url()).search).toBe(before.search);
  expect(new URL(page.url()).hash).toBe(before.hash);
  await expect(page.getByTestId("section-link-expenditure")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("section-link-revenue")).toHaveAttribute("href", "/en/explorer/revenue");
  await page.getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
  expect(new URL(page.url()).hash).toBe(before.hash);
});

test("the switch copies state written by replaceState without a hashchange event", async ({ page }) => {
  await page.goto("/explorer/expenditure");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.evaluate(() => history.replaceState(null, "", "#g=fields&m=table&r=2022-2025&sel=spending.education"));
  const link = page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true });
  await link.focus();
  await expect(link).toHaveAttribute("href", "/en/explorer/expenditure#g=fields&m=table&r=2022-2025&sel=spending.education");
  await link.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(new URL(page.url()).hash).toContain("sel=spending.education");
});

test("language selection remains available in the collapsed desktop sidebar and mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/explorer/expenditure");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.getByTestId("sidebar-toggle").click();
  await expect(page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("sidebar-toggle").click();
  await expect(page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true })).toBeVisible();
});

test("English municipality code redirects keep the English path and query", async ({ request }) => {
  const response = await request.get("/en/explorer/municipalities/06?source=shared", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/en/explorer/municipalities/batumi?source=shared");
});

test("English municipality redirects preserve the browser fragment", async ({ page }) => {
  await page.goto("/en/explorer/municipalities/06?source=shared#m=table&r=2020-2025&sel=municipal.total");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page).toHaveURL("/en/explorer/municipalities/batumi?source=shared#m=table&r=2020-2025&sel=municipal.total");
});

for (const route of ["/no-such-page", "/en/no-such-page", "/explorer/municipalities/no-such-place", "/en/explorer/municipalities/no-such-place", "/methodology/no-such-dataset"]) {
  test(`${route} returns a bilingual recovery page with a real 404`, async ({ request }) => {
    const response = await request.get(route);
    const html = await response.text();
    expect(response.status()).toBe(404);
    expect(html).toContain("გვერდი ვერ მოიძებნა");
    expect(html).toContain("Page not found");
    expect(html).toContain('href="/en"');
    expect(html).toContain("noindex");
  });
}

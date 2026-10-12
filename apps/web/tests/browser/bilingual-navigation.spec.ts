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

for (const { path, label } of [
  { path: "/explorer/debt", label: "მთავარ შინაარსზე გადასვლა" },
  { path: "/en/explorer/debt", label: "Skip to content" },
]) {
  test(`the first Tab reaches a skip link that moves focus to the content: ${path}, JavaScript on`, async ({ page }) => {
    const hash = "#f=rate&m=table&r=2015-2025&sel=debt.rate.external";
    await page.goto(`${path}${hash}`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: label, exact: true });
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Enter");
    await expect(page.locator("#content")).toBeFocused();
    // These pages keep their view in the URL hash; skipping must not replace it.
    expect(new URL(page.url()).hash).toBe(hash);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.getElementById("content")!.contains(document.activeElement))).toBe(true);
  });

  test(`the first Tab reaches a skip link that moves focus to the content: ${path}, JavaScript off`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(path);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: label, exact: true });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#content")).toBeFocused();
    await context.close();
  });
}

for (const path of ["/", "/en"]) {
  test(`the landing page has one banner, one main and one footer: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
  });
}

test("every page family has one skip target and a skip link that points to it", async ({ request }) => {
  for (const [path, status] of [
    ["/", 200], ["/en", 200], ["/about", 200], ["/en/connect", 200], ["/methodology", 200], ["/en/methodology/inflation", 200],
    ["/explorer", 200], ["/en/explorer/debt", 200], ["/explorer/municipalities/batumi", 200], ["/no-such-page", 404], ["/explorer/municipalities/no-such-place", 404],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(status);
    const html = await response.text();
    expect(html.match(/\sid="content"/g), path).toHaveLength(1);
    // The skip link is the first focusable element in the body.
    expect(html.slice(html.indexOf("<body")).match(/<(?:a|button|input|select|summary)\b[^>]*>/)?.[0], path).toContain('href="#content"');
  }
});

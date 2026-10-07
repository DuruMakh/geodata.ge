import { expect, test, type Locator, type Page } from "@playwright/test";

// Mobile repairs (2026-10-07 review, owner decisions D2/D3/D10): navigation,
// headers and editorial pages on a 390px phone.
test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function heights(links: Locator) {
  return links.evaluateAll((elements) =>
    elements
      .filter((element) => (element as HTMLElement).offsetParent !== null)
      .map((element) => ({ text: element.textContent?.trim() ?? "", height: element.getBoundingClientRect().height })),
  );
}

for (const { path, label } of [
  { path: "/explorer/expenditure", label: "მენიუ" },
  { path: "/en/explorer/inflation/cities/batumi", label: "Menu" },
]) {
  test(`${path}: the explorer top bar stays pinned and opens a 44px-row menu`, async ({ page }) => {
    await page.goto(path);
    await ready(page);
    const bar = page.getByTestId("data-sidebar");
    const toggle = page.getByTestId("sidebar-toggle");
    await expect(toggle).toHaveAccessibleName(label);
    const toggleBox = await toggle.boundingBox();
    expect(toggleBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    const barHeight = (await bar.boundingBox())?.height ?? 0;
    expect(barHeight).toBeLessThanOrEqual(64);

    // Mid-page the menu must still be one tap away.
    await page.evaluate(() => window.scrollTo(0, 2000));
    await expect.poll(async () => (await toggle.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((await toggle.boundingBox())?.y ?? 99).toBeLessThan(20);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("#data-sidebar-navigation");
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual(844 + 1);

    for (const row of await heights(panel.locator("nav a, nav li:not(:has(a)), a[data-testid=sidebar-back-home], [data-testid=language-switch] a"))) {
      expect(row.height, row.text).toBeGreaterThanOrEqual(44);
    }
    const backHome = page.getByTestId("sidebar-back-home");
    expect((await backHome.boundingBox())?.width ?? 0).toBeGreaterThan(300);
    const teaserOpacity = await page.getByTestId("teaser-demography").evaluate((element) => Number(getComputedStyle(element).opacity));
    expect(teaserOpacity).toBeLessThan(1);

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });
}

test("tapping a menu link from mid-page closes the menu on arrival", async ({ page }) => {
  await page.goto("/explorer/expenditure");
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, 1500));
  const toggle = page.getByTestId("sidebar-toggle");
  await toggle.click();
  await page.getByTestId("unemployment-link").click();
  await expect(page).toHaveURL(/\/explorer\/unemployment$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

for (const { path, menu, datasets, other } of [
  { path: "/", menu: "მენიუ", datasets: ["ბიუჯეტი", "ეკონომიკა", "ინფლაცია", "უმუშევრობა"], other: "English" },
  { path: "/en", menu: "Menu", datasets: ["Budget", "Economy", "Inflation", "Unemployment"], other: "ქართული" },
]) {
  test(`${path} ☰ menu lists the four datasets as 44px rows`, async ({ page }) => {
    await page.goto(path);
    const header = page.getByTestId("landing-header");
    await header.getByRole("button", { name: menu, exact: true }).click();
    const group = header.getByTestId("menu-datasets");
    await expect(group.getByRole("link")).toHaveText(datasets);
    const hrefs = await group.getByRole("link").evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
    const prefix = path === "/en" ? "/en" : "";
    expect(hrefs).toEqual(["/explorer", "/explorer/economy", "/explorer/inflation", "/explorer/unemployment"].map((href) => `${prefix}${href}`));
    for (const row of await heights(header.getByRole("navigation").getByRole("link"))) expect(row.height, row.text).toBeGreaterThanOrEqual(44);
    const switchBox = await header.getByRole("group").getByRole("link", { name: other }).boundingBox();
    expect(switchBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(switchBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
}

for (const { path, titles, measures } of [
  { path: "/", titles: ["ბიუჯეტი", "ეკონომიკა", "ინფლაცია", "უმუშევრობა"], measures: ["ხარჯები", "ნომინალური მშპ", "წლიური ინფლაცია", "უმუშევრობის დონე"] },
  { path: "/en", titles: ["Budget", "Economy", "Inflation", "Unemployment"], measures: ["Spending", "Nominal GDP", "Annual inflation", "Unemployment rate"] },
]) {
  test(`${path} lists the four datasets with a latest figure right after the country figures`, async ({ page }) => {
    await page.goto(path);
    const row = page.getByTestId("landing-datasets");
    const links = row.getByRole("link");
    await expect(links).toHaveCount(4);
    for (const [index, link] of (await links.all()).entries()) {
      await expect(link).toContainText(titles[index]);
      // "{measure} · {period}: {value}", the value a number with its unit.
      await expect(link).toContainText(new RegExp(`${measures[index]} · [^:]+: [−\\d.]+( |%)`));
      expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const figures = await page.getByTestId("key-numbers").boundingBox();
    const rowBox = await row.boundingBox();
    expect(rowBox!.y).toBeGreaterThan(figures!.y + figures!.height - 1);
    expect(rowBox!.y).toBeLessThan((await page.getByTestId("landing-data").boundingBox())!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
}

test("landing calls to action are 44px tap targets", async ({ page }) => {
  await page.goto("/");
  const targets = [
    page.getByTestId("hero-cta"),
    ...["landing-dataset-expenditure", "landing-dataset-revenue", "landing-dataset-municipalities", "landing-debt", "landing-deficit", "landing-methodology"].map((id) => page.getByTestId(id).getByRole("link").first()),
  ];
  for (const target of targets) expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("404 recovers to the four datasets with no top band on a phone", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  const recovery = page.getByTestId("not-found-recovery");
  const hrefs = await recovery.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual(["/", "/explorer", "/explorer/economy", "/explorer/inflation", "/explorer/unemployment", "/methodology"]);
  expect((await recovery.boundingBox())?.y ?? 999).toBeLessThanOrEqual(40);
  await expect(page.locator('a[href="/sitemap.xml"], a[href="/llms.txt"]')).toHaveCount(0);
});

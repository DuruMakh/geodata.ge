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
  { path: "/", menu: "მენიუ", datasets: ["ბიუჯეტი", "ეკონომიკა", "ინფლაცია", "უმუშევრობა", "საგარეო ვაჭრობა"], other: "English" },
  { path: "/en", menu: "Menu", datasets: ["Budget", "Economy", "Inflation", "Unemployment", "Trade"], other: "ქართული" },
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
  { path: "/", titles: ["ბიუჯეტი", "ეკონომიკა", "ინფლაცია", "უმუშევრობა", "საგარეო ვაჭრობა"], measures: ["ხარჯები", "ნომინალური მშპ", "წლიური ინფლაცია", "უმუშევრობის დონე", "საგარეო სავაჭრო ბრუნვა"] },
  { path: "/en", titles: ["Budget", "Economy", "Inflation", "Unemployment", "Trade"], measures: ["Spending", "Nominal GDP", "Annual inflation", "Unemployment rate", "Total trade"] },
]) {
  test(`${path} lists every dataset with a latest figure right after the country figures`, async ({ page }) => {
    await page.goto(path);
    const row = page.getByTestId("landing-datasets");
    const links = row.getByRole("link");
    await expect(links).toHaveCount(titles.length);
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

for (const { path, labels } of [
  { path: "/explorer/unemployment", labels: ["ბიუჯეტი", "ეკონომიკა", "ინფლაცია", "უმუშევრობა", "საგარეო ვაჭრობა", "მეთოდოლოგია", "AI-კავშირი", "მიზანი"] },
  { path: "/en", labels: ["Budget", "Economy", "Inflation", "Unemployment", "Trade", "Methodology", "AI connection", "About"] },
]) {
  test(`${path} footer names the four datasets in a compact two-column grid`, async ({ page }) => {
    await page.goto(path);
    const footer = page.getByTestId("site-footer");
    const nav = footer.locator("ul a");
    await expect(nav).toHaveText(labels);
    // The footer carries no tagline (owner decision 2026-10-08).
    await expect(footer).not.toContainText(path === "/en" ? "clear, verified, open" : "ნათლად, გადამოწმებულად, ღიად");
    const boxes = await nav.evaluateAll((links) => links.map((link) => link.getBoundingClientRect().toJSON() as DOMRect));
    for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
    expect(new Set(boxes.map((box) => Math.round(box.x))).size).toBe(2);
    // The data line no longer repeats its own heading.
    await expect(footer.getByText(path === "/en" ? "Data" : "მონაცემები", { exact: true })).toHaveCount(0);
    const height = (await footer.boundingBox())?.height ?? 0;
    // ~445px against ~600px before; seven 44px rows in two columns are the floor.
    expect(height).toBeLessThanOrEqual(460);
    const marginTop = await footer.evaluate((element) => parseFloat(getComputedStyle(element).marginTop));
    expect(marginTop).toBeLessThanOrEqual(48);
  });
}

test("404 recovers to the four datasets with no top band on a phone", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  const recovery = page.getByTestId("not-found-recovery");
  const hrefs = await recovery.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual(["/", "/explorer", "/explorer/economy", "/explorer/inflation", "/explorer/unemployment", "/methodology"]);
  expect((await recovery.boundingBox())?.y ?? 999).toBeLessThanOrEqual(40);
  await expect(page.locator('a[href="/sitemap.xml"], a[href="/llms.txt"]')).toHaveCount(0);
});

for (const { path, back, href, trail } of [
  { path: "/en/explorer/unemployment/regions/adjara", back: "Unemployment by region", href: "/en/explorer/unemployment/regions", trail: ["Home", "Data", "Unemployment", "Unemployment by region", "Adjara"] },
  { path: "/explorer/inflation/cities/batumi", back: "ქალაქები", href: "/explorer/inflation/cities", trail: null },
  { path: "/explorer/expenditure", back: "ბიუჯეტი", href: "/explorer", trail: ["მთავარი", "მონაცემები", "ბიუჯეტი", "ხარჯები"] },
]) {
  test(`${path}: one back-crumb on a phone, the full trail from 768px`, async ({ page }) => {
    await page.goto(path);
    const header = page.getByTestId("explorer-header");
    const jsonLd = await page.getByTestId("breadcrumb-json-ld").textContent();
    const crumb = header.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumb.getByRole("link")).toHaveCount(1);
    await expect(crumb.getByRole("link")).toHaveText(`←${back}`);
    await expect(crumb.getByRole("link")).toHaveAttribute("href", href);
    expect((await crumb.getByRole("link").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await header.boundingBox())?.height ?? 999).toBeLessThanOrEqual(80);

    await page.setViewportSize({ width: 1024, height: 800 });
    const full = header.getByRole("navigation", { name: "Breadcrumb" });
    await expect(full.locator("[aria-current=page]")).toHaveCount(1);
    if (trail) expect((await full.innerText()).split("/").map((part) => part.trim().toLowerCase())).toEqual(trail.map((part) => part.toLowerCase()));
    // Structured data is server-rendered once and does not depend on the width.
    expect(await page.getByTestId("breadcrumb-json-ld").textContent()).toBe(jsonLd);
  });
}

for (const path of ["/explorer", "/explorer/economy", "/explorer/inflation", "/explorer/unemployment", "/explorer/inflation/overview", "/explorer/economy/regions", "/explorer/economy/regions/adjara"]) {
  test(`${path} states coverage in the one shared format`, async ({ page }) => {
    await page.goto(path);
    const coverage = page.getByTestId("explorer-header").locator("p");
    await expect(coverage).toHaveText(/^\S+( \d{4})?–\S+( \d{4})? · განახლდა \d{4}-\d{2}-\d{2}$/);
  });
}

for (const { path, testId, text } of [
  { path: "/explorer/economy/gdp", testId: "gdp-latest", text: /^რეალური მშპ · \d{4}: \d+\.\d მლრდ აშშ დოლარი( · წინასწარი)?$/ },
  { path: "/explorer/inflation/overview", testId: "inflation-latest", text: /^წლიური ინფლაცია · \S+ \d{4}: −?\d+\.\d%$/ },
  { path: "/explorer/inflation/categories", testId: "inflation-category-latest", text: /^წლიური ინფლაცია · \S+ \d{4}: −?\d+\.\d%$/ },
  { path: "/explorer/inflation/cities", testId: "inflation-city-latest", text: /^წლიური ინფლაცია · \S+ \d{4}: −?\d+\.\d%$/ },
  { path: "/explorer/inflation/cities/batumi", testId: "inflation-city-latest", text: /^წლიური ინფლაცია · \S+ \d{4}: −?\d+\.\d%$/ },
  { path: "/explorer/unemployment/overview", testId: "unemployment-latest", text: /^უმუშევრობის დონე · \d{4}: \d+\.\d%$/ },
  { path: "/explorer/unemployment/gender", testId: "unemployment-latest", text: /^უმუშევრობის დონე · \d{4}: \d+\.\d%$/ },
  // No national rows on the age page: the line names its first selected group.
  { path: "/explorer/unemployment/age", testId: "unemployment-latest", text: /^უმუშევრობის დონე · .+ · \d{4}: \d+\.\d%$/ },
  { path: "/en/explorer/unemployment/regions/adjara", testId: "unemployment-latest", text: /^Unemployment rate · \d{4}: \d+\.\d%$/ },
]) {
  test(`${path} states the latest value on the first screen, right under the title`, async ({ page }) => {
    await page.goto(path);
    await ready(page);
    const line = page.getByTestId(testId);
    await expect(line).toHaveText(text);
    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    const box = await line.boundingBox();
    expect(box!.y).toBeGreaterThan(title!.y + title!.height - 1);
    // City and region pages keep their 44px ← previous · next → row between the two.
    const hasNeighbourRow = path.includes("/cities/") || path.includes("/regions/");
    expect(box!.y - (title!.y + title!.height)).toBeLessThan(hasNeighbourRow ? 80 : 24);
    expect(box!.y + box!.height).toBeLessThan(844);
  });
}

test("the GDP latest value follows the active indicator", async ({ page }) => {
  await page.goto("/explorer/economy/gdp");
  await ready(page);
  await page.getByTestId("gdp-tab-nominal").click();
  await expect(page.getByTestId("gdp-latest")).toHaveText(/^ნომინალური მშპ · \d{4}: \d+\.\d მლრდ ₾( · წინასწარი)?$/);
  await page.getByTestId("gdp-tab-growth").click();
  await expect(page.getByTestId("gdp-latest")).toHaveText(/^მშპ-ის ზრდა · \d{4}: [+−]\d+\.\d%( · წინასწარი)?$/);
});

for (const path of ["/explorer", "/explorer/economy", "/explorer/inflation", "/explorer/unemployment"]) {
  test(`${path} hub cards span their sparklines and keep one rhythm`, async ({ page }) => {
    await page.goto(path);
    for (const card of await page.getByTestId("hub-card").all()) {
      const cardBox = (await card.boundingBox())!;
      const graphic = card.locator("svg, [data-testid=hub-card-graphic-space]").first();
      const box = (await graphic.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(33);
      // The card has 18px of padding on each side.
      expect(box.width).toBeGreaterThan(cardBox.width - 40);
    }
  });
}

test("hub card names and the economy footer", async ({ page }) => {
  await page.goto("/explorer");
  await expect(page.getByTestId("hub-card").nth(3).getByRole("heading")).toHaveText("ანალიზი");
  await page.goto("/explorer/economy");
  await expect(page.getByTestId("hub-card").first().locator("p").last()).toHaveText(/^\d{4} · ნომინალური მშპ \d+\.\d მლრდ ₾$/);
});

test("/about opens on a compact cover and ends with a way into the data", async ({ page }) => {
  await page.goto("/about");
  expect((await page.getByTestId("mission-cover").boundingBox())!.height).toBeLessThanOrEqual(230);
  const explore = page.getByTestId("mission-explore");
  await expect(explore).toHaveText("გაეცანი მონაცემებს →");
  await expect(explore).toHaveAttribute("href", "/explorer");
  expect((await explore.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("/methodology rows keep the arrow on the title line", async ({ page }) => {
  await page.goto("/methodology");
  for (const row of await page.getByTestId("methodology-live-row").all()) {
    const title = (await row.getByRole("heading").boundingBox())!;
    const arrow = (await row.locator("span[aria-hidden=true]").last().boundingBox())!;
    expect(arrow.y).toBeLessThan(title.y + title.height);
    expect(arrow.x).toBeGreaterThan(title.x);
  }
});

for (const { path, more, guides } of [
  { path: "/connect", more: "მეტი მაგალითი", guides: ["Claude-ის ოფიციალური ინსტრუქცია", "Codex-ის ოფიციალური ინსტრუქცია"] },
  { path: "/en/connect", more: "More examples", guides: ["Claude official setup guide", "Codex official setup guide"] },
]) {
  test(`${path} keeps developer vocabulary behind toggles`, async ({ page }) => {
    await page.goto(path);
    const main = page.locator("main");
    expect(await main.innerText()).not.toMatch(/query_inflation|yoy_pct|entityIds/);
    const bilingual = page.getByTestId("connect-bilingual");
    await expect(bilingual.locator("li:visible")).toHaveCount(3);
    await page.getByTestId("connect-more-examples").getByText(more, { exact: true }).click();
    expect(await bilingual.locator("li:visible").count()).toBeGreaterThan(3);
    await page.getByTestId("connect-developer-details").locator("summary").click();
    await expect(page.getByTestId("connect-inflation-discovery")).toBeVisible();
    for (const name of guides) {
      const link = page.getByRole("link", { name, exact: true });
      await expect(link).toHaveCount(1);
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
}

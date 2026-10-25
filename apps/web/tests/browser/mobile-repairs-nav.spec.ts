import { expect, test, type Locator, type Page } from "@playwright/test";
import { DATASET_HUBS } from "../../lib/navigation/datasetHubs";

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
    const bar = page.getByTestId("sidebar-topbar");
    const toggle = page.getByTestId("sidebar-menu-button");
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

    // Every link and button of the menu, the language switch and the foot's links included (the old back-home row is the brand).
    for (const row of await heights(panel.locator("a, button"))) {
      expect(row.height, row.text).toBeGreaterThanOrEqual(44);
    }
    expect((await page.getByTestId("all-data-link").boundingBox())?.width ?? 0).toBeGreaterThan(300);
    // Demography is a live dataset link now (its 44px row is measured above), so no reduced-emphasis teaser row is left.
    await expect(panel.locator("[data-testid^=teaser-]")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });
}

test("tapping a menu link from mid-page closes the menu on arrival", async ({ page }) => {
  await page.goto("/explorer/expenditure");
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, 1500));
  const toggle = page.getByTestId("sidebar-menu-button");
  await toggle.click();
  await page.getByTestId("group-link-labour").click();
  await expect(page).toHaveURL(/\/explorer\/labour$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

for (const { path, menu, datasets, other } of [
  { path: "/", menu: "მენიუ", datasets: ["ბიუჯეტი", "ეკონომიკა და ბიზნესი", "ფასები და ფული", "შრომის ბაზარი", "ცხოვრების დონე და ჯანდაცვა", "საგარეო სექტორი", "დემოგრაფია", "საზოგადოება და გარემო"], other: "EN English" },
  { path: "/en", menu: "Menu", datasets: ["Budget", "Economy and business", "Prices and money", "Labour market", "Living standards and health", "External sector", "Demography", "Society and environment"], other: "KA ქართული" },
]) {
  test(`${path} ☰ menu lists every dataset as 44px rows`, async ({ page }) => {
    await page.goto(path);
    const header = page.getByTestId("landing-header");
    await header.getByRole("button", { name: menu, exact: true }).click();
    const group = header.getByTestId("menu-datasets");
    await expect(group.getByRole("link")).toHaveText(datasets);
    const hrefs = await group.getByRole("link").evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
    const prefix = path === "/en" ? "/en" : "";
    // The eight group pages (spec 2026-10-24-explorer-regroup).
    expect(hrefs).toEqual(DATASET_HUBS.map(({ href }) => `${prefix}${href}`));
    for (const row of await heights(header.getByRole("navigation").getByRole("link"))) expect(row.height, row.text).toBeGreaterThanOrEqual(44);
    // On a phone the link shows "EN"/"KA"; its name starts with that and adds the full language name.
    const switchBox = await header.getByRole("group").getByRole("link", { name: other, exact: true }).boundingBox();
    expect(switchBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(switchBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
}

// The hero CTA kept its 44px target only below 768px (U01-03); touch tablets sit above it.
for (const width of [390, 768, 1280]) test(`landing calls to action are 44px tap targets at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  const targets = [
    page.getByTestId("hero-cta"),
    page.locator("#sources").getByRole("link", { name: "მეთოდოლოგიის ნახვა →" }),
    page.locator("#ai").getByRole("link", { name: "AI-კავშირის ინსტრუქცია →" }),
  ];
  for (const target of targets) expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});

// Explorer pages have no footer; the homepage and the site's own pages carry the site footer (#221), whose data list is the groups.
for (const { path, labels } of [
  { path: "/", labels: [...["ბიუჯეტი", "ეკონომიკა და ბიზნესი", "ფასები და ფული", "შრომის ბაზარი", "ცხოვრების დონე და ჯანდაცვა", "საგარეო სექტორი", "დემოგრაფია", "საზოგადოება და გარემო"], "მეთოდოლოგია", "AI-კავშირი", "მიზანი", "English"] },
  { path: "/en", labels: [...["Budget", "Economy and business", "Prices and money", "Labour market", "Living standards and health", "External sector", "Demography", "Society and environment"], "Methodology", "AI connection", "About", "ქართული"] },
]) {
  test(`${path} footer names every group in two-column lists`, async ({ page }) => {
    await page.goto(path);
    const footer = page.getByTestId("site-footer");
    await expect(footer).toHaveAttribute("data-variant", "site");
    const nav = footer.locator("ul a");
    await expect(nav).toHaveText(labels);
    // The footer carries no tagline (owner decision 2026-10-08).
    await expect(footer).not.toContainText(path === "/en" ? "clear, verified, open" : "ნათლად, გადამოწმებულად, ღიად");
    const boxes = await nav.evaluateAll((links) => links.map((link) => link.getBoundingClientRect().toJSON() as DOMRect));
    for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
    expect(new Set(boxes.map((box) => Math.round(box.x))).size).toBe(2);
  });
}

// Explorer pages render no footer: the sidebar's foot links Methodology and AI connection.
test("/explorer/labour has no footer on a phone", async ({ page }) => {
  await page.goto("/explorer/labour");
  await ready(page);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
});

test("404 recovers to every dataset with no top band on a phone", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  const recovery = page.getByTestId("not-found-recovery");
  const hrefs = await recovery.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual(["/", ...DATASET_HUBS.map(({ href }) => href), "/methodology"]);
  expect((await recovery.boundingBox())?.y ?? 999).toBeLessThanOrEqual(40);
  await expect(page.locator('a[href="/sitemap.xml"], a[href="/llms.txt"]')).toHaveCount(0);
});

for (const { path, back, href, trail } of [
  { path: "/en/explorer/unemployment/regions/adjara", back: "Unemployment by region", href: "/en/explorer/unemployment/regions", trail: ["Home", "Data", "Unemployment", "Unemployment by region", "Adjara"] },
  { path: "/explorer/inflation/cities/batumi", back: "ქალაქები", href: "/explorer/inflation/cities", trail: null },
  // Budget's crumb leads to the Budget group page; /explorer is All data now.
  { path: "/explorer/expenditure", back: "ბიუჯეტი", href: "/explorer/budget", trail: ["მთავარი", "მონაცემები", "ბიუჯეტი", "ხარჯები"] },
]) {
  test(`${path}: one back-crumb on a phone, the full trail from 768px`, async ({ page }) => {
    await page.goto(path);
    const header = page.getByTestId("explorer-header");
    const jsonLd = await page.getByTestId("breadcrumb-json-ld").textContent();
    const landmark = path.startsWith("/en/") ? "Breadcrumb" : "ნავიგაციის ბილიკი";
    const crumb = header.getByRole("navigation", { name: landmark });
    await expect(crumb.getByRole("link")).toHaveCount(1);
    await expect(crumb.getByRole("link")).toHaveText(`←${back}`);
    await expect(crumb.getByRole("link")).toHaveAttribute("href", href);
    expect((await crumb.getByRole("link").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await header.boundingBox())?.height ?? 999).toBeLessThanOrEqual(80);

    await page.setViewportSize({ width: 1024, height: 800 });
    const full = header.getByRole("navigation", { name: landmark });
    await expect(full.locator("[aria-current=page]")).toHaveCount(1);
    if (trail) expect((await full.innerText()).split("/").map((part) => part.trim().toLowerCase())).toEqual(trail.map((part) => part.toLowerCase()));
    // Structured data is server-rendered once and does not depend on the width.
    expect(await page.getByTestId("breadcrumb-json-ld").textContent()).toBe(jsonLd);
  });
}

for (const path of ["/explorer/inflation/overview", "/explorer/economy/regions", "/explorer/economy/regions/adjara"]) {
  test(`${path} states coverage in the one shared format`, async ({ page }) => {
    await page.goto(path);
    const coverage = page.getByTestId("explorer-header").locator("p");
    await expect(coverage).toHaveText(/^\S+( \d{4})?–\S+( \d{4})? · განახლდა \d{4}-\d{2}-\d{2}$/);
  });
}

// All data and the group pages count their topics and pages instead (spec 2026-10-24-explorer-regroup §5, §6).
for (const path of ["/explorer", "/explorer/budget", "/explorer/economy", "/explorer/prices", "/explorer/labour"]) {
  test(`${path} states its pages and update date in the one shared format`, async ({ page }) => {
    await page.goto(path);
    const coverage = page.getByTestId("explorer-header").locator("p");
    await expect(coverage).toHaveText(/^(\d+ ქვეთემა · )?\d+ გვერდი · განახლდა \d{4}-\d{2}-\d{2}$/);
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

// Every group page renders the shared ExplorerCard, so the Budget page stands for them all.
test("group page cards span their graphics and keep one rhythm", async ({ page }) => {
  await page.goto("/explorer/budget");
  for (const card of await page.getByTestId("explorer-card").all()) {
    const cardBox = (await card.boundingBox())!;
    const box = (await card.getByTestId("explorer-card-graphic").boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(33);
    // The card has 18px of padding on each side.
    expect(box.width).toBeGreaterThan(cardBox.width - 40);
  }
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

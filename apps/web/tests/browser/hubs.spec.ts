import { expect, test, type Page } from "@playwright/test";

// The section hubs: rendered cards, their order and links, and where they lead.
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const ENERGY_FOOD_SECTIONS = ["energy-supply", "electricity", "energy-use", "food-self-sufficiency", "farming"] as const;

test("Economy links the delivered overview, national sectors, GDP by expenditure and regional economies", async ({ page }) => {
  await page.goto("/en/explorer/economy");
  const cards = page.getByTestId("economy-hub").getByTestId("hub-card");
  await expect(cards).toHaveCount(4);
  await expect(page.getByTestId("economy-hub").locator("a")).toHaveCount(4);
  await expect(page.getByTestId("economy-hub").locator('a[href="/en/explorer/economy/sectors"]')).toHaveCount(1);
  await expect(page.getByTestId("economy-hub").locator('a[href="/en/explorer/economy/expenditure"]')).toHaveCount(1);
  await expect(page.getByTestId("economy-hub").locator('a[href="/en/explorer/economy/regions"]')).toHaveCount(1);
  for (let index = 0; index < 4; index += 1) await expect(cards.nth(index).locator("svg")).toHaveCount(1);
  await expect(cards.nth(1)).toContainText("Top 3 sectors’ GDP share");
  await expect(cards.nth(2)).toContainText(/Households \d+\.\d% of GDP/);
  await expect(cards.nth(3)).toContainText("Total regional GDP (Current prices)");
  await page.getByTestId("economy-hub").locator('a[href="/en/explorer/economy/gdp"]').click();
  await expect(page.getByTestId("gdp-overview")).toBeVisible();
  await page.goto("/explorer/economy");
  for (let index = 0; index < 4; index += 1) await expect(cards.nth(index).locator("svg")).toHaveCount(1);
  await expect(cards.first().locator("p").last()).toHaveText(/^\d{4} · ნომინალური მშპ \d+\.\d მლრდ ₾$/);
  await expect(cards.nth(1)).toContainText("ტოპ 3-ის წილი მშპ-ში");
  await expect(cards.nth(2)).toContainText(/შინამეურნეობების მოხმარება მშპ-ის \d+\.\d%/);
  await expect(cards.nth(3)).toContainText("რეგიონის მთლიანი მშპ (მიმდინარე ფასები)");
});

test("the inflation hub links all four live sections and the sidebar reaches Overview and Categories", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/inflation");
  await expect(page.getByTestId("inflation-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("inflation-hub").getByTestId("hub-card")).toHaveCount(4);
  await expect(page.getByTestId("inflation-hub").locator("a")).toHaveCount(4);
  // Budget and Economy stay inactive; the footer names both publishers.
  await expect(page.getByTestId("section-link-expenditure")).toHaveCount(0);
  await expect(page.getByTestId("economy-link")).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByText("მონაცემები: საქსტატი და საქართველოს ეროვნული ბანკი", { exact: false })).toBeVisible();
  await page.getByTestId("inflation-hub").getByRole("link").first().click();
  await ready(page);
  await expect(page.getByTestId("inflation-overview-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("data-sidebar").getByText("მალე", { exact: true })).toHaveCount(0);

  // The Categories card reaches its page, and the sidebar leads back to Overview.
  await page.goto("/en/explorer/inflation");
  await page.getByRole("link", { name: "Categories", exact: true }).first().click();
  await ready(page);
  await expect(page).toHaveURL(/\/explorer\/inflation\/categories$|\/explorer\/inflation\/categories#/);
  await expect(page.getByTestId("inflation-categories-link")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("inflation-overview-link").click();
  await ready(page);
  await expect(page).toHaveURL(/\/explorer\/inflation\/overview/);
});

test("the living standards hub lists Income, Spending, Poverty and Inequality in that order", async ({ page }) => {
  await page.goto("/en/explorer/living-standards");
  const hub = page.getByTestId("living-standards-hub");
  const links = hub.locator("a");
  await expect(links).toHaveCount(4);
  expect(await links.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual(["income", "spending", "poverty", "inequality"].map(page => `/en/explorer/living-standards/${page}`));
  for (const [index, title] of ["Income", "Spending", "Poverty", "Inequality"].entries()) {
    await expect(links.nth(index)).toContainText(`0${index + 1}`);
    await expect(links.nth(index)).toContainText(title);
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Living standards");
  // The Georgian hub links the same pages without the /en prefix (moved from poverty.spec.ts).
  await page.goto("/explorer/living-standards");
  await expect(hub.locator("a")).toHaveCount(4);
  await expect(hub.locator("a").nth(2)).toHaveAttribute("href", "/explorer/living-standards/poverty");
});

// The rendered wages hub, in English, where its links carry the /en prefix (moved from wages.spec.ts).
test("the wages hub links its three pages", async ({ page }) => {
  await page.goto("/en/explorer/wages");
  const hub = page.getByTestId("wages-hub");
  await expect(hub.locator("a")).toHaveCount(3);
  await expect(hub.locator("a").first()).toHaveAttribute("href", "/en/explorer/wages/overview");
});

test("the energy and food hub shows one card per page, each linking to it", async ({ page }) => {
  await page.goto("/explorer/energy-food");
  const cards = page.getByTestId("energy-food-hub").locator("a");
  await expect(cards).toHaveCount(ENERGY_FOOD_SECTIONS.length);
  for (const [index, section] of ENERGY_FOOD_SECTIONS.entries()) await expect(cards.nth(index)).toHaveAttribute("href", `/explorer/energy-food/${section}`);
});

test("the health hub shows one card per page, each linking to it, and the sidebar lists Health after Living standards", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/health`);
    const cards = page.getByTestId("health-hub").locator("a");
    await expect(cards).toHaveCount(3);
    expect(await cards.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual(["doctors-hospitals", "illnesses", "causes-of-death"].map(section => `${prefix}/explorer/health/${section}`));
    for (let index = 0; index < 3; index += 1) await expect(cards.nth(index).locator("svg")).toHaveCount(1);
    const entry = page.getByTestId("health-link");
    await expect(entry).toHaveAttribute("aria-current", "page");
    expect(await page.getByTestId("living-standards-link").evaluate((living, health) => Boolean(living.compareDocumentPosition(health!) & Node.DOCUMENT_POSITION_FOLLOWING), await entry.elementHandle())).toBe(true);
    for (const id of ["doctors-hospitals", "illnesses", "causes-of-death"]) await expect(page.getByTestId(`health-${id}-link`)).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Health and social protection");
  await expect(page.getByTestId("health-hub").locator("a").first()).toContainText("2025 · 22,491 · 2002–2025");
});

test("the crime hub shows one card per page, each linking to it, and the sidebar lists Crime and justice after Health", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sections = ["recorded", "convictions", "prisons", "victims", "road-accidents"];
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/crime`);
    const cards = page.getByTestId("crime-hub").locator("a");
    await expect(cards).toHaveCount(5);
    expect(await cards.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual(sections.map(section => `${prefix}/explorer/crime/${section}`));
    for (let index = 0; index < 5; index += 1) await expect(cards.nth(index).locator("svg")).toHaveCount(1);
    const entry = page.getByTestId("crime-link");
    await expect(entry).toHaveAttribute("aria-current", "page");
    expect(await page.getByTestId("health-link").evaluate((health, crime) => Boolean(health.compareDocumentPosition(crime!) & Node.DOCUMENT_POSITION_FOLLOWING), await entry.elementHandle())).toBe(true);
    for (const id of sections) await expect(page.getByTestId(`crime-${id}-link`)).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Crime and justice");
  await expect(page.getByTestId("crime-hub").locator("a").first()).toContainText("2025 · 54,134 · 2015–2025");
});

test("the housing hub shows one card per page, each linking to it, and the sidebar lists Housing after Business", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/housing`);
    const cards = page.getByTestId("housing-hub").locator("a");
    await expect(cards).toHaveCount(4);
    expect(await cards.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual(["permits", "completed", "prices", "regions"].map(section => `${prefix}/explorer/housing/${section}`));
    // Three sparklines; Regions shows only its years.
    for (let index = 0; index < 3; index += 1) await expect(cards.nth(index).locator("svg")).toHaveCount(1);
    const entry = page.getByTestId("housing-link");
    await expect(entry).toHaveAttribute("aria-current", "page");
    expect(await page.getByTestId("business-link").evaluate((business, housing) => Boolean(business.compareDocumentPosition(housing!) & Node.DOCUMENT_POSITION_FOLLOWING), await entry.elementHandle())).toBe(true);
    for (const id of ["permits", "completed", "prices", "regions"]) await expect(page.getByTestId(`housing-${id}-link`)).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Housing and construction");
  await expect(page.getByTestId("housing-hub").locator("a").first()).toContainText("2025 · 11,578 · 2006–2025");
  await expect(page.getByTestId("housing-hub").locator("a").nth(2)).toContainText("2025 · 159.4 · 2020–2025");
  await expect(page.getByTestId("housing-hub").locator("a").nth(3)).toContainText("2006–2025");
});

// One hub test for the five external pages (moved from the 18 page-spec defaults runs): count, hrefs and a click to each.
for (const prefix of ["", "/en"]) {
  test(`the external hub links Money from abroad, Foreign investment, Current account, Foreign debt and Reserves ${prefix || "ka"}`, async ({ page }) => {
    for (const [index, slug] of ["money-from-abroad", "foreign-investment", "current-account", "foreign-debt", "reserves"].entries()) {
      await page.goto(`${prefix}/explorer/external`);
      const cards = page.getByTestId("external-hub").getByTestId("hub-card");
      await expect(cards).toHaveCount(5);
      await expect(cards.nth(index)).toHaveAttribute("href", new RegExp(`${prefix}/explorer/external/${slug}$`));
      await cards.nth(index).click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/external/${slug}$`));
      await ready(page);
      await expect(page.getByTestId(slug)).toBeVisible();
    }
  });
}

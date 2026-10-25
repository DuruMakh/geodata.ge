import { expect, test, type Locator, type Page } from "@playwright/test";
import { cardFigure, topicCards } from "./group-cards";

// The topics' cards on their group pages (each old topic hub is a section `#t-{topic}` of its group page now): rendered
// cards, their order and links, and where they lead.
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const ENERGY_FOOD_SECTIONS = ["energy-supply", "electricity", "energy-use", "food-self-sufficiency", "farming"] as const;
const hrefs = (cards: Locator) => cards.evaluateAll(elements => elements.map(element => element.getAttribute("href")));
/** The card's own chart: the graphic band's drawing. */
const chart = (card: Locator) => card.getByTestId("explorer-card-graphic").locator("svg");
/** Whether `later` comes after `earlier` in the page. */
const follows = async (earlier: Locator, later: Locator) => earlier.evaluate((first, second) => Boolean(first.compareDocumentPosition(second!) & Node.DOCUMENT_POSITION_FOLLOWING), await later.elementHandle());

test("Economy links the delivered overview, national sectors, GDP by expenditure and regional economies", async ({ page }) => {
  await page.goto("/en/explorer/economy");
  const cards = topicCards(page, "economy");
  await expect(cards).toHaveCount(4);
  expect(await hrefs(cards)).toEqual(["gdp", "sectors", "expenditure", "regions"].map(section => `/en/explorer/economy/${section}`));
  for (let index = 0; index < 3; index += 1) await expect(chart(cards.nth(index))).toHaveCount(1);
  // Regional economies draws its regions' spread instead of a line.
  await expect(cards.nth(3).getByTestId("region-spread-dot").first()).toBeAttached();
  await expect(cards.nth(1)).toContainText("Top 3 sectors’ GDP share");
  await expect(cards.nth(2)).toContainText(/\d+\.\d%Household consumption/);
  await expect(cards.nth(3)).toContainText("11 regions");
  await cards.first().click();
  await expect(page.getByTestId("gdp-overview")).toBeVisible();
  await page.goto("/explorer/economy");
  for (let index = 0; index < 3; index += 1) await expect(chart(cards.nth(index))).toHaveCount(1);
  // The GDP overview page's line: real GDP in US dollars.
  await expect(cards.first()).toContainText(/\d+\.\d მლრდ აშშ დოლარირეალური მშპ · \d{4}/);
  await expect(cards.nth(1)).toContainText("ტოპ 3-ის წილი მშპ-ში");
  await expect(cards.nth(2)).toContainText(/\d+\.\d%შინამეურნეობების მოხმარება/);
  await expect(cards.nth(3)).toContainText("11 რეგიონი");
});

test("the inflation section links all four live pages and the sidebar reaches Overview and Categories", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/prices");
  await expect(page.getByTestId("group-link-prices")).toHaveAttribute("aria-current", "page");
  await expect(topicCards(page, "inflation")).toHaveCount(4);
  // Budget and Economy stay closed and inactive; the group page has no footer.
  await expect(page.getByTestId("section-link-expenditure")).toHaveCount(0);
  await expect(page.getByTestId("group-link-economy")).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await topicCards(page, "inflation").first().click();
  await ready(page);
  await expect(page.getByTestId("inflation-overview-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("data-sidebar").getByText("მალე", { exact: true })).toHaveCount(0);

  // The Categories card reaches its page, and the sidebar leads back to Overview.
  await page.goto("/en/explorer/prices");
  await topicCards(page, "inflation").getByRole("heading", { name: "Categories", exact: true }).click();
  await ready(page);
  await expect(page).toHaveURL(/\/explorer\/inflation\/categories$|\/explorer\/inflation\/categories#/);
  await expect(page.getByTestId("inflation-categories-link")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("inflation-overview-link").click();
  await ready(page);
  await expect(page).toHaveURL(/\/explorer\/inflation\/overview/);
});

test("the living standards section lists Income, Spending, Poverty and Inequality in that order", async ({ page }) => {
  await page.goto("/en/explorer/living");
  const links = topicCards(page, "living-standards");
  await expect(links).toHaveCount(4);
  expect(await hrefs(links)).toEqual(["income", "spending", "poverty", "inequality"].map(page => `/en/explorer/living-standards/${page}`));
  for (const [index, title] of ["Income", "Spending", "Poverty", "Inequality"].entries()) {
    await expect(links.nth(index)).toContainText(`0${index + 1}`);
    await expect(links.nth(index)).toContainText(title);
  }
  await expect(page.locator("#t-living-standards").getByRole("heading", { level: 2 })).toHaveText("Living standards");
  // The Georgian section links the same pages without the /en prefix (moved from poverty.spec.ts).
  await page.goto("/explorer/living");
  await expect(links).toHaveCount(4);
  await expect(links.nth(2)).toHaveAttribute("href", "/explorer/living-standards/poverty");
});

// The rendered wages section, in English, where its links carry the /en prefix (moved from wages.spec.ts).
test("the wages section links its three pages", async ({ page }) => {
  await page.goto("/en/explorer/labour");
  const cards = topicCards(page, "wages");
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toHaveAttribute("href", "/en/explorer/wages/overview");
});

test("the energy and food section shows one card per page, each linking to it", async ({ page }) => {
  await page.goto("/explorer/society");
  const cards = topicCards(page, "energy-food");
  await expect(cards).toHaveCount(ENERGY_FOOD_SECTIONS.length);
  for (const [index, section] of ENERGY_FOOD_SECTIONS.entries()) await expect(cards.nth(index)).toHaveAttribute("href", `/explorer/energy-food/${section}`);
});

test("the health section shows one card per page, each linking to it, and the sidebar lists Health after Living standards", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Health's three pages, then the five social protection pages (tests/browser/social.spec.ts).
  const sections = ["doctors-hospitals", "illnesses", "causes-of-death", "social-payments", "pensions", "subsistence-allowance", "social-package", "funded-pension"];
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/living`);
    const cards = topicCards(page, "health");
    await expect(cards).toHaveCount(8);
    expect(await hrefs(cards)).toEqual(sections.map(section => `${prefix}/explorer/health/${section}`));
    for (let index = 0; index < 8; index += 1) await expect(chart(cards.nth(index))).toHaveCount(1);
    await expect(page.getByTestId("group-link-living")).toHaveAttribute("aria-current", "page");
    expect(await follows(page.getByTestId("living-standards-inequality-link"), page.getByTestId("health-doctors-hospitals-link"))).toBe(true);
    for (const id of sections) await expect(page.getByTestId(`health-${id}-link`)).toBeVisible();
  }
  await expect(page.locator("#t-health").getByRole("heading", { level: 2 })).toHaveText("Health and social protection");
  await expect(topicCards(page, "health").first()).toHaveAccessibleDescription(cardFigure("22,491", "2025", "2002–2025", "Doctors"));
  await expect(topicCards(page, "health").last()).toHaveAccessibleDescription(cardFigure("8.24 billion GEL", "2025", "2019–2025"));
});

test("the crime section shows one card per page, each linking to it, and the sidebar lists Crime and justice after Science and culture", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sections = ["recorded", "convictions", "prisons", "victims", "road-accidents"];
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/society`);
    const cards = topicCards(page, "crime");
    await expect(cards).toHaveCount(5);
    expect(await hrefs(cards)).toEqual(sections.map(section => `${prefix}/explorer/crime/${section}`));
    for (let index = 0; index < 5; index += 1) await expect(chart(cards.nth(index))).toHaveCount(1);
    await expect(page.getByTestId("group-link-society")).toHaveAttribute("aria-current", "page");
    expect(await follows(page.getByTestId("science-culture-theatres-link"), page.getByTestId("crime-recorded-link"))).toBe(true);
    for (const id of sections) await expect(page.getByTestId(`crime-${id}-link`)).toBeVisible();
  }
  await expect(page.locator("#t-crime").getByRole("heading", { level: 2 })).toHaveText("Crime and justice");
  await expect(topicCards(page, "crime").first()).toHaveAccessibleDescription(cardFigure("54,134", "2025", "2015–2025"));
});

test("the internet section shows one card per page, each linking to it, and the sidebar lists Internet and technology after Crime and justice", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sections = ["homes", "users", "online", "devices"];
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/society`);
    const cards = topicCards(page, "internet");
    await expect(cards).toHaveCount(4);
    expect(await hrefs(cards)).toEqual(sections.map(section => `${prefix}/explorer/internet/${section}`));
    for (let index = 0; index < 4; index += 1) await expect(chart(cards.nth(index))).toHaveCount(1);
    expect(await follows(page.getByTestId("crime-road-accidents-link"), page.getByTestId("internet-homes-link"))).toBe(true);
    for (const id of sections) await expect(page.getByTestId(`internet-${id}-link`)).toBeVisible();
  }
  await expect(page.locator("#t-internet").getByRole("heading", { level: 2 })).toHaveText("Internet and technology");
  await expect(topicCards(page, "internet").first()).toHaveAccessibleDescription(cardFigure("93.5%", "2026", "2016–2026"));
});

test("the housing section shows one card per page, each linking to it, and the sidebar lists Housing after Business", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/economy`);
    const cards = topicCards(page, "housing");
    await expect(cards).toHaveCount(4);
    expect(await hrefs(cards)).toEqual(["permits", "completed", "prices", "regions"].map(section => `${prefix}/explorer/housing/${section}`));
    // Three sparklines; Regions shows its regions' spread.
    for (let index = 0; index < 3; index += 1) await expect(chart(cards.nth(index))).toHaveCount(1);
    await expect(page.getByTestId("group-link-economy")).toHaveAttribute("aria-current", "page");
    expect(await follows(page.getByTestId("business-regions-link"), page.getByTestId("housing-permits-link"))).toBe(true);
    for (const id of ["permits", "completed", "prices", "regions"]) await expect(page.getByTestId(`housing-${id}-link`)).toBeVisible();
  }
  await expect(page.locator("#t-housing").getByRole("heading", { level: 2 })).toHaveText("Housing and construction");
  const cards = topicCards(page, "housing");
  await expect(cards.first()).toHaveAccessibleDescription(cardFigure("11,578", "2025", "2006–2025"));
  await expect(cards.nth(2)).toHaveAccessibleDescription(cardFigure("159.4", "2025 Q4", "2020–2025", "Index (2020 = 100)"));
  await expect(cards.nth(3)).toContainText("2006–2025");
});

test("the transport section shows one card per page, each linking to it, and the sidebar lists Transport after Environment and climate", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sections = ["vehicles", "vehicle-age", "passengers", "freight", "regions"];
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/society`);
    const cards = topicCards(page, "transport");
    await expect(cards).toHaveCount(5);
    expect(await hrefs(cards)).toEqual(sections.map(section => `${prefix}/explorer/transport/${section}`));
    // Four sparklines; Regions shows its regions' spread.
    for (let index = 0; index < 4; index += 1) await expect(chart(cards.nth(index))).toHaveCount(1);
    expect(await follows(page.getByTestId("environment-forests-link"), page.getByTestId("transport-vehicles-link"))).toBe(true);
    for (const id of sections) await expect(page.getByTestId(`transport-${id}-link`)).toBeVisible();
  }
  await expect(page.locator("#t-transport").getByRole("heading", { level: 2 })).toHaveText("Transport");
  const cards = topicCards(page, "transport");
  await expect(cards.first()).toHaveAccessibleDescription(cardFigure("1.65 million", "2025", "2000–2025", "Passenger cars"));
  await expect(cards.nth(1)).toHaveAccessibleDescription(cardFigure("1.32 million", "2025", "2017–2025", "Cars over 10 years old"));
  await expect(cards.nth(4)).toContainText("2017–2025");
});

// One test for the five external pages (moved from the 18 page-spec defaults runs): count, hrefs and a click to each.
for (const prefix of ["", "/en"]) {
  test(`the external flows section links Money from abroad, Foreign investment, Current account, Foreign debt and Reserves ${prefix || "ka"}`, async ({ page }) => {
    for (const [index, slug] of ["money-from-abroad", "foreign-investment", "current-account", "foreign-debt", "reserves"].entries()) {
      await page.goto(`${prefix}/explorer/external`);
      const cards = topicCards(page, "external");
      await expect(cards).toHaveCount(5);
      await expect(cards.nth(index)).toHaveAttribute("href", new RegExp(`${prefix}/explorer/external/${slug}$`));
      await cards.nth(index).click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/external/${slug}$`));
      await ready(page);
      await expect(page.getByTestId(slug)).toBeVisible();
    }
  });
}

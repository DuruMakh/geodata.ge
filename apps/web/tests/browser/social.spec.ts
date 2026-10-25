import { expect, test, type Page } from "@playwright/test";
import { topicCards } from "./group-cards";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const toggle = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const pressedRows = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
const HEALTH = ["doctors-hospitals", "illnesses", "causes-of-death"];
const SOCIAL = ["social-payments", "pensions", "subsistence-allowance", "social-package", "funded-pension"];

/** The table cell of the series labelled `label` in `year`, in either layout: year columns, or (a narrow table of up to three series) year rows. */
async function cell(page: Page, label: string, year: string) {
  const table = page.getByTestId("explorer-table");
  const headers = (await table.locator("thead th").allInnerTexts()).map(text => text.trim());
  const yearRow = (await table.getAttribute("data-layout")) === "rows";
  const column = headers.findIndex(text => yearRow ? text.includes(label) : text.startsWith(year));
  expect(column, `${label} ${year}`).toBeGreaterThan(0);
  const heading = yearRow ? new RegExp(`^${year}`) : label;
  // The row's label is its <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { has: page.locator("th", { hasText: heading }) }).locator("td").nth(column - 1);
}

/** The Excel button's download: its suggested file name. */
async function downloadName(page: Page) {
  const promise = page.waitForEvent("download");
  await page.getByTestId("social-excel-download").click();
  return (await promise).suggestedFilename();
}

/** How many lines an element's text takes. */
const lines = (page: Page, testId: string) => page.getByTestId(testId).evaluate(element => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight));

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

// The old Health hub is the section #t-health of the Living standards and health page now.
test("the Health section shows eight cards, the five social protection cards after Causes of death", async ({ page }) => {
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/living`);
    const cards = topicCards(page, "health");
    await expect(cards).toHaveCount(8);
    expect(await cards.evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual([...HEALTH, ...SOCIAL].map(section => `${prefix}/explorer/health/${section}`));
    for (let index = 0; index < 8; index += 1) await expect(cards.nth(index).getByTestId("explorer-card-graphic").locator("svg")).toHaveCount(1);
    await expect(cards.nth(7)).toContainText("08");
    await expect(cards.nth(7)).toContainText("2019–2025");
    await expect(cards.nth(3)).toContainText("04");
    await expect(cards.nth(3)).toContainText("2013–2025");
    // The sidebar lists the five pages under Health, after Causes of death.
    for (const section of SOCIAL) await expect(page.getByTestId(`health-${section}-link`)).toBeVisible();
    expect(await page.getByTestId("health-causes-of-death-link").evaluate((causes, payments) => Boolean(causes.compareDocumentPosition(payments!) & Node.DOCUMENT_POSITION_FOLLOWING), await page.getByTestId("health-social-payments-link").elementHandle())).toBe(true);
  }
});

test("Social payments: one row, the 6.17 billion line, the % of GDP switch and COVID-19's partial years", async ({ page }) => {
  await page.goto("/explorer/health/social-payments");
  await ready(page);
  await expect(page.getByTestId("social-latest")).toContainText("6.17");
  await expect(page.getByTestId("social-latest")).toContainText("2025");
  await expect(pressedRows(page)).toHaveCount(1);
  await expect(page.locator(toggle("social.payments.total.amount"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-row")).toHaveCount(19);
  await expect(page.getByTestId("series-heading")).toHaveText(["გაცემული თანხა · მლნ ლარი"]);
  // No tab row: the only switch is the icon pair.
  await expect(page.locator('[role="tablist"]')).toHaveCount(0);
  await expect(page.getByTestId("social-measure-gdp").locator("svg")).toHaveCount(1);
  await page.getByTestId("social-measure-gdp").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-view", "gdp");
  await expect(page.getByTestId("social-unit-label")).toHaveText("მშპ-ის %");
  await expect(page.getByTestId("source-label")).toContainText("მშპ");
  // The line keeps the money headline.
  await expect(page.getByTestId("social-latest")).toContainText("6.17");
  const share = Number((await page.locator('[data-testid="series-row"][data-series-id="social.payments.total.amount"]').innerText()).match(/(\d+\.\d+)/)![1]);
  expect(share).toBeGreaterThan(0);
  expect(share).toBeLessThan(20);
  await page.getByTestId("chart-mode-table").click();
  await expect(await cell(page, "გაცემული თანხა — ყველა პროგრამა", "2025")).toHaveText(/^\d{1,2}\.\d{2}%$/);
  await expect(page).toHaveURL(/#tab=gdp&view=table&sel=social\.payments\.total\.amount&range=all$/);
  // COVID-19 compensation ran six months in each of 2020 and 2021: the table marks the year.
  await page.getByTestId("social-measure-amount").click();
  await page.locator(toggle("social.payments.covid_vulnerable_compensation.amount")).click();
  await expect(pressedRows(page)).toHaveCount(2);
  await expect(await cell(page, "გაცემული თანხა — კორონავირუსით გამოწვეული ზიანის კომპენსაცია", "2020")).toContainText("6 თვე");
  await expect(await cell(page, "გაცემული თანხა — კორონავირუსით გამოწვეული ზიანის კომპენსაცია", "2019")).toHaveText("—");
  await expect(await cell(page, "გაცემული თანხა — ყველა პროგრამა", "2020")).not.toContainText("თვე");
});

test("the Pensions index draws the map, lists Georgia first and opens Tbilisi's region page", async ({ page }) => {
  await page.goto("/explorer/health/pensions");
  await ready(page);
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(1);
  await page.getByTestId("level-region").click();
  const rows = page.getByTestId("municipal-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toContainText("საქართველო");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/health/pensions/georgia");
  await page.getByTestId("municipality-marker-04").click();
  await expect(page).toHaveURL(/\/explorer\/health\/pensions\/region\/tbilisi$/);
  await ready(page);
  await expect(page.getByTestId("entity-picker-trigger")).toHaveText("თბილისი");
});

test("the Pensions municipalities tab lists Georgia first, finds it by name, keeps every bar within its track and opens Georgia's page", async ({ page }) => {
  await page.goto("/explorer/health/pensions");
  await ready(page);
  const rows = page.getByTestId("municipal-list-row");
  // Georgia, then the 64 municipalities; the count beside the search counts the municipalities only.
  await expect(rows).toHaveCount(65);
  await expect(page.getByTestId("row-count")).toHaveText("64");
  await expect(rows.first().getByTestId("municipal-row-name")).toHaveText("საქართველო");
  await expect(rows.first().locator("span").first()).toHaveText("—");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/health/pensions/georgia");
  // A share: Georgia's is below the highest municipality's, so the bars scale to that municipality, and none passes 100%.
  const widths = await rows.getByTestId("municipal-row-bar").evaluateAll((bars) => bars.map((bar) => Number.parseFloat((bar as HTMLElement).style.width)));
  expect(Math.max(...widths)).toBe(100);
  expect(widths[0]).toBeLessThan(100);
  await page.getByTestId("municipal-search").fill("საქართველო");
  await expect(rows).toHaveCount(1);
  await rows.first().click();
  await expect(page).toHaveURL(/\/explorer\/health\/pensions\/georgia$/);
});

test("Guria's Pensions page: the latest line, four headings, one heading at a time, 2025 prices and the next region", async ({ page }) => {
  await page.goto("/en/explorer/health/pensions/region/guria");
  await ready(page);
  // The heading's picker names the place, so the line under it does not (one phone line).
  await expect(page.getByTestId("entity-picker-trigger")).toHaveText("Guria");
  await expect(page.getByTestId("social-latest")).toHaveText(/^2025: [\d,]+ pensioners$/);
  await expect(page.getByTestId("social-latest")).not.toContainText("Guria");
  await expect(page.getByTestId("series-heading")).toHaveText([/^Pensioners$/, /^Share of residents/, /^Money paid/, /^Average per month/]);
  await expect(pressedRows(page)).toHaveCount(1);
  await expect(page.locator(toggle("social.pension.recipients"))).toHaveAttribute("aria-pressed", "true");
  // The share of residents reads as the map prints it.
  await expect(page.locator('[data-testid="series-row"][data-series-id="social.pension.recipients#share"]')).toContainText(/\d+\.\d%/);
  // Ticking Money paid → State pension replaces Pensioners.
  await page.locator(toggle("social.pension.amount")).click();
  await expect(pressedRows(page)).toHaveCount(1);
  await expect(page.locator(toggle("social.pension.recipients"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-heading", "money");
  // Ticking Average → Average pension at 2025 prices shows a value.
  await page.locator(toggle("social.pension.avg_monthly#real")).click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-heading", "average");
  await expect(page.locator('[data-testid="series-row"][data-series-id="social.pension.avg_monthly#real"]')).toContainText(/\d+\.\d{2}/);
  await expect(page.getByTestId("chart-panel").locator('svg[role="img"]:visible')).toHaveCount(1);
  // The next link opens the next region with the selection.
  const navigation = page.getByTestId("municipal-entity-navigation");
  await expect(navigation.getByRole("link")).toHaveText(["← Adjara", "Imereti →"]);
  await navigation.getByRole("link").last().click();
  await expect(page).toHaveURL(/\/en\/explorer\/health\/pensions\/region\/imereti#view=line&sel=social\.pension\.avg_monthly%23real&range=all$/);
  await ready(page);
  await expect(page.locator(toggle("social.pension.avg_monthly#real"))).toHaveAttribute("aria-pressed", "true");
});

test("Georgia's Subsistence allowance page draws the 2022 counting change, and the employment programme starts in 2022", async ({ page }) => {
  await page.goto("/explorer/health/subsistence-allowance/georgia");
  await ready(page);
  await expect(page.locator(toggle("social.subsistence.families"))).toHaveAttribute("aria-pressed", "true");
  const breaks = page.getByTestId("chart-panel").getByTestId("chart-break");
  await expect(breaks).toHaveCount(1);
  await expect(breaks).toContainText("ახალი აღრიცხვა");
  await page.getByTestId("chart-mode-table").click();
  // The year's header carries the mark, in either table layout.
  await expect(page.getByTestId("explorer-table").locator("th", { hasText: /^2022/ })).toContainText("ახალი აღრიცხვა");
  // Kept on it through the employment programme: a dash before 2022, a figure from 2022.
  await page.locator(toggle("social.subsistence.employment_families")).click();
  await expect(pressedRows(page)).toHaveCount(2);
  const employment = "ოჯახები — შემწეობაზე დარჩენილი დასაქმების პროგრამით";
  await expect(await cell(page, employment, "2021")).toHaveText("—");
  await expect(await cell(page, employment, "2022")).toHaveText(/^\d{1,3}(,\d{3})*$/);
});

test("Georgia's Subsistence allowance page lists the age groups last, unselected, and charts two of them", async ({ page }) => {
  await page.goto("/explorer/health/subsistence-allowance/georgia");
  await ready(page);
  await expect(page.getByTestId("series-heading").last()).toHaveText(/^ასაკობრივი ჯგუფები/);
  const ages = page.locator('[data-testid="series-row"][data-series-id^="social.subsistence.persons_age_"]');
  await expect(ages).toHaveCount(8);
  await expect(ages.first()).toContainText("0–6 წლის");
  await expect(ages.first()).toContainText("47,751");
  await expect(pressedRows(page)).toHaveCount(1);
  await expect(page.locator(toggle("social.subsistence.families"))).toHaveAttribute("aria-pressed", "true");
  // Ticking an age group replaces Families; a second adds to it, under the same heading.
  await page.locator(toggle("social.subsistence.persons_age_0_6")).click();
  await page.locator(toggle("social.subsistence.persons_age_70_plus")).click();
  await expect(pressedRows(page)).toHaveCount(2);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-heading", "ages");
  await expect(page.getByTestId("social-unit-label")).toHaveText("ადამიანი");
  await page.getByTestId("chart-mode-table").click();
  await expect(await cell(page, "0–6 წლის", "2025")).toHaveText("47,751");
});

test("Social package: the 2025 group redesign is drawn when Other groups is ticked", async ({ page }) => {
  await page.goto("/explorer/health/social-package");
  await ready(page);
  await expect(page.locator(toggle("social.social_package.total.recipients"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("social-measure-gdp")).toHaveCount(0);
  await expect(page.getByTestId("chart-panel").getByTestId("chart-break")).toHaveCount(0);
  await page.locator(toggle("social.social_package.other.recipients")).click();
  await expect(pressedRows(page)).toHaveCount(2);
  await expect(page.getByTestId("chart-panel").getByTestId("chart-break")).toHaveCount(1);
  await expect(page.getByTestId("chart-panel").getByTestId("chart-break")).toContainText("ახალი აღრიცხვა");
});

test("Funded pension: the 8.24 billion line, savings first, the % of GDP switch only on money headings, the 2022 loss", async ({ page }) => {
  await page.goto("/en/explorer/health/funded-pension");
  await ready(page);
  await expect(page.getByTestId("social-latest")).toHaveText("2025: 8.24 billion GEL in pension savings");
  await expect(pressedRows(page)).toHaveCount(1);
  await expect(page.locator(toggle("social.funded_pension.savings.amount"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[role="tablist"]')).toHaveCount(0);
  const headings = page.getByTestId("series-heading");
  await expect(headings).toHaveCount(5);
  for (const [index, name] of ["Savings, end of year", "Money in and out", "Members", "Employers", "Return"].entries()) await expect(headings.nth(index)).toContainText(name);
  // The switch shows on the money headings; ticking Members leaves the view at amount and drops it from the address.
  await expect(page.getByTestId("social-measure-gdp")).toBeVisible();
  await page.getByTestId("social-measure-gdp").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-view", "gdp");
  await expect(page).toHaveURL(/#tab=gdp&/);
  await page.locator(toggle("social.funded_pension.members")).click();
  await expect(pressedRows(page)).toHaveCount(1);
  await expect(page.locator(toggle("social.funded_pension.members"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("social-measure-gdp")).toHaveCount(0);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-view", "amount");
  await expect(page).not.toHaveURL(/tab=gdp/);
  // Securities lost money in 2022 and the statements print nothing for 2019: the table shows the loss and the empty-cell marker.
  await page.goto("/en/explorer/health/funded-pension#view=table&sel=social.funded_pension.securities_gains.amount&range=all");
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(await cell(page, "Gains or losses on securities", "2022")).toHaveText("−31.2");
  await expect(await cell(page, "Gains or losses on securities", "2019")).toHaveText("—");
});

test("the language switch keeps the hash on Guria's Pensions page and on Social payments", async ({ page }) => {
  const placeHash = "#view=table&sel=social.pension.amount&start=2016&end=2024";
  await page.goto(`/explorer/health/pensions/region/guria${placeHash}`);
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/health\/pensions\/region\/guria#view=table&sel=social\.pension\.amount&start=2016&end=2024$/);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(toggle("social.pension.amount"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("explorer-table")).toContainText("Money paid — State pension");

  const topicHash = "#tab=gdp&view=table&sel=social.payments.total.amount%2Csocial.payments.pension.amount&range=all";
  await page.goto(`/explorer/health/social-payments${topicHash}`);
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/health\/social-payments#tab=gdp&view=table&sel=social\.payments\.total\.amount%2Csocial\.payments\.pension\.amount&range=all$/);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-view", "gdp");
  await expect(pressedRows(page)).toHaveCount(2);
  await expect(page.getByTestId("social-unit-label")).toHaveText("% of GDP");
  await expect(page.getByTestId("social-latest")).toHaveText("2025: 6.17 billion GEL paid in social benefits");
});

test("Excel downloads a workbook on a place page and on Social payments", async ({ page }) => {
  await page.goto("/explorer/health/pensions/region/guria");
  await ready(page);
  expect(await downloadName(page)).toMatch(/^fiscal-social-pensions-region-guria-\d{4}-\d{4}\.xlsx$/);
  await page.goto("/en/explorer/health/social-payments");
  await ready(page);
  expect(await downloadName(page)).toMatch(/^fiscal-social-payments-2013-2025-en\.xlsx$/);
});

for (const prefix of ["", "/en"]) test(`social protection pages fit a 390px screen with one-line latest lines ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  // The place pages include the longest region names and a long municipality name, on both sets.
  const places = ["/region/racha_lechkhumi_kvemo_svaneti", "/region/samegrelo_zemo_svaneti", "/dedoplistskaro", "/georgia"];
  const paths = ["", "/social-payments", "/pensions", "/subsistence-allowance", "/pensions/region/guria", "/social-package", "/funded-pension", ...["/pensions", "/subsistence-allowance"].flatMap(set => places.map(place => `${set}${place}`))];
  for (const path of paths.map(path => `/explorer/health${path}`)) {
    await page.goto(`${prefix}${path}`);
    if (path === "/explorer/health") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
      continue;
    }
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
    expect(await lines(page, "social-latest"), path).toBeLessThanOrEqual(1.1);
  }
  expect(errors).toEqual([]);
});

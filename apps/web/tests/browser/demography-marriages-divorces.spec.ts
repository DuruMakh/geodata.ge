import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

const PATH = "/explorer/demography/marriages-divorces";
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const toggle = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const pressed = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');

test.describe("marriages and divorces page", () => {
  test("loads in both languages with marriages and divorces selected", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/en${PATH}`);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Marriages and divorces");
    await expect(page.getByTestId("marriage-latest")).toHaveText("2025: 22,285 marriages, 13,173 divorces");
    await expect(pressed(page)).toHaveCount(2);
    for (const id of ["marriages", "divorces"]) await expect(page.locator(toggle(id))).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-heading")).toHaveText(["Number", "Average age at marriage", "Average age at divorce", "Marriage length"]);
    await expect(page.getByTestId("marriage-unit-label")).toHaveText("number");
    // The published counts carry no census break.
    await expect(page.getByTestId("chart-panel").getByTestId("chart-break")).toHaveCount(0);
    await page.goto(`${TEST_BASE_URL}${PATH}`);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ქორწინება და განქორწინება");
    await expect(pressed(page)).toHaveCount(2);
  });

  test("per 1,000 residents keeps the selection and marks the 2025 census recalculation", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/en${PATH}`);
    await ready(page);
    await expect(page.getByTestId("marriage-measure-per1000")).toHaveAccessibleName("Per 1,000 residents");
    await page.getByTestId("marriage-measure-per1000").click();
    await expect(page).toHaveURL(/tab=per1000/);
    await expect(page.getByTestId("marriage-unit-label")).toHaveText("per 1,000 residents");
    await expect(pressed(page)).toHaveCount(2);
    const breaks = page.getByTestId("chart-panel").getByTestId("chart-break");
    await expect(breaks).toHaveCount(1);
    await expect(breaks.first()).toContainText("Census re-base");
    // The headline stays on the published counts.
    await expect(page.getByTestId("marriage-latest")).toHaveText("2025: 22,285 marriages, 13,173 divorces");
  });

  test("ticking an age clears the counts, so years and numbers never share the chart", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/en${PATH}`);
    await ready(page);
    await page.locator(toggle("age_first_marriage_male")).click();
    await expect(pressed(page)).toHaveCount(1);
    await expect(page.locator(toggle("age_first_marriage_male"))).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(toggle("marriages"))).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("marriage-unit-label")).toHaveText("years");
  });

  test("the places list shows one-decimal rates and opens a municipality at its section", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/en${PATH}`);
    await ready(page);
    const kazbegi = page.locator('a[href="/en/explorer/demography/population/kazbegi#marriages-divorces"]').first();
    await expect(kazbegi.getByTestId("municipal-row-primary-amount")).toHaveText(/^\d+\.\d$/);
    await expect(kazbegi.getByTestId("municipal-row-secondary")).toContainText("marriages ·");
    await kazbegi.click();
    await expect(page).toHaveURL(/\/population\/kazbegi#marriages-divorces$/);
    await ready(page);
    await expect(page.getByTestId("marriage-section")).toBeInViewport();
    await page.getByTestId("marriage-mode-table").click();
    await expect(page.getByTestId("marriage-section").getByRole("table")).toContainText("Marriages and divorces, Kazbegi, 2009–2025");
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const locale of ["ka", "en"] as const) {
    test(`the latest line fits one line (${locale})`, async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}${locale === "en" ? "/en" : ""}${PATH}`);
      await ready(page);
      const lines = await page.getByTestId("marriage-latest").evaluate((element) =>
        Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
      expect(lines).toBe(1);
    });
  }
});

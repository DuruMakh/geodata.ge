import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

const expectAppReady = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

test.describe("births and deaths on a place page", () => {
  for (const [path, lead] of [
    ["/en/explorer/demography/population/georgia", "Births and deaths registered in Georgia, 2014–2025."],
    ["/en/explorer/demography/population/region/imereti", "Births and deaths registered in Imereti, 2015–2025."],
    ["/en/explorer/demography/population/batumi", "Births and deaths registered in Batumi, 2015–2025."],
  ] as const) {
    test(`${path} ends with its section`, async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}${path}`);
      await expectAppReady(page);
      const section = page.getByTestId("vital-section");
      await expect(section).toContainText(lead);
      await section.getByTestId("vital-mode-table").click();
      await expect(section.getByRole("table")).toContainText("Natural increase");
    });
  }

  test("the section downloads its workbook", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/en/explorer/demography/population/batumi`);
    await expectAppReady(page);
    const pending = page.waitForEvent("download");
    await page.getByTestId("vital-excel-download").click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(/demography-births-deaths-batumi-2015-2025/);
  });
});

test.describe("births, deaths and fertility page", () => {
  test("lists places, opens a place at its section, and shows fertility and life expectancy", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/en/explorer/demography/births-deaths`);
    await expectAppReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Births, deaths and fertility");
    await expect(page.getByText("53 of 64")).toBeVisible();
    await expect(page.getByTestId("fertility-section")).toContainText("Census re-base");
    await expect(page.getByTestId("asfr-legend")).toContainText("2014");
    await expect(page.getByTestId("life-section")).toBeVisible();
    await page.locator('a[href="/en/explorer/demography/population/batumi#births-deaths"]').first().click();
    await expect(page).toHaveURL(/\/population\/batumi#births-deaths$/);
    await expect(page.getByTestId("vital-section")).toBeInViewport();
  });

  test("Georgian page renders", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/demography/births-deaths`);
    await expectAppReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("შობადობა და სიკვდილიანობა");
  });

  for (const path of ["/en/explorer/demography/births-deaths", "/explorer/demography/population/batumi"]) {
    test(`${path} has no sideways scroll at 390px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${TEST_BASE_URL}${path}`);
      await expectAppReady(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});

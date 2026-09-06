import { expect, test } from "@playwright/test";

test("English selection controls keep their complete denominator while searching", async ({ page }) => {
  await page.goto("/en/explorer/expenditure#g=ministries");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const search = page.getByTestId("series-search");
  const status = page.getByTestId("series-status");
  await expect(search).toHaveAccessibleName("Search series");
  await expect(search).toHaveAttribute("placeholder", "Search");
  await expect(status).toContainText("Main");
  await expect(status).toContainText("Programmes");
  const before = (await status.innerText()).replace(/\s+/g, " ");
  const denominator = Number(before.match(/\/\s*(\d+)/)![1]);
  await search.fill("თავდაცვა");
  expect((await status.innerText()).replace(/\s+/g, " ")).toBe(before);
  const bulk = page.getByTestId("series-toggle-all");
  await expect(bulk).toHaveAccessibleName("Clear");
  await bulk.click();
  await expect(bulk).toHaveAccessibleName("Select all");
  await bulk.click();
  await expect(status).toContainText(`${denominator} / ${denominator}`);
  await expect(page.getByTestId("range-start-handle")).toHaveAccessibleName("Start year");
  await expect(page.getByTestId("range-end-handle")).toHaveAccessibleName("End year");
  await expect(page.getByTestId("series-excel")).toHaveAccessibleName("Download");
  await expect(page.getByTestId("grouping-fields")).toHaveAccessibleName("Functions");
  await expect(page.getByTestId("grouping-ministries")).toHaveAccessibleName("Ministries");
  await expect(page.getByTestId("chart-mode-line")).toHaveAccessibleName("Line");
  await expect(page.getByTestId("chart-mode-table")).toHaveAccessibleName("Table");
});

test("English mobile shared hints and coming-soon labels are readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/explorer/expenditure");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("chart-scroll-hint")).toHaveText("Scroll horizontally to see more data");
  await page.getByTestId("sidebar-toggle").click();
  await expect(page.getByTestId("data-sidebar").getByText("Coming soon", { exact: true })).toHaveCount(4);
});

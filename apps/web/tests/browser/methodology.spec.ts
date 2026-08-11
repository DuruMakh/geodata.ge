import { expect, test } from "@playwright/test";

test("methodology hub separates live datasets from future markers", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("მეთოდოლოგია და პირველწყაროები");
  await expect(page.getByTestId("methodology-live-row")).toHaveCount(3);
  await expect(page.getByTestId("methodology-future-row")).toHaveCount(4);
  await expect(page.getByTestId("methodology-future-row").getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/2005–2025/);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/77/);
});

test("methodology live rows snap off motion when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://localhost:3100/methodology");

  const row = page.getByTestId("methodology-live-row").first();
  const arrow = row.locator('[aria-hidden="true"]');
  await row.hover();

  await expect
    .poll(() => row.evaluate((element) => getComputedStyle(element).transform))
    .toBe("none");
  await expect
    .poll(() => row.evaluate((element) => getComputedStyle(element).transitionProperty))
    .toBe("none");
  await expect
    .poll(() => arrow.evaluate((element) => getComputedStyle(element).transform))
    .toBe("none");
  await expect
    .poll(() => arrow.evaluate((element) => getComputedStyle(element).transitionProperty))
    .toBe("none");
});

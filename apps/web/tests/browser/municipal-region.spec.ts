import { expect, test } from "@playwright/test";

// Region roll-up pages (Task 12) — reuse Task 11's MunicipalExplorer
// workspace and the entity picker via `children`/`pickerGroups`. Two things
// nothing in the repo exercised before this page existed:
//
//  - the roll-up source note (design spec §7.3): a region total sums only
//    publicly served municipal budgets, so the page must say so out loud —
//    აჭარა excludes the Adjara autonomous republic's own budget, and შიდა
//    ქართლი/მცხეთა-მთიანეთი exclude bodies associated with occupied
//    territories. Without this note a region total reads as complete
//    territorially attributed spending, which it is not.
//  - the picker's region options (Task 10): they 404'd until this page
//    shipped, exactly as Task 11's report flagged.
//
// Full section e2e coverage is Task 14's; this pins the specific gaps above.

// იმერეთი: 12 member municipalities (data/imports/municipalities.csv), the
// same region the brief's own manual verification step names.
const REGION_URL = "http://localhost:3100/explorer/municipalities/region/imereti";

test.describe("region source note", () => {
  test("names both roll-up carve-outs — აჭარა's own budget and the occupied-territory exclusions", async ({ page }) => {
    const response = await page.goto(REGION_URL);
    expect(response?.status()).toBe(200);

    const note = page.getByTestId("municipal-source-note");
    await expect(note).toContainText("რეგიონის ჯამი მხოლოდ საჯაროდ მოწოდებულ მუნიციპალურ ბიუჯეტებს აერთიანებს");
    await expect(note).toContainText("აჭარის ავტონომიური რესპუბლიკის საკუთარი ბიუჯეტი მასში არ შედის");
    await expect(note).toContainText("შიდა ქართლსა და მცხეთა-მთიანეთს ოკუპირებულ ტერიტორიებთან დაკავშირებული ერთეულები აკლია");
  });
});

test.describe("region roll-up page", () => {
  test("renders every member, the roll-up chart, and suppresses the per-member divergence callout", async ({ page }) => {
    const response = await page.goto(REGION_URL);
    expect(response?.status()).toBe(200);

    // 12 member rows, matching the taxonomy count for region.imereti.
    await expect(page.getByTestId("region-member-row")).toHaveCount(12);

    const chart = page.getByTestId("chart-frame");
    await expect(chart).toBeVisible();
    await expect(chart.locator("svg text").first()).toBeVisible();

    // Region pages pass showWarnings={false}: a roll-up's own two totals
    // reconcile by construction, and თბილისი/აჭარა each have a warning
    // member in 9 of 11 years, so a region-level banner would be
    // near-permanent on the two most-visited pages (design spec §8.2).
    await expect(page.getByTestId("divergence-callout")).toHaveCount(0);
  });

  test("a member row links through to its own municipality page", async ({ page }) => {
    await page.goto(REGION_URL);

    const first = page.getByTestId("region-member-row").first();
    await expect(first).toHaveAttribute("href", /^\/explorer\/municipalities\/[^/]+$/);
  });

  test("meta line reports the member count and the region's rank out of 11, not 64", async ({ page }) => {
    await page.goto(REGION_URL);

    await expect(page.getByTestId("explorer-shell")).toContainText("12 მუნიციპალიტეტი");
    await expect(page.getByTestId("explorer-shell")).toContainText("ადგილი 11-დან");
  });
});

test.describe("entity picker region options resolve (previously 404)", () => {
  test("selecting a region option from a municipality page's picker navigates to a real, fully-rendered region page", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities/04"); // თბილისი
    await page.getByTestId("entity-picker-trigger").click();

    const regionOption = page.getByTestId("picker-region").filter({ hasText: "იმერეთი" });
    await expect(regionOption).toHaveCount(1);
    await regionOption.click();

    await expect(page).toHaveURL(/\/explorer\/municipalities\/region\/imereti(#|$)/);
    // Proof this is a real render, not Next's built-in 404 page: the
    // region-only member list and the genitive-form heading are both present.
    await expect(page.getByTestId("region-member-row")).toHaveCount(12);
    await expect(page.getByTestId("entity-picker-trigger")).toContainText("იმერეთის");
  });
});

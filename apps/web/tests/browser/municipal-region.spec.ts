import { expect, test, type Page } from "@playwright/test";

async function expectMunicipalAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

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
const LONG_REGION_URL =
  "http://localhost:3100/explorer/municipalities/region/racha_lechkhumi_kvemo_svaneti";

test.describe("region header responsiveness", () => {
  for (const viewport of [
    { width: 375, height: 844 },
    { width: 768, height: 900 },
    { width: 900, height: 900 },
  ]) {
    test(`keeps the longest heading readable without horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(LONG_REGION_URL);
      await expectMunicipalAppReady(page);
      expect(response?.status()).toBe(200);

      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toHaveText(
        "როგორ იხარჯება რაჭა-ლეჩხუმისა და ქვემო სვანეთის მუნიციპალური ბიუჯეტები▾",
      );

      const headingBox = await heading.boundingBox();
      const headerBox = await heading.locator("xpath=../..").boundingBox();
      expect(headingBox?.width ?? 0).toBeGreaterThan((headerBox?.width ?? 0) * 0.45);

      const pageWidth = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(pageWidth.content).toBe(pageWidth.viewport);
    });
  }
});

test.describe("region source note", () => {
  test("names both roll-up carve-outs — აჭარა's own budget and the occupied-territory exclusions", async ({ page }) => {
    const response = await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);
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
    await expectMunicipalAppReady(page);
    expect(response?.status()).toBe(200);

    // 12 member rows, matching the taxonomy count for region.imereti.
    await expect(page.getByTestId("region-member-row")).toHaveCount(12);

    const chart = page.getByTestId("chart-frame");
    await expect(chart).toBeVisible();
    await expect(chart.locator("svg text").first()).toBeVisible();

    // Region pages pass showWarnings={false}: warning type and reconciliation
    // wording are municipality-grain provenance and cannot be assigned to the
    // aggregate. The standing two-measures source note still applies.
    await expect(page.getByTestId("divergence-callout")).toHaveCount(0);
  });

  test("a member row links through to its own municipality page", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);

    const first = page.getByTestId("region-member-row").first();
    await expect(first).toHaveAttribute("href", /^\/explorer\/municipalities\/[^/]+$/);
  });

  test("meta line reports the member count and the region's rank out of 11, not 64", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("explorer-shell")).toContainText("12 მუნიციპალიტეტი");
    await expect(page.getByTestId("explorer-shell")).toContainText("ადგილი 11-დან");
  });
});

test.describe("entity picker region options resolve (previously 404)", () => {
  test("selecting a region option from a municipality page's picker navigates to a real, fully-rendered region page", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities/04"); // თბილისი
    await expectMunicipalAppReady(page);
    await page.getByTestId("entity-picker-trigger").click();

    const regionOption = page.getByTestId("picker-region").filter({ hasText: "იმერეთი" });
    await expect(regionOption).toHaveCount(1);
    await regionOption.click();

    await expect(page).toHaveURL(/\/explorer\/municipalities\/region\/imereti(#|$)/);
    // Proof this is a real render, not Next's built-in 404 page: the
    // region-only member list and the plain-name picker trigger are both present.
    await expect(page.getByTestId("region-member-row")).toHaveCount(12);
    await expect(page.getByTestId("entity-picker-trigger")).toContainText("იმერეთი");
  });
});

// Task 14: the full region-page e2e coverage the header comment above defers
// to this task ("Full section e2e coverage is Task 14's"). This necessarily
// overlaps in substance with the two targeted tests above — those pin specific
// past defects (the source note and the picker's region options), this is the
// page's general contract.
test.describe("region page", () => {
  test("uses the plain region name in the picker trigger", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);

    const trigger = page.getByTestId("entity-picker-trigger");
    await expect(trigger).toContainText("იმერეთი");
    await expect(trigger).not.toContainText("მუნიციპალური ბიუჯეტები");
  });

  test("lists its member municipalities and carries the roll-up caveats", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);
    const trigger = page.getByTestId("entity-picker-trigger");
    await expect(trigger).toHaveCSS("color", "rgb(179, 64, 42)");
    await expect(page.getByTestId("entity-picker-caret")).toHaveText("▾");
    await expect(page.getByTestId("region-member-row")).toHaveCount(12);
    await expect(page.getByTestId("municipal-source-note").first()).toContainText("აჭარის ავტონომიური რესპუბლიკის");
    await expect(page.getByTestId("divergence-callout")).toHaveCount(0);
  });
});

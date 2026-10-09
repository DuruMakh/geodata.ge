import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

async function expectEnglishPresentation(page: Page) {
  const text = (await page.locator("body").innerText()).replaceAll("ქართული", "");
  expect(text).not.toMatch(/\p{Script=Georgian}/u);
  const descriptions = await page.locator("[aria-label], [title]").evaluateAll(elements => elements.flatMap(element => [element.getAttribute("aria-label") ?? "", element.getAttribute("title") ?? ""]));
  expect(descriptions.filter(text => text !== "ქართული").join(" ")).not.toMatch(/\p{Script=Georgian}/u);
}

test("English national content is available before JavaScript runs", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: TEST_BASE_URL });
  try {
    const page = await context.newPage();
    for (const family of ["expenditure", "revenue"]) {
      await page.goto(`/en/explorer/${family}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("How Georgia’s budget");
      await expectEnglishPresentation(page);
    }
  } finally {
    await context.close();
  }
});

for (const [family, heading] of [["expenditure", "How Georgia’s budget is spent"], ["revenue", "How Georgia’s budget is financed"]] as const) {
  test(`English ${family} has complete page text in both chart and table views`, async ({ page }) => {
    await page.goto(`/en/explorer/${family}`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expectEnglishPresentation(page);
    await page.getByTestId("chart-mode-table").click();
    await expect(page.getByTestId("explorer-table")).toBeVisible();
    await expectEnglishPresentation(page);
  });
}

test("national table numbers and GDP-share settings survive a language switch", async ({ page }) => {
  await page.goto("/explorer/expenditure#g=fields&m=table&sh=1&r=2020-2025&sel=expenditure.total,spending.education");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const hash = new URL(page.url()).hash;
  // Hydration may serialize the comma as %2C; all selected settings must agree.
  const settings = (hash: string) => Object.fromEntries(new URLSearchParams(hash.slice(1)));
  const numbers = () => page.getByTestId("explorer-table").locator("tbody tr").evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll("td")).slice(1).map(cell => cell.textContent?.trim())));
  const before = await numbers();
  await page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  expect(settings(new URL(page.url()).hash)).toEqual(settings(hash));
  expect(await numbers()).toEqual(before);
  await expect(page.getByTestId("measure-share-toggle")).toHaveAccessibleName("% of GDP");
  await expectEnglishPresentation(page);
});

test("national search matches both languages and programme labels are English", async ({ page }) => {
  await page.goto("/en/explorer/expenditure");
  const search = page.getByTestId("series-search");
  for (const query of ["განათლება", "Education"]) {
    await search.fill(query);
    await expect(page.locator('[data-series-id="spending.education"] [data-testid="series-label"]')).toHaveText("Education");
  }
  await page.getByTestId("grouping-ministries").click();
  await page.locator('[data-testid="series-row"] button[aria-expanded="false"]').first().click();
  expect(await page.locator('[data-level="major_program"]').count()).toBeGreaterThan(0);
  await expectEnglishPresentation(page);
});

test("a selected programme keeps its plotted values through switching, back navigation and reload", async ({ page }) => {
  await page.goto("/en/explorer/expenditure#g=ministries&m=line&r=2020-2025");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.locator('[data-testid="series-row"] button[aria-expanded="false"]').first().click();
  const programme = page.locator('[data-level="major_program"]').first();
  const programmeId = await programme.getAttribute("data-series-id");
  expect(programmeId).toMatch(/^admin_program\./);
  await programme.getByTestId("series-row-toggle").click();
  await expect.poll(() => new URLSearchParams(new URL(page.url()).hash.slice(1)).get("sel")).toContain(programmeId!);
  const hash = new URL(page.url()).hash;
  // Compare the plotted heights (values) only: the y-axis padding fits each language's
  // labels ("bn" vs "მლრდ"), so a language switch may shift every point sideways.
  const paths = () => page.getByTestId("chart-frame").locator("svg path").evaluateAll(elements => elements.map(element =>
    (element.getAttribute("d")?.match(/-?\d+(?:\.\d+)?/g) ?? []).filter((_, index) => index % 2 === 1).join(",")));
  const before = await paths();
  expect(before.length).toBeGreaterThan(0);
  await page.getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  expect(new URL(page.url()).hash).toBe(hash);
  expect(await paths()).toEqual(before);
  await page.goBack();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  expect(new URL(page.url()).hash).toBe(hash);
  expect(await paths()).toEqual(before);
  await expectEnglishPresentation(page);
});

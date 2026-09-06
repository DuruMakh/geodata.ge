import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

async function expectEnglish(page: Page) {
  expect((await page.locator("body").innerText()).replaceAll("ქართული", "")).not.toMatch(/\p{Script=Georgian}/u);
  const descriptions = await page.locator("[aria-label], [title], svg title").evaluateAll(elements => elements.flatMap(element => [element.getAttribute("aria-label") ?? "", element.getAttribute("title") ?? "", element.tagName.toLowerCase() === "title" ? element.textContent ?? "" : ""]));
  expect(descriptions.filter(text => text !== "ქართული").join(" ")).not.toMatch(/\p{Script=Georgian}/u);
}

async function numericalPresentation(page: Page) {
  return {
    treemap: await page.getByTestId("snapshot-structure-card").evaluateAll(elements => elements.map(element => element.getAttribute("style"))),
    cells: await page.getByTestId("every-100-grid").locator("[data-cell]").evaluateAll(elements => elements.map(element => element.getAttribute("style"))),
    radar: await page.getByTestId("budget-radar").locator("path").evaluateAll(elements => elements.map(element => element.getAttribute("d"))),
    field: await page.getByTestId("budget-field").locator("circle").evaluateAll(elements => elements.map(element => ["cx", "cy", "r", "fill"].map(key => element.getAttribute(key)))),
    ranking: await page.getByTestId("single-year-ranking").locator("tbody tr").evaluateAll(elements => elements.map(element => [...element.querySelectorAll("td")].slice(1).map(cell => cell.textContent?.trim()))),
  };
}

test("English analysis is present in the initial HTML", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: TEST_BASE_URL });
  try {
    const page = await context.newPage();
    expect((await page.goto("/en/explorer/analysis"))?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
    for (const id of ["snapshot-treemap", "every-100-gel", "budget-radar", "budget-field", "single-year-ranking"]) await expect(page.getByTestId(id)).toBeVisible();
    await expectEnglish(page);
  } finally { await context.close(); }
});

for (const [side, grouping] of [["expenditure", "fields"], ["expenditure", "ministries"], ["revenue", "fields"]] as const) {
  test(`${side} / ${grouping} retains its year, every plotted value and ranking through language changes`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/en/explorer/analysis#as=${side}&ag=${grouping}&ay=2024`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("analysis-year-selector").getByRole("button", { name: "2024", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("every-100-grid").locator("[data-cell]")).toHaveCount(100);
    await expect(page.getByTestId("series-excel")).toHaveCount(0);
    await expectEnglish(page);
    const before = await numericalPresentation(page);
    const hash = new URL(page.url()).hash;
    const bubble = page.getByTestId("budget-field").locator("circle").first();
    await bubble.focus();
    await expect(page.getByTestId("budget-field-tooltip")).toBeVisible();
    expect(await page.getByTestId("budget-field-tooltip").innerText()).not.toMatch(/\p{Script=Georgian}/u);
    await page.getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ka");
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    expect(new URL(page.url()).hash).toBe(hash);
    expect(await numericalPresentation(page)).toEqual(before);
    await page.goBack();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    expect(new URL(page.url()).hash).toBe(hash);
    expect(await numericalPresentation(page)).toEqual(before);
    await expectEnglish(page);
  });
}

test("mobile analysis controls and the first-year growth explanation are fully English", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/explorer/analysis#as=expenditure&ag=ministries&ay=2004");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("budget-field")).toContainText("Previous-year data is unavailable");
  await expect(page.getByTestId("budget-field").locator("circle")).toHaveCount(0);
  await expectEnglish(page);
  await page.getByTestId("analysis-side-revenue").click();
  await page.getByTestId("analysis-year-selector").getByRole("button", { name: "2024", exact: true }).click();
  await expect(page.getByTestId("single-year-ranking").locator("caption")).toHaveText("Budget receipts by category — full ranking, 2024");
  await expectEnglish(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const params = new URLSearchParams(new URL(page.url()).hash.slice(1));
  expect(params.get("as")).toBe("revenue");
  expect(params.get("ay")).toBe("2024");
});

import { expect, test } from "@playwright/test";

const previewHosts = ["localhost", "127.0.0.1"];

for (const host of previewHosts) {
  test(`main explorer hydrates, renders chart, and responds on ${host}`, async ({ page }) => {
    const consoleProblems: string[] = [];

    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleProblems.push(`${message.type()}: ${message.text()}`);
      }
    });

    await page.goto(`http://${host}:3100`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    await expect(page.locator("aside")).toContainText("ხარჯები სულ");

    await page.getByTestId("side-revenue").click();

    await expect(page.locator("aside")).toContainText("დამატებული ღირებულების გადასახადი");
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    expect(consoleProblems).toEqual([]);
  });
}

test("single-year snapshot renders sections and revenue data", async ({ page }) => {
  const consoleProblems: string[] = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("http://localhost:3100");
  await expect(page.locator("aside")).toBeVisible();
  await expect(page.getByRole("application")).toBeVisible();

  await page.getByTestId("view-single_year").click();

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("snapshot-treemap")).toBeVisible();
  await expect(page.getByTestId("every-100-gel")).toBeVisible();
  await expect(page.getByTestId("spending-petals")).toBeVisible();
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();

  const yearSelect = page.locator("select");
  const earliestYear = await yearSelect.locator("option").first().getAttribute("value");
  if (!earliestYear) throw new Error("Expected at least one single-year option");
  await yearSelect.selectOption(earliestYear);

  await page.getByTestId("side-revenue").click();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toContainText("დამატებული ღირებულების გადასახადი");

  expect(consoleProblems).toEqual([]);
});

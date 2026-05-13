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

    await expect(page.getByRole("heading", { name: "საქართველოს ბიუჯეტის ანალიტიკა" })).toBeVisible();
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    await expect(page.locator("aside")).toContainText("ხარჯები სულ");

    await page.getByRole("button", { name: "შემოსავლები" }).click();

    await expect(page.locator("aside")).toContainText("შემოსავლები სულ");
    await expect(page.getByText("არჩეული მონაცემი არ არის.")).toBeVisible();
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    expect(consoleProblems).toEqual([]);
  });
}

test("single-year snapshot renders sections and empty states", async ({ page }) => {
  const consoleProblems: string[] = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("http://localhost:3100");
  await expect(page.locator("aside")).toBeVisible();
  await expect(page.getByRole("application")).toBeVisible();

  await page.getByRole("button", { name: "ერთი წელი" }).click();

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("snapshot-treemap")).toBeVisible();
  await expect(page.getByTestId("every-100-gel")).toBeVisible();
  await expect(page.getByTestId("spending-petals")).toBeVisible();
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();

  await page.locator("select").selectOption("2023");
  await expect(page.getByText("ზრდის საჩვენებლად წინა ხელმისაწვდომი წელი საჭიროა.")).toBeVisible();

  await page.getByRole("button", { name: "შემოსავლები" }).click();
  await expect(page.getByText("ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული.")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

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
    await expect(page.locator("svg")).toHaveCount(2);
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    await expect(page.locator("aside")).toContainText("ხარჯები სულ");

    await page.getByRole("button", { name: "შემოსავლები" }).click();

    await expect(page.locator("aside")).toContainText("შემოსავლები სულ");
    await expect(page.locator("svg")).toHaveCount(2);
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    expect(consoleProblems).toEqual([]);
  });
}

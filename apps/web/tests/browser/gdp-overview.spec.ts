import { expect, test } from "@playwright/test";
for (const locale of ['ka','en']) for (const width of [390,768,1440]) {
  test(`GDP layout ${locale} at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:1000});
    await page.goto(`${locale==='en'?'/en':''}/explorer/economy/gdp`);
    await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');
    await expect(page.getByTestId('gdp-indicators').getByRole('button')).toHaveCount(4);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`gdp-${locale}-${width}.png`),fullPage:true});
    await page.goto(`${locale==='en'?'/en':''}/explorer/deficit`);
    await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');
    await page.screenshot({path:testInfo.outputPath(`reference-deficit-${locale}-${width}.png`),fullPage:true});
  });
}
test('Economy footer identifies its actual sources',async({page})=>{
  await page.goto('/en/explorer/economy/gdp');
  await expect(page.getByTestId('site-footer')).toContainText('World Bank');
  await expect(page.getByTestId('site-footer')).not.toContainText('Ministry of Finance');
});
test("GDP reuses chart/table/range and preserves indicator state", async ({
  page,
}) => {
  await page.goto("/en/explorer/economy/gdp");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("gdp-tab-real")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("gdp-currency")).toHaveCount(0);
  await page.getByTestId("gdp-tab-nominal").click();
  await page.getByRole("button", { name: "USD", exact: true }).click();
  await expect(page.getByTestId("gdp-unit")).toContainText("USD");
  await page.getByTestId("gdp-tab-growth").click();
  await expect(page.getByTestId("gdp-currency")).toHaveCount(0);
  await expect(page.getByTestId("gdp-unit")).toContainText("%");
  await page.getByTestId("gdp-tab-per_capita").click();
  await expect(
    page.getByRole("button", { name: "USD", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toContainText("Preliminary");
  await page.reload();
  await expect(page.getByTestId("gdp-tab-per_capita")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByTestId("gdp-download").click();
  expect((await download).suggestedFilename()).toContain("per_capita-usd");
});
test("manual range clamps and All expands with a longer indicator", async ({
  page,
}) => {
  await page.goto(
    "/en/explorer/economy/gdp#indicator=real&start=1980&end=2000",
  );
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.getByTestId("gdp-tab-nominal").click();
  await expect(page).toHaveURL(/start=1996&end=2000/);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByTestId("gdp-tab-real").click();
  await expect(page).toHaveURL(/range=all/);
  await expect(
    page.getByRole("slider", { name: "Start year" }),
  ).toHaveAttribute("aria-valuenow", "1960");
});
test("Economy links only the delivered overview", async ({ page }) => {
  await page.goto("/en/explorer/economy");
  await expect(
    page.getByTestId("economy-hub").getByTestId("hub-card"),
  ).toHaveCount(3);
  await expect(page.getByTestId("economy-hub").locator("a")).toHaveCount(1);
  await page.getByTestId("economy-hub").getByRole("link").click();
  await expect(page.getByTestId("gdp-overview")).toBeVisible();
});

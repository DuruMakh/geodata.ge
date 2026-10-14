import { expect, test } from "@playwright/test";
// Page overflow at 390/768/1440 is in the layout pass of mobile-fit-charts.spec.ts.
for (const [locale, width] of [['ka', 390], ['en', 1440]] as const) {
  test(`GDP layout ${locale} at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.goto(`${locale==='en'?'/en':''}/explorer/economy/gdp`);
    await expect(page.locator('body')).toHaveAttribute('data-app-ready','true');
    await expect(page.getByTestId('gdp-indicators').getByRole('button')).toHaveCount(4);
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
  await expect(page.getByTestId("gdp-unit")).toHaveText("Current prices");
  await expect(page.getByTestId("chart-panel").getByTestId("gdp-unit")).toHaveCount(0);
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
test("the Economy heading steps from 30px on phones to 40px on wider screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/explorer/economy");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCSS("font-size", "30px");
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(heading).toHaveCSS("font-size", "40px");
});

for (const locale of ['ka', 'en']) {
  test(`GDP axes use readable currencies and percentage points in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${locale === 'en' ? '/en' : ''}/explorer/economy/gdp#indicator=growth&start=2015&end=2025`);
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
    const axis = page.getByTestId('chart-panel').locator('svg text');
    await expect(axis.filter({ hasText: /^15%$/ })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale === 'en' ? 'Economy overview' : 'ეკონომიკის მიმოხილვა');
    await page.getByTestId('gdp-tab-per_capita').click();
    for (const currency of ['GEL', 'USD']) {
      // The symbol is the visible face; the accessible name is the localized currency name (U10-01).
      const name = locale === 'en' ? currency : currency === 'GEL' ? '₾' : 'აშშ დოლარი';
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('button', { name, exact: true })).toHaveText(currency === 'GEL' ? '₾' : '$');
      const ticks = axis.filter({ hasText: currency === 'GEL' ? /₾$/ : /\$$/ });
      expect(await ticks.count()).toBeGreaterThan(2);
      const tickXs = await ticks.evaluateAll(elements => elements.map(el => (el as SVGGraphicsElement).getBBox().x));
      expect(Math.min(...tickXs)).toBeGreaterThanOrEqual(0);
    }

    // The real-growth chart keeps every label inside its drawing too.
    await page.getByTestId('gdp-tab-real').click();
    await expect(page.getByTestId('gdp-tab-real')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => document.fonts.ready);
    // Read every label in one pass: after the first measurement the chart drops the
    // geometry that does not fit, so a label list collected earlier can go stale.
    const labelXs = await page.getByTestId('chart-panel').evaluate(panel => [...panel.querySelectorAll('svg text')].map(e => (e as SVGGraphicsElement).getBBox().x));
    expect(labelXs.length).toBeGreaterThan(0);
    for (const x of labelXs) expect(x).toBeGreaterThanOrEqual(0);
  });
}

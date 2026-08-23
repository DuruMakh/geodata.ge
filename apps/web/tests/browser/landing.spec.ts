import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Landing page (GeoData Site v2 design): structure, live data blocks, and the
// paths into the explorer. The hero is WebGL; tests assert the canvas mounts
// (or the fallback message shows) rather than pixel content.

const artifactDir = join(process.cwd(), "test-results", "visual-reference");
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

async function capture(page: Page, name: string) {
  await mkdir(artifactDir, { recursive: true });
  await page.waitForTimeout(2500); // let the hero's geological entry settle
  // Viewport capture: full-page stitching drops the WebGL hero layer.
  await page.screenshot({ path: join(artifactDir, `${name}.png`), caret: "hide" });
}

async function expectNoPageOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBe(width.client);
}

async function expectDatasetTableFits(page: Page, testId: string) {
  const section = page.getByTestId(testId);
  await expect(section.locator("tbody tr")).toHaveCount(4);
  const geometry = await section.locator("table").evaluate((table) => {
    const tableBox = table.getBoundingClientRect();
    const parentBox = table.parentElement!.getBoundingClientRect();
    return {
      tableLeft: tableBox.left,
      tableRight: tableBox.right,
      parentLeft: parentBox.left,
      parentRight: parentBox.right,
    };
  });
  expect(geometry.tableLeft).toBeGreaterThanOrEqual(geometry.parentLeft);
  expect(geometry.tableRight).toBeLessThanOrEqual(geometry.parentRight + 0.5);
}

test("landing renders the approved latest-year data composition", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(baseUrl);

  await expect(page).toHaveTitle("საქართველოს ბიუჯეტი და მუნიციპალური მონაცემები | Fiscal.ge");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემები — ხარჯები, შემოსავლები, მუნიციპალიტეტები, მეთოდოლოგია და ჩამოსატვირთი მონაცემები.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("საქართველო ციფრებში");
  await expect(page.getByText("საქართველოს მონაცემების პლატფორმა", { exact: true })).toBeVisible();
  await expect(page.getByTestId("hero-cta")).toHaveText("გაეცანი მონაცემებს");
  await expect(page.getByTestId("hero-cta")).toHaveAttribute("href", "#data");
  await expect(page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 15_000 });

  const figures = page.getByTestId("key-numbers");
  await expect(figures).toContainText("3.9");
  await expect(figures).toContainText("2026 წლის 1 იანვარი · საქსტატი");
  await expect(figures).toContainText("69.7");
  await expect(figures).toContainText("104.6");
  await expectNoPageOverflow(page);

  const orderedHeadings = await page.locator("#data h2").allTextContents();
  expect(orderedHeadings).toEqual([
    "როგორ იხარჯება საქართველოს ბიუჯეტი",
    "როგორ ფინანსდება საქართველოს ბიუჯეტი",
    "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები",
    "მეთოდოლოგია და პირველწყაროები",
  ]);
  await expect(page.getByTestId("landing-data-header")).toContainText("ბოლო ხელმისაწვდომი წელი · 2025");

  for (const testId of [
    "landing-dataset-expenditure",
    "landing-dataset-revenue",
    "landing-dataset-municipalities",
  ]) {
    const section = page.getByTestId(testId);
    await expect(section.getByTestId("landing-dataset-total")).toBeVisible();
    await expectDatasetTableFits(page, testId);
    await expect(section.locator("tbody tr").first().getByRole("rowheader")).not.toBeEmpty();
    await expect(section.locator("tbody tr").first().getByRole("cell")).toHaveCount(2);
    const latestYear = await section.getByTestId("landing-dataset-total").locator("strong").textContent();
    await expect(section.locator("thead th").nth(1)).toHaveText(latestYear!);
  }

  await expect(page.getByTestId("landing-dataset-expenditure").getByRole("link")).toHaveAttribute("href", "/explorer/expenditure");
  await expect(page.getByTestId("landing-dataset-revenue").getByRole("link")).toHaveAttribute("href", "/explorer/revenue");
  await expect(page.getByTestId("landing-dataset-municipalities").getByRole("link")).toHaveAttribute("href", "/explorer/municipalities");
  await expect(page.getByText("უდიდესი მუნიციპალური ბიუჯეტები", { exact: true })).toBeVisible();
  await expect(page.getByTestId("landing-methodology").getByRole("link", { name: "მეთოდოლოგიის ნახვა →" })).toHaveAttribute("href", "/methodology");

  await expect(page.getByTestId("landing-data").locator("svg, canvas")).toHaveCount(0);
  await expect(page.getByTestId("three-paths")).toHaveCount(0);
  await expect(page.getByTestId("waffle-grid")).toHaveCount(0);
  await expect(page.getByTestId("excel-preview")).toHaveCount(0);
  await expect(page.getByTestId("methodology-promo")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "რა არის Fiscal.ge?" })).toHaveCount(0);

  const footer = page.getByTestId("landing-footer");
  await expect(footer.getByRole("link", { name: "info@fiscal.ge" })).toHaveAttribute("href", "mailto:info@fiscal.ge");
  await expect(footer).toContainText("CC BY 4.0");
  await capture(page, "landing-desktop");
});

test("landing data and methodology links use real destinations", async ({ page }) => {
  await page.goto(baseUrl);
  await expect(page.getByTestId("landing-header").locator('a[href="/explorer"]')).toBeVisible();
  await page.getByTestId("hero-cta").click();
  await expect(page).toHaveURL(/\/#data$/);
  await expect(page.getByTestId("landing-data")).toBeInViewport();

  await page.getByTestId("landing-dataset-revenue").getByRole("link").click();
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByTestId("explorer-shell")).toBeVisible();
});

test("landing keeps stats and dataset tables inside narrow viewports", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(baseUrl);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("key-numbers").locator("[data-country-stat]")).toHaveCount(3);
    await expectNoPageOverflow(page);

    for (const testId of [
      "landing-dataset-expenditure",
      "landing-dataset-revenue",
      "landing-dataset-municipalities",
    ]) {
      await expectDatasetTableFits(page, testId);
      const section = page.getByTestId(testId);
      const positions = await section.locator(
        '[data-testid="landing-dataset-index"], [data-testid="landing-dataset-copy"], [data-testid="landing-dataset-data"]',
      ).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
      expect(positions[1]).toBeGreaterThanOrEqual(positions[0]!);
      expect(positions[2]).toBeGreaterThanOrEqual(positions[1]!);
    }

    if (width === 320) {
      await expect(page.getByTestId("population-unit")).toHaveCSS("display", "block");
    }
    await capture(page, `landing-${width}`);
  }
});

test("methodology is in the footer but never the landing header", async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId("landing-header").getByRole("link", { name: "მეთოდოლოგია" })).toHaveCount(0);
  await expect(page.getByTestId("site-footer").getByRole("link", { name: "მეთოდოლოგია" })).toHaveAttribute(
    "href",
    "/methodology",
  );
  await expect(page.getByTestId("landing-methodology")).toBeVisible();
  await expect(page.getByTestId("methodology-promo")).toHaveCount(0);
});

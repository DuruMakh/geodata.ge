import { expect, test, type Page } from "@playwright/test";

async function expectMunicipalAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test("renders 60 municipality polygons, five markers, two inert overlays, and 64 unique routes", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const map = page.getByTestId("municipality-map");
  await expect(map.locator("[data-municipality-shape]")).toHaveCount(60);
  await expect(map.locator("[data-municipality-marker]")).toHaveCount(5);
  await expect(map.locator("[data-occupied-overlay]")).toHaveCount(2);

  const codes = await map.locator("[data-municipality-code]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-municipality-code")),
  );
  expect(new Set(codes).size).toBe(64);
  expect(codes).toHaveLength(65);
});

test("polygon and marker clicks open municipality pages directly", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  await page.getByTestId("municipality-shape-33").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/33");

  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  await page.getByTestId("municipality-marker-06").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/06");
});

test("Enter and Space activate polygon and marker without scrolling", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  await page.getByTestId("municipality-shape-33").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/33");

  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const before = await page.evaluate(() => window.scrollY);
  await page.getByTestId("municipality-marker-06").focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/06");
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("occupied overlays expose no interaction or public explanation", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const overlays = page.locator("[data-occupied-overlay]");
  await expect(overlays).toHaveCount(2);
  for (const overlay of await overlays.all()) {
    await expect(overlay).toHaveAttribute("aria-hidden", "true");
    await expect(overlay).not.toHaveAttribute("tabindex");
    await expect(overlay).not.toHaveAttribute("role");
  }
  await expect(page.getByTestId("municipality-map")).not.toContainText(/ოკუპირ|Russian/i);
});

test("credits OpenStreetMap boundaries without occupied-territory copy", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const source = page.getByTestId("municipal-source-note");
  await expect(source.getByRole("link", { name: /OpenStreetMap contributors/ })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/copyright",
  );
  await expect(source).toContainText("ODbL");
  await expect(source).not.toContainText(/ოკუპირ|Russian/i);
  await expect(page.getByTestId("municipality-map")).not.toContainText(/მონაცემები არ არის|no data/i);
});

test("map hover and focus show only name, amount, and an arrow visibly", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const zugdidi = page.getByTestId("municipality-shape-33");
  await zugdidi.hover();
  const tooltip = page.getByTestId("municipality-map-tooltip");
  await expect(tooltip).toContainText("ზუგდიდი");
  await expect(tooltip).toContainText("₾");
  await expect(tooltip).toContainText("→");
  await expect(tooltip).not.toContainText(/Open|გახსნა/);
  await expect(zugdidi).toHaveAccessibleName(/ზუგდიდი.*გახსნა/);

  const batumi = page.getByTestId("municipality-marker-06");
  await batumi.focus();
  await expect(tooltip).toContainText("ბათუმი");
  await expect(tooltip).toContainText("→");
  await expect(batumi).toHaveAccessibleName(/ბათუმი.*გახსნა/);
});

test("municipality map and list highlight each other by exact code", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const shape = page.getByTestId("municipality-shape-33");
  const row = page.locator('[data-municipality-row-code="33"]');

  await shape.hover();
  await expect(shape).toHaveAttribute("data-active", "true");
  await expect(row).toHaveAttribute("data-active", "true");

  await page.getByRole("heading", { level: 1 }).hover();
  await row.focus();
  await expect(shape).toHaveAttribute("data-active", "true");
});

test("keyboard focus wins over a simultaneous pointer target", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const focusedShape = page.getByTestId("municipality-shape-33");
  const otherRow = page.locator('[data-municipality-row-code="04"]');
  await focusedShape.focus();
  await otherRow.hover();
  await expect(focusedShape).toHaveAttribute("data-active", "true");
  await expect(otherRow).not.toHaveAttribute("data-active", "true");
});

test("region rows do not activate municipality geometry", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  await page.getByTestId("level-region").click();
  await page.getByTestId("municipal-list-row").first().hover();
  await expect(page.locator('[data-municipality-code][data-active="true"]')).toHaveCount(0);
  await expect(page.getByTestId("municipality-map").locator("[data-municipality-shape]")).toHaveCount(60);
});

test("focus uses the polygon or marker instead of a rectangular outline", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const shape = page.getByTestId("municipality-shape-33");
  await shape.focus();
  const shapeStyle = await shape.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, strokeWidth: Number.parseFloat(style.strokeWidth) };
  });
  expect(shapeStyle.outline).toBe("none");
  expect(shapeStyle.strokeWidth).toBeGreaterThan(1);

  const marker = page.getByTestId("municipality-marker-06");
  await marker.focus();
  const markerStyle = await marker.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, radius: Number.parseFloat(element.getAttribute("r") ?? "0") };
  });
  expect(markerStyle.outline).toBe("none");
  expect(markerStyle.radius).toBeGreaterThan(7.5);
});

test("keeps the tooltip inside the map after a narrow viewport resize", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const map = page.getByTestId("municipality-map");
  const lowestTestId = await map.locator("[data-municipality-shape]").evaluateAll((elements) => {
    const lowest = elements.reduce((current, element) =>
      element.getBoundingClientRect().bottom > current.getBoundingClientRect().bottom ? element : current,
    );
    return lowest.getAttribute("data-testid");
  });
  expect(lowestTestId).toBeTruthy();
  await page.getByTestId(lowestTestId!).focus();
  await expect(page.getByTestId("municipality-map-tooltip")).toBeVisible();

  await page.setViewportSize({ width: 340, height: 844 });
  await expect
    .poll(async () => {
      const svgBox = await map.locator("svg").boundingBox();
      const tooltipBox = await page.getByTestId("municipality-map-tooltip").boundingBox();
      if (svgBox === null || tooltipBox === null) return false;
      return (
        tooltipBox.x >= svgBox.x &&
        tooltipBox.y >= svgBox.y &&
        tooltipBox.x + tooltipBox.width <= svgBox.x + svgBox.width &&
        tooltipBox.y + tooltipBox.height <= svgBox.y + svgBox.height
      );
    })
    .toBe(true);
});

test.describe("municipalities index", () => {
  test("lists all municipalities and switches grain", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(64);
    await page.getByTestId("level-region").click();
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(11);
    await expect(page).toHaveURL(/#lvl=region/);
  });

  test("filters and clears the search", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await page.getByTestId("municipal-search").fill("თელავი");
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(1);
    await page.getByTestId("municipal-search").fill("ზზზზ");
    await expect(page.getByTestId("municipal-empty")).toBeVisible();
  });

  test("keeps row bars normalized to the unfiltered leader while searching", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);

    const rows = page.getByTestId("municipal-list-row");
    const comparisonRow = rows.nth(1);
    const query = await comparisonRow.getByTestId("municipal-row-name").textContent();
    const widthBefore = await comparisonRow.getByTestId("municipal-row-bar").getAttribute("style");
    expect(query).toBeTruthy();
    expect(widthBefore).toMatch(/^width:\s*(?!100(?:\.0)?%).+%$/);

    await page.getByTestId("municipal-search").fill(query!);
    await expect(rows).toHaveCount(1);
    const widthAfter = await rows.first().getByTestId("municipal-row-bar").getAttribute("style");
    expect(widthAfter).toBe(widthBefore);
  });

  test("opens a municipality from the list", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await page.getByTestId("municipal-list-row").first().click();
    await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/04");
  });

  test("shows four KPIs", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("index-kpi")).toHaveCount(4);
  });

  test("describes municipalities on the map and in the list", async ({ page }) => {
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await expect(page.locator("main > div > p").first()).toContainText(
      "აირჩიე მუნიციპალიტეტი რუკაზე ან სიაში",
    );
  });

  test("keeps the index workspace stacked until its content container reaches 1100px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("http://localhost:3100/explorer/municipalities");
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "true");

    const columns = await page.getByTestId("municipal-index-workspace").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
    );
    const kpiColumns = await page.getByTestId("index-kpi-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
    );
    expect(columns).toHaveLength(1);
    expect(kpiColumns).toHaveLength(2);
  });
});

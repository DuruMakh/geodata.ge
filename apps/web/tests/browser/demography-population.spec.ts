import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

// Two frames and a short timer flush the effects that follow a render, so a URL write made on load would have happened by now.
const settled = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)))),
  );

// The buttons of `main` that come before the map in document order, and those after it. The map's own children are left out.
const buttonsAroundMap = (page: Page) =>
  page.evaluate(() => {
    const map = document.querySelector('[data-testid="municipality-map"]')!;
    const outside = [...document.querySelectorAll("main button")].filter((button) => !map.contains(button));
    const before = outside.filter((button) => Boolean(button.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING));
    return { before: before.length, after: outside.length - before.length };
  });

for (const [locale, prefix, heading, coverage] of [
  ["ka", "", "მოსახლეობა", "2004–2026 · 1 იანვრის მდგომარეობით"],
  ["en", "/en", "Population", "2004–2026 · as of 1 January"],
] as const) {
  test(`${locale}: the index opens on the municipalities with the map, four key figures and no button row`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography/population`);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("explorer-header")).toContainText(coverage);
    await expect(page.getByTestId("municipality-map")).toBeVisible();
    await expect(page.getByTestId("index-kpi")).toHaveCount(4);
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(64);
    await expect(page.locator('[data-testid^="population-level-"], [data-testid^="population-measure-"], [data-testid="population-georgia-pill"]')).toHaveCount(0);
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(0);

    // The retired ids above are only three names. The Budget index is the page this one copies, so a row of buttons above the map,
    // under any other id, would show as more buttons before the map than the Budget index has.
    const population = await buttonsAroundMap(page);
    expect(population.after, "the tabs follow the map, so the count sees buttons").toBeGreaterThan(0);
    await page.goto(`${prefix}/explorer/municipalities`);
    await ready(page);
    expect(population.before, "buttons before the map, against the Budget index").toBe((await buttonsAroundMap(page)).before);
  });

  test(`${locale}: the hub lists four pages and links the live one`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography`);
    await expect(page.getByTestId("demography-hub").getByTestId("hub-card")).toHaveCount(4);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveCount(1);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveAttribute("href", `${prefix}/explorer/demography/population`);
    await expect(page.getByTestId("demography-link")).toHaveAttribute("aria-current", "page");
  });
}

test("clicking a municipality on the map opens its page", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipality-shape-11").click();
  await expect(page).toHaveURL(/\/en\/explorer\/demography\/population\/khulo$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Khulo");
  await expect(page.getByTestId("explorer-header")).toContainText("Adjara");
  await expect(page.getByTestId("population-highlights")).toContainText("16,098");
});

test("a list row opens its page", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipal-list-row").filter({ hasText: "Batumi" }).click();
  await expect(page).toHaveURL(/\/population\/batumi$/);
  await expect(page.getByTestId("population-highlights")).toContainText("246,267");
});

// The Georgian twins of the two tests above. The anchored address is the Georgian one, not the /en page.
test("ka: clicking a municipality on the map opens its page", async ({ page }) => {
  await page.goto("/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipality-shape-11").click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/explorer\/demography\/population\/khulo$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ხულო");
});

test("ka: a list row opens its page", async ({ page }) => {
  await page.goto("/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipal-list-row").filter({ hasText: "ბათუმი" }).click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/explorer\/demography\/population\/batumi$/);
  await expect(page.getByTestId("population-highlights")).toContainText("246,267");
});

test("the Regions tab lists Georgia and the 11 regions, with density, and a region row opens its page", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("level-region").click();
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
  await expect(page.getByTestId("municipal-list-region")).toContainText("2,715.7/km²");
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  await page.getByTestId("municipal-list-row").filter({ hasText: "Imereti" }).click();
  await expect(page).toHaveURL(/\/population\/region\/imereti$/);
  await expect(page.getByTestId("series-row")).toHaveCount(13);
  await expect(page.getByTestId("region-member-row")).toHaveCount(12);
});

test("Georgia's page lists Georgia and the 11 regions (12 rows) and has no previous or next", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/georgia");
  await ready(page);
  await expect(page.getByTestId("series-row")).toHaveCount(12);
  await expect(page.getByTestId("municipal-entity-navigation")).toHaveCount(0);
  await expect(page.getByTestId("population-highlights")).toContainText("3,941,103");
});

// A page that shows a density says which area it uses (docs/data-methodology/demography.md): Georgia's shows the densest region's, a region's its own.
test("Georgia's and a region's page name the area the density uses; a municipality's page shows no density and no note", async ({ page }) => {
  for (const path of ["/en/explorer/demography/population/georgia", "/en/explorer/demography/population/region/adjara"]) {
    await page.goto(path);
    await ready(page);
    const note = page.getByTestId("population-highlights").getByTestId("population-density-note");
    await expect(note, path).toBeVisible();
    await expect(note, path).toContainText("504.24");
  }
  await page.goto("/en/explorer/demography/population/batumi");
  await ready(page);
  await expect(page.getByTestId("population-density-note")).toHaveCount(0);
});

test("Tbilisi opens one page from the map's city dot and from the lists", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipality-marker-04").click();
  await expect(page).toHaveURL(/\/population\/region\/tbilisi$/);
  await expect(page.getByTestId("series-row")).toHaveCount(1);

  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipal-list-row").first().click();
  await expect(page).toHaveURL(/\/population\/region\/tbilisi$/);
  await expect(page.getByTestId("region-member-row")).toHaveCount(0);

  // The other list: the Regions tab has a Tbilisi row of its own.
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("level-region").click();
  await page.getByTestId("municipal-list-row").filter({ hasText: "Tbilisi" }).click();
  await expect(page).toHaveURL(/\/population\/region\/tbilisi$/);
  await expect(page.getByTestId("region-member-row")).toHaveCount(0);
});

test("on a place page the picker, previous/next and the way back work", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/batumi");
  await ready(page);
  await expect(page.getByTestId("municipal-entity-navigation")).toBeVisible();
  await page.getByTestId("entity-picker-trigger").click();
  await page.getByTestId("picker-municipality").filter({ hasText: "Khulo" }).click();
  await expect(page).toHaveURL(/\/population\/khulo$/);
  await page.getByTestId("municipal-entity-navigation").getByRole("link").last().click();
  await expect(page).not.toHaveURL(/khulo$/);
  await expect(page).toHaveURL(/\/en\/explorer\/demography\/population\/[a-z_-]+$/);
  await page.getByTestId("population-back-link").click();
  await expect(page).toHaveURL(/\/en\/explorer\/demography\/population$/);
});

test("ticking a part puts it in the address and the table and survives a reload", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/region/adjara");
  await ready(page);
  await expect(page.getByTestId("series-row")).toHaveCount(7);
  await page.getByTestId("series-row").filter({ hasText: "Batumi" }).getByTestId("series-row-toggle").click();
  await expect(page).toHaveURL(/sel=region\.adjara(,|%2C)06/);
  await page.getByTestId("population-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toContainText("Batumi");
  await expect(page.getByTestId("explorer-table")).toContainText("Adjara");
  await page.reload();
  await ready(page);
  await expect(page.getByTestId("population-mode-table")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("explorer-table")).toContainText("Batumi");
});

test("the census re-base is a gap in the chart and a rule in the table", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/georgia");
  await ready(page);
  await expect(page.getByTestId("chart-break")).toContainText("Census re-base");
  await page.getByTestId("population-mode-table").click();
  const header = page.getByTestId("explorer-table").locator("thead th", { hasText: "2025" });
  await expect(header).toContainText("Census re-base");
  expect(await header.evaluate((cell) => getComputedStyle(cell).borderLeftWidth)).toBe("2px");
  await expect(page.getByTestId("population-census-note")).toContainText("re-based the population to the 2024 census");
});

// The range strip's marker prints the re-base label and no year: the year is where it stands on the rail, so the test reads the place.
for (const [locale, prefix, label] of [
  ["ka", "", "აღწერით გადათვლა"],
  ["en", "/en", "Census re-base"],
] as const) {
  test(`${locale}: Georgia's range strip marks the census re-base at 2025`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography/population/georgia`);
    await ready(page);
    const marker = page.getByTestId("range-marker");
    await expect(marker).toBeVisible();
    await expect(marker).toHaveText(label);
    const handle = page.getByTestId("range-start-handle");
    const [min, max] = [Number(await handle.getAttribute("aria-valuemin")), Number(await handle.getAttribute("aria-valuemax"))];
    expect(await marker.evaluate((element) => (element as HTMLElement).style.left)).toBe(`${(((2025 - min) / (max - min)) * 100).toFixed(2)}%`);
  });
}

test("the Excel download of a place page has three sheets and numeric population", async ({ page }, testInfo) => {
  await page.goto("/en/explorer/demography/population/batumi");
  await ready(page);
  const pending = page.waitForEvent("download");
  await page.getByTestId("population-excel-download").click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("fiscal-demography-population-batumi-2015-2026-en.xlsx");
  const file = testInfo.outputPath("population.xlsx");
  await download.saveAs(file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  expect(book.getWorksheet("Data")!.getCell("A2").value).toBe("Batumi");
  expect(book.getWorksheet("Data")!.getCell("D2").value).toBe(155_163);
});

test("the sidebar keeps Population current on a place page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/demography/population/batumi");
  await ready(page);
  await expect(page.getByTestId("demography-population-link")).toHaveAttribute("aria-current", "page");
});

test("English pages have no Georgian text on the index or on a place page", async ({ page }) => {
  for (const path of ["/en/explorer/demography/population", "/en/explorer/demography/population/region/adjara", "/en/explorer/demography/population/batumi"]) {
    await page.goto(path);
    await ready(page);
    expect(await page.locator("main").innerText(), path).not.toMatch(/[Ⴀ-ჿ]/);
  }
});

// URL state: loading never writes the URL (DESIGN.md section 6.3; pristine-urls.spec.ts covers a clean load); only a later change does.
test("a shared link restores a place page's view and the address stays exactly as shared", async ({ page }) => {
  const hash = "#m=table&r=2018-2024&sel=region.adjara%2C06";
  await page.goto(`/en/explorer/demography/population/region/adjara${hash}`);
  await ready(page);
  await expect(page.getByTestId("population-mode-table")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("explorer-table")).toContainText("Batumi");
  await settled(page);
  expect(new URL(page.url()).hash).toBe(hash);
});

test("a shared link restores the index's Regions tab and the address stays as shared", async ({ page }) => {
  await page.goto("/en/explorer/demography/population#lvl=region");
  await ready(page);
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
  await settled(page);
  expect(new URL(page.url()).hash).toBe("#lvl=region");
});

for (const width of [320, 390, 768, 900, 1100, 1440]) {
  test(`the hub, the index and the place pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/explorer/demography",
      "/explorer/demography/population",
      "/en/explorer/demography/population",
      "/en/explorer/demography/population/georgia",
      "/explorer/demography/population/region/adjara",
      "/en/explorer/demography/population/batumi",
    ]) {
      await page.goto(path);
      if (path.endsWith("/population") || path.includes("/population/")) await ready(page);
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} at ${width}px`).toBe(true);
    }
  });
}

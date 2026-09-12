import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { expectReadableText } from "./color-contrast";

for (const prefix of ["", "/en"]) {
  test(`long sector names leave mobile table values readable ${prefix || "ka"}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`${prefix}/explorer/economy/sectors#view=table&start=2025&end=2025&sel=sector.g`);
    const region = page.getByTestId("explorer-table");
    await expect(region.locator("tbody tr")).toHaveCount(1);
    await region.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    const cells = region.locator("tbody tr td");
    const label = (await cells.nth(0).boundingBox())!;
    const value = (await cells.nth(1).boundingBox())!;
    expect(label.width).toBeLessThanOrEqual(190);
    expect(value.x).toBeGreaterThanOrEqual(label.x + label.width - 1);
    expect(await cells.nth(1).evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
    await region.screenshot({ path: info.outputPath("mobile-sector-table.png") });
  });
}

for (const width of [390, 768, 1440]) {
  test(`Georgian sector highlights match the Budget hero and side KPIs at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/explorer/economy/sectors");
    const section = page.getByTestId("sector-highlights");
    await expect(section).toContainText("ტოპ 3-ის წილი მშპ-ში");
    await expect(section).toContainText("რეალური წლიური ზრდა");
    const cards = section.locator('[data-testid^="sector-highlight-"]');
    await expect(cards).toHaveCount(4);
    const hero = page.getByTestId("sector-highlight-largest");
    const side = page.getByTestId("sector-side-kpis");
    await expect(side.locator('[data-testid^="sector-highlight-"]')).toHaveCount(3);
    const heroBox = (await hero.boundingBox())!, sideBox = (await side.boundingBox())!;
    if (width === 1440) {
      expect(sideBox.x).toBeGreaterThan(heroBox.x + heroBox.width - 1);
      expect(sideBox.y).toBeCloseTo(heroBox.y, 0);
    } else {
      expect(sideBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height);
    }
    await expect(side.locator("svg")).toHaveCount(3);
    expect(await hero.locator('[data-testid="sector-hero-value"]').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(width < 768 ? 44 : 62);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await section.screenshot({ path: info.outputPath(`highlights-ka-${width}.png`) });
  });
}

test("four national highlights ignore chart selection and measure and explain missing 2010 growth", async ({ page }, info) => {
  await page.goto("/en/explorer/economy/sectors");
  const highlights = page.getByTestId("sector-highlights");
  await expect(highlights).toBeVisible();
  await expect(highlights.locator('[data-testid^="sector-highlight-"]')).toHaveCount(4);
  await expect(highlights).toContainText("2025");
  await expect(highlights).toContainText("Preliminary");
  await expect(page.getByTestId("sector-highlight-largest")).toContainText("Wholesale and retail trade");
  const before = await highlights.innerText();
  await page.getByTestId("series-toggle-all").click();
  await page.getByRole("button", { name: "% of GDP", exact: true }).click();
  await expect(highlights).toHaveText(before, { useInnerText: true });
  await page.goto("/en/explorer/economy/sectors#start=2010&end=2010");
  for (const id of ["fastest", "slowest"]) {
    await expect(page.getByTestId(`sector-highlight-${id}`)).toContainText("Real growth data are available from 2011");
    await expect(page.getByTestId(`sector-highlight-${id}`)).toContainText("—");
  }
  await expect(highlights).not.toContainText("Preliminary");
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await highlights.screenshot({ path: info.outputPath("sector-highlights-mobile.png") });
});

test("ranked sector table keeps the GDP reference first", async ({ page }) => {
  await page.goto("/en/explorer/economy/sectors#view=table&sel=economy.gdp_total,sector.a,sector.b");
  await expect(page.getByTestId("explorer-table").locator("tbody tr").first()).toContainText("Total GDP");
});

test("compact sector descriptions keep the chart still and clicked hints disappear", async ({ page }) => {
  await page.goto("/explorer/economy/sectors");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const panel = page.getByTestId("chart-panel");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const top = (await panel.boundingBox())!.y;
    for (const name of ["% მშპ-ში", "რეალური ზრდა %", "ნომინალური ღირებულება ლარში"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page.getByRole("heading", { level: 1 }).hover();
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      expect((await panel.boundingBox())!.y).toBe(top);
    }
  }
  await expect(page.getByTestId("sectors-unit")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("სექტორები");
});

test.describe("touch measure controls", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 900 } });
  test("Georgian touch selection retains a readable measure name without hover", async ({ page }) => {
    await page.goto("/explorer/economy/sectors");
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    const growth = page.getByRole("button", { name: "რეალური ზრდა %", exact: true });
    await growth.tap();
    await expect(growth).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("წლიური ზრდა, ფასების ცვლილების გამოკლებით.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "% მშპ-ში", exact: true }).tap();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "share_of_gdp");
    await expect(page.getByText("სექტორის დამატებული ღირებულების წილი მთლიან მშპ-ში.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test("collapsed sidebar home icon stays visible on the dark navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/explorer/economy/sectors");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.getByTestId("sidebar-toggle").click();
  const sidebar = page.getByTestId("data-sidebar");
  const home = sidebar.getByRole("link", { name: "Home", exact: true });
  await expect(home.locator("svg")).toBeVisible();
  await expectReadableText(home, sidebar);
});

test("icon measure controls explain themselves on hover and keyboard focus", async ({ page }, info) => {
  await page.goto("/en/explorer/economy/sectors");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const share = page.getByRole("button", { name: "% of GDP", exact: true });
  const growth = page.getByRole("button", { name: "Real growth %", exact: true });
  await expect(share.locator("svg")).toHaveCount(1);
  await expect(growth.locator("svg")).toHaveCount(1);
  await expect(share).toHaveText("");
  await share.hover();
  await expect(page.getByRole("tooltip")).toHaveText("% of GDP");
  await page.getByRole("tooltip").hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await growth.focus();
  await expect(page.getByRole("tooltip")).toHaveText("Real growth %");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "real_growth");
  await expect(page.getByText("Annual growth, adjusted for price changes.", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("lucide-controls-mobile.png"), fullPage: true });
});

test("sector page signals completed hydration",async({page})=>{
  await page.goto("/en/explorer/economy/sectors");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready","true");
});
for(const locale of ["ka","en"] as const) for(const width of [390,768,900,1020,1440]) {
  test(`sectors layout ${locale} ${width}`,async({page},info)=>{
    await page.setViewportSize({width,height:1000});
    await page.goto(`${locale==="en"?"/en":""}/explorer/economy/sectors`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready","true");
    await expect(page.getByTestId("series-row-toggle")).toHaveCount(21);
    await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.getByTestId("economic-sectors-explorer").getByRole("tablist")).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`sectors-${locale}-${width}.png`),fullPage:true});
  });
}
test("sector selections, measures and manual period survive history and language changes",async({page})=>{
  await page.goto("/en/explorer/economy/sectors#measure=nominal&start=2011&end=2025&sel=sector.a");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready","true");
  const a=page.locator('[data-series-id="sector.a"]').getByTestId("series-row-toggle");
  await expect(a).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Real growth %",exact:true}).click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure","real_growth");
  await page.getByRole("button",{name:"Nominal value in GEL",exact:true}).click();
  await expect(page.getByRole("slider",{name:"Start year"})).toHaveAttribute("aria-valuenow","2011");
  await page.goBack();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure","real_growth");
  await page.goForward();
  await page.getByTestId("chart-mode-table").click();
  await page.reload();
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  await page.getByRole("link",{name:"ქართული",exact:true}).click();
  await expect(page).toHaveURL(/\/explorer\/economy\/sectors#.*sel=sector.a/);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode","table");
  await expect(a).toHaveAttribute("aria-pressed","true");
});
test("search never restricts bulk selection or counts",async({page})=>{
  await page.goto("/en/explorer/economy/sectors");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready","true");
  await page.getByTestId("series-search").fill("no-such-sector");
  await expect(page.getByTestId("series-row-toggle")).toHaveCount(1);
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("sectors-excel-download")).toBeDisabled();
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("series-actions")).toContainText("21 / 21");
  await page.getByTestId("series-search").fill("");
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(21);
});
for(const locale of ["ka","en"] as const) for(const measure of ["nominal","share_of_gdp","real_growth"] as const) {
  test(`sectors workbook ${locale} ${measure}`,async({page},info)=>{
    await page.goto(`${locale==="en"?"/en":""}/explorer/economy/sectors#measure=${measure}&sel=sector.t&start=2025&end=2025`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready","true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure",measure);
    const pending=page.waitForEvent("download");
    await page.getByTestId("sectors-excel-download").click();
    const download=await pending,filename=info.outputPath(download.suggestedFilename());
    await download.saveAs(filename);
    const book=new ExcelJS.Workbook();await book.xlsx.readFile(filename);
    expect(book.worksheets.map(s=>s.name)).toEqual(locale==="en"?["Summary","Data","Sources"]:["მარტივი ცხრილი","მონაცემები","წყაროები"]);
    const cell=book.worksheets[0].getCell("B4");
    expect(typeof cell.value).toBe("number");
    if(measure==="nominal") {expect(cell.value).toBeCloseTo(0.08635408557338411,12);expect(cell.numFmt).toContain("0.00");}
    else {expect(cell.numFmt).toContain("%");if(measure==="real_growth") expect(cell.value).toBeCloseTo(-0.1301754817479356,12);}
    expect(cell.numFmt).toContain(locale==="en"?"Preliminary":"წინასწარი");
    expect(JSON.stringify(book.worksheets[2].model)).toContain("/downloads/methodology/economic-sectors/files/");
  });
}
test("sector source notes and metadata name the correct dataset",async({page})=>{
  await page.goto("/en/explorer/economy/sectors");
  await expect(page.getByTestId("site-footer")).toContainText("Geostat");
  await expect(page.getByTestId("site-footer")).not.toContainText("World Bank");
  const structuredData = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(node => JSON.parse(node.textContent ?? "{}")));
  expect(structuredData.filter(data => data["@type"] === "BreadcrumbList")).toHaveLength(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href","https://fiscal.ge/en/explorer/economy/sectors");
  await page.getByTestId("chart-mode-table").click();
  await expect(page.locator("caption")).toContainText("bn GEL");
  await expect(page.getByTestId("explorer-table")).toContainText("Preliminary");
});

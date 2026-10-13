import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

// 390 and 1440 load the page; 768 is reached by resizing the 1440 page, since
// it is the only width with the stacked layout and the 62px numeral.
for (const startWidth of [390, 1440]) {
  test(`Georgian sector highlights match the Budget hero and side KPIs from ${startWidth}px`, async ({ page }) => {
    await page.setViewportSize({ width: startWidth, height: 1000 });
    await page.goto("/explorer/economy/sectors");
    const section = page.getByTestId("sector-highlights");
    await expect(section).toContainText("ტოპ 3-ის წილი მშპ-ში");
    await expect(section).toContainText("რეალური წლიური ზრდა");
    const cards = section.locator('[data-testid^="sector-highlight-"]');
    await expect(cards).toHaveCount(4);
    const hero = page.getByTestId("sector-highlight-largest");
    const side = page.getByTestId("sector-side-kpis");
    await expect(side.locator('[data-testid^="sector-highlight-"]')).toHaveCount(3);
    for (const width of startWidth === 1440 ? [1440, 768] : [390]) {
      await page.setViewportSize({ width, height: 1000 });
      const heroBox = (await hero.boundingBox())!, sideBox = (await side.boundingBox())!;
      if (width === 1440) {
        expect(sideBox.x).toBeGreaterThan(heroBox.x + heroBox.width - 1);
        expect(sideBox.y).toBeCloseTo(heroBox.y, 0);
      } else {
        expect(sideBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height);
      }
      await expect(side.locator("svg")).toHaveCount(3);
      expect(await hero.locator('[data-testid="sector-hero-value"]').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(width < 768 ? 44 : 62);
    }
  });
}

test("four national highlights ignore chart selection and measure and explain missing 2010 growth", async ({ page }) => {
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
    // U11-01 (Q6): Total GDP alone is a flat 100% line; the share view opens on the five largest sectors, and the
    // headline is nominal GDP, the amount the shares divide, not Total GDP's own 100%.
    await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(5);
    await expect(page.getByTestId("sectors-headline")).toContainText("₾");
    await expect(page.getByTestId("sectors-headline")).not.toContainText("100.0%");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test("icon measure controls explain themselves on hover and keyboard focus", async ({ page }) => {
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
});

for(const width of [390,1440]) {
  test(`sectors layout en ${width}`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.goto("/en/explorer/economy/sectors");
    await expect(page.locator("body")).toHaveAttribute("data-app-ready","true");
    await expect(page.getByTestId("series-row-toggle")).toHaveCount(21);
    await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.getByTestId("economic-sectors-explorer").getByRole("tablist")).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
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
// Every measure in English; Georgian once for its sheet names, numFmt label and source link.
for(const [locale,measure] of [["en","nominal"],["en","share_of_gdp"],["en","real_growth"],["ka","nominal"]] as const) {
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
  await page.getByTestId("chart-mode-table").click();
  await expect(page.locator("caption")).toContainText("bn GEL");
  await expect(page.getByTestId("explorer-table")).toContainText("Preliminary");
});

test("range drags and arrow keys replace history; only measure and view add entries", async ({ page }) => {
  await page.goto("/en/explorer/economy/sectors");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const initial = await page.evaluate(() => history.length);

  await page.getByRole("button", { name: "Real growth %", exact: true }).click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "real_growth");
  expect(await page.evaluate(() => history.length)).toBe(initial + 1);

  const startHandle = page.getByRole("slider", { name: "Start year" });
  await startHandle.focus();
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("ArrowRight");
  await expect(startHandle).toHaveAttribute("aria-valuenow", "2016");

  const box = (await page.getByTestId("range-start-handle").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 16 });
  await page.mouse.up();
  // The drag must actually move the handle, or the history check below proves nothing.
  await expect(startHandle).not.toHaveAttribute("aria-valuenow", "2016");
  expect(await page.evaluate(() => history.length)).toBe(initial + 1);

  await page.goBack();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "nominal");
});

test("announces the period when the measure changes, not on every range change", async ({ page }) => {
  await page.goto("/en/explorer/economy/sectors");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  // The explorer's own announcer; the Excel button keeps a separate status line.
  const status = page.getByTestId("economic-sectors-explorer").locator('p.sr-only[role="status"]');
  await expect(status).toHaveText("");

  const startHandle = page.getByRole("slider", { name: "Start year" });
  await startHandle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(startHandle).toHaveAttribute("aria-valuenow", "2011");
  await expect(status).toHaveText("");

  await page.getByRole("button", { name: "Real growth %", exact: true }).click();
  await expect(status).toHaveText(/^Period: \d{4}–\d{4}$/);
});

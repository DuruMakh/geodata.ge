import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

async function expectEnglish(page: Page) {
  const untranslated = await page.locator("body").evaluate(body => {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const failures: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style")) continue;
      const text = node.textContent?.trim() ?? "";
      if (!/\p{Script=Georgian}/u.test(text)) continue;
      if (text === "ქართული" && parent.closest('[data-testid="language-switch"]')) continue;
      if (parent.closest('[data-original-language="filename"][lang="ka"][data-source-id]')) continue;
      failures.push(text);
    }
    return failures;
  });
  expect(untranslated).toEqual([]);
  const labels = await page.locator("[aria-label], [title]").evaluateAll(elements => elements.flatMap(element => [element.getAttribute("aria-label") ?? "", element.getAttribute("title") ?? ""]));
  expect(labels.filter(label => label !== "ქართული").join(" ")).not.toMatch(/\p{Script=Georgian}/u);
}

test("all five English methodology pages render complete text without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: TEST_BASE_URL });
  try {
    const page = await context.newPage();
    for (const suffix of ["", "/expenditure", "/revenue", "/municipalities", "/debt"]) {
      const response = await page.goto(`/en/methodology${suffix}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectEnglish(page);
      if (suffix) await expect(page.getByText("English translation reviewed · 2026-09-06", { exact: true })).toBeVisible();
    }
  } finally { await context.close(); }
});

for (const width of [390, 1440]) {
  test(`English methodology navigation and disclosure work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/en/methodology");
    const rows = page.getByTestId("methodology-live-row");
    await expect(rows).toHaveCount(6);
    expect(await rows.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual(["expenditure", "revenue", "municipalities", "debt", "gdp", "economic-sectors"].map(id => `/en/methodology/${id}`));
    await expect(page.getByTestId("methodology-future-row").getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("methodology-future-row").getByText("Coming soon", { exact: true })).toHaveCount(3);
    await rows.first().click();
    const decision = page.getByTestId("methodology-decision").first();
    await decision.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(decision).toHaveAttribute("open", "");
    await expect(decision.locator("div").last()).toBeVisible();
    await expectEnglish(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("navigation", { name: "Page contents" }).getByRole("link").last().click();
    expect(new URL(page.url()).hash).toBe("#source-archive");
    if (width < 900) await page.getByTestId("methodology-header").getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ka");
    expect(new URL(page.url()).pathname).toBe("/methodology/expenditure");
    expect(new URL(page.url()).hash).toBe("#source-archive");
    if (width < 900) await page.getByTestId("methodology-header").getByRole("button", { name: "მენიუ", exact: true }).click();
    await page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Methodology", exact: true })).toHaveAttribute("href", "/en/methodology");
  });
}

test("archive searches both languages and retains identical files, downloads and year scope", async ({ page, request }) => {
  await page.goto("/methodology/expenditure#source-archive");
  const archive = page.getByTestId("source-archive");
  const first = archive.getByTestId("source-archive-row").first();
  const originalTitle = await first.locator("td").nth(1).locator("span").first().innerText();
  const originals = await archive.locator('[data-original-language="filename"]').evaluateAll(elements => elements.map(element => [element.getAttribute("data-source-id"), element.textContent]));
  const downloadLinks = () => page.locator('a[href^="/downloads/"]').evaluateAll(elements => elements.map(element => element.getAttribute("href")));
  const kaDownloads = await downloadLinks();
  await page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await downloadLinks()).toEqual(kaDownloads);
  expect(await archive.locator('[data-original-language="filename"]').evaluateAll(elements => elements.map(element => [element.getAttribute("data-source-id"), element.textContent]))).toEqual(originals);
  const englishTitle = await first.locator("td").nth(1).locator("span").first().innerText();
  const query = archive.getByRole("searchbox", { name: "Search original sources" });
  await query.fill(englishTitle);
  const matching = await archive.locator('[data-original-language="filename"]').evaluateAll(elements => elements.map(element => element.getAttribute("data-source-id")));
  expect(matching.length).toBeGreaterThan(0);
  await query.fill(originalTitle);
  expect(await archive.locator('[data-original-language="filename"]').evaluateAll(elements => elements.map(element => element.getAttribute("data-source-id")))).toEqual(matching);
  await query.fill("");
  await archive.getByRole("button", { name: "2020", exact: true }).click();
  await expect(archive.locator("caption")).toContainText("2020");
  await expect(archive.locator("caption")).not.toContainText("2004–2025");
  await query.fill("no-matching-source-document");
  await expect(archive.getByTestId("source-archive-empty")).toHaveText("No sources found");
  const file = kaDownloads.find(href => href?.includes("/files/"));
  expect(file).toBeTruthy();
  expect((await request.get(file!)).status()).toBe(200);
});

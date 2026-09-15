import { expect, test } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.SEO_BASE_URL ?? "http://localhost:3100";
const ENDPOINT = "https://fiscal.ge/mcp";

for (const prefix of ["", "/en"]) {
  test(`bilingual examples and shared contract on ${prefix}/connect`, async ({ page }) => {
    await page.goto(`${BASE_URL}${prefix}/connect`);
    await expect(page.getByTestId("connect-endpoint")).toHaveText(ENDPOINT);
    const bilingual = page.getByTestId("connect-bilingual");
    await expect(bilingual.locator("li")).toHaveCount(4);
    await expect(bilingual).toContainText("2025");
    await expect(bilingual).toContainText("2024");
    await expect(page.getByTestId("connect-technical")).toContainText("1.2.0");
    await expect(page.getByTestId("connect-technical")).toContainText("dataVersion");
    if (prefix) expect(await bilingual.innerText()).not.toMatch(/\p{Script=Georgian}/u);
    else await expect(bilingual).toContainText("ხულოს");
    const sectors = page.getByTestId("connect-sector-coverage");
    await expect(sectors).toContainText("20");
    await expect(sectors).toContainText("2010–2025");
    await expect(sectors).toContainText("2011–2025");
    const discovery = page.getByTestId("connect-sector-discovery");
    await expect(discovery).toContainText("query_economic_sectors");
    await expect(discovery.locator('a[href="/downloads/data/economic-sectors.csv"]')).toHaveCount(1);
    await expect(discovery.locator(`a[href="${prefix}/methodology/economic-sectors"]`)).toHaveCount(1);
  });
}

test.describe("connection page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/connect`);
  });

  test("leads in Georgian with what the service is", async ({ page }) => {
    const heading = page.getByRole("heading", { level: 1 });

    await expect(heading).toBeVisible();
    // Georgian-first: the h1 is Georgian script, not a Latin product name.
    await expect(heading).toHaveText(/[Ⴀ-ჿ]/);
    await expect(page.getByTestId("connect-intro")).toBeVisible();
  });

  test("shows the endpoint and can copy it from the keyboard", async ({ page }) => {
    await expect(page.getByTestId("connect-endpoint")).toContainText(ENDPOINT);

    const copy = page.getByTestId("connect-copy");
    await expect(copy).toBeVisible();
    // An icon-only control with no accessible name is unusable by a screen
    // reader, and this is the one action on the page.
    const label = (await copy.getAttribute("aria-label")) ?? (await copy.innerText());
    expect(label.trim().length).toBeGreaterThan(3);
    expect(label).toMatch(/[Ⴀ-ჿ]/);

    await copy.focus();
    await expect(copy).toBeFocused();

    const box = await copy.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(24);
    expect(box!.width).toBeGreaterThanOrEqual(24);
  });

  test("gives per-application connection steps for at least two clients", async ({ page }) => {
    const clients = page.getByTestId("connect-client");

    expect(await clients.count()).toBeGreaterThanOrEqual(2);
    for (const client of await clients.all()) {
      await expect(client).toBeVisible();
      expect((await client.innerText()).trim().length).toBeGreaterThan(30);
    }
  });

  // Spec 12.3: the coverage statement is what stops a user asking for
  // out-of-scope data and concluding the tool is broken.
  test("states both what is served and what is not", async ({ page }) => {
    const served = page.getByTestId("connect-coverage-served");
    const missing = page.getByTestId("connect-coverage-excluded");

    await expect(served).toBeVisible();
    await expect(missing).toBeVisible();

    // Per LINE, not per block. Asserting that the block as a whole contains
    // "2004" cannot tell which dataset supplied it: if ministries silently
    // drifted to 2005, national still contributes a 2004 and the test stays
    // green - which is the exact drift this page exists to prevent.
    const servedLines = (await served.innerText()).split("\n").filter((line) => line.includes("—"));
    const catalogue = await (await page.request.get(`${BASE_URL}/downloads/data/catalogue.json`)).json();
    expect(servedLines).toHaveLength(catalogue.datasets.length);
    expect(servedLines.find(line => line.startsWith("მშპ,"))).toContain("1960–2025");

    // Debt and the balance are served now, so the page must not still deny
    // them, and their ranges must be real rather than borrowed from a
    // neighbour: the balance reaches back further than anything else here.
    expect(servedLines.some((line) => line.startsWith("სახელმწიფო ვალი"))).toBe(true);
    const balance = servedLines.find((line) => line.includes("ბალანსი"))!;
    expect(balance).toContain("1995–2031");
    // A range, optionally followed by the projection note the two forward-
    // looking datasets carry. The range itself must still be the last data on
    // the line, so a dataset silently losing its years is still caught.
    for (const line of servedLines.filter(line => !line.startsWith("ეკონომიკური სექტორები") && !line.startsWith("სამომხმარებლო ფასების ინფლაცია"))) expect(line).toMatch(/\d{4}–\d{4}(\s*\([^)]*\))?\.?\s*$/);
    // Inflation is monthly, so like the sector line it carries several ranges; its
    // month span and the contribution start must still be real data.
    const inflation = servedLines.find((line) => line.startsWith("სამომხმარებლო ფასების ინფლაცია"))!;
    expect(inflation).toMatch(/\d{4}-\d{2}–\d{4}-\d{2}/);
    expect(inflation).toContain("2013-01");

    const municipal = servedLines.find((line) => line.includes("მუნიციპალური"))!;
    expect(municipal).toContain("2015–2025");
    // The counts are derived too, so they must be present and non-zero.
    expect(municipal).toMatch(/\d+ მუნიციპალიტეტი და \d+ რეგიონი/);

    // Revenue is consolidated receipts, NOT state-budget revenue. Getting this
    // wrong on the page that addresses AI clients hands them the premise for a
    // deficit subtraction that the data does not support.
    expect(servedLines.some((line) => line.startsWith("ნაერთი ბიუჯეტის შემოსულობები"))).toBe(true);

    const missingText = await missing.innerText();
    // Quarterly, monthly, capital projects - named explicitly. Debt was on
    // this list until the endpoint began serving it.
    expect(missingText).not.toContain("სახელმწიფო ვალი");
    expect(missingText.length).toBeGreaterThan(40);
    await expect(missing).toHaveText(/[Ⴀ-ჿ]/);
  });

  // Production discovery includes the connection page.
  test("is discoverable from the shared footer", async ({ page }) => {
    await page.goto(`${BASE_URL}/about`);

    await expect(page.locator('footer a[href="/connect"]')).toHaveCount(1);
  });

  test("stays readable on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/connect`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("connect-endpoint")).toBeVisible();
    // No horizontal scroll: the endpoint URL is the usual culprit on mobile.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("carries its own canonical metadata", async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${"https://fiscal.ge"}/connect`);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect((description ?? "").length).toBeGreaterThan(40);
  });
});


test("AI header navigation opens the active connection page on desktop and mobile", async ({ page }) => {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE_URL);
    if (width < 900) await page.getByTestId("landing-header").getByRole("button", { name: "მენიუ" }).click();
    const link = page.getByRole("navigation", { name: "ნავიგაცია", exact: true }).getByRole("link", { name: "AI", exact: true });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/connect$/);
    if (width < 900) await page.getByTestId("connect-header").getByRole("button", { name: "მენიუ" }).click();
    await expect(page.getByTestId("connect-header").getByRole("link", { name: "AI", exact: true })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

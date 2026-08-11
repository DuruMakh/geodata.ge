import { expect, test, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";

async function expectVisibleFocusOutline(locator: Locator) {
  await locator.focus();
  await expect(locator).toBeFocused();
  const outline = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThan(0);
  expect(outline.color).not.toBe("rgba(0, 0, 0, 0)");
}

for (const [path, expectedHref] of [
  ["/explorer", "/methodology"],
  ["/explorer/expenditure", "/methodology/expenditure"],
  ["/explorer/revenue", "/methodology/revenue"],
  ["/explorer/municipalities", "/methodology/municipalities"],
] as const) {
  test(`${path} ends with the approved methodology promotion`, async ({ page }) => {
    await page.goto(`http://localhost:3100${path}`);

    await expect(page.getByTestId("methodology-promo").getByRole("link")).toHaveAttribute(
      "href",
      expectedHref,
    );
    await expect(page.locator("footer")).toHaveCount(0);
  });
}

test("analysis promotion follows the active analysis side", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/analysis");

  const promotionLink = page.getByTestId("methodology-promo").getByRole("link");
  await expect(promotionLink).toHaveAttribute("href", "/methodology/expenditure");
  await page.getByTestId("analysis-side-revenue").click();
  await expect(promotionLink).toHaveAttribute("href", "/methodology/revenue");
  await expect(page.locator("footer")).toHaveCount(0);
});

for (const path of [
  "/explorer/municipalities/04",
  "/explorer/municipalities/region/imereti",
] as const) {
  test(`${path} uses one compact methodology link`, async ({ page }) => {
    await page.goto(`http://localhost:3100${path}`);

    await expect(page.getByTestId("methodology-promo")).toHaveCount(0);
    await expect(page.getByTestId("compact-methodology-link")).toHaveCount(1);
    await expect(page.getByTestId("compact-methodology-link")).toHaveAttribute(
      "href",
      "/methodology/municipalities",
    );
    await expect(page.locator("footer")).toHaveCount(0);
  });
}

test("methodology hub separates live datasets from future markers", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("მეთოდოლოგია და პირველწყაროები");
  await expect(page.getByTestId("methodology-live-row")).toHaveCount(3);
  await expect(page.getByTestId("methodology-future-row")).toHaveCount(4);
  await expect(page.getByTestId("methodology-future-row").getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/2005–2025/);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/77/);
});

test("sitemap publishes exactly the four live methodology routes", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology");
  const sitemapXml = await page.evaluate(async () => (await fetch("/sitemap.xml")).text());
  const methodologyUrls = await page.evaluate((xml) => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    return [...document.querySelectorAll("loc")]
      .map((location) => new URL(location.textContent ?? "").pathname)
      .filter((pathname) => pathname === "/methodology" || pathname.startsWith("/methodology/"));
  }, sitemapXml);

  expect(methodologyUrls).toEqual([
    "/methodology",
    "/methodology/expenditure",
    "/methodology/revenue",
    "/methodology/municipalities",
  ]);
});

test("future routes stay on the static 404 surface and out of navigation", async ({ page }) => {
  for (const slug of ["inflation", "gdp", "population", "unemployment"] as const) {
    const response = await page.goto(`http://localhost:3100/methodology/${slug}`);
    expect(response?.status(), slug).toBe(404);
    await expect(page.locator("body")).toContainText("404");
    await expect(page.locator("body")).toContainText("This page could not be found.");
  }

  await page.goto("http://localhost:3100/methodology");
  const futureRows = page.getByTestId("methodology-future-row");
  await expect(futureRows).toHaveCount(4);
  expect(
    await futureRows.evaluateAll((rows) =>
      rows.every(
        (row) =>
          (row as HTMLElement).tabIndex < 0 &&
          row.querySelectorAll("a, button, input, select, textarea, [tabindex]:not([tabindex='-1'])").length === 0,
      ),
    ),
  ).toBe(true);
});

test("methodology live rows snap off motion when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://localhost:3100/methodology");

  const row = page.getByTestId("methodology-live-row").first();
  const arrow = row.locator('[aria-hidden="true"]');
  await row.hover();

  await expect
    .poll(() => row.evaluate((element) => getComputedStyle(element).transform))
    .toBe("none");
  await expect
    .poll(() => row.evaluate((element) => getComputedStyle(element).transitionProperty))
    .toBe("none");
  await expect
    .poll(() => arrow.evaluate((element) => getComputedStyle(element).transform))
    .toBe("none");
  await expect
    .poll(() => arrow.evaluate((element) => getComputedStyle(element).transitionProperty))
    .toBe("none");
});

test("expenditure methodology exposes the complete layered article", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology/expenditure");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("ხარჯები");
  await expect(page.getByTestId("methodology-disclosure")).toContainText("GeoData");
  await expect(page.getByTestId("method-journey-step")).toHaveCount(4);
  await expect(page.getByTestId("decision-record")).toContainText("2004");
  await expect(page.getByTestId("source-archive-row")).toHaveCount(77);

  const archiveLink = page
    .getByRole("navigation", { name: "გვერდის სარჩევი" })
    .getByRole("link", { name: "უცვლელი პირველწყაროები" });
  await archiveLink.click();
  await expect(page).toHaveURL(/#source-archive$/);
  await expect(page.locator("#source-archive")).toBeInViewport();
});

test("archive filters by search and year with a visible zero state", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology/revenue#source-archive");

  const archive = page.getByTestId("source-archive");
  await archive.getByRole("button", { name: "2025", exact: true }).click();
  await expect(archive.getByRole("button", { name: "2025", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(archive.getByTestId("source-archive-row")).toHaveCount(1);
  await archive.getByRole("searchbox", { name: "პირველწყაროს ძებნა" }).fill("არარსებული ფაილი");
  await expect(archive.getByTestId("source-archive-empty")).toBeVisible();
});

test("methodology mobile layout preserves reading order, overflow, and substantial boundaries", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/methodology");

  const heading = page.getByRole("heading", { level: 1 });
  const jumpLink = page.getByRole("link", { name: "მონაცემთა მეთოდოლოგიები ↓" });
  const openDocument = page.getByRole("img", {
    name: "ღია დოკუმენტი, რომელიც პირველწყაროდან შემოწმებულ მონაცემებამდე გზას აჩვენებს",
  });
  await expect(heading).toBeVisible();
  const headingBox = await heading.boundingBox();
  const jumpBox = await jumpLink.boundingBox();
  const documentBox = await openDocument.boundingBox();
  expect(headingBox).not.toBeNull();
  expect(jumpBox).not.toBeNull();
  expect(documentBox).not.toBeNull();
  expect(headingBox!.x).toBeGreaterThanOrEqual(0);
  expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(390);
  expect(headingBox!.y + headingBox!.height).toBeLessThan(844);
  expect(documentBox!.y).toBeGreaterThanOrEqual(jumpBox!.y + jumpBox!.height);
  await expect(page.getByTestId("site-footer")).toBeVisible();

  await page.goto("http://localhost:3100/methodology/expenditure#source-archive");
  const contents = page.getByRole("navigation", { name: "გვერდის სარჩევი" });
  await expect(contents).toHaveCSS("position", "static");
  const archiveScroller = page.getByTestId("source-archive").locator("table").locator("..");
  const overflow = await archiveScroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
  expect(
    await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
    })),
  ).toEqual({ body: 390, viewport: 390 });

  await page.goto("http://localhost:3100/");
  const promotion = page.getByTestId("methodology-promo");
  const promotionVisual = promotion.getByRole("img", { name: "სამი გადაფარული პირველწყაროს დოკუმენტი" });
  const promotionTitle = promotion.getByRole("heading", { level: 2 });
  const footer = page.getByTestId("site-footer");
  const promotionBox = await promotion.boundingBox();
  const promotionVisualBox = await promotionVisual.boundingBox();
  const promotionTitleBox = await promotionTitle.boundingBox();
  const footerBox = await footer.boundingBox();
  expect(promotionBox).not.toBeNull();
  expect(promotionVisualBox).not.toBeNull();
  expect(promotionTitleBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(promotionBox!.height).toBeGreaterThan(500);
  expect(promotionTitleBox!.y).toBeGreaterThanOrEqual(promotionVisualBox!.y + promotionVisualBox!.height);
  expect(footerBox!.y).toBeGreaterThanOrEqual(promotionBox!.y + promotionBox!.height);
});

test("methodology keyboard controls expose native behavior and visible focus", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology");
  await expectVisibleFocusOutline(page.getByTestId("methodology-live-row").first());

  await page.goto("http://localhost:3100/methodology/expenditure#source-archive");
  const summary = page.getByTestId("methodology-decision").first().locator("summary");
  await expectVisibleFocusOutline(summary);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("methodology-decision").first()).toHaveAttribute("open", "");

  const archive = page.getByTestId("source-archive");
  const search = archive.getByRole("searchbox", { name: "პირველწყაროს ძებნა" });
  await search.focus();
  await expect(search).toBeFocused();
  await expectVisibleFocusOutline(archive.getByRole("button", { name: "2025", exact: true }));
  await expectVisibleFocusOutline(
    archive.getByTestId("source-archive-row").first().getByRole("link", { name: /ჩამოტვირთვა/ }),
  );
});

test("published download bytes match the archive row and manifest", async ({ page, request }) => {
  await page.goto("http://localhost:3100/methodology/expenditure#source-archive");

  const firstRow = page.getByTestId("source-archive-row").first();
  const download = firstRow.getByRole("link", { name: /ჩამოტვირთვა/ });
  const downloadHref = await download.getAttribute("href");
  const rowHash = await firstRow.getByTestId("source-archive-sha256").getAttribute("title");
  expect(downloadHref).toBeTruthy();
  expect(rowHash).toMatch(/^[a-f0-9]{64}$/);

  const manifestResponse = await request.get(
    "http://localhost:3100/downloads/methodology/expenditure/manifest.json",
  );
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as { downloadHref: string; sha256: string }[];
  const manifestRow = manifest.find((row) => row.downloadHref === downloadHref);
  expect(manifestRow).toBeTruthy();
  expect(rowHash).toBe(manifestRow?.sha256);

  const fileResponse = await request.get(`http://localhost:3100${downloadHref}`);
  expect(fileResponse.ok()).toBe(true);
  const publishedHash = createHash("sha256").update(await fileResponse.body()).digest("hex");
  expect(publishedHash).toBe(manifestRow?.sha256);

  for (const href of [
    "/downloads/methodology/expenditure/expenditure-original-sources.zip",
    "/downloads/methodology/expenditure/manifest.csv",
    "/downloads/methodology/expenditure/manifest.json",
  ]) {
    const response = await request.get(`http://localhost:3100${href}`);
    expect(response.status(), href).toBe(200);
  }
});

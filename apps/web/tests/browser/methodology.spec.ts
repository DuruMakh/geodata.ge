import { expect, test, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { LIVE_METHODOLOGY_IDS } from "../../lib/methodology/types";
import { TEST_BASE_URL } from "./test-base-url";

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

test("public header keeps landing active, exposes mission, and leaves methodology navigation inactive", async ({ page }) => {
  await page.setViewportSize({ width: 1640, height: 900 });
  await page.goto(`${TEST_BASE_URL}/`);
  const landingHeader = page.getByTestId("landing-header");
  await expect(landingHeader.getByRole("link", { name: "მთავარი", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(landingHeader.getByRole("link", { name: "მიზანი", exact: true })).toHaveAttribute("href", "/about");
  const landingHeaderBox = await landingHeader.boundingBox();
  expect(landingHeaderBox).not.toBeNull();

  for (const [path, testId] of [
    ["/methodology", "methodology-header"],
    ["/methodology/expenditure", "methodology-header"],
    ["/methodology/revenue", "methodology-header"],
    ["/methodology/municipalities", "methodology-header"],
    ["/methodology/regional-economies", "methodology-header"],
    ["/about", "about-header"],
  ] as const) {
    await page.goto(`${TEST_BASE_URL}${path}`);
    const header = page.getByTestId(testId);
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: "მთავარი", exact: true })).toHaveAttribute("href", "/");
    await expect(header.getByRole("link", { name: "მონაცემები", exact: true })).toHaveAttribute("href", "/explorer");
    await expect(header.getByRole("link", { name: "მიზანი", exact: true })).toHaveAttribute("href", "/about");
    if (path === "/about") {
      await expect(header.getByRole("link", { name: "მიზანი", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(header.getByRole("navigation").locator("[aria-current]")).toHaveCount(1);
    } else {
      await expect(header.getByRole("navigation").locator("[aria-current]")).toHaveCount(0);
    }
    await expect(header).not.toContainText(/\d{4}[–-]\d{4}/);

    const headerBox = await header.boundingBox();
    const headingBox = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(headerBox!.x).toBeCloseTo(landingHeaderBox!.x, 1);
    expect(headerBox!.width).toBeCloseTo(landingHeaderBox!.width, 1);
    expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(headingBox!.y);
  }
});

for (const path of [
  "/explorer",
  "/explorer/expenditure",
  "/explorer/revenue",
  "/explorer/analysis",
  "/explorer/municipalities",
  "/explorer/municipalities/tbilisi",
  "/explorer/municipalities/region/imereti",
] as const) {
  test(`${path} keeps the methodology link in the footer rather than inline`, async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}${path}`);

    // The owner's design puts the methodology route in the footer and in the
    // lowest section of the main pages, not on every data surface. Until the
    // explorer had a footer at all, that left these routes with no path to it.

    const footer = page.locator("footer");
    await expect(footer).toHaveCount(1);
    await expect(footer.locator('a[href^="/methodology"]')).toHaveCount(1);
    await expect(page.locator('a[href^="/methodology"]')).toHaveCount(1);
    // No repeated methodology promotion on a content page.
    await expect(page.getByRole("link", { name: "მეთოდოლოგია და პირველწყაროები", exact: true })).toHaveCount(0);
  });
}

test("methodology hub separates live datasets from future markers", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/methodology`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("მეთოდოლოგია და პირველწყაროები");
  await expect(page.getByTestId("methodology-live-row")).toHaveCount(17);
  // Unemployment, trade and demography are all live, so no future row remains to name.
  await expect(page.getByTestId("methodology-future-row")).toHaveCount(0);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/2004–2025/);
});

test("future routes stay on the static 404 surface", async ({ page }) => {
  for (const slug of ["population"] as const) {
    const response = await page.goto(`${TEST_BASE_URL}/methodology/${slug}`);
    expect(response?.status(), slug).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა" })).toHaveCount(1);
    // Home, the eleven dataset hubs and methodology.
    await expect(page.getByTestId("not-found-recovery").getByRole("link")).toHaveCount(13);
    await expect(page.locator(`link[rel="canonical"][href*="/methodology/${slug}"]`)).toHaveCount(0);
    await expect(page.locator(`meta[property="og:url"][content*="/methodology/${slug}"]`)).toHaveCount(0);
    await expect(page.getByTestId("site-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(0);
    await expect(page.getByTestId("dataset-json-ld")).toHaveCount(0);
  }
});

test("methodology live rows snap off motion when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${TEST_BASE_URL}/methodology`);

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
  await page.goto(`${TEST_BASE_URL}/methodology/expenditure`);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("ხარჯები");
  await expect(page.getByTestId("methodology-disclosure")).toContainText("Fiscal.ge");
  await expect(page.getByTestId("method-journey-step")).toHaveCount(4);
  await expect(page.getByTestId("decision-record")).toContainText("2004–2025");
  await expect(page.getByTestId("decision-record")).toContainText("1,930,210,300");
  await expect(page.getByTestId("decision-record")).toContainText("ცენტრალური ბიუჯეტი");
  await expect(page.getByTestId("decision-record")).toContainText("არ ქვეყნდება");
  await expect(page.getByTestId("source-archive-row")).toHaveCount(79);

  const archiveLink = page
    .getByRole("navigation", { name: "გვერდის სარჩევი" })
    .getByRole("link", { name: "უცვლელი პირველწყაროები" });
  await archiveLink.click();
  await expect(page).toHaveURL(/#source-archive$/);
  await expect(page.locator("#source-archive")).toBeInViewport();
});

for (const dataset of ["expenditure", "revenue", "municipalities", "debt", "regional-economies"] as const) {
  test(`${dataset} methodology article is followed by the shared footer`, async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/methodology/${dataset}`);

    const footer = page.getByTestId("site-footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: "მეთოდოლოგია", exact: true })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(
      await page.evaluate(() => {
        const article = document.querySelector("main");
        const sharedFooter = document.querySelector('[data-testid="site-footer"]');
        return Boolean(
          article &&
            sharedFooter &&
            article.compareDocumentPosition(sharedFooter) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }),
    ).toBe(true);
  });
}

// The explorer pages above check this in their footer-link loop.
test("regular content pages do not repeat the methodology promotion", async ({ page }) => {
  for (const path of [
    "/explorer/municipalities/region/adjara",
    "/explorer/municipalities/georgia",
    "/about",
  ]) {
    await page.goto(`${TEST_BASE_URL}${path}`);
    await expect(page.getByRole("link", { name: "მეთოდოლოგია და პირველწყაროები", exact: true })).toHaveCount(0);
  }
});

test("source archives describe the full coverage and selected year without exposing provenance metadata", async ({ page }) => {
  // Regional economies has two files, too few for a year filter (U29-02): its caption keeps the full coverage.
  for (const [dataset, datasetTitle, coverage, selectedYear] of [
    ["expenditure", "ხარჯების მეთოდოლოგია", "2004–2025", "2025"],
    ["revenue", "შემოსავლების მეთოდოლოგია", "2004–2025", "2025"],
    ["municipalities", "მუნიციპალიტეტების მეთოდოლოგია", "2015–2025", "2025"],
    ["regional-economies", "რეგიონების ეკონომიკა", "2010–2024", null],
  ] as const) {
    await page.goto(`${TEST_BASE_URL}/methodology/${dataset}#source-archive`);
    const archive = page.getByTestId("source-archive");
    const caption = archive.locator("table caption");

    await expect(caption).toHaveText(`${datasetTitle} — პირველწყაროების არქივი, ${coverage} წლები`);
    if (selectedYear === null) {
      await expect(archive.getByTestId("archive-year-filter")).toHaveCount(0);
    } else {
      await archive.getByRole("button", { name: selectedYear, exact: true }).click();
      await expect(caption).toHaveText(`${datasetTitle} — პირველწყაროების არქივი, ${selectedYear} წელი`);
    }
    await expect(archive.locator("thead")).not.toContainText("თარიღი");
    await expect(archive.locator("thead")).not.toContainText("SHA-256");
    await expect(archive).not.toContainText("უახლესი ჩანაწერის თარიღი");
    expect(await page.content()).not.toContain("docs/Raw Data");
  }
});

test("dataset articles omit the public methodology blocks requested for simplification", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/methodology/expenditure`);
  await expect(page.getByRole("heading", { name: "ისტორიული გადაწყვეტილებები" })).toHaveCount(0);
  await expect(page.getByTestId("decision-record")).toContainText("2004–2025");

  await page.goto(`${TEST_BASE_URL}/methodology/revenue`);
  await expect(page.getByRole("heading", { name: "ვალიდაცია" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "ტექნიკური დანართი" })).toHaveCount(0);
  await expect(page.getByTestId("decision-record")).toContainText("ფაქტი უპირატესია გეგმაზე");
  for (const title of ["კლასიფიკაცია და გარდაქმნა", "შემოწმება და შეჯერება", "შეზღუდვები"] as const) {
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "უცვლელი პირველწყაროები" })).toBeVisible();

  await page.goto(`${TEST_BASE_URL}/methodology/municipalities`);
  await expect(page.getByRole("heading", { name: "გადაწყვეტილებების სრული ჩანაწერი" })).toHaveCount(0);
  await expect(page.getByTestId("decision-record")).toHaveCount(0);
  for (const title of ["კლასიფიკაცია და გარდაქმნა", "შემოწმება და შეჯერება", "შეზღუდვები"] as const) {
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "უცვლელი პირველწყაროები" })).toBeVisible();
});

test("municipality archive copy keeps prepared geometry outside the download boundary", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/methodology/municipalities#source-archive`);

  const archiveSection = page.locator("#source-archive");
  await expect(archiveSection).toContainText("პორტალურ ექსპორტებსა და ფინანსთა სამინისტროს სამუშაო წიგნებს");
  await expect(archiveSection).toContainText("რუკის გეომეტრიის წარმომავლობა საჯარო მეთოდოლოგიაშია დოკუმენტირებული");
  await expect(archiveSection).toContainText("გეომეტრიის ასლები და პროექტის არტეფაქტები ჩამოსატვირთ არქივში არ შედის");
  await expect(archiveSection).not.toContainText("ლიცენზირებულ გეომეტრიის წყაროებს უცვლელი ბაიტებით");
});

test("method journey shows its spine only on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${TEST_BASE_URL}/methodology/expenditure`);

  const spine = page.getByTestId("method-journey-spine");
  await expect(spine).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(spine).toBeHidden();
});

test("archive filters by search and year with a visible zero state in both languages", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/methodology/revenue#source-archive`);

  const archive = page.getByTestId("source-archive");
  await archive.getByRole("button", { name: "2025", exact: true }).click();
  await expect(archive.getByRole("button", { name: "2025", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(archive.getByTestId("source-archive-row")).toHaveCount(1);
  await archive.getByRole("searchbox", { name: "პირველწყაროს ძებნა" }).fill("არარსებული ფაილი");
  await expect(archive.getByTestId("source-archive-empty")).toBeVisible();

  await page.goto(`${TEST_BASE_URL}/en/methodology/expenditure#source-archive`);
  await archive.getByRole("button", { name: "2020", exact: true }).click();
  await expect(archive.locator("caption")).toContainText("2020");
  await expect(archive.locator("caption")).not.toContainText("2004–2025");
  await archive.getByRole("searchbox", { name: "Search original sources" }).fill("no-matching-source-document");
  await expect(archive.getByTestId("source-archive-empty")).toHaveText("No sources found");
});

test("methodology mobile layout preserves reading order, overflow, and substantial boundaries", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${TEST_BASE_URL}/methodology`);

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
  expect(headingBox!.y).toBeGreaterThanOrEqual(0);
  expect(headingBox!.x).toBeGreaterThanOrEqual(0);
  expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(390);
  expect(headingBox!.y + headingBox!.height).toBeLessThan(844);
  expect(documentBox!.y).toBeGreaterThanOrEqual(jumpBox!.y + jumpBox!.height);
  await expect(page.getByTestId("site-footer")).toBeVisible();

  await page.goto(`${TEST_BASE_URL}/methodology/expenditure#source-archive`);
  const contents = page.getByRole("navigation", { name: "გვერდის სარჩევი" });
  await expect(contents).toHaveCSS("position", "static");
  // Phones get each source as a stacked block with a full-width download link
  // instead of the 760px table in a sideways scroller.
  // The header row is visually hidden but kept for screen readers (sr-only), so the stacked rows keep their column names.
  const header = (await page.getByTestId("source-archive").locator("thead").boundingBox())!;
  expect(header.width <= 1 && header.height <= 1).toBe(true);
  const archiveScroller = page.getByTestId("source-archive").locator("table").locator("..");
  expect(await archiveScroller.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
  const firstCard = page.getByTestId("source-archive-row").first();
  await expect(firstCard).toBeVisible();
  const cardDownload = firstCard.getByRole("link", { name: /ჩამოტვირთვა/ });
  const cardBox = (await firstCard.boundingBox())!;
  const downloadBox = (await cardDownload.boundingBox())!;
  expect(downloadBox.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(downloadBox.width - cardBox.width)).toBeLessThan(1);
  await expect(cardDownload).toContainText(/(PDF|XLSX?|ZIP|DOCX?|CSV|HTML?) · [\d.]+ (MB|KB|B)/);
  expect(
    await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
    })),
  ).toEqual({ body: 390, viewport: 390 });
});

test("methodology keyboard controls expose native behavior and visible focus", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/methodology`);
  await expectVisibleFocusOutline(page.getByTestId("methodology-live-row").first());

  await page.goto(`${TEST_BASE_URL}/methodology/expenditure#source-archive`);
  const summary = page.getByTestId("methodology-decision").first().locator("summary");
  const indicator = summary.getByTestId("decision-disclosure-indicator");
  await expect(indicator.locator('[data-disclosure-state="closed"]')).toBeVisible();
  await expect(indicator.locator('[data-disclosure-state="open"]')).toBeHidden();
  await expectVisibleFocusOutline(summary);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("methodology-decision").first()).toHaveAttribute("open", "");
  await expect(indicator.locator('[data-disclosure-state="closed"]')).toBeHidden();
  await expect(indicator.locator('[data-disclosure-state="open"]')).toBeVisible();

  const archive = page.getByTestId("source-archive");
  const search = archive.getByRole("searchbox", { name: "პირველწყაროს ძებნა" });
  await search.focus();
  await expect(search).toBeFocused();
  await expectVisibleFocusOutline(archive.getByRole("button", { name: "2025", exact: true }));
  await expectVisibleFocusOutline(
    archive.getByTestId("source-archive-row").first().getByRole("link", { name: /ჩამოტვირთვა/ }),
  );
  await expect(
    archive.getByRole("link", { name: "პირველწყაროების მანიფესტი — CSV ჩამოტვირთვა" }),
  ).toHaveAttribute("href", "/downloads/methodology/expenditure/manifest.csv");
  await expect(
    archive.getByRole("link", { name: "პირველწყაროების მანიფესტი — JSON ჩამოტვირთვა" }),
  ).toHaveAttribute("href", "/downloads/methodology/expenditure/manifest.json");
});

test("published download bytes match the manifest integrity record", async ({ page, request }) => {
  await page.goto(`${TEST_BASE_URL}/methodology/expenditure#source-archive`);

  const firstRow = page.getByTestId("source-archive-row").first();
  const download = firstRow.getByRole("link", { name: /ჩამოტვირთვა/ });
  const downloadHref = await download.getAttribute("href");
  expect(downloadHref).toBeTruthy();

  const manifestResponse = await request.get(
    `${TEST_BASE_URL}/downloads/methodology/expenditure/manifest.json`,
  );
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as { downloadHref: string; sha256: string }[];
  const manifestRow = manifest.find((row) => row.downloadHref === downloadHref);
  expect(manifestRow).toBeTruthy();
  expect(manifestRow?.sha256).toMatch(/^[a-f0-9]{64}$/);

  const fileResponse = await request.get(`${TEST_BASE_URL}${downloadHref}`);
  expect(fileResponse.ok()).toBe(true);
  const publishedHash = createHash("sha256").update(await fileResponse.body()).digest("hex");
  expect(publishedHash).toBe(manifestRow?.sha256);

  for (const href of [
    "/downloads/methodology/expenditure/expenditure-original-sources.zip",
    "/downloads/methodology/expenditure/manifest.csv",
    "/downloads/methodology/expenditure/manifest.json",
  ]) {
    const response = await request.get(`${TEST_BASE_URL}${href}`);
    expect(response.status(), href).toBe(200);
  }
});

for (const prefix of ["", "/en"]) {
  test(`trade methodology has the bounded source archive ${prefix || "ka"}`, async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}${prefix}/methodology/trade`);
    await expect(page.locator("#services").getByRole("link", { name: prefix ? "Geostat services trade source page" : "საქსტატის მომსახურებით ვაჭრობის გვერდი", exact: true })).toHaveAttribute("href", "https://www.geostat.ge/en/modules/categories/766/international-trade-in-services");
    await expect(page.locator('a[href*="/downloads/methodology/trade/files/"]')).toHaveCount(18);
    for (const filename of ["georgian-exports-of-services-by-types.xlsx", "georgian-imports-of-services-by-types.xlsx", "1004_180325_en.pdf"]) {
      await expect(page.locator(`a[href="/downloads/methodology/trade/files/${filename}"]`)).toHaveCount(1);
    }
    const json = JSON.parse(await page.getByTestId("dataset-json-ld").textContent() ?? "{}");
    expect(json.temporalCoverage).toBe("1995/2025");
    expect(json).not.toHaveProperty("distribution");
    expect(await readFile(path.resolve(process.cwd(), "../../data/reports/trade-overview-validation.json"), "utf8")).toContain('"status": "passed"');
  });
}


test("the two HTML originals open as sandboxed text without executing archived website scripts", async ({ page, request }) => {
  await page.goto(`${TEST_BASE_URL}/en/methodology/trade`);
  const trackingRequests: string[] = [];
  page.on("request", req => { if (/googletagmanager|google-analytics|recaptcha/.test(req.url())) trackingRequests.push(req.url()); });
  for (const [filename, hash] of [
    ["external_trade_methodology.html.txt", "8f912e38ceac487c9a80205b80e1c5de043de5cc2c753adf5b98f9b8b8c3d0b4"],
    ["metadata-en.html.txt", "4b6e3d4ed9340b75800ebbfcf880625527ec2bda0f3c1d76b14702806bed6114"],
  ]) {
    const href = `/downloads/methodology/trade/files/${filename}`;
    const response = await request.get(href);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toMatch(/^text\/plain\b/);
    expect(response.headers()["content-security-policy"]).toBe("sandbox; default-src 'none'");
    expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(hash);
    await page.locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${href.replaceAll(".", "\\.")}$`));
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/methodology\/trade$/);
  }
  expect(trackingRequests).toEqual([]);
});

test.describe("the source archive on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("keeps its column headers and table roles when stacked", async ({ page }) => {
    await page.goto("/en/methodology/wages#source-archive");
    const archive = page.getByTestId("source-archive");
    await expect(archive.locator("table")).toHaveAttribute("role", "table");
    await expect(archive.getByRole("columnheader")).toHaveCount(5);
    await expect(archive.getByTestId("source-archive-row").first().getByRole("cell")).toHaveCount(5);
  });

  test("methodology article: stacked sources, a visible search field and a contents button", async ({ page }) => {
    for (const [path, label, placeholder] of [["/methodology/expenditure", "სარჩევი ↑", "ძებნა"], ["/en/methodology/expenditure", "Contents ↑", "Search"]] as const) {
      await page.goto(path);
      const archive = page.getByTestId("source-archive");
      await expect(archive.locator("input[type='search']")).toHaveAttribute("placeholder", placeholder);
      const cards = archive.getByTestId("source-archive-row");
      expect(await cards.count()).toBeGreaterThan(10);
      const overflow = await archive.evaluate((root) => Math.max(...[...root.querySelectorAll("[data-testid='source-archive-row'] a")].map((link) => link.getBoundingClientRect().right)) - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(-16);

      // The contents button stays on screen deep in the article and jumps back up.
      const jump = page.getByTestId("methodology-contents-jump");
      await page.locator("#source-archive").scrollIntoViewIfNeeded();
      await expect(jump).toBeInViewport();
      await expect(jump).toHaveText(label);
      expect((await jump.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await jump.tap();
      await expect(page.locator("#methodology-contents")).toBeInViewport();
    }
  });
});

// U29-05: a long Georgian heading (municipalities, household income) was wider than the screen at 38px, and at 320px a 27px
// section heading (energy and food) was too. A heading may break mid-word only as a last resort, so the check turns that off:
// every word of every heading has to fit the phone as it is.
for (const width of [320, 360]) {
  for (const id of LIVE_METHODOLOGY_IDS) {
    for (const prefix of ["", "/en"]) {
      const path = `${prefix}/methodology/${id}`;
      test(`${path} fits a ${width}px phone without splitting a word`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`${TEST_BASE_URL}${path}`);
        const heading = page.getByRole("heading", { level: 1 });
        await expect(heading).toBeVisible();
        await page.addStyleTag({ content: "main h1, main article h2 { overflow-wrap: normal !important; }" });
        const fit = await page.evaluate(() => ({
          headings: [...document.querySelectorAll("main h1, main article h2")]
            .filter((element) => element.scrollWidth > element.clientWidth)
            .map((element) => element.textContent),
          page: document.documentElement.scrollWidth === document.documentElement.clientWidth,
        }));
        expect(fit).toEqual({ headings: [], page: true });
      });
    }
  }
}

import { expect, test, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";
import { expectReadableText } from "./color-contrast";
import { TEST_BASE_URL } from "./test-base-url";

// The badge shows on paper in one place today: the three cards of the Demography hub whose pages are not published. The
// methodology hub's future-dataset list and the sidebar's teaser list are both empty. The badge has no fill of its own,
// so it is measured against the card it sits on (--tile), not against the page.
for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`coming-soon badges on the Demography hub are readable on their cards at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${TEST_BASE_URL}/explorer/demography`);
    const badges = page.getByTestId("demography-hub").getByText("მალე", { exact: true });
    await expect(badges).toHaveCount(3);
    for (const badge of await badges.all()) {
      await expectReadableText(badge, badge.locator("xpath=ancestor::*[@data-testid='hub-card']"));
    }
  });
}

test("the data sidebar shows no coming-soon teaser badge", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  const sidebar = page.getByTestId("data-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(
    sidebar.getByText("მალე", { exact: true }),
    "a teaser badge is back in the sidebar: measure it here with expectReadableText(badge, sidebar), as the paper test does for its cards",
  ).toHaveCount(0);
});

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
    await expect(page.getByTestId("methodology-promo")).toHaveCount(0);

    const footer = page.locator("footer");
    await expect(footer).toHaveCount(1);
    await expect(footer.locator('a[href^="/methodology"]')).toHaveCount(1);
    await expect(page.locator('a[href^="/methodology"]')).toHaveCount(1);
  });
}

test("methodology hub separates live datasets from future markers", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/methodology`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("მეთოდოლოგია და პირველწყაროები");
  await expect(page.getByTestId("methodology-live-row")).toHaveCount(10);
  await expect(page.getByTestId("methodology-future-row")).toHaveCount(0);
  await expect(page.getByTestId("methodology-future-row").getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/2004–2025/);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/79/);
});

test("sitemap publishes exactly the live methodology routes", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/methodology`);
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
    "/methodology/debt",
    "/methodology/gdp",
    "/methodology/economic-sectors",
    "/methodology/regional-economies",
    "/methodology/inflation",
    "/methodology/unemployment",
    "/methodology/demography",
  ]);
});

test("future routes stay on the static 404 surface and out of navigation", async ({ page }) => {
  for (const slug of ["population"] as const) {
    const response = await page.goto(`${TEST_BASE_URL}/methodology/${slug}`);
    expect(response?.status(), slug).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა" })).toHaveCount(1);
    await expect(page.getByTestId("not-found-recovery").getByRole("link")).toHaveCount(5);
    await expect(page.locator(`link[rel="canonical"][href*="/methodology/${slug}"]`)).toHaveCount(0);
    await expect(page.locator(`meta[property="og:url"][content*="/methodology/${slug}"]`)).toHaveCount(0);
    await expect(page.getByTestId("site-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(0);
    await expect(page.getByTestId("dataset-json-ld")).toHaveCount(0);
  }

  await page.goto(`${TEST_BASE_URL}/methodology`);
  const futureRows = page.getByTestId("methodology-future-row");
  // Unemployment and demography are both live, so no future row remains to name.
  await expect(futureRows).toHaveCount(0);
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

test("regular content pages do not repeat the methodology promotion", async ({ page }) => {
  for (const path of [
    "/explorer/expenditure",
    "/explorer/revenue",
    "/explorer/analysis",
    "/explorer/municipalities",
    "/explorer/municipalities/tbilisi",
    "/explorer/municipalities/region/adjara",
    "/explorer/municipalities/georgia",
    "/about",
  ]) {
    await page.goto(`${TEST_BASE_URL}${path}`);
    await expect(page.getByTestId("seo-introduction")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "მეთოდოლოგია და პირველწყაროები", exact: true })).toHaveCount(0);
  }
});

test("source archives describe the full coverage and selected year without exposing provenance metadata", async ({ page }) => {
  for (const [dataset, datasetTitle, coverage, selectedYear] of [
    ["expenditure", "ხარჯების მეთოდოლოგია", "2004–2025", "2025"],
    ["revenue", "შემოსავლების მეთოდოლოგია", "2004–2025", "2025"],
    ["municipalities", "მუნიციპალიტეტების მეთოდოლოგია", "2015–2025", "2025"],
    ["regional-economies", "რეგიონების ეკონომიკა", "2010–2024", "2024"],
  ] as const) {
    await page.goto(`${TEST_BASE_URL}/methodology/${dataset}#source-archive`);
    const archive = page.getByTestId("source-archive");
    const caption = archive.locator("table caption");

    await expect(caption).toHaveText(`${datasetTitle} — პირველწყაროების არქივი, ${coverage} წლები`);
    await archive.getByRole("button", { name: selectedYear, exact: true }).click();
    await expect(caption).toHaveText(`${datasetTitle} — პირველწყაროების არქივი, ${selectedYear} წელი`);
    await expect(archive.locator("thead")).not.toContainText("თარიღი");
    await expect(archive.locator("thead")).not.toContainText("SHA-256");
    await expect(archive).not.toContainText("უახლესი ჩანაწერის თარიღი");
    await expect(archive.getByTestId("source-archive-retrieval")).toHaveCount(0);
    await expect(archive.getByTestId("source-archive-sha256")).toHaveCount(0);
    await expect(archive.getByTestId("source-archive-proxy-disclosure")).toHaveCount(0);
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

test("method journey shows its tokenized spine only on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${TEST_BASE_URL}/methodology/expenditure`);

  const spine = page.getByTestId("method-journey-spine");
  await expect(spine).toBeVisible();
  expect(
    await spine.evaluate((element) => {
      const style = getComputedStyle(element);
      const token = getComputedStyle(document.documentElement).getPropertyValue("--hairline").trim();
      return { backgroundColor: style.backgroundColor, token, width: style.width };
    }),
  ).toEqual({ backgroundColor: "rgb(217, 207, 190)", token: "#d9cfbe", width: "1px" });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(spine).toBeHidden();
});

test("archive filters by search and year with a visible zero state", async ({ page }) => {
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

  await page.goto(`${TEST_BASE_URL}/`);
  const methodology = page.getByTestId("landing-methodology");
  const methodologyTitle = methodology.getByRole("heading", { level: 2 });
  const methodologyList = methodology.locator("ol");
  const footer = page.getByTestId("site-footer");
  await expect(methodology).toBeVisible();
  await expect(methodologyTitle).toBeVisible();
  await expect(methodologyList).toBeVisible();
  await expect(footer).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  const geometry = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('[data-testid="landing-methodology"]');
    const title = section?.querySelector<HTMLElement>("h2");
    const list = section?.querySelector<HTMLOListElement>("ol");
    const footerElement = document.querySelector<HTMLElement>('[data-testid="site-footer"]');
    if (!section || !title || !list || !footerElement) return null;

    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };

    return {
      methodology: box(section),
      title: box(title),
      list: box(list),
      footer: box(footerElement),
      overflow: {
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth,
      },
    };
  });
  expect(geometry).not.toBeNull();
  if (!geometry) throw new Error("Landing methodology geometry was not found");
  expect(geometry.methodology.x).toBeGreaterThanOrEqual(0);
  expect(geometry.methodology.x + geometry.methodology.width).toBeLessThanOrEqual(390);
  expect(geometry.title.x).toBeGreaterThanOrEqual(0);
  expect(geometry.title.x + geometry.title.width).toBeLessThanOrEqual(390);
  expect(geometry.list.x).toBeGreaterThanOrEqual(0);
  expect(geometry.list.x + geometry.list.width).toBeLessThanOrEqual(390);
  expect(geometry.list.y).toBeGreaterThanOrEqual(geometry.title.y + geometry.title.height);
  expect(geometry.footer.y).toBeGreaterThanOrEqual(geometry.methodology.y + geometry.methodology.height);
  expect(geometry.overflow).toEqual({ body: 390, viewport: 390 });
});

test("landing methodology keeps its introduction and link with the left heading on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${TEST_BASE_URL}/`);

  const methodology = page.getByTestId("landing-methodology");
  const copy = methodology.getByTestId("landing-methodology-copy");
  const intro = methodology.getByTestId("landing-methodology-intro");
  const link = methodology.getByTestId("landing-methodology-link");
  const list = methodology.locator("ol");
  await expect(copy).toBeVisible();
  await expect(intro).toBeVisible();
  await expect(link).toBeVisible();
  await expect(list).toBeVisible();

  const positions = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('[data-testid="landing-methodology"]')!;
    const box = (selector: string) => {
      const rect = section.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top };
    };
    return {
      copy: box('[data-testid="landing-methodology-copy"]'),
      intro: box('[data-testid="landing-methodology-intro"]'),
      link: box('[data-testid="landing-methodology-link"]'),
      list: box("ol"),
    };
  });

  expect(positions.intro.left).toBeGreaterThanOrEqual(positions.copy.left);
  expect(positions.intro.right).toBeLessThanOrEqual(positions.copy.right);
  expect(positions.link.left).toBeGreaterThanOrEqual(positions.copy.left);
  expect(positions.link.right).toBeLessThanOrEqual(positions.copy.right);
  expect(positions.list.left).toBeGreaterThan(positions.copy.right);
  expect(positions.list.top).toBeLessThanOrEqual(positions.intro.top);
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

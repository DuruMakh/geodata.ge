import { expect, test, type Locator, type Page } from "@playwright/test";
import { MUNICIPALITY_ROUTES } from "../../lib/explorer/municipalityRoutes";
import { computedCssColorAlpha } from "./focus-outline";
import { TEST_BASE_URL } from "./test-base-url";

const BASE_URL = process.env.SEO_BASE_URL ?? TEST_BASE_URL;

test("uses the shared browser artifact when no SEO-specific URL is configured", async ({ page }) => {
  test.skip(Boolean(process.env.SEO_BASE_URL), "SEO_BASE_URL intentionally overrides the shared artifact URL");

  await page.goto(BASE_URL);

  const expectedOrigin = new URL(TEST_BASE_URL).origin;
  expect(new URL(page.url()).origin).toBe(expectedOrigin);
});

async function expectMinimumTarget(locator: Locator, size = 24) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(size);
  expect(box!.height).toBeGreaterThanOrEqual(size);
}

async function expectNonOverlappingTargets(locator: Locator) {
  const boxes = await Promise.all((await locator.all()).map((target) => target.boundingBox()));
  expect(boxes.every((box) => box !== null)).toBe(true);

  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      const a = boxes[first]!;
      const b = boxes[second]!;
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps, `targets ${first} and ${second} overlap`).toBe(false);
    }
  }
}

async function expectKeyboardFocusOrder(page: Page, locator: Locator) {
  const links = await locator.all();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  for (let index = 0; index < links.length; index += 1) {
    const link = links[index]!;
    let reachedTarget = false;

    for (let tab = 0; tab < 100; tab += 1) {
      await page.keyboard.press("Tab");
      const focusedIndex = await locator.evaluateAll((elements) => elements.findIndex((element) => element === document.activeElement));
      expect(focusedIndex, `target ${index} was skipped in keyboard order`).not.toBeGreaterThan(index);
      if (focusedIndex !== index) continue;

      await expect(link).toBeFocused();
      const outline = await link.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.outlineColor,
          style: style.outlineStyle,
          width: Number.parseFloat(style.outlineWidth),
        };
      });
      expect(await link.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
      expect(outline.style).not.toBe("none");
      expect(outline.width).toBeGreaterThan(0);
      expect(computedCssColorAlpha(outline.color)).toBeGreaterThan(0);
      reachedTarget = true;
      break;
    }

    expect(reachedTarget, `target ${index} was not reached by Tab`).toBe(true);
  }
}

test("outline alpha parser rejects fully transparent colored outlines", () => {
  expect(computedCssColorAlpha("rgba(255, 0, 0, 0)")).toBe(0);
  expect(computedCssColorAlpha("rgb(255 0 0 / 0%)")).toBe(0);
  expect(computedCssColorAlpha("oklab(none none none / 0)")).toBe(0);
  expect(computedCssColorAlpha("color(display-p3 1 0 0)")).toBe(1);
});

async function expectNoPageOverflow(page: Page) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

const representativeRoutes = [
  { route: "/", canonical: "https://fiscal.ge/" },
  { route: "/explorer/expenditure", canonical: "https://fiscal.ge/explorer/expenditure" },
  { route: "/explorer/revenue", canonical: "https://fiscal.ge/explorer/revenue" },
  { route: "/explorer/analysis", canonical: "https://fiscal.ge/explorer/analysis" },
  { route: "/explorer/debt", canonical: "https://fiscal.ge/explorer/debt" },
  { route: "/explorer/deficit", canonical: "https://fiscal.ge/explorer/deficit" },
  { route: "/explorer/municipalities", canonical: "https://fiscal.ge/explorer/municipalities" },
  { route: "/explorer/municipalities/tbilisi", canonical: "https://fiscal.ge/explorer/municipalities/tbilisi" },
  { route: "/explorer/municipalities/region/imereti", canonical: "https://fiscal.ge/explorer/municipalities/region/imereti" },
  { route: "/explorer/municipalities/georgia", canonical: "https://fiscal.ge/explorer/municipalities/georgia" },
  { route: "/methodology", canonical: "https://fiscal.ge/methodology" },
  { route: "/methodology/expenditure", canonical: "https://fiscal.ge/methodology/expenditure" },
  { route: "/about", canonical: "https://fiscal.ge/about" },
] as const;

for (const { route, canonical } of representativeRoutes) {
  test(`${route} exposes Fiscal.ge search metadata`, async ({ page }) => {
    await page.goto(`${BASE_URL}${route}`);
    const canonicalLink = page.locator('link[rel="canonical"]');
    const openGraphUrl = page.locator('meta[property="og:url"]');
    await expect(canonicalLink).toHaveCount(1);
    await expect(openGraphUrl).toHaveCount(1);
    await expect(canonicalLink).toHaveAttribute("href", canonical);
    await expect(openGraphUrl).toHaveAttribute("content", canonical);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/fiscal\.ge\//);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
  });
}

test("Link navigation keeps exactly one route-correct canonical and Open Graph URL", async ({ page }) => {
  async function expectUrlMetadata(expected: string) {
    const canonical = page.locator('link[rel="canonical"]');
    const openGraphUrl = page.locator('meta[property="og:url"]');
    await expect(canonical).toHaveCount(1);
    await expect(openGraphUrl).toHaveCount(1);
    await expect(canonical).toHaveAttribute("href", expected);
    await expect(openGraphUrl).toHaveAttribute("content", expected);
  }

  await page.goto(`${BASE_URL}/explorer/expenditure`);
  await expectUrlMetadata("https://fiscal.ge/explorer/expenditure");

  await page.locator('[data-testid="data-sidebar"] a[href="/"]').first().click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
  await expectUrlMetadata("https://fiscal.ge/");

  await page.getByRole("link", { name: "მონაცემები", exact: true }).click();
  await expect(page).toHaveURL(`${BASE_URL}/explorer`);
  await expectUrlMetadata("https://fiscal.ge/explorer");
});

test("explorer datasets publish stable ids and downloadable CSV distributions", async ({ page, request }) => {
  for (const { route, downloadPath } of [
    { route: "/explorer/expenditure", downloadPath: "/downloads/data/national-expenditure.csv" },
    { route: "/explorer/revenue", downloadPath: "/downloads/data/national-revenue.csv" },
    { route: "/explorer/municipalities", downloadPath: "/downloads/data/municipal-expenditure.csv" },
    { route: "/explorer/deficit", downloadPath: "/downloads/data/general-government-balance.csv" },
  ] as const) {
    await page.goto(`${BASE_URL}${route}`);
    const node = JSON.parse(await page.getByTestId("explorer-dataset-json-ld").textContent() ?? "{}");
    expect(node["@id"]).toBe(`https://fiscal.ge${route}#dataset`);
    expect(node.distribution).toEqual([
      expect.objectContaining({
        "@type": "DataDownload",
        contentUrl: `https://fiscal.ge${downloadPath}`,
      }),
    ]);
    expect((await request.get(`${BASE_URL}${downloadPath}`)).status()).toBe(200);
  }
});

test("Government Debt Dataset metadata includes the service projection horizon", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/debt`);
  const node = JSON.parse(await page.getByTestId("explorer-dataset-json-ld").textContent() ?? "{}");

  expect(node.temporalCoverage).toBe("2013/2030");
  expect(node.description).toContain("2026–2030");
  expect(node.description).toContain("პროგნოზი");
});

test("general-government deficit metadata includes the IMF projection horizon", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/deficit`);
  const node = JSON.parse(await page.getByTestId("explorer-dataset-json-ld").textContent() ?? "{}");

  expect(node.temporalCoverage).toBe("1995/2031");
  expect(node.description).toContain("2026–2031");
  expect(node.description).toContain("პროგნოზია");
});

test("the GDP methodology page emits the shared Dataset vocabulary", async ({ page }) => {
  for (const path of ["/methodology/gdp", "/en/methodology/gdp"]) {
    await page.goto(`${BASE_URL}${path}`);
    const node = JSON.parse(await page.getByTestId("dataset-json-ld").textContent() ?? "{}");

    expect(node["@type"], path).toBe("Dataset");
    expect(Array.isArray(node.keywords), `${path} keywords`).toBe(true);
    expect(node.keywords.length, `${path} keywords`).toBeGreaterThan(0);
    expect(Array.isArray(node.variableMeasured), `${path} variableMeasured`).toBe(true);
    expect(Array.isArray(node.distribution), `${path} distribution`).toBe(true);
    expect(node.distribution.map((entry: { contentUrl: string }) => entry.contentUrl), path).toContain(
      "https://fiscal.ge/downloads/data/gdp-overview.csv",
    );
  }
});

test("only third-party methodology source originals send a noindex header", async ({ request }) => {
  const original = await request.get(
    `${BASE_URL}/downloads/methodology/expenditure/files/2004/mof-annual-execution-annex.pdf`,
  );
  const processed = await request.get(`${BASE_URL}/downloads/data/national-expenditure.csv`);
  const methodologyPage = await request.get(`${BASE_URL}/methodology/expenditure`);

  expect(original.headers()["x-robots-tag"]).toBe("noindex, follow");
  expect(processed.headers()["x-robots-tag"]).toBeUndefined();
  expect(methodologyPage.headers()["x-robots-tag"]).toBeUndefined();
});

test("agent instructions publish a plain-text guide with working public links", async ({ request }) => {
  const response = await request.get(`${BASE_URL}/llms.txt`);

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]?.toLowerCase()).toBe("text/plain; charset=utf-8");

  const targets = [...(await response.text()).matchAll(/\]\((https:\/\/fiscal\.ge\/[^)]*)\)/g)].map((match) => match[1]!);
  expect(targets).not.toHaveLength(0);

  for (const target of targets) {
    const listedResponse = await request.get(`${BASE_URL}${new URL(target).pathname}`);
    expect(listedResponse.status(), target).toBe(200);
  }
});

test("404 recovery keeps a real not-found response with useful, accessible destinations", async ({ page, request }) => {
  const path = "/this-route-does-not-exist";
  const response = await request.get(`${BASE_URL}${path}`);
  const html = await response.text();
  const rscPrefetchRequests: string[] = [];

  page.on("request", (pageRequest) => {
    const url = new URL(pageRequest.url());
    if (url.searchParams.has("_rsc")) rscPrefetchRequests.push(url.pathname);
  });

  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]?.toLowerCase()).toContain("text/html");
  for (const href of ["/", "/explorer", "/explorer/economy", "/explorer/inflation", "/explorer/unemployment", "/methodology"]) {
    expect(html).toContain(`href=\"${href}\"`);
  }

  const consoleIssues: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    const isExpectedNotFoundStatus = message.text() === "Failed to load resource: the server responded with a status of 404 (Not Found)";
    if ((message.type() === "warning" || message.type() === "error") && !isExpectedNotFoundStatus) {
      consoleIssues.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const navigation = await page.goto(`${BASE_URL}${path}`);

    expect(navigation?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "გვერდი ვერ მოიძებნა" })).toHaveCount(1);
    const recovery = page.getByTestId("not-found-recovery");
    await expect(recovery).toContainText("მისამართი არ არსებობს ან გვერდი გადატანილია.");
    const links = recovery.getByRole("link");
    await expect(links).toHaveCount(7);
    for (const href of ["/", "/explorer", "/explorer/economy", "/explorer/inflation", "/explorer/unemployment", "/explorer/trade", "/methodology"]) {
      await expect(recovery.locator(`[href=\"${href}\"]`)).toHaveCount(1);
    }
    await expectNoPageOverflow(page);
    await expectKeyboardFocusOrder(page, links);
    await page.waitForTimeout(500);
  }

  expect(rscPrefetchRequests).toEqual([]);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("breadcrumb links keep non-overlapping 24px mobile targets and keyboard focus", async ({ page }) => {
  test.setTimeout(90_000);

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 767, height: 844 },
  ]) {
    await page.setViewportSize(viewport);

    for (const route of ["/methodology/expenditure", "/explorer/expenditure", "/explorer/municipalities/tbilisi"] as const) {
      await page.goto(`${BASE_URL}${route}`);
      const breadcrumb = route.startsWith("/explorer")
        ? page.getByTestId("explorer-header").getByRole("navigation", { name: "Breadcrumb" })
        : page.getByRole("navigation", { name: "Breadcrumb" });
      const links = breadcrumb.getByRole("link");

      expect(await links.count()).toBeGreaterThan(0);
      for (const link of await links.all()) {
        await expectMinimumTarget(link);
      }
      await expectKeyboardFocusOrder(page, links);
      await expectNonOverlappingTargets(links);
      await expectNoPageOverflow(page);
    }
  }
});

test("entity datasets use final URLs and omit unavailable workbook distributions", async ({ page }) => {
  for (const route of [
    "/explorer/municipalities/tbilisi",
    "/explorer/municipalities/region/imereti",
    "/explorer/municipalities/georgia",
  ] as const) {
    await page.goto(`${BASE_URL}${route}`);
    const node = JSON.parse(await page.getByTestId("explorer-dataset-json-ld").textContent() ?? "{}");
    expect(node["@id"]).toBe(`https://fiscal.ge${route}#dataset`);
    expect(node).not.toHaveProperty("distribution");
  }

  await page.goto(`${BASE_URL}/explorer/analysis`);
  await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(0);
});

test("site Organization schema publishes the reviewed SVG logo without unverified graph claims", async ({ page, request }) => {
  await page.goto(`${BASE_URL}/`);
  const raw = await page.getByTestId("site-json-ld").textContent() ?? "{}";
  const graph = JSON.parse(raw);
  const organization = graph["@graph"].find(
    (node: { "@type"?: string }) => node["@type"] === "Organization",
  );
  expect(organization.logo).toEqual({
    "@type": "ImageObject",
    url: "https://fiscal.ge/fiscal-ge-logo.svg",
    width: 520,
    height: 650,
  });
  expect(raw).not.toContain("sameAs");
  expect(raw).not.toContain("SearchAction");

  const logo = await request.get(`${BASE_URL}/fiscal-ge-logo.svg`);
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
});

test("raw homepage response retains meaningful content, heading order, and core links", async ({ request }) => {
  const response = await request.get(`${BASE_URL}/`);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  const serverHtml = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const meaningfulText = serverHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const headingSequence = [...serverHtml.matchAll(/<h([1-6])(?:\s[^>]*)?>/gi)].map((match) => `H${match[1]}`);
  const serverLinkHrefs = [...serverHtml.matchAll(/<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>/gi)].map(
    (match) => match[2],
  );

  expect(meaningfulText.length).toBeGreaterThan(500);
  expect(headingSequence).toEqual(["H1", "H2", "H2", "H2", "H2", "H2", "H2"]);
  expect(serverLinkHrefs).toContain("/explorer");
  expect(serverLinkHrefs).toContain("/explorer/debt");
  expect(serverLinkHrefs).toContain("/explorer/deficit");
  expect(serverLinkHrefs).toContain("/methodology");
});

test("root metadata publishes the reviewed browser and Apple icons", async ({ page }) => {
  await page.goto(`${BASE_URL}/`);
  const iconHrefs = await page.locator('link[rel="icon"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLLinkElement).href),
  );
  const appleHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(iconHrefs.some((href) => href.includes("/icon.svg"))).toBe(true);
  expect(appleHref).toContain("/apple-icon.png");

  const emittedHrefs = [...iconHrefs, new URL(appleHref!, BASE_URL).href];
  for (const [pathname, expectedContentType] of [
    ["/favicon.ico", "image/x-icon"],
    ["/icon.svg", "image/svg+xml"],
    ["/apple-icon.png", "image/png"],
  ] as const) {
    const href = emittedHrefs.find((candidate) => new URL(candidate).pathname === pathname);
    expect(href, `${pathname} metadata link`).toBeDefined();
    const response = await page.evaluate(async (url) => {
      const result = await fetch(url, { cache: "no-store" });
      return {
        contentType: result.headers.get("content-type"),
        ok: result.ok,
      };
    }, href!);
    expect(response.ok).toBe(true);
    expect(response.contentType).toBe(expectedContentType);
  }
});

test("municipality navigation uses crawlable links", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/municipalities`);
  const municipalityHrefs = await page
    .getByTestId("municipal-list-row")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(municipalityHrefs).toHaveLength(64);
  expect(new Set(municipalityHrefs)).toEqual(
    new Set(MUNICIPALITY_ROUTES.map(({ slug }) => `/explorer/municipalities/${slug}`)),
  );
});

test("legacy municipality codes redirect directly to their canonical slugs and keep browser hash state", async ({ page, request }) => {
  test.setTimeout(60_000);

  for (const { code, slug } of MUNICIPALITY_ROUTES) {
    const oldResponse = await request.get(`${BASE_URL}/explorer/municipalities/${code}`, { maxRedirects: 0 });
    expect(oldResponse.status(), code).toBe(308);
    expect(oldResponse.headers().location, code).toBe(`/explorer/municipalities/${slug}`);
    const slugResponse = await request.get(`${BASE_URL}/explorer/municipalities/${slug}`, { maxRedirects: 0 });
    expect(slugResponse.status(), slug).toBe(200);
  }

  await page.goto(`${BASE_URL}/explorer/municipalities/06#r=2016-2021`);
  await expect(page).toHaveURL((url) =>
    url.pathname === "/explorer/municipalities/batumi" && new URLSearchParams(url.hash.slice(1)).get("r") === "2016-2021",
  );
  await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2016");
  await expect(page.getByTestId("range-end-handle")).toHaveAttribute("aria-valuenow", "2021");
  expect((await request.get(`${BASE_URL}/explorer/municipalities/unknown`)).status()).toBe(404);
});

test("sitemap publishes every municipality slug and no numeric municipality page", async ({ request }) => {
  const xml = await (await request.get(`${BASE_URL}/sitemap.xml`)).text();
  const paths = [...xml.matchAll(/<loc>https:\/\/[^/]+([^<]+)<\/loc>/g)].map((match) => match[1]);
  const municipalityPaths = paths.filter((path) => /^\/explorer\/municipalities\/(?!georgia$|region\/)/.test(path));

  expect(municipalityPaths).toEqual(MUNICIPALITY_ROUTES.map(({ slug }) => `/explorer/municipalities/${slug}`));
  expect(municipalityPaths.some((path) => /\/\d{2}$/.test(path))).toBe(false);
});

test("sitemap keeps its XML contract and offers a readable browser view", async ({ page, request }) => {
  const response = await request.get(`${BASE_URL}/sitemap.xml`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]?.toLowerCase()).toContain("application/xml");

  const xml = await response.text();
  expect(xml).toContain('<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>');
  expect([...xml.matchAll(/<loc>https:\/\/[^<]+<\/loc>/g)]).toHaveLength(486);
  expect(xml).toContain("<loc>https://fiscal.ge/explorer/trade/partners</loc>");
  expect(xml).toContain("<loc>https://fiscal.ge/en/explorer/trade/partners</loc>");
  expect(xml).toContain("<loc>https://fiscal.ge/explorer/trade/products</loc>");
  expect(xml).toContain("<loc>https://fiscal.ge/en/explorer/trade/products</loc>");

  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleIssues.push(message.text());
  });
  page.on("pageerror", (error) => consoleIssues.push(error.message));

  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const navigation = await page.goto(`${BASE_URL}/sitemap.xml`);
    expect(navigation?.status()).toBe(200);
    await expect(page).toHaveTitle("Fiscal.ge / XML sitemap");
    await expect(page.getByRole("heading", { name: "Public pages" })).toHaveCount(1);
    await expect(page.locator(".sitemap-row")).toHaveCount(486);
    await expectNoPageOverflow(page);

    if (viewport.width < 720) {
      const firstRowGeometry = await page.locator(".sitemap-row").first().evaluate((row) => {
        const url = row.querySelector<HTMLElement>(".url")!.getBoundingClientRect();
        const lastModified = row.querySelector<HTMLElement>(".last-modified")!.getBoundingClientRect();
        return { urlBottom: url.bottom, lastModifiedTop: lastModified.top };
      });
      expect(firstRowGeometry.lastModifiedTop).toBeGreaterThanOrEqual(firstRowGeometry.urlBottom);
    }
  }

  expect(consoleIssues).toEqual([]);
});

test("municipality index server-renders the existing country and region tab links", async ({ page, request }) => {
  const response = await request.get(`${BASE_URL}/explorer/municipalities`);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  const countryHrefs = html.match(/href="\/explorer\/municipalities\/georgia"/g) ?? [];
  const regionHrefs = html.match(/href="\/explorer\/municipalities\/region\/[^\"]+"/g) ?? [];
  const municipalityHrefs = [
    ...html.matchAll(/href="(\/explorer\/municipalities\/(?!georgia")[a-z][a-z0-9-]*)"/g),
  ].map((match) => match[1]);
  expect(countryHrefs).toHaveLength(1);
  expect(regionHrefs).toHaveLength(11);
  expect(municipalityHrefs).toHaveLength(64);
  expect(new Set(municipalityHrefs)).toEqual(
    new Set(MUNICIPALITY_ROUTES.map(({ slug }) => `/explorer/municipalities/${slug}`)),
  );
  expect(html).toMatch(/data-testid="municipal-list-region"[^>]* hidden=""/);

  await page.goto(`${BASE_URL}/explorer/municipalities`);

  const country = page.locator('a[href="/explorer/municipalities/georgia"]');
  const regions = page.locator('a[href^="/explorer/municipalities/region/"]');
  await expect(country).toHaveCount(1);
  await expect(regions).toHaveCount(11);
  await expect(country).toBeHidden();
  await expect(regions.first()).toBeHidden();
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(64);

  await page.getByTestId("level-region").click();
  await expect(country).toBeVisible();
  await expect(regions.first()).toBeVisible();
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
});

test("municipality breadcrumbs include the region in visible and structured hierarchy", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/municipalities/chiatura`);

  // Only the trail on screen: below 768px a separate back-link replaces it.
  const visibleLabels = await page
    .locator('nav[aria-label="Breadcrumb"]:visible')
    .locator('a, [aria-current="page"]')
    .allTextContents();
  const structured = await page.locator('[data-testid="breadcrumb-json-ld"]').textContent();
  const structuredLabels = JSON.parse(structured ?? "{}").itemListElement.map(
    (item: { name: string }) => item.name,
  );

  expect(visibleLabels).toEqual([
    "მთავარი",
    "ბიუჯეტი",
    "მუნიციპალიტეტები",
    "იმერეთი",
    "ჭიათურა",
  ]);
  expect(structuredLabels).toEqual([
    "მთავარი",
    "ბიუჯეტი",
    "მუნიციპალიტეტები",
    "იმერეთი",
    "ჭიათურა",
  ]);
  await expect(page.locator('nav[aria-label="Breadcrumb"]:visible a', { hasText: "იმერეთი" })).toHaveAttribute(
    "href",
    "/explorer/municipalities/region/imereti",
  );
});

test("Tbilisi municipality breadcrumbs distinguish the region from the city", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/municipalities/tbilisi`);

  const expectedLabels = [
    "მთავარი",
    "ბიუჯეტი",
    "მუნიციპალიტეტები",
    "თბილისის რეგიონი",
    "თბილისი",
  ];
  const visibleLabels = await page
    .locator('nav[aria-label="Breadcrumb"]:visible')
    .locator('a, [aria-current="page"]')
    .allTextContents();
  const structured = await page.locator('[data-testid="breadcrumb-json-ld"]').textContent();
  const structuredLabels = JSON.parse(structured ?? "{}").itemListElement.map(
    (item: { name: string }) => item.name,
  );

  expect(visibleLabels).toEqual(expectedLabels);
  expect(structuredLabels).toEqual(expectedLabels);
  await expect(page.locator('nav[aria-label="Breadcrumb"]:visible a', { hasText: "თბილისის რეგიონი" })).toHaveAttribute(
    "href",
    "/explorer/municipalities/region/tbilisi",
  );
});

test("explorer hub explains the reviewed data scope and available actions", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer`);

  const introduction = page.getByTestId("explorer-hub-introduction");
  await expect(introduction).toHaveText(
    "Fiscal.ge აერთიანებს საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების, მთავრობის ვალისა და ზოგადი მთავრობის დეფიციტის გადამოწმებულ მონაცემებს. შეადარეთ წლები და მაჩვენებლები, ან ჩამოტვირთეთ მონაცემები Excel ფორმატში.",
  );
});

test("methodology exposes a stable processed-data download", async ({ page, request }) => {
  await page.goto(`${BASE_URL}/methodology/expenditure`);
  await expect(page.getByTestId("processed-dataset-download")).toHaveAttribute(
    "href",
    "/downloads/data/national-expenditure.csv",
  );
  const response = await request.get(`${BASE_URL}/downloads/data/national-expenditure.csv`);
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
});

for (const [route, expectedLabels] of [
  ["/methodology", ["მთავარი", "მეთოდოლოგია"]],
  ["/methodology/expenditure", ["მთავარი", "მეთოდოლოგია", "ხარჯების მეთოდოლოგია"]],
] as const) {
  test(`${route} keeps visible and structured breadcrumbs aligned`, async ({ page }) => {
    await page.goto(`${BASE_URL}${route}`);
    const visibleLabels = await page
      .locator('nav[aria-label="Breadcrumb"] [data-breadcrumb-label]')
      .allTextContents();
    const structured = await page.locator('[data-testid="breadcrumb-json-ld"]').textContent();
    const structuredLabels = JSON.parse(structured ?? "{}").itemListElement.map(
      (item: { name: string }) => item.name,
    );

    expect(visibleLabels).toEqual([...expectedLabels]);
    expect(structuredLabels).toEqual([...expectedLabels]);
  });
}

test("the municipal parent dataset lists exactly the entity pages that exist", async ({ page, request }) => {
  await page.goto(`${BASE_URL}/explorer/municipalities`);
  const parent = JSON.parse(
    (await page.getByTestId("explorer-dataset-json-ld").textContent()) ?? "{}",
  );
  const parts: string[] = parent.hasPart.map((part: { "@id": string }) => part["@id"]);
  for (const part of parent.hasPart) {
    expect(part["@type"]).toBe("Dataset");
    expect(part.name.length).toBeGreaterThan(0);
    expect(part.description.length).toBeGreaterThanOrEqual(50);
    expect(part.creator).toMatchObject({ "@type": "Organization", name: "Fiscal.ge" });
    expect(part.license).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(part).not.toHaveProperty("distribution");
  }

  // The sitemap is the site's own statement of which entity pages exist, so the
  // two cannot drift apart without this failing.
  const sitemap = await (await request.get(`${BASE_URL}/sitemap.xml`)).text();
  // Dataset @ids are locale-independent, so only the canonical Georgian URLs
  // take part: the /en twins resolve to the same identity.
  const entityUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => /\/explorer\/municipalities\/./.test(url) && !url.includes("/en/"));

  expect(parts.toSorted()).toEqual(entityUrls.map((url) => `${url}#dataset`).toSorted());
  expect(new Set(parts).size).toBe(parts.length);

  // ...and the relationship closes in the other direction.
  for (const route of ["/explorer/municipalities/tbilisi", "/explorer/municipalities/georgia"]) {
    await page.goto(`${BASE_URL}${route}`);
    const child = JSON.parse(
      (await page.getByTestId("explorer-dataset-json-ld").textContent()) ?? "{}",
    );
    expect(child.isPartOf["@id"]).toBe("https://fiscal.ge/explorer/municipalities#dataset");
    expect(parts).toContain(child["@id"]);
  }
});

test("the country aggregate does not claim the per-resident measure", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/municipalities/georgia`);
  const node = JSON.parse(
    (await page.getByTestId("explorer-dataset-json-ld").textContent()) ?? "{}",
  );
  const measures = node.variableMeasured.map((measure: { propertyID: string }) => measure.propertyID);
  expect(measures).toEqual(["amount_gel", "share_of_total_pct"]);
});

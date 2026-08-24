import { expect, test } from "@playwright/test";
import { MUNICIPALITY_ROUTES } from "../../lib/explorer/municipalityRoutes";

const BASE_URL = process.env.SEO_BASE_URL ?? "http://localhost:3100";

const representativeRoutes = [
  { route: "/", canonical: "https://fiscal.ge/" },
  { route: "/explorer/expenditure", canonical: "https://fiscal.ge/explorer/expenditure" },
  { route: "/explorer/revenue", canonical: "https://fiscal.ge/explorer/revenue" },
  { route: "/explorer/analysis", canonical: "https://fiscal.ge/explorer/analysis" },
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
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/fiscal\.ge\//);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
  });
}

test("explorer datasets publish stable ids and downloadable CSV distributions", async ({ page, request }) => {
  for (const { route, downloadPath } of [
    { route: "/explorer/expenditure", downloadPath: "/downloads/data/national-expenditure.csv" },
    { route: "/explorer/revenue", downloadPath: "/downloads/data/national-revenue.csv" },
    { route: "/explorer/municipalities", downloadPath: "/downloads/data/municipal-expenditure.csv" },
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

test("site Organization schema publishes the square SVG logo without unverified graph claims", async ({ page, request }) => {
  await page.goto(`${BASE_URL}/`);
  const raw = await page.getByTestId("site-json-ld").textContent() ?? "{}";
  const graph = JSON.parse(raw);
  const organization = graph["@graph"].find(
    (node: { "@type"?: string }) => node["@type"] === "Organization",
  );
  expect(organization.logo).toEqual({
    "@type": "ImageObject",
    url: "https://fiscal.ge/fiscal-ge-logo.svg",
    width: 512,
    height: 512,
  });
  expect(raw).not.toContain("sameAs");
  expect(raw).not.toContain("SearchAction");

  const logo = await request.get(`${BASE_URL}/fiscal-ge-logo.svg`);
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
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
    url.pathname === "/explorer/municipalities/batumi" && url.hash === "#r=2016-2021",
  );
  expect((await request.get(`${BASE_URL}/explorer/municipalities/unknown`)).status()).toBe(404);
});

test("sitemap publishes every municipality slug and no numeric municipality page", async ({ request }) => {
  const xml = await (await request.get(`${BASE_URL}/sitemap.xml`)).text();
  const paths = [...xml.matchAll(/<loc>https:\/\/[^/]+([^<]+)<\/loc>/g)].map((match) => match[1]);
  const municipalityPaths = paths.filter((path) => /^\/explorer\/municipalities\/(?!georgia$|region\/)/.test(path));

  expect(municipalityPaths).toEqual(MUNICIPALITY_ROUTES.map(({ slug }) => `/explorer/municipalities/${slug}`));
  expect(municipalityPaths.some((path) => /\/\d{2}$/.test(path))).toBe(false);
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

  const visibleLabels = await page
    .locator('nav[aria-label="Breadcrumb"] a, nav[aria-label="Breadcrumb"] [aria-current="page"]')
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
  await expect(page.locator('nav[aria-label="Breadcrumb"] a', { hasText: "იმერეთი" })).toHaveAttribute(
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
    .locator('nav[aria-label="Breadcrumb"] a, nav[aria-label="Breadcrumb"] [aria-current="page"]')
    .allTextContents();
  const structured = await page.locator('[data-testid="breadcrumb-json-ld"]').textContent();
  const structuredLabels = JSON.parse(structured ?? "{}").itemListElement.map(
    (item: { name: string }) => item.name,
  );

  expect(visibleLabels).toEqual(expectedLabels);
  expect(structuredLabels).toEqual(expectedLabels);
  await expect(page.locator('nav[aria-label="Breadcrumb"] a', { hasText: "თბილისის რეგიონი" })).toHaveAttribute(
    "href",
    "/explorer/municipalities/region/tbilisi",
  );
});

test("explorer hub explains the reviewed data scope and available actions", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer`);

  const introduction = page.getByTestId("explorer-hub-introduction");
  await expect(introduction).toHaveText(
    "Fiscal.ge აერთიანებს საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებულ ფაქტობრივ მონაცემებს. შეადარეთ წლები, სფეროები და მუნიციპალიტეტები, ან ჩამოტვირთეთ მონაცემები Excel ფორმატში.",
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
  ["/about", ["მთავარი", "Fiscal.ge-ის შესახებ"]],
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

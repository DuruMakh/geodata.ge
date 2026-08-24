import { expect, test } from "@playwright/test";

const BASE_URL = process.env.SEO_BASE_URL ?? "http://localhost:3100";

const representativeRoutes = [
  "/",
  "/explorer/expenditure",
  "/explorer/revenue",
  "/explorer/analysis",
  "/explorer/municipalities",
  "/explorer/municipalities/04",
  "/explorer/municipalities/region/imereti",
  "/methodology",
  "/methodology/expenditure",
  "/about",
] as const;

for (const route of representativeRoutes) {
  test(`${route} exposes Fiscal.ge search metadata`, async ({ page }) => {
    await page.goto(`${BASE_URL}${route}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https:\/\/fiscal\.ge/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/fiscal\.ge\//);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
  });
}

test("municipality navigation uses crawlable links", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/municipalities`);
  await expect(page.getByTestId("municipal-list-row").first()).toHaveAttribute(
    "href",
    /\/explorer\/municipalities\/\d+/,
  );
});

test("municipality index server-renders the existing country and region tab links", async ({ page, request }) => {
  const response = await request.get(`${BASE_URL}/explorer/municipalities`);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  const countryHrefs = html.match(/href="\/explorer\/municipalities\/georgia"/g) ?? [];
  const regionHrefs = html.match(/href="\/explorer\/municipalities\/region\/[^\"]+"/g) ?? [];
  expect(countryHrefs).toHaveLength(1);
  expect(regionHrefs).toHaveLength(11);
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
  await page.goto(`${BASE_URL}/explorer/municipalities/21`);

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
  await page.goto(`${BASE_URL}/explorer/municipalities/04`);

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

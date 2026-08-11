import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";

test("methodology hub separates live datasets from future markers", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("მეთოდოლოგია და პირველწყაროები");
  await expect(page.getByTestId("methodology-live-row")).toHaveCount(3);
  await expect(page.getByTestId("methodology-future-row")).toHaveCount(4);
  await expect(page.getByTestId("methodology-future-row").getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/2005–2025/);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/77/);
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

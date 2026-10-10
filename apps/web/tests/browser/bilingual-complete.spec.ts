import { expect, test } from "@playwright/test";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { pageHref } from "../../lib/i18n/routes";

test("every public page has two working document languages", async ({ request }) => {
  test.setTimeout(90_000);
  const paths = await listPublicPagePaths();
  expect(paths).toHaveLength(228);
  expect(paths).toContain("/explorer/trade/partners");
  expect(paths).toContain("/explorer/trade/products");
  for (const path of paths) for (const locale of ["ka", "en"] as const) {
    const response = await request.get(pageHref(path, locale));
    expect(response.status(), `${locale}:${path}`).toBe(200);
    expect(await response.text()).toMatch(new RegExp(`<html[^>]*lang="${locale}"`));
    await response.dispose();
  }
});

test("the English explorer, language switch and shared bilingual publication agree", async ({ page, request }) => {
  const response = await request.get("/downloads/data/national-expenditure.json");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.schemaVersion).toBe("1.5.0");
  const education = data.observations.find((row: { year: number; seriesId: string }) => row.year === 2025 && row.seriesId === "spending.education");
  expect(education.value).toBe(3045941254);
  expect(education.seriesLabelEn).toBe("Education");
  await page.goto("/en/explorer/expenditure#g=fields&m=table&r=2025-2025&sel=spending.education");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const table = page.getByTestId("explorer-table");
  await expect(table).toContainText(education.seriesLabelEn);
  const values = await table.locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].slice(1).map(cell => cell.textContent?.trim())));
  expect(values.length).toBeGreaterThan(0);
  await page.getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(table).toContainText(education.seriesLabelKa);
  expect(await table.locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].slice(1).map(cell => cell.textContent?.trim())))).toEqual(values);
  expect(new URL(page.url()).hash).toContain("spending.education");
  expect(education.documentIds.length).toBeGreaterThan(0);
});

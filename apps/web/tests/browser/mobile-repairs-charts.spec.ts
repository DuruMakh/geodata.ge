import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

// Phone-width regressions for the shared SVG charts (2026-10-07 mobile review).
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function ready(page: Page, path: string) {
  await page.goto(`${TEST_BASE_URL}${path}`);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.evaluate(() => document.fonts.ready);
}

const regionSlugs = [
  "tbilisi",
  "adjara",
  "guria",
  "imereti",
  "kakheti",
  "mtskheta_mtianeti",
  "racha_lechkhumi_kvemo_svaneti",
  "samegrelo_zemo_svaneti",
  "samtskhe_javakheti",
  "kvemo_kartli",
  "shida_kartli",
];

const axisPages = [
  "/explorer/expenditure",
  "/explorer/revenue",
  "/explorer/debt",
  "/explorer/municipalities/georgia",
  "/explorer/municipalities/batumi",
  "/explorer/unemployment/overview#indicator=unemployed",
  ...regionSlugs.map((slug) => `/explorer/economy/regions/${slug}`),
];

for (const prefix of ["", "/en"]) {
  // A fixed 74-unit left padding clipped the first digit of 9-character labels:
  // "50.0 მლრდ" read "0.0 მლრდ" at the top of the expenditure axis.
  test(`y-axis labels keep their first character ${prefix || "ka"}`, async ({ page }) => {
    for (const path of axisPages) {
      await ready(page, `${prefix}${path}`);
      const leftEdges = await page
        .locator('[data-testid="chart-frame"] svg[role="img"] text[text-anchor="end"]')
        .evaluateAll((nodes) => nodes.map((node) => [node.textContent, (node as SVGGraphicsElement).getBBox().x] as const));
      expect(leftEdges.length, path).toBeGreaterThan(1);
      for (const [label, x] of leftEdges) expect(x, `${path} ${label}`).toBeGreaterThanOrEqual(0);
    }
  });
}

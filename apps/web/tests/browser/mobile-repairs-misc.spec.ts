import { expect, test, type Page } from "@playwright/test";

// Mobile repairs from the 2026-10-07 phone review (owner decisions D6, D7, D9
// and the related repairs). Phone checks run at 390x844 with touch emulation.

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("analysis structure is a stacked bar and a full list on phones (D6)", async ({ page }) => {
    await page.goto("/explorer/analysis");
    await ready(page);
    const treemap = page.getByTestId("snapshot-treemap");
    await expect(treemap.getByTestId("snapshot-structure-grid")).toBeHidden();
    await expect(treemap.getByTestId("snapshot-structure-bar")).toBeVisible();

    // Same items, same order as the desktop tiles.
    const tileNames = await treemap.getByTestId("snapshot-structure-card").evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute("title")!.split(" — ")[0]));
    const rowNames = await treemap.getByTestId("snapshot-structure-row").locator("th").allInnerTexts();
    expect(rowNames.map((name) => name.trim())).toEqual(tileNames);
    expect(rowNames.length).toBeGreaterThan(5);

    // Full names wrap instead of truncating, and nothing crosses the right gutter.
    const geometry = await treemap.evaluate((root) => {
      const width = document.documentElement.clientWidth;
      const bar = root.querySelector("[data-testid='snapshot-structure-bar']")!.getBoundingClientRect();
      const rows = [...root.querySelectorAll("[data-testid='snapshot-structure-row']")];
      return {
        width,
        barRight: bar.right,
        rowRight: Math.max(...rows.map((row) => row.getBoundingClientRect().right)),
        clipped: rows.filter((row) => {
          const name = row.querySelector("th span span:last-child")!;
          return name.scrollWidth > name.clientWidth + 1;
        }).length,
        pageOverflow: document.documentElement.scrollWidth - width,
      };
    });
    expect(geometry.barRight).toBeLessThanOrEqual(geometry.width - 16);
    expect(geometry.rowRight).toBeLessThanOrEqual(geometry.width - 16);
    expect(geometry.clipped).toBe(0);
    expect(geometry.pageOverflow).toBeLessThanOrEqual(0);
  });
});

test("treemap tiles stay inside the treemap at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1000 });
  for (const hash of ["", "#as=revenue"]) {
    await page.goto(`/explorer/analysis${hash}`);
    await ready(page);
    const grid = page.getByTestId("snapshot-structure-grid");
    await expect(grid).toBeVisible();
    const overflow = await grid.evaluate((root) => {
      const box = root.getBoundingClientRect();
      return Math.max(...[...root.querySelectorAll("[data-testid='snapshot-structure-card']")].map((tile) => tile.getBoundingClientRect().right - box.right));
    });
    expect(overflow).toBeLessThanOrEqual(0.5);
  }
});

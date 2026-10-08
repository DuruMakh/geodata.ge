import { expect, test, type Page } from "@playwright/test";

// Polish leftovers from the 2026-10-07 phone review (owner approved all). Phone
// checks run at 390x844 with touch emulation; a few desktop checks guard the
// behaviour that must stay unchanged there.

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("analysis years sit on one scrolling row, opened at the active year", async ({ page }) => {
    await page.goto("/explorer/analysis");
    await ready(page);
    const row = page.getByTestId("analysis-year-selector");
    const geometry = await row.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const buttons = [...element.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
      const active = element.querySelector("button[aria-pressed='true']")!.getBoundingClientRect();
      return {
        overflows: element.scrollWidth > element.clientWidth,
        rows: new Set(buttons.map((button) => Math.round(button.top))).size,
        minHeight: Math.min(...buttons.map((button) => button.height)),
        minWidth: Math.min(...buttons.map((button) => button.width)),
        activeInside: active.left >= box.left - 1 && active.right <= box.right + 1,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(geometry).toMatchObject({ overflows: true, rows: 1, activeInside: true, pageOverflow: 0 });
    expect(geometry.minHeight).toBeGreaterThanOrEqual(36);
    expect(geometry.minWidth).toBeGreaterThanOrEqual(36);

    // Picking an early year keeps it in view and still drives the page.
    await row.evaluate((element) => { element.scrollLeft = 0; });
    await row.getByRole("button", { name: "2010", exact: true }).click();
    await expect(row.getByRole("button", { name: "2010", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("range handles rest at least 12px from the screen edges", async ({ page }) => {
    for (const path of ["/explorer/expenditure", "/explorer/inflation/overview"]) {
      await page.goto(path);
      await ready(page);
      const start = await page.getByTestId("range-start-handle").boundingBox();
      const end = await page.getByTestId("range-end-handle").boundingBox();
      expect(start!.x).toBeGreaterThanOrEqual(12);
      expect(390 - (end!.x + end!.width)).toBeGreaterThanOrEqual(12);
    }
  });

  test("monthly strips open native month and year pickers from the readout", async ({ page }) => {
    await page.goto("/explorer/inflation/overview");
    await ready(page);
    const startHandle = page.getByTestId("range-start-handle");
    const picker = page.getByTestId("range-start-picker");
    await expect(picker.locator("select")).toHaveCount(2);
    await picker.getByLabel("საწყისი წელი").selectOption("2015");
    await expect(startHandle).toHaveAttribute("aria-valuetext", /2015$/);
    await picker.getByLabel("საწყისი თვე").selectOption({ index: 5 });
    await expect(startHandle).toHaveAttribute("aria-valuetext", /^ივნ 2015$/);
    await expect(page).toHaveURL(/r=2015-06-/);
    // A year past the end handle lands on the end month instead.
    const end = await page.getByTestId("range-end-handle").getAttribute("aria-valuenow");
    await page.getByTestId("range-end-picker").getByLabel("საბოლოო წელი").selectOption("2016");
    await picker.getByLabel("საწყისი წელი").selectOption("2016");
    expect(Number(await startHandle.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(Number(await page.getByTestId("range-end-handle").getAttribute("aria-valuenow")));
    expect(end).not.toBeNull();
  });

  test("deficit pill and unit caption never read the same text", async ({ page }) => {
    await page.goto("/explorer/deficit");
    await ready(page);
    const pill = page.getByTestId("measure-share-toggle");
    await expect(pill).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("deficit-measure-label")).toHaveCount(0);
    expect(await pill.evaluate((element) => getComputedStyle(element, "::before").content)).toContain("✓");
    await pill.click();
    await expect(pill).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("deficit-measure-label")).toHaveText("მლრდ ₾");
    expect(await pill.evaluate((element) => getComputedStyle(element, "::before").content)).toBe("none");
  });

  test("municipal controls stay on one row and the range strip has one rule", async ({ page }) => {
    for (const path of ["/explorer/municipalities/batumi", "/en/explorer/municipalities/batumi"]) {
      await page.goto(path);
      await ready(page);
      // Only the short caption is displayed on a phone (the long one is display:none).
      await expect(page.getByTestId("municipal-measure-label")).toHaveText(path.startsWith("/en") ? "mln GEL" : "მლნ ₾", { useInnerText: true });
      const toggle = await page.getByTestId("municipal-share-toggle").boundingBox();
      const mode = await page.getByTestId("municipal-mode-line").boundingBox();
      expect(Math.abs(toggle!.y + toggle!.height / 2 - (mode!.y + mode!.height / 2))).toBeLessThan(4);
      const gap = await page.getByTestId("year-range-strip").evaluate((strip) => {
        const before = strip.previousElementSibling!.getBoundingClientRect();
        return { gap: strip.getBoundingClientRect().top - before.bottom, parentRule: getComputedStyle(strip.parentElement!).borderTopWidth };
      });
      expect(gap.gap).toBeLessThan(40);
      expect(gap.parentRule).toBe("0px");
    }
  });

  test("economy regions index marks itself ready; municipal legend and neighbour links fit phones", async ({ page }) => {
    await page.goto("/explorer/economy/regions");
    await ready(page);

    await page.goto("/explorer/municipalities");
    await ready(page);
    const ends = await page.getByTestId("municipality-map-legend-scale").evaluate((scale) => {
      const spans = [...scale.children].map((child) => child.getBoundingClientRect());
      return { first: Math.round(spans[0]!.top), last: Math.round(spans.at(-1)!.top), right: spans.at(-1)!.right };
    });
    expect(ends.first).toBe(ends.last);
    expect(ends.right).toBeLessThanOrEqual(390);

    await page.goto("/explorer/municipalities/batumi");
    await ready(page);
    const links = page.getByTestId("municipal-entity-navigation").locator("a");
    await expect(links).toHaveCount(2);
    for (const box of [await links.nth(0).boundingBox(), await links.nth(1).boundingBox()]) expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("methodology archive years wrap instead of scrolling sideways", async ({ page }) => {
    await page.goto("/methodology/expenditure");
    const filter = page.getByTestId("archive-year-filter");
    await expect(filter).toBeVisible();
    const geometry = await filter.evaluate((element) => ({
      overflow: element.scrollWidth - element.clientWidth,
      rows: new Set([...element.querySelectorAll("button")].map((button) => Math.round(button.getBoundingClientRect().top))).size,
      right: Math.max(...[...element.querySelectorAll("button")].map((button) => button.getBoundingClientRect().right)),
    }));
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    expect(geometry.rows).toBeGreaterThan(1);
    expect(geometry.right).toBeLessThanOrEqual(390);
  });

  test("product names break inside a word only when the word is wider than its column at 390px", async ({ page }) => {
    for (const path of ["/explorer/inflation/products", "/en/explorer/inflation/products"]) {
      await page.goto(path);
      await ready(page);
      await page.evaluate(() => document.fonts.ready);
      const result = await page.getByTestId("product-table").evaluate((table) => {
        const broken: string[] = [];
        const canvas = document.createElement("canvas").getContext("2d")!;
        for (const span of table.querySelectorAll<HTMLElement>("[data-testid='product-row-toggle'] span.block")) {
          const node = span.firstChild;
          // A single word wider than the whole name column has to break somewhere:
          // Georgian has no browser hyphenation (e.g. ელექტროგაყვანილობის at 390px).
          canvas.font = getComputedStyle(span).font;
          if (!node || node.nodeType !== Node.TEXT_NODE) continue;
          let index = 0;
          for (const word of node.textContent!.split(/(\s+)/)) {
            if (word.trim() && !word.includes("-")) {
              const range = document.createRange();
              range.setStart(node, index);
              range.setEnd(node, index + word.length);
              const fits = canvas.measureText(word).width <= span.clientWidth;
              if (fits && new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size > 1) broken.push(word);
            }
            index += word.length;
          }
        }
        const overflowing = [...table.querySelectorAll("th, td")].filter((cell) => cell.scrollWidth > cell.clientWidth + 0.5).length;
        return { broken, overflowing, scrolls: table.scrollWidth > table.clientWidth };
      });
      expect(result).toEqual({ broken: [], overflowing: 0, scrolls: false });
    }
  });

  test("a chart that fits is not announced as horizontally scrollable", async ({ page }) => {
    await page.goto("/en/explorer/expenditure");
    await ready(page);
    await expect(page.getByTestId("chart-frame")).toHaveAttribute("aria-label", "Multi-year chart");
  });

  test("radar note points to the ranking and the index uses one per-resident term", async ({ page }) => {
    await page.goto("/explorer/analysis");
    await ready(page);
    await expect(page.getByTestId("budget-radar")).toContainText("ზუსტი მნიშვნელობები — რეიტინგში ქვემოთ");
    await expect(page.getByTestId("budget-radar")).not.toContainText("ვიზუალური");
    await page.goto("/explorer/municipalities");
    await ready(page);
    await expect(page.getByTestId("municipal-row-per-resident").first()).toContainText("ერთ მოსახლეზე");
    await expect(page.locator("body")).not.toContainText("ერთ სულზე");
  });

  test("inflation overview eyebrow starts where the chart and range strip start", async ({ page }) => {
    await page.goto("/en/explorer/inflation/overview");
    await ready(page);
    const eyebrow = page.getByTestId("explorer-header").locator("p");
    // The default range is "all", so the start handle sits on the first month the tab offers.
    const startOf = async () => (await page.getByTestId("range-start-handle").getAttribute("aria-valuemin"))!;
    const labelOf = async () => (await page.getByTestId("range-start-handle").getAttribute("aria-valuetext"))!;
    const yoyStart = await labelOf();
    await expect(eyebrow).toHaveText(new RegExp(`^${yoyStart}–`));
    const yoyMin = await startOf();
    await page.getByTestId("inflation-tab-index").click();
    const indexStart = await labelOf();
    expect(Number(await startOf())).toBeLessThan(Number(yoyMin));
    await expect(eyebrow).toHaveText(new RegExp(`^${indexStart}–`));
  });
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("analysis years still wrap and range handles keep the full-width rail", async ({ page }) => {
    await page.goto("/explorer/analysis");
    await ready(page);
    const row = page.getByTestId("analysis-year-selector");
    expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.goto("/explorer/expenditure");
    await ready(page);
    const rail = await page.getByRole("group", { name: "წლების დიაპაზონი" }).evaluate((element) => getComputedStyle(element).marginLeft);
    expect(rail).toBe("0px");
  });

  test("GDP and unemployment y labels fit without the old fixed padding", async ({ page }) => {
    for (const [path, counts] of [["/explorer/economy/gdp", false], ["/explorer/unemployment/overview", true]] as const) {
      await page.goto(path);
      await ready(page);
      if (counts) {
        await page.getByTestId("series-toggle-all").click();
        await page.locator('[data-series-id="georgia:unemployed"] [data-testid="series-row-toggle"]').click();
      }
      const geometry = await page.getByTestId("chart-frame").first().evaluate((frame) => {
        const svg = frame.querySelector<SVGSVGElement>("svg[role='img']")!;
        const box = svg.getBoundingClientRect();
        const scale = box.width / svg.viewBox.baseVal.width;
        const labels = [...svg.querySelectorAll("text[text-anchor='end']")].map((text) => text.getBoundingClientRect());
        const lattice = svg.querySelector("[data-testid='chart-dot-lattice']")!.getBoundingClientRect();
        return { minLeft: Math.min(...labels.map((label) => label.left - box.left)), padLeft: (lattice.left - box.left) / scale, widest: Math.max(...labels.map((label) => label.right - box.left)) / scale };
      });
      expect(geometry.minLeft).toBeGreaterThanOrEqual(0);
      // The plot starts right after the widest label, not at a fixed 90 / 180.
      expect(geometry.padLeft).toBeLessThanOrEqual(Math.max(74, geometry.widest + 16) + 2);
    }
  });

  test("a desktop drawing that overflows its frame keeps the scroll wording", async ({ page }) => {
    await page.setViewportSize({ width: 770, height: 900 });
    await page.goto("/en/explorer/expenditure");
    await ready(page);
    const frame = page.getByTestId("chart-frame");
    if (await frame.evaluate((element) => element.scrollWidth > element.clientWidth + 1)) {
      await expect(frame).toHaveAttribute("aria-label", "Multi-year chart — scroll horizontally");
    } else {
      await expect(frame).toHaveAttribute("aria-label", "Multi-year chart");
    }
  });
});

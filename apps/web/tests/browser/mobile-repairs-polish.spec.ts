import { expect, test, type Page } from "@playwright/test";

// Polish leftovers from the 2026-10-07 phone review (owner approved all). Phone
// checks run at 390x844 with touch emulation; a few desktop checks guard the
// behaviour that must stay unchanged there.

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

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

  // Touch targets at the site's own sizes (DESIGN.md §12: text controls 44px on
  // phones; WCAG 2.5.8: nothing tappable under 24px). Native selects take 16px
  // text on phones so iOS Safari does not zoom the page on focus (Q5).
  test("native selects are 16px and 44px tall on phones", async ({ page }) => {
    for (const [path, testId] of [["/explorer/unemployment/age", "unemployment-indicator"], ["/explorer/wages/industries", "wages-group"]] as const) {
      await page.goto(path);
      await ready(page);
      const select = page.getByTestId(testId);
      expect(await select.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
      expect((await select.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.goto("/explorer/inflation/overview");
    await ready(page);
    expect(await page.getByTestId("range-start-picker").locator("select").evaluateAll((selects) => selects.map((select) => getComputedStyle(select).fontSize))).toEqual(["16px", "16px"]);
  });

  test("range chips, text tabs and the show-all button are 44px targets on phones", async ({ page }) => {
    // The count comes first, so a renamed test id fails instead of checking nothing.
    const heights = async (locator: ReturnType<Page["locator"]>, count: number) => {
      await expect(locator).toHaveCount(count);
      return locator.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    };
    for (const path of ["/explorer/debt", "/explorer/municipalities/batumi"]) {
      await page.goto(path);
      await ready(page);
      const chips = page.getByTestId("year-range-strip").locator("button[aria-pressed]");
      for (const height of await heights(chips, 3)) expect(height).toBeGreaterThanOrEqual(44);
      // The taller chip row must not reach the handles' tap areas on the rail below it.
      const chipBoxes = await chips.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
      for (const handle of ["range-start-handle", "range-end-handle"]) {
        const h = (await page.getByTestId(handle).boundingBox())!;
        for (const c of chipBoxes) expect(c.right <= h.x || h.x + h.width <= c.left || c.bottom <= h.y || h.y + h.height <= c.top).toBe(true);
      }
    }
    await page.goto("/explorer/inflation/overview");
    await ready(page);
    for (const height of await heights(page.locator("[data-testid^='inflation-tab-']"), 3)) expect(height).toBeGreaterThanOrEqual(44);
    await page.goto("/explorer/trade/products");
    await ready(page);
    for (const height of await heights(page.locator("[data-testid^='trade-products-measure-']"), 2)) expect(height).toBeGreaterThanOrEqual(44);
    await page.goto("/explorer/trade/partners");
    await ready(page);
    expect((await page.getByTestId("trade-partners-show-all").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // The narrowest text tab on the site: "All" over the census pyramid.
    await page.goto("/en/explorer/demography/population/georgia");
    await ready(page);
    const settlements = page.locator("[data-testid^='age-sex-settlement-']");
    await expect(settlements).toHaveCount(3);
    for (const box of await settlements.evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().toJSON()))) {
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("links in fine print are at least 24px targets that do not overlap on phones", async ({ page }) => {
    const atLeast24 = async (links: ReturnType<Page["locator"]>) => {
      // One box per line a link occupies: a link that wraps is two targets side by side.
      const boxes = await links.evaluateAll((elements) => elements.flatMap((element) => [...element.getClientRects()].map((rect) => rect.toJSON())));
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.width).toBeGreaterThanOrEqual(24);
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
      for (const [index, a] of boxes.entries()) {
        for (const b of boxes.slice(index + 1)) expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
      }
    };
    for (const path of ["/explorer/external/money-from-abroad", "/explorer/external/foreign-investment", "/explorer/external/current-account"]) {
      await page.goto(path);
      await ready(page);
      await atLeast24(page.getByTestId("source-label").locator("a"));
    }
    await page.goto("/en/explorer/demography/population/georgia");
    await ready(page);
    await atLeast24(page.getByTestId("population-source-note").locator("a"));
    await page.goto("/methodology/expenditure");
    await atLeast24(page.getByTestId("processed-dataset-json").locator("a"));
    await page.goto("/connect");
    await page.getByTestId("connect-developer-details").locator("summary").click();
    for (const block of ["connect-sector-discovery", "connect-regional-discovery", "connect-inflation-discovery", "connect-product-discovery"]) await atLeast24(page.getByTestId(block).locator("a"));
  });

  test("picker rows are 44px on phones, touch hides the arrow-key hint and the municipal picker fits the screen", async ({ page }) => {
    await page.goto("/explorer/economy/regions/imereti");
    await ready(page);
    await page.getByTestId("region-picker-trigger").click();
    const options = page.getByRole("listbox").getByRole("option");
    expect(await options.count()).toBeGreaterThan(0);
    for (const height of await options.evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height))) expect(height).toBeGreaterThanOrEqual(44);
    await expect(page.getByText("გადაადგილდით ისრებით", { exact: false })).toBeHidden();

    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto("/en/explorer/municipalities/region/racha_lechkhumi_kvemo_svaneti");
    await ready(page);
    await page.getByTestId("entity-picker-trigger").click();
    const picker = page.getByTestId("entity-picker");
    expect(await picker.getByRole("option").count()).toBeGreaterThan(0);
    for (const height of await picker.getByRole("option").evaluateAll((rows) => rows.slice(0, 5).map((row) => row.getBoundingClientRect().height))) expect(height).toBeGreaterThanOrEqual(44);
    const fit = await picker.evaluate((dialog) => {
      const input = dialog.querySelector("input")!;
      const style = getComputedStyle(input);
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = `${style.fontSize} ${style.fontFamily}`;
      return {
        list: dialog.querySelector("[role='listbox']")!.getBoundingClientRect().height,
        bottom: dialog.getBoundingClientRect().bottom,
        placeholder: context.measureText(input.placeholder).width <= input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      };
    });
    expect(fit.list).toBeLessThanOrEqual(700 * 0.4 + 1);
    expect(fit.bottom).toBeLessThanOrEqual(700);
    expect(fit.placeholder).toBe(true);
  });

  test("ranking headers are 11px and the trade share header breaks only between words", async ({ page }) => {
    for (const [path, testId] of [["/explorer/trade/partners", "trade-partners-ranking"], ["/en/explorer/trade/products", "trade-partners-ranking"], ["/explorer/external/money-from-abroad", "money-from-abroad-ranking"]] as const) {
      await page.goto(path);
      await ready(page);
      const header = await page.getByTestId(testId).locator("thead").evaluate((head) => {
        const broken: string[] = [];
        for (const cell of head.querySelectorAll("th")) {
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            let index = 0;
            for (const word of node.textContent!.split(/(\s+)/)) {
              if (word.trim()) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + word.length);
                if (new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size > 1) broken.push(word);
              }
              index += word.length;
            }
          }
        }
        return { broken, cells: head.querySelectorAll("th").length > 0, sizes: [...new Set([...head.querySelectorAll("th")].map((cell) => getComputedStyle(cell).fontSize))] };
      });
      expect(header).toEqual({ broken: [], cells: true, sizes: ["11px"] });
    }
  });

  test("neighbour region names wrap instead of being cut on phones", async ({ page }) => {
    for (const path of ["/explorer/unemployment/regions/mtskheta_mtianeti", "/en/explorer/unemployment/regions/samegrelo_zemo_svaneti"]) {
      await page.goto(path);
      await ready(page);
      const links = page.getByTestId("unemployment-region-navigation").locator("a");
      await expect(links).toHaveCount(2);
      await expect(links.locator("span")).toHaveCount(2);
      expect(await links.locator("span").evaluateAll((spans) => spans.filter((span) => span.scrollWidth > span.clientWidth).map((span) => span.textContent))).toEqual([]);
      for (const height of await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getBoundingClientRect().height))) expect(height).toBeGreaterThanOrEqual(44);
    }
  });

  test("the pinned bar's brand link is a 44px row", async ({ page }) => {
    await page.goto("/explorer/unemployment/overview");
    await ready(page);
    expect((await page.getByTestId("sidebar-topbar").locator("a").first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
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

  test("range handles keep the full-width rail", async ({ page }) => {
    await page.goto("/explorer/expenditure");
    await ready(page);
    const rail = await page.getByRole("group", { name: "წლების დიაპაზონი" }).evaluate((element) => getComputedStyle(element).marginLeft);
    expect(rail).toBe("0px");
  });

  test("phone-only target sizes leave the desktop controls as they were", async ({ page }) => {
    // These exact sizes are today's inherited ones: globals.css:95-100 gives buttons and
    // selects `font: inherit; min-width: 0` outside a layer, which overrides their text-*
    // utilities. They are expected to move if that rule is ever fixed.
    await page.goto("/explorer/debt");
    await ready(page);
    const chips = page.getByTestId("year-range-strip").locator("button[aria-pressed]");
    await expect(chips).toHaveCount(3);
    for (const height of await chips.evaluateAll((elements) => elements.map((chip) => chip.getBoundingClientRect().height))) expect(height).toBe(38);
    await page.goto("/explorer/unemployment/age");
    await ready(page);
    const select = page.getByTestId("unemployment-indicator");
    expect(await select.evaluate((element) => getComputedStyle(element).fontSize)).toBe("10px");
    expect((await select.boundingBox())!.height).toBeLessThan(36);
    await page.goto("/explorer/inflation/overview");
    await ready(page);
    expect((await page.getByTestId("inflation-tab-index").boundingBox())!.height).toBe(36);
    await page.goto("/explorer/trade/partners");
    await ready(page);
    expect((await page.getByTestId("trade-partners-show-all").boundingBox())!.height).toBe(24);
    await expect(page.getByTestId("trade-partners-ranking").locator("thead th").nth(3)).toHaveText("წილი საქართველოს ჯამში", { useInnerText: true });
    // The 40svh list cap is for phones only: a short desktop window keeps the 340px list.
    await page.setViewportSize({ width: 1366, height: 700 });
    await page.goto("/en/explorer/municipalities/region/racha_lechkhumi_kvemo_svaneti");
    await ready(page);
    await page.getByTestId("entity-picker-trigger").click();
    expect(await page.getByTestId("entity-picker").getByRole("listbox").evaluate((list) => list.getBoundingClientRect().height)).toBe(340);
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
      // A sideways scroll to operate makes the frame a keyboard stop of its own.
      await expect(frame).toHaveAttribute("tabindex", "0");
    } else {
      await expect(frame).toHaveAttribute("aria-label", "Multi-year chart");
      await expect(frame).not.toHaveAttribute("tabindex");
    }
  });
});

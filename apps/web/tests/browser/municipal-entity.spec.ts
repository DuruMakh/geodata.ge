import { expect, test } from "@playwright/test";

// Municipality entity pages (Task 11). Three things nothing in the repo
// exercised before this page existed:
//
//  - the entity picker (Task 10): its own review approved the code on
//    inspection but deferred verification, because nothing mounted it until
//    this page. Covered below: focus in on open, focus back to the trigger on
//    Escape AND click-outside, Escape/click-outside close it, ArrowUp/ArrowDown
//    move aria-activedescendant under real keydown events, Enter activates the
//    highlighted option — plus that the popover mounts as a sibling of the
//    trigger, not nested inside the <h1>.
//  - lib/explorer/format.ts's UNIT_MLN: the first time any chart or table has
//    ever rendered a non-UNIT_BN unit. A regression that threaded `unit`
//    through as a prop and then silently re-hardcoded the billion divisor
//    would be invisible to every budget-explorer test, since national figures
//    render identically either way.
//  - use-municipal-state.ts's hash sanitising: parseMunicipalHash deliberately
//    does not clamp a reversed range or filter unknown series ids, so the
//    consumer must — nothing tested either path.
//
// Full section e2e coverage is Task 14's; this pins the specific gaps above.

const ENTITY_URL = "http://localhost:3100/explorer/municipalities/04"; // თბილისი

test.describe("hash sanitising", () => {
  test("a reversed shared range renders in the correct order, not reversed", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#r=2024-2016`);
    await page.reload();

    await expect(page.getByTestId("year-range-strip")).toContainText("2016–2024");

    const headers = page.getByTestId("comparison-table").locator("thead th");
    await expect(headers.nth(1)).toHaveText("2016");
    await expect(headers.nth(3)).toHaveText("2024");
  });

  test("a reversed shared range self-corrects the address bar, not just the display", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#r=2024-2016`);
    await page.reload();

    await expect(page.getByTestId("year-range-strip")).toContainText("2016–2024");

    // use-municipal-state.ts used to serialise the hash from the raw,
    // still-reversed start/end fields, so the address bar stayed "r=2024-2016"
    // forever even once the rail itself displayed the corrected order.
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toContain("r=2016-2024");
    expect(hash).not.toContain("r=2024-2016");
  });

  test("after loading a reversed shared range, moving the start handle moves the start handle, not the end", async ({
    page,
  }) => {
    await page.goto(`${ENTITY_URL}#r=2024-2016`);
    await page.reload();

    const startHandle = page.getByTestId("range-start-handle");
    const endHandle = page.getByTestId("range-end-handle");
    await expect(startHandle).toHaveAttribute("aria-valuenow", "2016");
    await expect(endHandle).toHaveAttribute("aria-valuenow", "2024");

    // The bug this guards: while the raw start/end fields stayed reversed
    // (2024/2016) after mount, a `{ start: ... }` patch from the displayed
    // start handle actually wrote the field driving the displayed END, so one
    // ArrowRight on the start handle silently moved end from 2024 to 2017
    // instead of moving start.
    await startHandle.focus();
    await page.keyboard.press("ArrowRight");

    await expect(startHandle).toHaveAttribute("aria-valuenow", "2017");
    await expect(endHandle).toHaveAttribute("aria-valuenow", "2024");
  });

  test("a selection whose ids are all unknown falls back to the default selection", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#sel=municipal.made_up`);
    await page.reload();

    // getDefaultMunicipalSelection: top 5 functions by latest-year value.
    await expect(page.locator('[data-testid="municipal-series-row"][aria-pressed="true"]')).toHaveCount(5);
  });

  test("a selection mixing a known and an unknown id keeps the known one and drops the unknown one", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#sel=municipal.education,municipal.made_up`);
    await page.reload();

    const checked = page.locator('[data-testid="municipal-series-row"][aria-pressed="true"]');
    await expect(checked).toHaveCount(1);
    await expect(checked).toContainText("განათლება");
  });
});

test.describe("entity picker accessibility", () => {
  test("opening moves focus into the search input", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await page.getByTestId("entity-picker-trigger").click();

    const combobox = page.getByTestId("entity-picker").getByRole("combobox");
    await expect(combobox).toBeFocused();
  });

  test("the popover mounts as a sibling of the trigger, not nested inside the h1", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await page.getByTestId("entity-picker-trigger").click();
    await expect(page.getByTestId("entity-picker")).toBeVisible();

    // A role="dialog" nested inside a heading is announced as part of the
    // heading by screen readers and is fragile to position — Task 11 pins the
    // fix as a live DOM check now that something finally mounts the picker.
    const nestedInHeading = await page.evaluate(() => {
      const heading = document.querySelector("h1");
      const picker = document.querySelector('[data-testid="entity-picker"]');
      return heading !== null && picker !== null && heading.contains(picker);
    });
    expect(nestedInHeading).toBe(false);
  });

  test("Escape closes the popover and returns focus to the trigger", async ({ page }) => {
    await page.goto(ENTITY_URL);
    const trigger = page.getByTestId("entity-picker-trigger");
    await trigger.click();
    await expect(page.getByTestId("entity-picker")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByTestId("entity-picker")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("clicking outside the popover closes it and returns focus to the trigger", async ({ page }) => {
    await page.goto(ENTITY_URL);
    const trigger = page.getByTestId("entity-picker-trigger");
    await trigger.click();
    await expect(page.getByTestId("entity-picker")).toBeVisible();

    // The click-outside catcher is a fixed, full-viewport div at z-30 (above
    // the page, below the popover's own z-40), so any point clear of the
    // 430px-wide popover hits it — (1200, 500) is well outside on the default
    // 1280x720 viewport.
    await page.mouse.click(1200, 500);

    await expect(page.getByTestId("entity-picker")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("ArrowDown/ArrowUp move aria-activedescendant across real options, and Enter activates the highlighted one", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await page.getByTestId("entity-picker-trigger").click();

    const combobox = page.getByTestId("entity-picker").getByRole("combobox");
    await expect(combobox).not.toHaveAttribute("aria-activedescendant");

    // Narrow to exactly two options — the region header and its one matching
    // member — so the arrow sequence below is deterministic regardless of
    // which municipality currently has the largest budget.
    await combobox.fill("ბათუმი");
    const options = page.getByTestId("entity-picker").getByRole("option");
    await expect(options).toHaveCount(2);
    const regionOption = options.nth(0);
    const municipalityOption = options.nth(1);
    await expect(regionOption).toHaveAttribute("data-testid", "picker-region");
    await expect(municipalityOption).toHaveAttribute("data-testid", "picker-municipality");

    await page.keyboard.press("ArrowDown");
    await expect(regionOption).toHaveAttribute("aria-selected", "true");
    const regionId = await regionOption.getAttribute("id");
    await expect(combobox).toHaveAttribute("aria-activedescendant", regionId ?? "");

    await page.keyboard.press("ArrowDown");
    await expect(municipalityOption).toHaveAttribute("aria-selected", "true");
    await expect(regionOption).toHaveAttribute("aria-selected", "false");
    const municipalityId = await municipalityOption.getAttribute("id");
    await expect(combobox).toHaveAttribute("aria-activedescendant", municipalityId ?? "");

    // ArrowUp moves the highlight back to the region option.
    await page.keyboard.press("ArrowUp");
    await expect(regionOption).toHaveAttribute("aria-selected", "true");
    await expect(municipalityOption).toHaveAttribute("aria-selected", "false");

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Batumi's own page re-serialises its default hash state (#m=line&r=...)
    // as soon as it mounts, so the URL is not bare — only the path is pinned.
    await expect(page).toHaveURL(/\/explorer\/municipalities\/06(#|$)/);
    await expect(page.getByTestId("entity-picker")).toBeHidden();
  });
});

test.describe("UNIT_MLN — first render anywhere in the repo", () => {
  test("the chart axis reads in the million unit, and the table shows municipal-scale numbers, not the national billion unit", async ({
    page,
  }) => {
    await page.goto(ENTITY_URL);

    const chart = page.getByTestId("chart-frame");
    await expect(chart).toBeVisible();
    await expect(chart.locator("svg text").first()).toBeVisible();

    // formatAxis (editorial-line-chart.tsx) renders `${value/unit.divisor}
    // ${unit.label}`. A regression that silently re-hardcoded UNIT_BN would
    // still draw axis labels — just never say მლნ, and always მლრდ instead.
    const axisTexts = await chart.locator("svg text").allTextContents();
    expect(axisTexts.some((text) => text.includes("მლნ"))).toBe(true);
    expect(axisTexts.some((text) => text.includes("მლრდ"))).toBe(false);

    await page.getByTestId("municipal-mode-table").click();
    const totalRow = page.getByTestId("explorer-table").locator("tbody tr").last();
    await expect(totalRow).toContainText("სულ");

    // Total row, last-year cell (label, then one td per year, then change,
    // then share — third from the end). A hard-coded billion divisor would
    // collapse Tbilisi's hundreds-of-millions total to a low single digit;
    // the million divisor keeps it in the hundreds or thousands.
    const cells = await totalRow.locator("td").allTextContents();
    const lastYearValue = Number.parseFloat((cells.at(-3) ?? "").replace(/,/g, ""));
    expect(lastYearValue).toBeGreaterThan(50);
  });
});

// Task 14: the full municipality-page e2e coverage the header comment above
// defers to this task ("Full section e2e coverage is Task 14's").
test.describe("municipality page", () => {
  test("switches between chart and table", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await page.getByTestId("municipal-mode-table").click();
    const table = page.getByTestId("explorer-table");
    await expect(table).toBeVisible();
    // The regression this guards: in billions every municipal cell reads 0.00.
    // Checked cell by cell, not as a substring of the table's full text: this
    // municipality's თავდაცვა (defence) row is genuinely 0.0 for every loaded
    // year, and eleven adjacent, individually-correct "0.0" cells concatenate
    // to "...0.00.00.0...", which itself contains "0.00" — a naive substring
    // check on the whole table would fail here even though every cell is
    // individually correct. UNIT_MLN always renders exactly one decimal, so a
    // real cell can never be the two-decimal string "0.00".
    const cells = await table.locator("tbody td").allTextContents();
    for (const cell of cells) {
      expect(cell).not.toBe("0.00");
    }
  });

  test("enforces the six-series chart cap", async ({ page }) => {
    await page.goto(ENTITY_URL);
    const rows = page.getByTestId("municipal-series-row");
    for (let index = 0; index < 10; index += 1) {
      const row = rows.nth(index);
      if ((await row.getAttribute("aria-pressed")) === "false") await row.click();
    }
    await expect(page.getByTestId("municipal-series-limit")).toBeVisible();
  });

  test("shows the divergence callout only where the data diverges", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expect(page.getByTestId("divergence-callout")).toBeVisible();
    // თელავი is municipality code 15, not 22 (verified against
    // data/imports/municipalities.csv) — show_warning is false for all of its
    // loaded years, so its page never renders the callout.
    await page.goto("http://localhost:3100/explorer/municipalities/15");
    await expect(page.getByTestId("divergence-callout")).toHaveCount(0);
  });

  test("opens the entity picker with the keyboard", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("entity-picker")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("entity-picker")).toHaveCount(0);
  });

  test("keeps the picker popover out of the heading", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await page.keyboard.press("Control+k");
    // A role="dialog" inside an h1 is announced as part of the heading.
    await expect(page.locator("h1 [data-testid='entity-picker']")).toHaveCount(0);
    await expect(page.locator("h1 [data-testid='entity-picker-trigger']")).toHaveCount(1);
  });

  test("filters the series list and clears the selection", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await page.getByTestId("municipal-series-search").fill("განათლება");
    await expect(page.getByTestId("municipal-series-row")).toHaveCount(1);
    await page.getByTestId("municipal-series-search").fill("");
    await expect(page.getByTestId("municipal-series-row")).toHaveCount(10);
    await page.getByTestId("municipal-series-all").click();
    await expect(page.getByTestId("municipal-series-row").first()).toHaveAttribute("aria-pressed", "false");
  });

  test("selects every function in table mode", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await page.getByTestId("municipal-mode-table").click();
    await page.getByTestId("municipal-series-all").click();
    // Table mode has no six-series cap, so select-all must leave all ten rows
    // pressed. Asserting the count of pressed rows is the point of this test:
    // a locator on its own is always truthy and would pass unconditionally.
    // aria-pressed lives on the row element itself, not a descendant, so this
    // is a compound attribute selector rather than `.filter({ has })` — `has`
    // only matches a DESCENDANT of the outer locator, and would silently find
    // zero rows here regardless of how many are actually pressed.
    await expect(page.getByTestId("municipal-series-row")).toHaveCount(10);
    await expect(page.locator("[data-testid='municipal-series-row'][aria-pressed='true']")).toHaveCount(10);
    await expect(page.getByTestId("municipal-series-all")).toHaveAttribute("aria-pressed", "true");
  });

  test("offers a CSV download", async ({ page }) => {
    await page.goto(ENTITY_URL);
    const download = page.waitForEvent("download");
    await page.getByTestId("municipal-csv").click();
    expect((await download).suggestedFilename()).toMatch(/^geodata-municipality-04-\d{4}-\d{4}\.csv$/);
  });

  test("recomputes the period comparison when the range moves", async ({ page }) => {
    // The regression this guards: filtering years without rebuilding the model,
    // so ცვლილება and the comparison table describe the full span while the
    // chart describes the selection.
    await page.goto(ENTITY_URL);
    const before = await page.getByTestId("comparison-table").innerText();
    await page.goto(`${ENTITY_URL}#m=line&r=2020-2025&sel=municipal.education`);
    await page.reload();
    // The server always renders the default range first — a URL hash is never
    // sent in the request — so the hash-restored range lands only after
    // client-side hydration runs. Wait for it to actually show in the DOM
    // before reading the table; an immediate innerText() can capture that
    // pre-hydration snapshot and compare the default range against itself.
    await expect(page.getByTestId("comparison-table").locator("thead th").nth(1)).toHaveText("2020");
    const after = await page.getByTestId("comparison-table").innerText();
    expect(after).not.toBe(before);
  });
});

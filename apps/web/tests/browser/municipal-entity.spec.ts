import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { TEST_BASE_URL } from "./test-base-url";

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

const BASE_URL = TEST_BASE_URL;
const SOURCE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
const ENTITY_URL = `${BASE_URL}/explorer/municipalities/tbilisi`; // თბილისი
const ALL_FUNCTIONS = [
  "municipal.general_public_services",
  "municipal.defence",
  "municipal.public_order_safety",
  "municipal.economic_affairs",
  "municipal.environment",
  "municipal.housing_communal",
  "municipal.health",
  "municipal.recreation_culture",
  "municipal.education",
  "municipal.social_protection",
].join(",");

async function expectMunicipalAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function downloadMunicipalWorkbook(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("municipal-excel").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Expected a local XLSX download path");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(await readFile(path)).buffer);
  return { download, workbook };
}

test.describe("hash sanitising", () => {
  test("a reversed shared range renders in the correct order, not reversed", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#r=2024-2016`);
    await expectMunicipalAppReady(page);
    await page.reload();
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("year-range-strip")).toContainText("2016–2024");

    const headers = page.getByTestId("comparison-table").locator("thead th");
    await expect(headers.nth(1)).toHaveText("2016");
    await expect(headers.nth(3)).toHaveText("2024");
  });

  test("a reversed shared range self-corrects the address bar, not just the display", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#r=2024-2016`);
    await expectMunicipalAppReady(page);
    await page.reload();
    await expectMunicipalAppReady(page);

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
    await expectMunicipalAppReady(page);
    await page.reload();
    await expectMunicipalAppReady(page);

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
    await expectMunicipalAppReady(page);
    await page.reload();
    await expectMunicipalAppReady(page);

    // getDefaultMunicipalSelection: official total only.
    await expect(page.locator('[data-testid="series-row"] [data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
  });

  test("a selection mixing a known and an unknown id keeps the known one and drops the unknown one", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#sel=municipal.education,municipal.made_up`);
    await expectMunicipalAppReady(page);
    await page.reload();
    await expectMunicipalAppReady(page);

    const checked = page.locator('[data-testid="series-row"] [data-testid="series-row-toggle"][aria-pressed="true"]');
    await expect(checked).toHaveCount(1);
    await expect(checked).toContainText("განათლება");
  });
});

test.describe("entity picker accessibility", () => {
  test("answers a non-matching query instead of collapsing to a 0px void", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("entity-picker-trigger").click();

    const picker = page.getByTestId("entity-picker");
    const listbox = picker.getByRole("listbox");
    await expect(listbox).toBeVisible();
    await picker.getByRole("combobox").fill("zzzqqq");

    // The other two search surfaces both answer: the series panel shows
    // "კატეგორია ვერ მოიძებნა" and the index list "ვერაფერი მოიძებნა" with a clear
    // button. The picker — reachable from every one of the 76 municipal pages
    // by click or ⌘K — rendered a 0-height listbox with no options, no count
    // and no way to clear the query other than selecting the text.
    await expect(listbox.getByRole("option")).toHaveCount(0);
    const empty = page.getByTestId("picker-empty");
    await expect(empty).toBeVisible();
    await expect(picker.getByRole("status")).toContainText("ვერაფერი მოიძებნა");

    await empty.getByRole("button", { name: "ძებნის გასუფთავება" }).click();
    await expect(listbox.getByRole("option").first()).toBeVisible();
  });

  test("Tab reaches the empty-state clear action and Enter restores the picker", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("entity-picker-trigger").click();

    const picker = page.getByTestId("entity-picker");
    const input = picker.getByRole("combobox");
    await input.fill("zzzqqq");
    await input.press("Tab");

    const clear = picker.getByRole("button", { name: "ძებნის გასუფთავება" });
    await expect(clear).toBeFocused();
    await clear.press("Enter");
    await expect(picker.getByRole("option").first()).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("Tab from the empty-state action closes the picker and continues through the page", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("entity-picker-trigger").click();

    const picker = page.getByTestId("entity-picker");
    await picker.getByRole("combobox").fill("zzzqqq");
    await picker.getByRole("combobox").press("Tab");
    const clear = picker.getByRole("button", { name: "ძებნის გასუფთავება" });
    await expect(clear).toBeFocused();

    await clear.press("Tab");
    await expect(picker).toBeHidden();
    await expect(page.getByTestId("municipal-entity-navigation").locator("a").first()).toBeFocused();
  });

  test("picker rows expose hover feedback", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("entity-picker-trigger").click();

    const region = page.getByTestId("picker-region").first();
    const municipality = page.getByTestId("picker-municipality").nth(1);
    await expect(municipality).not.toHaveAttribute("aria-current", "page");
    await expect(municipality).not.toHaveCSS("color", "rgb(179, 64, 42)");
    await expect(municipality).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const regionBox = await region.boundingBox();
    const municipalityBox = await municipality.boundingBox();

    for (const row of [region, municipality]) {
      await row.hover();
      await expect(row).toHaveCSS("color", "rgb(179, 64, 42)");
      await expect(row).toHaveCSS("border-left-color", "rgb(179, 64, 42)");
      await expect(row).toHaveCSS("transition-duration", "0.1s");
      await expect(row).toHaveCSS("transition-property", /color/);
    }
    await expect(municipality).toHaveCSS("background-color", "rgb(241, 234, 220)");

    expect(await region.boundingBox()).toEqual(regionBox);
    expect(await municipality.boundingBox()).toEqual(municipalityBox);
  });

  test("the entity picker trigger keeps the preview affordance across rest, hover, and open states", async ({
    page,
  }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const trigger = page.getByTestId("entity-picker-trigger");
    const caret = trigger.locator("span[aria-hidden='true']");
    const restingBox = await trigger.boundingBox();

    await expect(page.locator("h1")).not.toContainText(/[▾▴]/);
    await expect(page.locator("main h1")).toHaveText("როგორ ხარჯავს ბიუჯეტს თბილისი");

    await expect(trigger).toHaveCSS("color", "rgb(179, 64, 42)");
    await expect(trigger).toHaveCSS("border-bottom-style", "dashed");
    await expect(trigger).toHaveCSS("border-bottom-width", "1px");
    await expect(trigger).toHaveCSS("transition-duration", "0.1s");
    await expect(caret).toHaveText("");
    await expect(caret).toHaveCSS("border-top-width", "5px");
    await expect(caret).toHaveCSS("border-bottom-width", "0px");
    await expect(caret).toHaveCSS("color", "rgb(179, 64, 42)");

    await trigger.hover();
    await expect(caret).toHaveCSS("color", "rgb(179, 64, 42)");
    expect(await trigger.boundingBox()).toEqual(restingBox);

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(caret).toHaveText("");
    await expect(caret).toHaveCSS("border-top-width", "0px");
    await expect(caret).toHaveCSS("border-bottom-width", "5px");
  });

  test("opening moves focus into the search input", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("entity-picker-trigger").click();

    const combobox = page.getByTestId("entity-picker").getByRole("combobox");
    await expect(combobox).toBeFocused();
  });

  test("the popover mounts as a sibling of the trigger, not nested inside the h1", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
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
    await expectMunicipalAppReady(page);
    const trigger = page.getByTestId("entity-picker-trigger");
    await trigger.click();
    await expect(page.getByTestId("entity-picker")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByTestId("entity-picker")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("clicking outside the popover closes it and returns focus to the trigger", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
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

  test("Tab closes the popover and leaves focus on the next page control", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    const trigger = page.getByTestId("entity-picker-trigger");
    await trigger.click();
    const combobox = page.getByTestId("entity-picker").getByRole("combobox");
    await expect(combobox).toBeFocused();

    await page.keyboard.press("Tab");

    await expect(page.getByTestId("entity-picker")).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).not.toBeFocused();
    await expect(page.locator("a:focus")).toHaveCount(1);
  });

  test("ArrowDown/ArrowUp move aria-activedescendant across real options, and Enter activates the highlighted one", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
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
    await expect(page).toHaveURL(/\/explorer\/municipalities\/batumi(#|$)/);
    await expect(page.getByTestId("entity-picker")).toBeHidden();

    await page.getByTestId("municipal-mode-table").click();
    await expect(
      page.getByTestId("explorer-table").getByRole("table", {
        name: /ბათუმი — ხარჯები ლარში/,
      }),
    ).toHaveCount(1);
  });

  test("puts Georgia first in the picker and keeps it searchable", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("entity-picker-trigger").click();

    const picker = page.getByTestId("entity-picker");
    const options = picker.getByRole("option");
    await expect(options.first()).toHaveAttribute("data-testid", "picker-country");
    await expect(options.first()).toContainText("საქართველო");
    await expect(options.first()).toContainText("69 მუნიციპალური ბიუჯეტი");

    const search = picker.getByRole("combobox");
    await search.fill("საქართველო");
    await expect(picker.getByRole("option")).toHaveCount(1);
    const country = picker.getByTestId("picker-country");
    await country.click();
    await expect(page).toHaveURL(/\/explorer\/municipalities\/georgia(#|$)/);
  });
});

test.describe("UNIT_MLN — first render anywhere in the repo", () => {
  test("the chart axis reads in the million unit, and the table shows municipal-scale numbers, not the national billion unit", async ({
    page,
  }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

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
    await expect(totalRow).toContainText("მთლიანი ბიუჯეტი");

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
  test("municipal selector uses the same standardized anatomy as the national explorer", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const panel = page.getByTestId("series-selector");
    const sections = await panel.locator("[data-selector-section]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-selector-section")),
    );
    expect(sections).toEqual(["search", "actions", "list"]);

    await expect(panel.getByTestId("series-row").first()).toContainText("მთლიანი ბიუჯეტი");
    await expect(panel.getByTitle("მთლიანი ბიუჯეტი")).toHaveAttribute("aria-pressed", "true");

    const actionBox = await panel.getByTestId("series-toggle-all").boundingBox();
    const statusBox = await panel.getByTestId("series-status").boundingBox();
    expect(actionBox!.x).toBeLessThan(statusBox!.x);
  });

  test("series rows reuse the explorer's animated hover and selected tint", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const initiallySelected = page.locator('[data-testid="series-row"]:has([data-testid="series-row-toggle"][aria-pressed="true"])').first();
    const initiallyUnselected = page.locator('[data-testid="series-row"]:has([data-testid="series-row-toggle"][aria-pressed="false"])').first();
    const selectedLabel = await initiallySelected.getByTestId("series-label").innerText();
    const unselectedLabel = await initiallyUnselected.getByTestId("series-label").innerText();
    const selectedRow = page.getByTestId("series-row").filter({ hasText: selectedLabel }).first();
    const unselectedRow = page.getByTestId("series-row").filter({ hasText: unselectedLabel }).first();

    await expect(selectedRow.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(unselectedRow.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "false");
    await expect(selectedRow).toHaveCSS("background-color", "rgb(241, 234, 220)");
    await expect(selectedRow).toHaveCSS("transition-duration", "0.1s");
    await unselectedRow.hover();
    await expect(unselectedRow).toHaveCSS("background-color", "rgb(241, 234, 220)");

    await unselectedRow.getByTestId("series-row-toggle").click();
    await expect(unselectedRow.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(unselectedRow).toHaveCSS("background-color", "rgb(241, 234, 220)");
  });

  test("switches between chart and table", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("municipal-mode-table").click();
    const table = page.getByTestId("explorer-table");
    await expect(table).toBeVisible();
    await expect(table.locator("caption")).toHaveText("თბილისი — ხარჯები ლარში, 2015–2025");
    await expect(page.getByTestId("comparison-table").locator("caption")).toHaveText(
      "თბილისი — პერიოდის შედარება, 2015–2025",
    );
    // The regression this guards: in billions every municipal cell reads 0.0.
    // Checked cell by cell, not as a substring of the table's full text: this
    // municipality's თავდაცვა (defence) row genuinely rounds to 0 for every
    // loaded year, so the check stays cell-by-cell. UNIT_MLN renders whole
    // millions, so a correct cell can never be the decimal string "0.0".
    const cells = await table.locator("tbody td").allTextContents();
    for (const cell of cells) {
      expect(cell).not.toBe("0.0");
    }

    await page.getByTestId("municipal-share-toggle").click();
    await expect(table.locator("caption")).toHaveText("თბილისი — წილი მთლიან ბიუჯეტში, 2015–2025");

    await page.goto(`${ENTITY_URL}#m=table&sh=1&r=2020-2024`);
    await page.reload();
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("explorer-table").locator("caption")).toHaveText(
      "თბილისი — წილი მთლიან ბიუჯეტში, 2020–2024",
    );
    await expect(page.getByTestId("comparison-table").locator("caption")).toHaveText(
      "თბილისი — პერიოდის შედარება, 2020–2024",
    );
  });

  test("renders the official total and every selected municipal line", async ({ page }) => {
    const selection = `municipal.total,${ALL_FUNCTIONS}`;
    await page.goto(`${ENTITY_URL}#m=line&sel=${selection}`);
    await page.reload();
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("series-row").first()).toContainText("მთლიანი ბიუჯეტი");
    await expect(page.locator("[data-testid='series-row'] [data-testid='series-row-toggle'][aria-pressed='true']")).toHaveCount(11);
    await expect(page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']")).toHaveCount(11);
    await expect(page.getByTestId("series-overflow-callout")).toHaveCount(0);
  });

  test("bulk actions ignore the active municipal search", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    const panel = page.getByTestId("series-selector");
    const bulk = panel.getByTestId("series-toggle-all");
    const indicator = panel.getByTestId("series-toggle-indicator");
    const status = panel.getByTestId("series-status");

    await expect(status).toContainText("სერიები 1 / 11");
    await expect(bulk).toHaveAttribute("role", "checkbox");
    await expect(bulk).toHaveAttribute("aria-checked", "mixed");
    await expect(indicator).toHaveText("—");
    await expect(bulk).toContainText("გასუფთავება");
    await bulk.click();
    await expect(bulk).toHaveAttribute("aria-checked", "false");
    await expect(indicator).toHaveText("");
    await expect(bulk).toContainText("ყველას მონიშვნა");

    await panel.getByTestId("series-search").fill("განათლება");
    await expect(panel.getByTestId("series-row")).toHaveCount(2);
    await bulk.click();
    await expect(bulk).toHaveAttribute("aria-checked", "true");
    await expect(indicator).toHaveText("✓");
    await panel.getByTestId("series-search").fill("");
    await expect(panel.locator("[data-testid='series-row'] [data-testid='series-row-toggle'][aria-pressed='true']")).toHaveCount(11);
  });

  test("an explicitly empty selection shows guidance instead of an empty chart", async ({ page }) => {
    await page.addInitScript(() => {
      history.replaceState(null, "", "#m=line&sel=");
    });
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page.getByTestId("chart-frame")).toHaveCount(0);
    await expect(page.locator("[data-testid='series-row'] [data-testid='series-row-toggle'][aria-pressed='true']")).toHaveCount(0);
  });

  test("an explicitly empty selection renders no table rows", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#m=table&sel=`);
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);
    await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(0);
  });

  test("uses the official municipal total as 100% without normalizing functions", async ({ page }) => {
    const selection = `municipal.total,${ALL_FUNCTIONS}`;
    const duplicateKeyWarnings: string[] = [];
    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type()) && message.text().includes("same key")) {
        duplicateKeyWarnings.push(message.text());
      }
    });
    await page.goto(`${ENTITY_URL}#m=table&sh=1&r=2024-2024&sel=${selection}`);
    await page.reload();
    await expectMunicipalAppReady(page);

    const rows = page.getByTestId("explorer-table").locator("tbody tr");
    await expect(rows.last()).toContainText("მთლიანი ბიუჯეტი");
    await expect(rows.last()).toContainText("100.0%");

    const shares = await rows.locator("td:last-child").allTextContents();
    const functionalSum = shares
      .slice(0, -1)
      .reduce((sum, value) => sum + Number.parseFloat(value.replace("%", "")), 0);
    expect(functionalSum).not.toBeCloseTo(100, 1);
    expect(duplicateKeyWarnings).toEqual([]);
  });

  test("does not render a divergence callout or two-total source copy", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("divergence-callout")).toHaveCount(0);
    await expect(page.getByTestId("municipal-source-note")).not.toContainText("ორი განსხვავებული საზომია");
  });

  test("opens the entity picker with the keyboard", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("entity-picker")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("entity-picker")).toHaveCount(0);
  });

  test("keeps the picker popover out of the heading", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.keyboard.press("Control+k");
    // A role="dialog" inside an h1 is announced as part of the heading.
    await expect(page.locator("h1 [data-testid='entity-picker']")).toHaveCount(0);
    await expect(page.locator("h1 [data-testid='entity-picker-trigger']")).toHaveCount(1);
  });

  test("filters the series list and clears the selection", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("series-search")).toHaveAttribute("placeholder", "ძებნა");
    await page.getByTestId("series-search").fill("განათლება");
    await expect(page.getByTestId("series-row")).toHaveCount(2);
    await page.getByTestId("series-search").fill("");
    await expect(page.getByTestId("series-row")).toHaveCount(11);
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-row").first().getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "false");
  });

  test("omits the compact methodology link from an individual page", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("compact-methodology-link")).toHaveCount(0);
  });

  test("shows only the GEL amount in the municipality period-change column", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const changes = page.getByTestId("comparison-change-cell");
    await expect(changes).toHaveCount(11);
    await expect(changes.first()).not.toContainText("%");
    await expect(changes.first()).toContainText("₾");

    // The column sits between the 2015 and 2025 level columns in the same
    // typographic style, so direction has to survive without colour: grayscale,
    // print and colourblind readers otherwise read three levels in a row.
    const texts = await changes.allInnerTexts();
    expect(texts.filter((text) => /^[+−]/.test(text.trim()))).toHaveLength(texts.length);
  });

  test("keeps a sign on a real municipal change below the display threshold", async ({ page }) => {
    await page.goto(`${BASE_URL}/explorer/municipalities/batumi#r=2016-2021`);
    await expectMunicipalAppReady(page);

    const defenceRow = page.getByTestId("period-comparison").locator("tbody tr").filter({ hasText: "თავდაცვა" });
    await expect(defenceRow.getByTestId("comparison-change-cell")).toHaveText("+<0.01 მლნ ₾");
  });

  test("a single-year range states that it has no period instead of reporting 0.0% everywhere", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("entity-kpi-grid")).toBeVisible();

    await page.getByTestId("range-start-handle").press("End");

    await expect(page.getByTestId("period-single-year-note")).toBeVisible();
    await expect(page.getByTestId("period-movers")).toHaveCount(0);
    await expect(page.getByTestId("period-comparison")).toHaveCount(0);

    // All three municipal side KPIs are point-in-time (level, rank, share), so
    // the grid survives — #r=2015-2015 is a supported way to read the 2015 rank.
    await expect(page.getByTestId("entity-kpi-grid")).toBeVisible();
    await expect(page.getByTestId("period-indicators")).not.toContainText("პერიოდის ცვლილება");
  });

  test("treats a pinned total search as a match and reports genuine misses", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const panel = page.getByTestId("series-selector");
    const search = panel.getByTestId("series-search");
    const totalLabel = await panel.locator('[data-level="total"] [data-testid="series-label"]').innerText();
    const emptyState = panel.getByText(/^კატეგორია ვერ მოიძებნა/);

    await search.fill(totalLabel);
    await expect(panel.getByTestId("series-row")).toHaveCount(1);
    await expect(emptyState).toHaveCount(0);

    await search.fill("definitely-no-municipal-series-match");
    await expect(panel.getByTestId("series-row")).toHaveCount(1);
    await expect(emptyState).toBeVisible();
  });

  test("selects the official total and every function", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("series-toggle-all").click();
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-row")).toHaveCount(11);
    await expect(page.locator("[data-testid='series-row'] [data-testid='series-row-toggle'][aria-pressed='true']")).toHaveCount(11);
    await expect(page.getByTestId("series-toggle-all")).toHaveAttribute("aria-checked", "true");
  });

  test("downloads the selected range and series as a sourced percentage workbook", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#r=2020-2021&sh=1&sel=municipal.total,municipal.education`);
    await expectMunicipalAppReady(page);
    await page.getByTestId("series-search").fill("ჯანდაცვა");

    const { download, workbook } = await downloadMunicipalWorkbook(page);
    expect(download.suggestedFilename()).toBe("fiscal-municipality-04-2020-2021.xlsx");
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);

    const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
    expect(readable.getRow(3).values).toEqual([
      undefined,
      "კატეგორია",
      2020,
      2021,
      "ცვლილება 2020–2021",
    ]);
    expect([readable.getCell("A4").value, readable.getCell("A5").value]).toEqual([
      "მთლიანი ბიუჯეტი",
      "განათლება",
    ]);
    expect(readable.getCell("B4").value).toBe(1);
    expect(readable.getCell("B5").value).toBeCloseTo(148_386_753.36 / 1_080_555_805.54);

    const analysis = workbook.getWorksheet("მონაცემები")!;
    const analysisRows = (analysis.getRows(2, 20) ?? []).filter((row) => row.getCell(1).value !== null);
    expect(analysis.getRow(1).values).toContain("წილი მთლიან ბიუჯეტში (%)");
    expect(analysisRows.map((row) => row.getCell(1).value)).toEqual([2020, 2021]);
    expect(analysisRows.map((row) => row.getCell(3).value)).toEqual(["განათლება", "განათლება"]);
    expect(analysis.getCell("D2").value).toBe(148_386_753.36);
    expect(analysis.getCell("F2").value).toBeCloseTo(148_386_753.36 / 1_080_555_805.54);
    expect(analysis.getCell("F2").numFmt).toBe("0.0%");
    expect(analysis.getCell("F2").value).toBeCloseTo(148_386_753.36 / 1_080_555_805.54);

    const hyperlinks = workbook.getWorksheet("წყაროები")!.getSheetValues().flatMap((row) =>
      Array.isArray(row)
        ? row.flatMap((cell) => typeof cell === "object" && cell && "hyperlink" in cell ? [cell.hyperlink] : [])
        : [],
    );
    expect(hyperlinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2020/mof-functional-classification.xlsx`);
    expect(hyperlinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2016-2025/mof-municipality-budget-history-04.xlsx`);
    expect(hyperlinks).not.toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2016-2025/mof-municipality-budget-history-05.xlsx`);
    expect(hyperlinks).not.toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2016-2025/adjara-republic-actual-payments.xlsx`);
  });

  test("2015 total-only uses the portal fallback without a history workbook", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#r=2015-2015&sel=municipal.total`);
    await expectMunicipalAppReady(page);
    const { workbook } = await downloadMunicipalWorkbook(page);
    const sources = workbook.getWorksheet("წყაროები")!;
    const hyperlinks = sources.getSheetValues().flatMap((row) =>
      Array.isArray(row)
        ? row.flatMap((cell) => typeof cell === "object" && cell && "hyperlink" in cell ? [cell.hyperlink] : [])
        : [],
    );
    expect(hyperlinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2015-2019/municipalities-portal-functionals.zip`);
    expect(hyperlinks.some((value) => value.includes("budget-history-04"))).toBe(false);
  });

  test("2016 total-only uses the municipality history without the 2015 portal fallback", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#r=2016-2016&sel=municipal.total`);
    await expectMunicipalAppReady(page);
    const { workbook } = await downloadMunicipalWorkbook(page);
    const sources = workbook.getWorksheet("წყაროები")!;
    const hyperlinks = sources.getSheetValues().flatMap((row) =>
      Array.isArray(row)
        ? row.flatMap((cell) => typeof cell === "object" && cell && "hyperlink" in cell ? [cell.hyperlink] : [])
        : [],
    );
    expect(hyperlinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2016-2025/mof-municipality-budget-history-04.xlsx`);
    expect(hyperlinks.some((value) => value.includes("municipalities-portal-functionals"))).toBe(false);
  });

  test("nominal function-only excludes total histories while percentage function-only keeps the denominator sources", async ({ page }) => {
    await page.goto(`${ENTITY_URL}#r=2020-2020&sel=municipal.education`);
    await expectMunicipalAppReady(page);
    const nominal = await downloadMunicipalWorkbook(page);
    const nominalLinks = nominal.workbook.getWorksheet("წყაროები")!.getSheetValues().flatMap((row) =>
      Array.isArray(row)
        ? row.flatMap((cell) => typeof cell === "object" && cell && "hyperlink" in cell ? [cell.hyperlink] : [])
        : [],
    );
    expect(nominalLinks.some((value) => value.includes("mof-functional-classification.xlsx"))).toBe(true);
    expect(nominalLinks.some((value) => value.includes("budget-history-04.xlsx"))).toBe(false);

    await page.goto(`${ENTITY_URL}#r=2020-2020&sel=municipal.education`);
    await expectMunicipalAppReady(page);
    await page.getByTestId("municipal-share-toggle").click();
    const percentage = await downloadMunicipalWorkbook(page);
    const percentageLinks = percentage.workbook.getWorksheet("წყაროები")!.getSheetValues().flatMap((row) =>
      Array.isArray(row)
        ? row.flatMap((cell) => typeof cell === "object" && cell && "hyperlink" in cell ? [cell.hyperlink] : [])
        : [],
    );
    expect(percentageLinks.some((value) => value.includes("mof-functional-classification.xlsx"))).toBe(true);
    expect(percentageLinks.some((value) => value.includes("budget-history-04.xlsx"))).toBe(true);
  });

  test("Khulo 2024 total cites the functional fallback instead of its history workbook", async ({ page }) => {
    await page.goto(`${BASE_URL}/explorer/municipalities/khulo#r=2024-2024&sel=municipal.total`);
    await expectMunicipalAppReady(page);
    const { workbook } = await downloadMunicipalWorkbook(page);
    const hyperlinks = workbook.getWorksheet("წყაროები")!.getSheetValues().flatMap((row) =>
      Array.isArray(row)
        ? row.flatMap((cell) => typeof cell === "object" && cell && "hyperlink" in cell ? [cell.hyperlink] : [])
        : [],
    );
    expect(hyperlinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2024/mof-functional-classification.xlsx`);
    expect(hyperlinks.some((value) => value.includes("budget-history-11.xlsx"))).toBe(false);
  });

  test("uses the same export control treatment as the national explorer", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const classes = await page.getByTestId("municipal-excel").getAttribute("class");
    expect(classes).toContain("h-[38px]");
    expect(classes).toContain("w-full");
    expect(classes).toContain("bg-[var(--ink)]");
    expect(classes).toContain("text-[var(--paper)]");
  });

  test("recomputes the period comparison when the range moves", async ({ page }) => {
    // The regression this guards: filtering years without rebuilding the model,
    // so ცვლილება and the comparison table describe the full span while the
    // chart describes the selection.
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    const before = await page.getByTestId("comparison-table").innerText();
    await page.goto(`${ENTITY_URL}#m=line&r=2020-2025&sel=municipal.education`);
    await expectMunicipalAppReady(page);
    await page.reload();
    await expectMunicipalAppReady(page);
    // The server always renders the default range first — a URL hash is never
    // sent in the request — so the hash-restored range lands only after
    // client-side hydration runs. Wait for it to actually show in the DOM
    // before reading the table; an immediate innerText() can capture that
    // pre-hydration snapshot and compare the default range against itself.
    await expect(page.getByTestId("comparison-table").locator("thead th").nth(1)).toHaveText("2020");
    const after = await page.getByTestId("comparison-table").innerText();
    expect(after).not.toBe(before);
  });

  test("uses the historical range-end rank rather than the latest-year rank", async ({ page }) => {
    await page.goto(`${BASE_URL}/explorer/municipalities/sighnaghi#r=2015-2015`);
    await expectMunicipalAppReady(page);

    const rankKpi = page.getByTestId("entity-kpi").filter({ hasText: "წილი მუნიციპალურ ხარჯებში" });
    await expect(rankKpi).toContainText("მე-51 ადგილი 64-დან");
    await expect(rankKpi).not.toContainText("მე-26 ადგილი 64-დან");
  });

  test("renders the municipal headline gauge and side KPI trends", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("municipal-change-gauge")).toBeVisible();
    await expect(page.getByTestId("municipal-change-start")).toContainText(/2015/);
    await expect(page.getByTestId("municipal-change-end")).toContainText(/2025/);
    await expect(page.getByTestId("municipal-change-sentence")).toContainText("წლებში");
    await expect(page.getByTestId("entity-kpi").first().getByText("+120.0%", { exact: true })).toBeVisible();

    const sideKpis = page.getByTestId("side-kpi");
    await expect(sideKpis).toHaveCount(3);
    const officialBudgetUnit = sideKpis.first().getByText("მლრდ ₾", { exact: true });
    await expect(officialBudgetUnit).toHaveClass(/ml-1\.5/);
    await expect(officialBudgetUnit).toHaveClass(/font-\[family-name:var\(--font-numeric\)\]/);
    await expect(officialBudgetUnit).toHaveClass(/text-xs/);
    await expect(officialBudgetUnit).toHaveClass(/font-medium/);
    await expect(officialBudgetUnit).toHaveClass(/tracking-normal/);
    await expect(officialBudgetUnit).toHaveClass(/text-\[var\(--body\)\]/);
    for (let index = 0; index < 3; index += 1) {
      await expect(sideKpis.nth(index).locator("svg")).toHaveCount(1);
    }
  });

  test("keeps the municipal workspace stacked until its content container reaches 1100px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "true");

    const columns = await page.getByTestId("municipal-workspace").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
    );
    const kpiColumns = await page.getByTestId("entity-kpi-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
    );
    expect(columns).toHaveLength(1);
    expect(kpiColumns).toHaveLength(1);
  });

  test("uses reviewed punctuation in the municipality metadata description", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute("content", /ქალაქ თბილისის მუნიციპალიტეტის ფაქტობრივი ბიუჯეტი/);
    await expect(description).not.toHaveAttribute("content", /მუნიციპალიტეტიის/);
  });

  // Whole-branch review finding: municipalities is the first section with
  // child routes, so `pathname === section.href` alone never matched on a
  // municipality sub-page and the sidebar carried no active state at all —
  // no accent marker, no aria-current — even though the reader is inside the
  // section. main-explorer.spec.ts already pins this on the index; this pins
  // it one level deeper, on an actual municipality page.
  test("the sidebar keeps მუნიციპალიტეტები highlighted on a municipality sub-page, not just the index", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const sidebar = page.getByTestId("data-sidebar");
    const municipalitiesLink = sidebar.getByTestId("section-link-municipalities");
    await expect(municipalitiesLink).toHaveAttribute("aria-current", "page");
    // No other section row should also claim to be current.
    await expect(sidebar.getByTestId("section-link-expenditure")).not.toHaveAttribute("aria-current", "page");
  });

  // Whole-branch review finding: the comparison table's header hardcoded the
  // revenue scope's column label ("საბიუჯეტო მუხლი") even though its rows are
  // municipal functions, so the same page named the same column two different
  // ways. Comparing the two tables to each other (not just to a literal) means
  // a future edit that moves one label without the other fails here too.
  test("the chart-mode table and the period-comparison table label their first column the same way", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("municipal-mode-table").click();

    const explorerHeader = page.getByTestId("explorer-table").locator("thead th").first();
    const comparisonHeader = page.getByTestId("comparison-table").locator("thead th").first();

    await expect(explorerHeader).toHaveText("ფუნქცია");
    await expect(comparisonHeader).toHaveText("ფუნქცია");
    expect(await comparisonHeader.innerText()).toBe(await explorerHeader.innerText());
  });

  test("renders municipality indicators across the page below the Excel panel", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const workspace = page.getByTestId("municipal-workspace");
    const indicators = page.getByTestId("period-indicators");
    const excelButton = page.getByTestId("municipal-excel");

    await expect(workspace.locator("[data-testid='period-indicators']")).toHaveCount(0);
    await expect(indicators).toBeVisible();
    await expect(page.getByTestId("comparison-table").locator("tbody tr")).toHaveCount(11);

    const columns = await workspace.evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/));
    const workspaceBox = await workspace.boundingBox();
    const indicatorsBox = await indicators.boundingBox();
    const excelBox = await excelButton.boundingBox();

    expect(columns).toHaveLength(2);
    expect(workspaceBox).not.toBeNull();
    expect(indicatorsBox).not.toBeNull();
    expect(excelBox).not.toBeNull();
    expect(Math.abs(indicatorsBox!.x - workspaceBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(indicatorsBox!.width - workspaceBox!.width)).toBeLessThanOrEqual(1);
    expect(indicatorsBox!.y).toBeGreaterThanOrEqual(excelBox!.y + excelBox!.height);
  });

  test("places a data-derived entity summary below the chart source and before the indicators", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const summary = page.getByTestId("municipal-entity-summary");
    await expect(summary).toHaveText(
      "ქალაქ თბილისის მუნიციპალიტეტის ბიუჯეტი 2025 წელს 2.1 მლრდ ₾ იყო — 64 მუნიციპალიტეტს შორის პირველი ადგილი. ყველაზე დიდი ფუნქციური მიმართულებაა ეკონომიკური საქმიანობა, რომელიც ბიუჯეტის 34.9%-ს შეადგენს.",
    );

    const sourceBox = await page.getByTestId("municipal-source-note").boundingBox();
    const summaryBox = await summary.boundingBox();
    const indicatorsBox = await page.getByTestId("period-indicators").boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(indicatorsBox).not.toBeNull();
    expect(summaryBox!.y).toBeGreaterThanOrEqual(sourceBox!.y + sourceBox!.height);
    expect(indicatorsBox!.y).toBeGreaterThanOrEqual(summaryBox!.y + summaryBox!.height);
  });

  test("matches the national mover and comparison presentation", async ({ page }) => {
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const movers = page.getByTestId("period-movers");
    const moverHeadings = movers.locator("h3");
    await expect(moverHeadings).toHaveCount(2);
    expect(await moverHeadings.allTextContents()).toEqual(["ყველაზე მზარდი", "ყველაზე ნელი ზრდა"]);
    for (const heading of await moverHeadings.all()) {
      await expect(heading).toHaveCSS("font-size", "13px");
      await expect(heading).toHaveCSS("font-weight", "600");
    }

    const moverRows = movers.locator("[title]");
    await expect(moverRows).toHaveCount(6);
    for (const row of await moverRows.all()) {
      const label = (await row.locator(":scope > span").nth(1).textContent())?.trim();
      await expect(row).toHaveAttribute("title", label ?? "");
      const width = await row.locator(":scope > span:nth-child(3) > span").evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).width) / Number.parseFloat(getComputedStyle(element.parentElement!).width),
      );
      expect(width).toBeGreaterThanOrEqual(0.04);
    }

    const comparison = page.getByTestId("period-comparison");
    const comparisonHeading = comparison.locator("h3");
    await expect(comparisonHeading).toHaveCSS("font-size", "13px");
    await expect(comparisonHeading).toHaveCSS("font-weight", "600");
    await expect(comparison.locator("h2")).toHaveCount(0);
    await expect(comparison.locator("p")).toHaveCount(0);
    await expect(comparison.locator("span").filter({ hasText: /→/ })).toHaveCount(0);

    const table = comparison.getByTestId("comparison-table");
    await expect(table).toHaveClass(/table-fixed/);
    await expect(table.locator("colgroup col")).toHaveCount(4);
    await expect(table.locator("colgroup col").first()).toHaveClass(/w-\[44%\]/);
    const row = table.locator("tbody tr").first();
    await expect(row).toHaveClass(/transition-colors/);
    await expect(row).toHaveClass(/duration-100/);
    await expect(row).toHaveClass(/hover:bg-\[var\(--tint\)\]/);
  });

  test("keeps the four-column comparison readable inside a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ENTITY_URL);
    await expectMunicipalAppReady(page);

    const table = page.getByTestId("comparison-table");
    const overflow = table.locator("..");
    const sizes = await overflow.evaluate((container) => ({
      containerClientWidth: container.clientWidth,
      containerScrollWidth: container.scrollWidth,
      pageClientWidth: document.documentElement.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      tableWidth: container.querySelector("table")!.getBoundingClientRect().width,
    }));

    // Below 768px the comparison fits the column, like the national one (§8.7):
    // the change and latest-year columns must not hide behind a sideways scroll.
    expect(sizes.tableWidth).toBeLessThanOrEqual(sizes.containerClientWidth);
    expect(sizes.containerScrollWidth).toBe(sizes.containerClientWidth);
    expect(sizes.pageScrollWidth).toBe(sizes.pageClientWidth);

    const boxes = await table.locator("tbody tr").first().locator("td").evaluateAll((cells) => cells.slice(1).map((cell) => {
      const box = cell.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }));
    expect(boxes).toHaveLength(3);
    expect(boxes[0]!.right).toBeLessThanOrEqual(boxes[1]!.left);
    expect(boxes[1]!.right).toBeLessThanOrEqual(boxes[2]!.left);
  });

  test("keeps municipal chart controls readable on narrow phones", async ({ page }) => {
    for (const path of [
      "/explorer/municipalities/tbilisi",
      "/explorer/municipalities/region/kakheti",
      "/explorer/municipalities/georgia",
    ]) {
      for (const width of [320, 375, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`${BASE_URL}${path}`);
        await expectMunicipalAppReady(page);

        const controls = page.getByTestId("municipal-chart-controls");
        const shareToggle = page.getByTestId("municipal-share-toggle");
        await expect(controls).toBeVisible();
        await expect(shareToggle).toHaveText("% წილი");

        const geometry = await controls.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            viewport: document.documentElement.clientWidth,
            pageWidth: document.documentElement.scrollWidth,
          };
        });
        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
        expect(geometry.pageWidth).toBe(geometry.viewport);

        const toggleBox = await shareToggle.boundingBox();
        expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(36);
        await expect(shareToggle).toHaveCSS("white-space", "nowrap");

        for (const testId of ["municipal-mode-line", "municipal-mode-table"]) {
          const mode = page.getByTestId(testId);
          const modeBox = await mode.boundingBox();
          expect(modeBox?.height ?? 0).toBeGreaterThanOrEqual(36);
          await expect(mode).toHaveCSS("min-height", "36px");
        }
      }
    }
  });
});

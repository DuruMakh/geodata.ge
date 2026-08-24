import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

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

// Region roll-up pages (Task 12) — reuse Task 11's MunicipalExplorer
// workspace and the entity picker via `children`/`pickerGroups`. Two things
// nothing in the repo exercised before this page existed:
//
//  - the roll-up source note (design spec §7.3): the page must state its
//    coverage — აჭარა consolidates the autonomous republic and its six
//    municipalities, while შიდა ქართლი/მცხეთა-მთიანეთი exclude bodies associated with occupied
//    territories. Without this note a region total reads as complete
//    territorially attributed spending, which it is not.
//  - the picker's region options (Task 10): they 404'd until this page
//    shipped, exactly as Task 11's report flagged.
//
// Full section e2e coverage is Task 14's; this pins the specific gaps above.

// იმერეთი: 12 member municipalities (data/imports/municipalities.csv), the
// same region the brief's own manual verification step names.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const SOURCE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
const REGION_URL = `${BASE_URL}/explorer/municipalities/region/imereti`;
const ADJARA_URL = `${BASE_URL}/explorer/municipalities/region/adjara`;
const LONG_REGION_URL = `${BASE_URL}/explorer/municipalities/region/racha_lechkhumi_kvemo_svaneti`;

test.describe("region header responsiveness", () => {
  for (const viewport of [
    { width: 375, height: 844 },
    { width: 768, height: 900 },
    { width: 900, height: 900 },
  ]) {
    test(`keeps the longest heading readable without horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(LONG_REGION_URL);
      await expectMunicipalAppReady(page);
      expect(response?.status()).toBe(200);

      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toHaveText(
        "როგორ ხარჯავს ბიუჯეტს რაჭა-ლეჩხუმი და ქვემო სვანეთი▾",
      );

      const headingBox = await heading.boundingBox();
      const headerBox = await heading.locator("xpath=../..").boundingBox();
      expect(headingBox?.width ?? 0).toBeGreaterThan((headerBox?.width ?? 0) * 0.45);

      const pageWidth = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(pageWidth.content).toBe(pageWidth.viewport);
    });
  }
});

test.describe("region source note", () => {
  test("keeps the occupied-territory exclusions on ordinary regional roll-ups", async ({ page }) => {
    const response = await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);
    expect(response?.status()).toBe(200);

    const note = page.getByTestId("municipal-source-note");
    await expect(note).toContainText("რეგიონის ჯამი მხოლოდ საჯაროდ მოწოდებულ მუნიციპალურ ბიუჯეტებს აერთიანებს");
    await expect(note).toContainText("შიდა ქართლსა და მცხეთა-მთიანეთს ოკუპირებულ ტერიტორიებთან დაკავშირებული ერთეულები აკლია");
  });

  test("identifies Adjara's consolidated total and removed internal transfers", async ({ page }) => {
    await page.goto(ADJARA_URL);
    await expectMunicipalAppReady(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("გაერთიანებული ბიუჯეტი — აჭარა▾");
    const note = page.getByTestId("municipal-source-note");
    await expect(note).toContainText("ექვსი მუნიციპალიტეტის ბიუჯეტებს");
    await expect(note).toContainText("ტრანსფერები გამოკლებულია");
    await expect(note).toContainText("ფუნქციური სერიები მხოლოდ მუნიციპალიტეტების");
    await expect(page.getByTestId("explorer-shell")).toContainText("განახლდა 2026-08-16");
    await expect(page.locator('a[href*="adjara-republic"]')).toHaveCount(0);

    const summary = page.getByTestId("municipal-entity-summary");
    await expect(summary).toContainText("6 მუნიციპალიტეტსა და აჭარის ა.რ. რესპუბლიკურ ბიუჯეტს");
    await expect(summary).toContainText("შიდა ტრანსფერების გამოკლებით");
    await expect(summary).not.toContainText("ყველაზე დიდი ფუნქციური მიმართულებაა");
    await expect(summary).not.toContainText("%");
  });
});

test.describe("region roll-up page", () => {
  test("downloads only the active range with readable millions and full-GEL analysis", async ({ page }) => {
    await page.goto(`${ADJARA_URL}#r=2020-2021`);
    await expectMunicipalAppReady(page);

    const { download, workbook } = await downloadMunicipalWorkbook(page);
    expect(download.suggestedFilename()).toBe("fiscal-region-adjara-2020-2021.xlsx");
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);

    const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
    expect(readable.getRow(3).values).toEqual([
      undefined,
      "კატეგორია",
      2020,
      2021,
      "ცვლილება 2020–2021",
    ]);
    expect(readable.getCell("A4").value).toBe("მთლიანი ბიუჯეტი");
    expect(readable.getCell("B4").value).toBeGreaterThan(1);

    const analysis = workbook.getWorksheet("მონაცემები")!;
    const analysisRows = (analysis.getRows(2, 10) ?? []).filter((row) => row.getCell(1).value !== null);
    expect(analysisRows.map((row) => row.getCell(1).value)).toEqual([2020, 2021]);
    expect(analysis.getCell("D2").value).toBeCloseTo(Number(readable.getCell("B4").value) * 1_000_000);
    const hyperlinks = workbook.getWorksheet("წყაროები")!.getSheetValues().flatMap((row) =>
      Array.isArray(row)
        ? row.flatMap((cell) => typeof cell === "object" && cell && "hyperlink" in cell ? [cell.hyperlink] : [])
        : [],
    );
    expect(hyperlinks).not.toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2020/mof-functional-classification.xlsx`);
    expect(hyperlinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2016-2025/mof-municipality-budget-history-06.xlsx`);
    expect(hyperlinks).not.toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2016-2025/mof-municipality-budget-history-12.xlsx`);
    expect(hyperlinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/municipalities/files/2016-2025/adjara-republic-actual-payments.xlsx`);
    expect(hyperlinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf`);
    expect(hyperlinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/revenue/files/2021/mof-revenue-form-1.pdf`);
  });

  test("renders every member, the roll-up chart, and suppresses the per-member divergence callout", async ({ page }) => {
    const response = await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);
    expect(response?.status()).toBe(200);

    // 12 member rows, matching the taxonomy count for region.imereti.
    await expect(page.getByTestId("region-member-row")).toHaveCount(12);

    const chart = page.getByTestId("chart-frame");
    await expect(chart).toBeVisible();
    await expect(chart.locator("svg text").first()).toBeVisible();

    await expect(page.getByTestId("divergence-callout")).toHaveCount(0);
  });

  test("a member row links through to its own municipality page", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);

    const first = page.getByTestId("region-member-row").first();
    await expect(first).toHaveAttribute("href", /^\/explorer\/municipalities\/[^/]+$/);
  });

  test("meta line reports the member count and the region's rank out of 11, not 64", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("explorer-shell")).toContainText("12 მუნიციპალიტეტი");
    await expect(page.getByTestId("explorer-shell")).toContainText("ადგილი 11-დან");
  });

  test("places a region-specific summary below the chart source and before the indicators", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);

    const summary = page.getByTestId("municipal-entity-summary");
    await expect(summary).toHaveText(
      "იმერეთის მუნიციპალიტეტების ჯამური ბიუჯეტი 2025 წელს 606 მლნ ₾ იყო — 11 რეგიონს შორის მე-3 ადგილი. ყველაზე დიდი ფუნქციური მიმართულებაა ეკონომიკური საქმიანობა, რომელიც ბიუჯეტის 25.6%-ს შეადგენს.",
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
});

test.describe("entity picker region options resolve (previously 404)", () => {
  test("selecting a region option from a municipality page's picker navigates to a real, fully-rendered region page", async ({ page }) => {
    await page.goto(`${BASE_URL}/explorer/municipalities/tbilisi`); // თბილისი
    await expectMunicipalAppReady(page);
    await page.getByTestId("entity-picker-trigger").click();

    const regionOption = page.getByTestId("picker-region").filter({ hasText: "იმერეთი" });
    await expect(regionOption).toHaveCount(1);
    await regionOption.click();

    await expect(page).toHaveURL(/\/explorer\/municipalities\/region\/imereti(#|$)/);
    // Proof this is a real render, not Next's built-in 404 page: the
    // region-only member list and the plain-name picker trigger are both present.
    await expect(page.getByTestId("region-member-row")).toHaveCount(12);
    await expect(page.getByTestId("entity-picker-trigger")).toContainText("იმერეთი");
  });

  test("puts Georgia before the region options on a region page", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);
    await page.getByTestId("entity-picker-trigger").click();

    const picker = page.getByTestId("entity-picker");
    const options = picker.getByRole("option");
    await expect(options.first()).toHaveAttribute("data-testid", "picker-country");
    await expect(options.first()).toContainText("საქართველო");
    await expect(options.nth(1)).toHaveAttribute("data-testid", "picker-region");
  });
});

// Task 14: the full region-page e2e coverage the header comment above defers
// to this task ("Full section e2e coverage is Task 14's"). This necessarily
// overlaps in substance with the two targeted tests above — those pin specific
// past defects (the source note and the picker's region options), this is the
// page's general contract.
test.describe("region page", () => {
  test("uses the standardized selector structure with only its total selected by default", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);

    const panel = page.getByTestId("series-selector");
    const sections = await panel.locator("[data-selector-section]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-selector-section")),
    );
    expect(sections).toEqual(["search", "actions", "list"]);
    await expect(panel.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
    await expect(panel.locator('[data-level="total"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByTestId("series-status")).toContainText(/სერიები\s*1 \/ 11/);
  });

  test("uses the plain region name in the picker trigger", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);

    const trigger = page.getByTestId("entity-picker-trigger");
    await expect(trigger).toContainText("იმერეთი");
    await expect(trigger).not.toContainText("მუნიციპალური ბიუჯეტები");
  });

  test("uses the municipality-style regional heading and no individual methodology link", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ხარჯავს ბიუჯეტს იმერეთი▾");
    await expect(page.getByTestId("compact-methodology-link")).toHaveCount(0);
  });

  test("lists its member municipalities and carries the roll-up caveats", async ({ page }) => {
    await page.goto(REGION_URL);
    await expectMunicipalAppReady(page);
    const trigger = page.getByTestId("entity-picker-trigger");
    await expect(trigger).toHaveCSS("color", "rgb(179, 64, 42)");
    await expect(page.getByTestId("entity-picker-caret")).toHaveText("▾");
    await expect(page.getByTestId("region-member-row")).toHaveCount(12);
    await expect(page.getByTestId("municipal-source-note").first()).toContainText("ოკუპირებულ ტერიტორიებთან");
    await expect(page.getByTestId("divergence-callout")).toHaveCount(0);
  });
});

import { expect, test, type Page } from "@playwright/test";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { formatAmount, formatPerResidentGel } from "../../lib/explorer/format";
import { TEST_BASE_URL } from "./test-base-url";

async function expectMunicipalAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (channels?.length !== 3) throw new Error(`Expected an RGB color, received ${color}`);
    const [red, green, blue] = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("states where the index figures come from and what the map measures", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);

  // The page publishes a choropleth, four fiscal KPIs and 64 ranked budgets.
  // Every other data surface carries a source note; this one had none, and #68
  // also removed the intro paragraph and the map's measure-and-year heading, so
  // the ramp legend read only "ერთ მოსახლეზე" with no year attached.
  const note = page.getByTestId("municipal-source-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText("საქართველოს ფინანსთა სამინისტრო");
  await expect(note).toContainText("ბოლო განახლება");

  // Region rows sum the 64 served municipalities and sit directly beneath a
  // "საქართველო" row built from the 69-unit roll-up; say why they differ.
  await expect(note).toContainText("69");
  await expect(note).toContainText("64");

  // #68 removed the visible map heading on purpose and a test below locks that
  // in, so the measure and its year are stated here rather than reinstated
  // above the choropleth.
  await expect(note).toContainText("ერთ მოსახლეზე");
  await expect(note).toContainText("2025");

  // The choropleth is a vendored OSM derivative, so ODbL §4.3 attribution rides
  // on the note wherever the map is publicly used — DESIGN.md §20 specifies the
  // link and the licence name here, not on the methodology page alone.
  const attribution = note.getByRole("link", { name: /OpenStreetMap/ });
  await expect(attribution).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  await expect(note).toContainText("ODbL");
});

test("renders 64 globally ordered accessible map targets behind one tab stop", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  const map = page.getByTestId("municipality-map");
  await expect(map.locator("[data-municipality-shape]")).toHaveCount(60);
  await expect(map.locator("[data-municipality-marker]")).toHaveCount(5);
  await expect(map.locator("[data-occupied-overlay]")).toHaveCount(2);

  const targets = map.locator("[data-municipality-map-target]");
  // One target per municipality. Tbilisi (04) is the only entity the artifact
  // carries as both a polygon and a self-governing-city marker; the marker is
  // the encoding the legend names, so the polygon stays drawn but is not a
  // second focus stop announcing the same name.
  await expect(targets).toHaveCount(64);
  const targetMetadata = await targets.evaluateAll((elements) =>
    elements.map((element) => {
      const label = element.getAttribute("aria-label") ?? "";
      return {
        code: element.getAttribute("data-municipality-code"),
        label,
        name: label.split(" · ")[0],
        role: element.getAttribute("role"),
        tabIndex: element.getAttribute("tabindex"),
      };
    }),
  );
  const codes = targetMetadata.map(({ code }) => code);
  expect(new Set(codes).size).toBe(64);
  expect(codes).toHaveLength(64);
  expect(targetMetadata.every(({ role }) => role === "link")).toBe(true);

  // Roving tabindex: the map is one stop on the way to the ranked list, not 65.
  // The picker component already avoids this — its comment says "Tab must not
  // stop at all ~75 of them one by one" — and the map now matches it.
  expect(targetMetadata.filter(({ tabIndex }) => tabIndex === "0")).toHaveLength(1);
  expect(targetMetadata.filter(({ tabIndex }) => tabIndex === "-1")).toHaveLength(63);
  expect(
    targetMetadata.every(({ label }) => /[\u10A0-\u10FF].+მუნიციპალიტეტის გახსნა$/.test(label)),
  ).toBe(true);

  const names = targetMetadata.map(({ name }) => name);
  expect(names).toEqual(names.toSorted((left, right) => left.localeCompare(right, "ka")));
  expect(targetMetadata.filter(({ code }) => code === "04")).toHaveLength(1);

  await map.scrollIntoViewIfNeeded();
  const markersAreTopmostAtTheirCenters = await map.locator("[data-municipality-marker]").evaluateAll((markers) =>
    markers.every((marker) => {
      const box = marker.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === marker;
    }),
  );
  expect(markersAreTopmostAtTheirCenters).toBe(true);

  const overlaysFollowTargets = await map.locator("svg").evaluate((svg) => {
    const targets = [...svg.querySelectorAll("[data-municipality-map-target]")];
    const lastTarget = targets.at(-1);
    const overlays = [...svg.querySelectorAll("[data-occupied-overlay]")];
    return (
      lastTarget !== undefined &&
      overlays.every((overlay) =>
        Boolean(lastTarget.compareDocumentPosition(overlay) & Node.DOCUMENT_POSITION_FOLLOWING),
      )
    );
  });
  expect(overlaysFollowTargets).toBe(true);
});

test("draws all reviewed map shapes before JavaScript runs", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    const paths = page.getByTestId("municipality-map").locator("[data-municipality-shape], [data-occupied-overlay]");
    await expect(paths).toHaveCount(62);
    await expect.poll(() => paths.evaluateAll((elements) => elements.filter((element) => {
      const box = (element as SVGGraphicsElement).getBBox();
      return box.width > 0 && box.height > 0;
    }).length)).toBe(62);
    await expect(page.getByTestId("municipality-map").locator("[data-municipality-marker]")).toHaveCount(5);
  } finally {
    await context.close();
  }
});

test("moves between map targets with arrow keys instead of 65 tab stops", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);

  const map = page.getByTestId("municipality-map");
  const first = map.locator("[data-municipality-map-target]").first();
  await first.focus();

  const focusedCode = () => page.evaluate(() => document.activeElement?.getAttribute("data-municipality-code") ?? null);
  const start = await focusedCode();

  await page.keyboard.press("ArrowRight");
  const next = await focusedCode();
  expect(next).not.toBe(start);

  await page.keyboard.press("ArrowLeft");
  expect(await focusedCode()).toBe(start);

  await page.keyboard.press("End");
  const last = await focusedCode();
  expect(last).not.toBe(start);

  await page.keyboard.press("Home");
  expect(await focusedCode()).toBe(start);
});

test("polygon and marker clicks open municipality pages directly", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  await page.getByTestId("municipality-shape-33").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/zugdidi");

  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  await page.getByTestId("municipality-marker-06").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/batumi");
});

test("Enter activates a polygon and Space activates a marker", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  await page.getByTestId("municipality-shape-33").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/zugdidi");

  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  const before = await page.evaluate(() => window.scrollY);
  await page.getByTestId("municipality-marker-06").focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/batumi");
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("occupied overlays expose no interaction or public explanation", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  const overlays = page.locator("[data-occupied-overlay]");
  await expect(overlays).toHaveCount(2);
  for (const overlay of await overlays.all()) {
    await expect(overlay).toHaveAttribute("aria-hidden", "true");
    await expect(overlay).not.toHaveAttribute("tabindex");
    await expect(overlay).not.toHaveAttribute("role");
  }
  await expect(page.getByTestId("municipality-map")).not.toContainText(/ოკუპირ|Russian/i);
});

test("keeps occupied-area and no-data wording out of the map itself", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  await expect(page.getByTestId("municipality-map")).not.toContainText(/ოკუპირ|Russian/i);
  await expect(page.getByTestId("municipality-map")).not.toContainText(/მონაცემები არ არის|no data/i);
});

test("map shows no data popup while its legend and accessible names retain the measure", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  await expect(page.getByTestId("municipality-map-heading")).toHaveCount(0);
  await expect(page.getByTestId("municipality-map-legend")).toContainText("₾");
  await expect(page.getByTestId("municipality-map").locator("svg")).toHaveAttribute(
    "aria-label",
    /2025.*ერთ მოსახლეზე/,
  );

  const { totalFacts, populationFacts } = await loadServedMunicipalData();
  const zugdidiTotal = totalFacts.find((row) => row.year === 2025 && row.municipalityCode === "33")!;
  const zugdidiPopulation = populationFacts.find((row) => row.municipalityCode === "33")!;
  const perResident = formatPerResidentGel(zugdidiTotal.publicTotalGel / zugdidiPopulation.populationPersons);
  const total = formatAmount(zugdidiTotal.publicTotalGel);
  const zugdidi = page.getByTestId("municipality-shape-33");
  await zugdidi.hover();
  const tooltip = page.getByTestId("municipality-map-tooltip");
  await expect(tooltip).toHaveCount(0);
  await expect(zugdidi).toHaveAccessibleName(new RegExp(`ზუგდიდი.*${perResident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*${total.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*გახსნა`));
  await expect(zugdidi).not.toHaveAttribute("aria-describedby");

  const batumi = page.getByTestId("municipality-marker-06");
  await batumi.focus();
  await expect(tooltip).toHaveCount(0);
  await expect(batumi).toHaveAccessibleName(/ბათუმი.*გახსნა/);
  await expect(batumi).not.toHaveAttribute("aria-describedby");
  await expect(zugdidi).not.toHaveAttribute("aria-describedby");
  await expect(page.locator("[data-municipality-map-target][aria-describedby]")).toHaveCount(0);
});

test("Tbilisi path and marker activate together with one accessible target and no data popup", async ({
  page,
}) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  const path = page.getByTestId("municipality-shape-04");
  const marker = page.getByTestId("municipality-marker-04");

  // The polygon co-highlights with its marker on hover and still opens Tbilisi
  // on click, but it is aria-hidden and unfocusable: one municipality, one
  // accessible name, one stop.
  await path.dispatchEvent("mouseover");
  await expect(path).toHaveAttribute("data-active", "true");
  await expect(marker).toHaveAttribute("data-active", "true");
  await expect(path).toHaveAttribute("aria-hidden", "true");
  await expect(path).not.toHaveAttribute("tabindex");

  await marker.focus();
  await expect(path).toHaveAttribute("data-active", "true");
  await expect(marker).toHaveAttribute("data-active", "true");
  await expect(marker).not.toHaveAttribute("aria-describedby");
  await expect(page.getByTestId("municipality-map-tooltip")).toHaveCount(0);
  await expect(path).not.toHaveAttribute("aria-describedby");
});

test("list focus takes priority over a different map pointer target without a data popup", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  const zugdidi = page.getByTestId("municipality-shape-33");
  const tbilisiPath = page.getByTestId("municipality-shape-04");
  const tbilisiMarker = page.getByTestId("municipality-marker-04");

  await zugdidi.dispatchEvent("mouseover");
  await expect(page.getByTestId("municipality-map-tooltip")).toHaveCount(0);
  await page.locator('[data-municipality-row-code="04"]').evaluate((row) =>
    (row as HTMLElement).focus({ preventScroll: true }),
  );

  await expect(tbilisiPath).toHaveAttribute("data-active", "true");
  await expect(tbilisiMarker).toHaveAttribute("data-active", "true");
  await expect(zugdidi).not.toHaveAttribute("data-active");
  await expect(page.getByTestId("municipality-map-tooltip")).toHaveCount(0);
  await expect(zugdidi).not.toHaveAttribute("aria-describedby");
  await expect(page.locator("[data-municipality-map-target][aria-describedby]")).toHaveCount(0);
});

test("municipality map and list highlight each other by exact code", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  const shape = page.getByTestId("municipality-shape-33");
  const row = page.locator('[data-municipality-row-code="33"]');

  await shape.hover();
  await expect(shape).toHaveAttribute("data-active", "true");
  await expect(row).toHaveAttribute("data-active", "true");

  await page.getByRole("heading", { level: 1 }).hover();
  await row.focus();
  await expect(shape).toHaveAttribute("data-active", "true");
});

test("map keyboard focus wins over a simultaneous list pointer target", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  const focusedShape = page.getByTestId("municipality-shape-33");
  const otherRow = page.locator('[data-municipality-row-code="04"]');
  await focusedShape.focus();
  await otherRow.hover();
  await expect(focusedShape).toHaveAttribute("data-active", "true");
  await expect(otherRow).not.toHaveAttribute("data-active", "true");
});

test("region rows do not activate municipality geometry", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  await page.getByTestId("level-region").click();
  const regionRow = page.getByTestId("municipal-list-row").first();
  await expect(regionRow).toHaveCSS("transition-duration", "0.1s");
  await regionRow.hover();
  await expect(regionRow).toHaveCSS("background-color", "rgb(241, 234, 220)");
  await expect(page.locator('[data-municipality-code][data-active="true"]')).toHaveCount(0);
  await expect(page.getByTestId("municipality-map").locator("[data-municipality-shape]")).toHaveCount(60);
});

test("focus uses the polygon or marker instead of a rectangular outline", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
  await expectMunicipalAppReady(page);
  const shape = page.getByTestId("municipality-shape-33");
  await shape.focus();
  const shapeStyle = await shape.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fill: style.fill,
      outline: style.outlineStyle,
      stroke: style.stroke,
      strokeWidth: Number.parseFloat(style.strokeWidth),
    };
  });
  expect(shapeStyle.outline).toBe("none");
  expect(shapeStyle.strokeWidth).toBeGreaterThanOrEqual(2);
  expect(contrastRatio(shapeStyle.stroke, shapeStyle.fill)).toBeGreaterThanOrEqual(3);

  const marker = page.getByTestId("municipality-marker-06");
  await marker.focus();
  const markerStyle = await marker.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fill: style.fill,
      outline: style.outlineStyle,
      radius: Number.parseFloat(element.getAttribute("r") ?? "0"),
      stroke: style.stroke,
      strokeWidth: Number.parseFloat(style.strokeWidth),
    };
  });
  expect(markerStyle.outline).toBe("none");
  expect(markerStyle.radius).toBeGreaterThan(7.5);
  expect(markerStyle.strokeWidth).toBeGreaterThanOrEqual(2);
  expect(contrastRatio(markerStyle.stroke, markerStyle.fill)).toBeGreaterThanOrEqual(3);
});

test.describe("municipalities index", () => {
  test("shows the review date of the consolidated Adjara source", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);

    await expect(page.getByTestId("explorer-shell")).toContainText("განახლდა 2026-08-16");
  });

  test("lists all municipalities and the country-first region grain", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(64);
    await page.getByTestId("level-region").click();
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
    await expect(page).toHaveURL(/#lvl=region/);
  });

  test("puts Georgia first in the region list and routes it to the country explorer", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);
    await page.getByTestId("level-region").click();

    const rows = page.getByTestId("municipal-list-row");
    await expect(rows).toHaveCount(12);
    const country = rows.first();
    await expect(country.getByTestId("municipal-row-name")).toHaveText("საქართველო");
    await expect(country).toContainText("69 მუნიციპალური ბიუჯეტი");
    await expect(country.locator("span").first()).toHaveText("—");
    await expect(country.getByTestId("municipal-row-per-resident")).toHaveCount(0);

    await country.click();
    await expect(page).toHaveURL(/\/explorer\/municipalities\/georgia(#|$)/);
  });

  test("keeps total budget primary while showing per-resident support for municipalities and regions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);

    const municipality = page.getByTestId("municipal-list-row").first();
    await expect(municipality.getByTestId("municipal-row-primary-amount")).toContainText(/მლნ ₾|მლრდ ₾/);
    await expect(municipality.getByTestId("municipal-row-per-resident")).toHaveText(/^\d{1,3}(?:,\d{3})* ერთ მოსახლეზე$/);
    await expect(municipality.getByTestId("municipal-row-per-resident")).toHaveCSS("font-size", "10px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByTestId("level-region").click();
    const regionRows = page.getByTestId("municipal-list-row");
    await expect(regionRows.first().getByTestId("municipal-row-per-resident")).toHaveCount(0);
    await expect(regionRows.nth(1).getByTestId("municipal-row-per-resident")).toHaveText(/^\d{1,3}(?:,\d{3})* ერთ მოსახლეზე$/);
    await expect(regionRows.nth(1).getByTestId("municipal-row-per-resident")).toHaveCSS("font-size", "10px");
  });

  test("filters and clears the search", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);
    await page.getByTestId("municipal-search").fill("თელავი");
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(1);
    await page.getByTestId("municipal-search").fill("ზზზზ");
    await expect(page.getByTestId("municipal-empty")).toBeVisible();
  });

  test("uses the same simple search label for municipalities and regions", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);

    const search = page.getByTestId("municipal-search");
    await expect(search).toHaveAttribute("placeholder", "ძებნა");
    await page.getByTestId("level-region").click();
    await expect(search).toHaveAttribute("placeholder", "ძებნა");
  });

  test("keeps row bars normalized to the unfiltered leader while searching", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);

    const rows = page.getByTestId("municipal-list-row");
    const comparisonRow = rows.nth(1);
    const query = await comparisonRow.getByTestId("municipal-row-name").textContent();
    const widthBefore = await comparisonRow.getByTestId("municipal-row-bar").getAttribute("style");
    expect(query).toBeTruthy();
    expect(widthBefore).toMatch(/^width:\s*(?!100(?:\.0)?%).+%$/);

    await page.getByTestId("municipal-search").fill(query!);
    await expect(rows).toHaveCount(1);
    const widthAfter = await rows.first().getByTestId("municipal-row-bar").getAttribute("style");
    expect(widthAfter).toBe(widthBefore);
  });

  test("opens a municipality from the list", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);
    await page.getByTestId("municipal-list-row").first().click();
    await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/tbilisi");
  });

  test("shows four KPIs including the 2025 median budget per resident", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);
    const kpis = page.getByTestId("index-kpi");
    await expect(kpis).toHaveCount(4);
    await expect(kpis.nth(0)).toContainText("2025 · 69 მუნიციპალური საბიუჯეტო ერთეული");
    await expect(kpis.nth(2)).toContainText("მედიანური ბიუჯეტი ერთ მოსახლეზე");
    await expect(kpis.nth(2)).toContainText("1,335 ₾");
    await expect(kpis.nth(2)).toContainText("2025 · 64 მუნიციპალიტეტი");
  });

  test("starts directly with the municipal comparison workspace", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("municipal-index-workspace")).toBeVisible();
    await expect(page.getByText("საქართველოს მუნიციპალიტეტების ბიუჯეტები წარმოდგენილია", { exact: false })).toHaveCount(0);
  });

  test("keeps the index workspace stacked until its content container reaches 1100px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${TEST_BASE_URL}/explorer/municipalities`);
    await expectMunicipalAppReady(page);
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "true");

    const columns = await page.getByTestId("municipal-index-workspace").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
    );
    const kpiColumns = await page.getByTestId("index-kpi-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
    );
    expect(columns).toHaveLength(1);
    expect(kpiColumns).toHaveLength(2);
  });
});

test("keeps municipality share as share of its budget", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities/tbilisi`);
  await expectMunicipalAppReady(page);

  await page.getByRole("button", { name: "ცხრილი" }).click();
  const table = page.getByTestId("explorer-table");
  await expect(table).toBeVisible();
  await expect(table).toContainText("წილი 2025");
  await expect(table).not.toContainText("მშპ");

  const toggle = page.getByTestId("municipal-share-toggle");
  await expect(toggle).toHaveText("% წილი");
  await toggle.click();
  await expect(table.locator("tbody tr").first().locator("td").nth(1)).not.toHaveText("—");
  await expect(page.getByTestId("municipal-workspace")).toContainText("წილი მთლიან ბიუჯეტში, %");
  await expect(page.getByTestId("municipal-workspace")).not.toContainText("მშპ");
});

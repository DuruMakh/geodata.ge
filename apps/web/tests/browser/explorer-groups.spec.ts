import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { GROUP_HEADLINES } from "../../lib/explorer/groupHeadlines";
import { LEGACY_TOPIC_FORWARDS, NAV_GROUPS, PAGE_COUNT, groupPages, topicHub } from "../../lib/navigation/navTree";
import { axeViolations } from "./axe";

// The explorer regrouping (spec 2026-10-24-explorer-regroup): the eight group pages, the sidebar with its rail and phone
// menu, All data with its search, and the old topic hubs' forwards (Review Focus 3, 4 and 5).

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const sidebar = (page: Page) => page.getByTestId("data-sidebar");
const width = async (locator: Locator) => Math.round((await locator.boundingBox())?.width ?? 0);
/** Whether focus is inside the element. */
const holdsFocus = (locator: Locator) => locator.evaluate((element) => element.contains(document.activeElement));
const PREFIXES = ["", "/en"] as const;
/** The page's address without its origin, compared exactly: a Georgian case that ended in English would not match. */
const address = (page: Page) => { const url = new URL(page.url()); return url.pathname + url.search + url.hash; };
const FORWARDED = new Set(LEGACY_TOPIC_FORWARDS.map(({ from }) => from));
/** The app's own scripts. */
const APP_SCRIPT = (url: URL) => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js");

test.describe("the sidebar at 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a group's chevron opens and closes its pages", async ({ page }) => {
    await page.goto("/explorer/labour");
    await ready(page);
    const toggle = page.getByTestId("group-toggle-society");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("group-panel-society")).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("group-panel-society")).toBeVisible();
    await expect(page.getByTestId("education-schools-link")).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("group-panel-society")).toHaveCount(0);
    // The current page's group stays open, and its own link is current.
    await expect(page.getByTestId("group-panel-labour")).toBeVisible();
    await expect(page.getByTestId("group-link-labour")).toHaveAttribute("aria-current", "page");
  });

  test("the rail opens a pop-out on hover and on focus, Escape closes it, and expanding the rail closes it", async ({ page }) => {
    await page.goto("/explorer/labour");
    await ready(page);
    const toggle = page.getByTestId("sidebar-toggle");
    expect(await width(sidebar(page))).toBe(272);
    await toggle.click();
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
    await expect.poll(() => width(sidebar(page))).toBe(72);

    // Hover: the pop-out hangs beside the rail at its full height; moving away closes it.
    await page.getByTestId("group-link-society").hover();
    const society = page.getByTestId("group-panel-society");
    await expect(society).toBeVisible();
    const box = (await society.boundingBox())!;
    expect(Math.round(box.x)).toBe(72);
    expect(Math.round(box.width)).toBe(320);
    expect(Math.round(box.height)).toBe(900);
    await page.mouse.move(1000, 450);
    await expect(society).toHaveCount(0);

    // Hover intent: crossing another group's rail icon on the way into a pop-out, or leaving it for a moment, keeps it open.
    // The page's clock is paused and stepped, so the 150ms close timer has either fired or not, however loaded the runner is.
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    const labourIcon = (await page.getByTestId("group-link-labour").boundingBox())!;
    const livingIcon = (await page.getByTestId("group-link-living").boundingBox())!;
    await page.mouse.move(labourIcon.x + labourIcon.width / 2, labourIcon.y + labourIcon.height / 2);
    const labour = page.getByTestId("group-panel-labour");
    await expect(labour).toBeVisible();
    await page.mouse.move(livingIcon.x + livingIcon.width / 2, livingIcon.y + livingIcon.height / 2);
    await page.mouse.move(200, livingIcon.y + 120);
    await page.clock.runFor(300);
    await expect(labour).toBeVisible();
    await expect(page.getByTestId("group-panel-living")).toHaveCount(0);
    // Away for less than 150ms and back: still open after the delay has long passed.
    await page.mouse.move(1000, 450);
    await page.clock.runFor(100);
    await page.mouse.move(200, livingIcon.y + 120);
    await page.clock.runFor(300);
    await expect(labour).toBeVisible();
    // Away for good: open at 100ms, closed once 150ms have run.
    await page.mouse.move(1000, 450);
    await page.clock.runFor(100);
    await expect(labour).toBeVisible();
    await page.clock.runFor(100);
    await expect(labour).toHaveCount(0);
    await page.clock.resume();

    // Keyboard: focus on a rail icon opens its pop-out, and Escape closes it with focus kept on the icon.
    await page.getByTestId("all-data-link").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("group-link-budget")).toBeFocused();
    await expect(page.getByTestId("group-panel-budget")).toBeVisible();
    await page.keyboard.press("Tab");
    expect(await holdsFocus(page.getByTestId("group-panel-budget"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("group-panel-budget")).toHaveCount(0);
    await expect(page.getByTestId("group-link-budget")).toBeFocused();

    // Review Focus 5: expanding the rail while a pop-out is open closes it, and it stays closed when the rail returns.
    await page.getByTestId("group-link-prices").hover();
    await expect(page.getByTestId("group-panel-prices")).toBeVisible();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "false");
    await expect(page.getByTestId("group-panel-prices")).toHaveCount(0);
    // Away from the rail, so no hover can open or keep a pop-out when it returns.
    await page.mouse.move(1000, 450);
    await page.keyboard.press("Enter");
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
    await expect(page.getByTestId("group-panel-prices")).toHaveCount(0);

    // The rail is remembered.
    await page.reload();
    await ready(page);
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
    await expect.poll(() => width(sidebar(page))).toBe(72);
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");

    // A rail icon is its group page's link.
    await page.getByTestId("group-link-economy").click();
    await expect.poll(() => address(page)).toBe("/explorer/economy");
    await ready(page);
    await expect(page.getByTestId("group-link-economy")).toHaveAttribute("aria-current", "page");
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
  });

  test("/ opens All data with its search box focused", async ({ page }) => {
    await page.goto("/en/explorer/labour");
    await ready(page);
    await page.keyboard.press("/");
    await expect(page).toHaveURL(/\/en\/explorer#q=$/);
    await expect(page.locator("#explorer-q")).toBeFocused();
  });

  test("the sidebar's search link focuses the box when All data is already open", async ({ page }) => {
    for (const prefix of PREFIXES) {
      await page.goto(`${prefix}/explorer`);
      await ready(page);
      await page.locator("body").click({ position: { x: 1200, y: 10 } });
      await expect(page.locator("#explorer-q")).not.toBeFocused();
      await page.getByTestId("sidebar-search").click();
      await expect(page.locator("#explorer-q")).toBeFocused();
      await page.keyboard.type("wages");
      await expect(page.locator("#explorer-q")).toHaveValue("wages");
    }
  });
});

test.describe("the phone menu at 375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  const PATH = "/explorer/wages/overview";
  // A place partway down the page; with no footer it scrolls about 390px at 375×812 and 247px at 1200×812.
  const MID_PAGE = 200;

  async function openMenuAt(page: Page, scrollY: number) {
    await page.goto(PATH);
    await ready(page);
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
    await page.getByTestId("sidebar-menu-button").click();
    await expect(page.getByTestId("sidebar-menu-button")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("sidebar-close")).toBeFocused();
  }

  test("hides the search row's / key hint in the menu, which the desktop sidebar shows", async ({ page }) => {
    await openMenuAt(page, 0);
    await expect(page.getByTestId("sidebar-search").locator("kbd")).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("sidebar-search").locator("kbd")).toBeVisible();
  });

  test("opens full screen as a dialog, keeps focus inside, and Escape and X give back focus and place", async ({ page }) => {
    await openMenuAt(page, MID_PAGE);
    const nav = sidebar(page);
    // The dialog is the nav's wrapper: ARIA lets a nav be no dialog (axe aria-allowed-role), so the nav stays a landmark inside it.
    const dialog = page.getByTestId("sidebar-menu-dialog");
    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAccessibleName("მენიუ");
    await expect(nav).not.toHaveAttribute("role");
    await expect(page.getByRole("dialog").getByRole("navigation", { name: "მონაცემთა პანელი" })).toBeVisible();
    const box = (await nav.boundingBox())!;
    expect([box.x, box.y, Math.round(box.width), Math.round(box.height)]).toEqual([0, 0, 375, 812]);
    await expect(page.locator("#content")).not.toBeVisible();
    // The page and the bar behind the menu are inert, and Shift+Tab wraps from the menu's first control to its last, so
    // focus never leaves the menu: not for the page, and not for the browser's own controls (the body here).
    await expect(page.locator("[data-shell-page]")).toHaveAttribute("inert", "");
    await expect(page.getByTestId("sidebar-topbar")).toHaveAttribute("inert", "");
    const stops = await nav.locator("a[href], button").evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length);
    for (let step = 0; step < stops + 5; step += 1) {
      await page.keyboard.press("Shift+Tab");
      const outside = await page.evaluate((id) => {
        const active = document.activeElement;
        return active && document.getElementById(id)!.contains(active) ? null : active?.outerHTML.slice(0, 160) ?? "nothing";
      }, "data-sidebar-navigation");
      expect(outside, `Shift+Tab ${step + 1}`).toBeNull();
    }

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sidebar-menu-button")).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("sidebar-menu-button")).toBeFocused();
    await expect(page.locator("#content")).toBeVisible();
    await expect(page.locator("[data-shell-page]")).not.toHaveAttribute("inert");
    expect(await page.evaluate(() => window.scrollY)).toBe(MID_PAGE);

    await page.getByTestId("sidebar-menu-button").click();
    await expect(page.getByTestId("sidebar-close")).toBeFocused();
    await page.getByTestId("sidebar-close").click();
    await expect(page.getByTestId("sidebar-menu-button")).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(MID_PAGE);
  });

  test("widening to 1200 with the menu open shows the desktop sidebar and keeps the reader's place (Review Focus 5)", async ({ page }) => {
    await openMenuAt(page, MID_PAGE);
    await page.setViewportSize({ width: 1200, height: 812 });
    await expect(sidebar(page)).not.toHaveAttribute("data-menu-open");
    await expect(page.getByTestId("sidebar-menu-dialog")).not.toHaveAttribute("role");
    await expect.poll(() => width(sidebar(page))).toBe(272);
    await expect(page.locator("#content")).toBeVisible();
    await expect(page.getByTestId("sidebar-topbar")).toBeHidden();
    expect(await page.evaluate(() => window.scrollY)).toBe(MID_PAGE);
    // Back on a phone the menu is closed and the page is shown.
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByTestId("sidebar-menu-button")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#content")).toBeVisible();
  });

  test("the bar's search button opens All data with its box focused", async ({ page }) => {
    for (const prefix of PREFIXES) {
      await page.goto(`${prefix}/explorer/labour`);
      await ready(page);
      await page.getByTestId("topbar-search").click();
      await expect.poll(() => address(page)).toBe(`${prefix}/explorer#q=`);
      await expect(page.locator("#explorer-q")).toBeFocused();
      // Already on All data, the button focuses the box in place.
      await page.locator("#explorer-q").blur();
      await page.getByTestId("topbar-search").click();
      await expect(page.locator("#explorer-q")).toBeFocused();
    }
  });

  test("a link to another page closes the menu and lands at that page's top", async ({ page }) => {
    await openMenuAt(page, MID_PAGE);
    await page.getByTestId("wages-regions-link").click();
    await expect(page).toHaveURL(/\/explorer\/wages\/regions$/);
    await ready(page);
    await expect(page.getByTestId("sidebar-menu-button")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#content")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

for (const prefix of PREFIXES) {
  test(`every group page links its headlines and topics, with one card per page ${prefix || "ka"}`, async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const group of NAV_GROUPS) {
      await page.goto(`${prefix}${group.href}`);
      await ready(page);
      await expect(page.getByTestId("group-link-" + group.id)).toHaveAttribute("aria-current", "page");
      const headlines = page.getByTestId("group-headline");
      expect(await headlines.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(GROUP_HEADLINES[group.id].map(({ page: href }) => `${prefix}${href}`));
      for (const { page: href } of GROUP_HEADLINES[group.id]) expect((await request.get(`${prefix}${href}`)).status(), href).toBe(200);
      for (const topic of group.topics) {
        const cards = page.locator(`#t-${topic}`).getByTestId("explorer-card");
        expect(await cards.evaluateAll((links) => links.map((link) => link.getAttribute("href"))), topic).toEqual(topicHub(topic).sections.map(({ href }) => `${prefix}${href}`));
      }
      expect(await page.getByTestId("explorer-card").count()).toBe(groupPages(group).length);
      const topicLinks = page.getByTestId("group-topic-link");
      await expect(topicLinks).toHaveCount(group.topics.length > 1 ? group.topics.length : 0);
      if (group.topics.length < 2) continue;
      // The last topic's link scrolls its section into view below the sticky links.
      const last = group.topics.at(-1)!;
      await topicLinks.last().click();
      await expect(page).toHaveURL(new RegExp(`${group.href}#t-${last}$`));
      const section = page.locator(`#t-${last}`);
      await expect(section).toBeInViewport();
      const bar = (await topicLinks.first().locator("xpath=..").boundingBox())!;
      await expect.poll(async () => Math.round((await section.boundingBox())!.y)).toBeGreaterThanOrEqual(Math.floor(bar.y + bar.height) - 1);
    }
  });
}

/** Each element of `testId` inside `root` that breaks across lines: its text, for the failure message. */
const broken = (root: Locator, testId: string) => root.getByTestId(testId).evaluateAll((elements) =>
  elements.filter((element) => element.getClientRects().length > 1).map((element) => element.textContent));

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`at ${viewport.width}px the topic links are one pinned row that scrolls, and no value parts from its unit`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const prefix of PREFIXES) {
      for (const group of NAV_GROUPS) {
        await page.goto(`${prefix}${group.href}`);
        await ready(page);
        await page.evaluate(() => document.fonts.ready);
        // Headline figures and units: each part on one line, the unit on the figure's line.
        for (const headline of await page.getByTestId("group-headline").all()) {
          const parts = await headline.evaluate((link) => {
            const one = (testId: string) => {
              const element = link.querySelector(`[data-testid="${testId}"]`);
              return element ? { lines: element.getClientRects().length, bottom: element.getBoundingClientRect().bottom } : null;
            };
            return { figure: one("group-headline-figure"), unit: one("group-headline-unit"), text: link.textContent };
          });
          expect(parts.figure?.lines, parts.text!).toBe(1);
          if (!parts.unit) continue;
          expect(parts.unit.lines, parts.text!).toBe(1);
          expect(Math.abs(parts.unit.bottom - parts.figure!.bottom), parts.text!).toBeLessThan(6);
        }
        // Card values and bar values stay whole: a figure and its unit never break inside themselves.
        const content = page.locator("#content");
        expect(await broken(content, "card-value-figure"), group.id).toEqual([]);
        expect(await broken(content, "card-value-unit"), group.id).toEqual([]);
        for (const value of await page.getByTestId("card-pair-value").all()) {
          expect(await value.evaluate((element) => element.getClientRects().length), (await value.textContent()) ?? "").toBe(1);
          expect((await value.boundingBox())!.height).toBeLessThan(20);
        }
        if (group.topics.length < 2) continue;
        // One row, pinned, no taller than one line of links, that scrolls sideways to every link.
        const row = page.getByTestId("group-topic-links");
        expect(await page.getByTestId("group-topic-row").evaluate((element) => getComputedStyle(element).position)).toBe("sticky");
        const rowBox = (await row.boundingBox())!;
        expect(rowBox.height, group.id).toBeLessThanOrEqual(70);
        const links = page.getByTestId("group-topic-link");
        const tops = await links.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top)));
        expect(new Set(tops).size, group.id).toBe(1);
        for (const link of await links.all()) {
          await link.evaluate((element) => element.scrollIntoView({ block: "nearest", inline: "nearest" }));
          const box = (await link.boundingBox())!;
          expect(box.x, (await link.textContent()) ?? "").toBeGreaterThanOrEqual(rowBox.x - 0.5);
          expect(box.x + box.width, (await link.textContent()) ?? "").toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
        }
        // A topic link lands its section below the row.
        const last = group.topics.at(-1)!;
        await links.last().click();
        const section = page.locator(`#t-${last}`);
        await expect(section).toBeInViewport();
        await expect.poll(async () => {
          const bar = (await row.boundingBox())!;
          return Math.round((await section.boundingBox())!.y) - Math.floor(bar.y + bar.height);
        }).toBeGreaterThanOrEqual(-1);
      }
    }
  });

  test(`at ${viewport.width}px a #t-transport address lands the Transport heading below the row and its link in the row`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const chartPage = topicHub("transport").sections[0].href;
    for (const prefix of PREFIXES) {
      const landed = async () => {
        await ready(page);
        const bar = (await page.getByTestId("group-topic-links").boundingBox())!;
        await expect.poll(async () => Math.round((await page.locator("#th-transport").boundingBox())!.y)).toBeGreaterThanOrEqual(Math.ceil(bar.y + bar.height));
        await expect(page.locator("#th-transport")).toBeInViewport();
        const link = (await page.getByTestId("group-topic-link").and(page.locator('[href="#t-transport"]')).boundingBox())!;
        expect(link.x).toBeGreaterThanOrEqual(bar.x - 0.5);
        expect(link.x + link.width).toBeLessThanOrEqual(bar.x + bar.width + 0.5);
      };
      // Typed or followed from outside the site.
      await page.goto(`${prefix}/explorer/society#t-transport`);
      await landed();
      // A Transport chart page's crumb (R8).
      await page.goto(`${prefix}${chartPage}`);
      await ready(page);
      await page.getByTestId("explorer-header").locator(`a[href="${prefix}/explorer/society#t-transport"]`).first().click();
      await expect.poll(() => address(page)).toBe(`${prefix}/explorer/society#t-transport`);
      await landed();
    }
  });
}

for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  test(`at ${viewport.width}px Society's pinned topic row, with a scrollbar that takes room, is no taller than 70px`, async ({ playwright, browserName, channel, launchOptions, baseURL }) => {
    // Headless Chromium hides scrollbars; Windows and Linux desktops draw the thin one under the links.
    const browser = await playwright[browserName].launch({ ...launchOptions, channel, ignoreDefaultArgs: ["--hide-scrollbars"] });
    try {
      const page = await browser.newPage({ baseURL, viewport });
      for (const prefix of PREFIXES) {
        await page.goto(`${prefix}/explorer/society`);
        await ready(page);
        const row = page.getByTestId("group-topic-links");
        // The Georgian row overflows at both widths; the English one, labels only, can fit at 1440px and then draws no scrollbar.
        const overflows = await row.evaluate((element) => element.scrollWidth > element.clientWidth);
        if (!prefix) expect(overflows, "the Georgian row overflows").toBe(true);
        expect(await row.evaluate((element) => (element as HTMLElement).offsetHeight - element.clientHeight > 1), "the scrollbar is drawn when the row overflows").toBe(overflows);
        await page.evaluate(() => window.scrollTo(0, 2000));
        await expect.poll(async () => (await row.boundingBox())!.y).toBe(0);
        expect((await row.boundingBox())!.height, prefix || "ka").toBeLessThanOrEqual(70);
      }
    } finally {
      await browser.close();
    }
  });
}

test("at 1024px the Society row fades the edge with more links beyond it, and below 900px it shows no fade", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/explorer/society");
  await ready(page);
  const opacity = (edge: "start" | "end") => page.getByTestId(`group-topic-fade-${edge}`).evaluate((element) => getComputedStyle(element).opacity);
  const row = page.getByTestId("group-topic-links");
  expect(await row.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect.poll(() => opacity("end")).toBe("1");
  expect(await opacity("start")).toBe("0");
  await row.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await expect.poll(() => opacity("start")).toBe("1");
  await expect.poll(() => opacity("end")).toBe("0");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByTestId("group-topic-fade-start")).toBeHidden();
  await expect(page.getByTestId("group-topic-fade-end")).toBeHidden();
});

// 320px is the narrowest phone: a headline's long unit (`მლრდ აშშ დოლარი`) and a lead card's value wrap there instead of
// pushing the page sideways.
for (const width of [320, 1101, 1150, 1280]) {
  test(`at ${width}px no group page scrolls sideways, and each region spread's names and lead end label stay in their card`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const prefix of PREFIXES) {
      for (const group of NAV_GROUPS) {
        await page.goto(`${prefix}${group.href}`);
        await ready(page);
        await page.evaluate(() => document.fonts.ready);
        const fit = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
        expect(fit.scroll, `${prefix}${group.href}`).toBeLessThanOrEqual(fit.inner);
        const outside = await page.locator("[data-testid=region-spread-low], [data-testid=region-spread-high]").evaluateAll((labels) => labels.flatMap((label) => {
          const card = label.closest("[data-testid=explorer-card]")!.getBoundingClientRect();
          const box = label.getBoundingClientRect();
          return box.left < card.left || box.right > card.right ? [label.textContent] : [];
        }));
        expect(outside, `${prefix}${group.href}`).toEqual([]);
        // A lead card's end label fits its gutter (Georgian letters are wider) and sits inside the chart band.
        const labels = await page.getByTestId("lead-end-label").evaluateAll((spans) => spans.flatMap((span) => {
          const band = span.parentElement!.getBoundingClientRect();
          const box = span.getBoundingClientRect();
          return span.scrollWidth > span.clientWidth + 1 || box.top < band.top - 1 || box.bottom > band.bottom + 1 ? [span.textContent] : [];
        }));
        expect(labels, `${prefix}${group.href}`).toEqual([]);
      }
    }
  });
}

test("a Budget chart page's Budget crumb goes to the Budget group page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const prefix of PREFIXES) {
    await page.goto(`${prefix}/explorer/expenditure`);
    await ready(page);
    const crumb = page.getByTestId("explorer-header").getByRole("link", { name: prefix ? "Budget" : "ბიუჯეტი", exact: true });
    await expect(crumb).toHaveAttribute("href", `${prefix}/explorer/budget`);
    await crumb.click();
    await expect.poll(() => address(page)).toBe(`${prefix}/explorer/budget`);
    await ready(page);
  }
});

test("at 1440px a lead card that spans the row puts its chart beside its text", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Economy's four pages give a lead that spans the whole row (leadSpan: lead3); Budget's eight give a two-column lead now.
  expect(topicHub("economy").sections.length % 3).toBe(1);
  await page.goto("/explorer/economy");
  await ready(page);
  const cards = page.getByTestId("explorer-card");
  const lead = cards.first();
  const leadBox = (await lead.boundingBox())!;
  const second = (await cards.nth(1).boundingBox())!;
  // The lead spans all three columns, alone on its row.
  expect(second.y).toBeGreaterThanOrEqual(leadBox.y + leadBox.height - 1);
  expect(leadBox.width).toBeGreaterThan(second.width * 2.5);
  const band = (await lead.getByTestId("explorer-card-graphic").boundingBox())!;
  const text = await lead.locator("> *:not([data-testid=explorer-card-graphic]):not(.sr-only)").evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().toJSON() as DOMRect));
  expect(text.length).toBeGreaterThanOrEqual(4);
  // The chart is the right column, the text the left, and they do not overlap.
  expect(band.width).toBeGreaterThan(200);
  expect(band.height).toBeGreaterThanOrEqual(150);
  for (const box of text) {
    expect(box.x + box.width).toBeLessThanOrEqual(band.x + 1);
    expect(box.y).toBeGreaterThanOrEqual(leadBox.y);
    expect(box.y + box.height).toBeLessThanOrEqual(leadBox.y + leadBox.height + 1);
  }
  expect(band.x + band.width).toBeLessThanOrEqual(leadBox.x + leadBox.width);
  expect(band.y).toBeGreaterThanOrEqual(leadBox.y);
  expect(band.y + band.height).toBeLessThanOrEqual(leadBox.y + leadBox.height);
});

test.describe("All data", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  const search = (page: Page) => page.locator("#explorer-q");

  test("the A to Z letters jump to their section below the sticky bar", async ({ page }) => {
    await page.goto("/explorer");
    await ready(page);
    const letters = page.getByTestId("az-letter");
    expect(await letters.count()).toBeGreaterThan(10);
    const last = letters.last();
    const target = (await last.getAttribute("href"))!;
    await last.click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    const section = page.locator(target);
    await expect(section).toBeInViewport();
    const bar = (await page.getByTestId("az-index").getByRole("navigation").boundingBox())!;
    await expect.poll(async () => (await section.boundingBox())!.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
  });

  test("at 1024px every letter of the bar is on screen", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    for (const prefix of PREFIXES) {
      await page.goto(`${prefix}/explorer`);
      await page.evaluate(() => document.fonts.ready);
      // The letters sit in the content column, beside the 272px sidebar.
      const column = (await page.locator("#content").boundingBox())!;
      expect(Math.round(column.x)).toBe(272);
      const boxes = await page.getByTestId("az-index").getByRole("navigation").locator("a, span").evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().toJSON() as DOMRect));
      expect(boxes.length).toBeGreaterThanOrEqual(26);
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(column.x);
        expect(box.x + box.width).toBeLessThanOrEqual(1024);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
    }
  });

  test("the ადგილობრივი ექსპორტი chip puts Domestic exports first, and ინფლაცია puts Inflation overview first", async ({ page }) => {
    await page.goto("/explorer");
    await ready(page);
    await page.getByTestId("search-chip").filter({ hasText: "ადგილობრივი ექსპორტი" }).click();
    await expect(search(page)).toHaveValue("ადგილობრივი ექსპორტი");
    await expect(page.getByTestId("search-result").first()).toHaveAttribute("href", "/explorer/trade/domestic-exports");
    await search(page).fill("ინფლაცია");
    await expect(page.getByTestId("search-result").first()).toHaveAttribute("href", "/explorer/inflation/overview");
    await expect(page).toHaveURL(/#q=/);
    await expect(page.getByTestId("az-index")).toBeHidden();
  });

  test("xelfasebi is read as Georgian and finds Wages", async ({ page }) => {
    await page.goto("/explorer");
    await ready(page);
    await search(page).fill("xelfasebi");
    await expect(page.getByTestId("search-reading")).toContainText("ხელფასები");
    await expect(page.getByTestId("search-result").and(page.locator('[href="/explorer/wages/overview"]'))).toHaveCount(1);
  });

  test("Enter with results but nothing highlighted opens the first result", async ({ page }) => {
    for (const prefix of PREFIXES) {
      await page.goto(`${prefix}/explorer`);
      await ready(page);
      await search(page).fill(prefix ? "inflation" : "ინფლაცია");
      const first = page.getByRole("option").first();
      await expect(first).toBeVisible();
      await expect(search(page)).not.toHaveAttribute("aria-activedescendant");
      const href = (await first.getAttribute("href"))!;
      await search(page).press("Enter");
      await expect.poll(() => address(page)).toBe(href);
    }
  });

  test("ბათუმი shows the place card and Enter opens its first row", async ({ page }) => {
    await page.goto("/explorer");
    await ready(page);
    await search(page).fill("ბათუმი");
    await expect(page.getByTestId("place-card")).toBeVisible();
    await expect(page.getByTestId("place-fact")).toHaveCount(4);
    await expect(page.getByTestId("search-result").first()).toHaveAttribute("href", "/explorer/municipalities/batumi");
    await search(page).press("ArrowDown");
    await expect(search(page)).toHaveAttribute("aria-activedescendant", "explorer-o0");
    await search(page).press("Enter");
    await expect(page).toHaveURL(/\/explorer\/municipalities\/batumi$/);
  });

  test("the arrow keys move through the results and wrap, and Escape clears the box", async ({ page }) => {
    await page.goto("/explorer");
    await ready(page);
    const box = search(page);
    await box.fill("ინფლაცია");
    await expect(page).toHaveURL(new RegExp(`#q=${encodeURIComponent("ინფლაცია")}$`));
    const options = page.getByRole("option");
    const total = await options.count();
    expect(total).toBeGreaterThan(2);
    await box.press("ArrowDown");
    await expect(box).toHaveAttribute("aria-activedescendant", "explorer-o0");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await box.press("ArrowDown");
    await expect(box).toHaveAttribute("aria-activedescendant", "explorer-o1");
    await box.press("ArrowUp");
    await box.press("ArrowUp");
    await expect(box).toHaveAttribute("aria-activedescendant", `explorer-o${total - 1}`);
    await box.press("Escape");
    await expect(box).toHaveValue("");
    await expect(page.getByTestId("az-index")).toBeVisible();
    await expect(page).not.toHaveURL(/q=/);
  });

  test("with the places file blocked, page search still finds Wages and shows no error (Review Focus 4)", async ({ page }) => {
    await page.route("**/explorer-places.*.json", (route) => route.abort());
    const failed = page.waitForEvent("requestfailed", (request) => request.url().includes("explorer-places"));
    await page.goto("/explorer");
    await ready(page);
    await search(page).fill("ხელფასები");
    // The checks below mean something only once the file has failed.
    await failed;
    await expect(page.getByTestId("search-result").and(page.locator('[href="/explorer/wages/overview"]'))).toHaveCount(1);
    await expect(page.getByTestId("search-none")).toHaveCount(0);
    await expect(page.getByTestId("place-card")).toHaveCount(0);
    await expect(page.locator("#content")).not.toContainText(/error|შეცდომ/i);
  });

  test("with a slow places file, pages answer at once and the place card follows the file (Review Focus 4)", async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let requests = 0;
    await page.route("**/explorer-places.*.json", async (route) => {
      requests += 1;
      await held;
      await route.continue();
    });
    await page.goto("/explorer");
    await ready(page);
    await search(page).fill("ხელფასები");
    await expect(page.getByTestId("search-result").and(page.locator('[href="/explorer/wages/overview"]'))).toHaveCount(1);
    await search(page).fill("ბათუმი");
    // Batumi's rows all come from the places file. Page search has answered this query (its count went from Wages' to
    // none) and the file has not, so there is no place card yet.
    await expect(page.getByRole("search").getByText("0 გვერდი", { exact: true })).toBeVisible();
    await expect(page.getByTestId("search-result")).toHaveCount(0);
    await expect(page.getByTestId("place-card")).toHaveCount(0);
    // The file may still name a place, so nothing says "not found" while it is on its way.
    await expect(page.getByTestId("search-none")).toHaveCount(0);
    release();
    await expect(page.getByTestId("place-card")).toBeVisible();
    await expect(page.getByTestId("place-fact")).toHaveCount(4);
    expect(requests).toBe(1);
  });

  test("with the pointer resting over the results, the arrow keys still move one row at a time (search #4)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/explorer");
    await ready(page);
    // The pointer rests where the results will come, as a laptop's cursor does; the keys then scroll rows under it.
    await page.mouse.move(640, 600);
    await search(page).fill("ბათუმი");
    await expect(page.getByTestId("place-card")).toBeVisible();
    expect(await page.getByRole("option").count()).toBeGreaterThan(12);
    for (let index = 0; index < 12; index++) {
      await search(page).press("ArrowDown");
      await expect(search(page)).toHaveAttribute("aria-activedescendant", `explorer-o${index}`);
    }
    // A real move of the pointer still picks the row under it.
    const under = page.getByRole("option").nth(3);
    await under.scrollIntoViewIfNeeded();
    const target = (await under.boundingBox())!;
    await page.mouse.move(target.x + 40, target.y + target.height / 2, { steps: 3 });
    await expect(search(page)).toHaveAttribute("aria-activedescendant", "explorer-o3");
  });

  for (const width of [390, 1280]) {
    test(`at ${width}px a long unbroken query wraps instead of scrolling the page sideways (search #6)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const query of ["https://www.geostat.ge/ka/modules/categories/41/samomkhmareblo-fasebis-indeksi", "ა".repeat(80), "q".repeat(80)]) {
        await page.goto(`/explorer#q=${encodeURIComponent(query)}`);
        await ready(page);
        await expect(page.getByTestId("search-none").or(page.getByTestId("search-reading")).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth), query).toBe(width);
      }
    });
  }

  test("without JavaScript the inert box and example words are hidden, and the A to Z list works (search #15)", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      await page.goto("/explorer");
      await expect(page.getByTestId("all-data-search")).toBeHidden();
      await expect(page.getByTestId("search-chip").first()).toBeHidden();
      await expect(page.getByTestId("az-row")).toHaveCount(PAGE_COUNT);
      await expect(page.getByTestId("az-row").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("names the place in each place row and in the announcement (search #14)", async ({ page }) => {
    await page.goto("/explorer");
    await ready(page);
    await search(page).fill("ბათუმი");
    await expect(page.getByTestId("place-card")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(/^ბათუმი: ნაპოვნია \d+ შედეგი$/);
    const labels = await page.getByTestId("search-result").evaluateAll((rows) => rows.map((row) => row.getAttribute("aria-label") ?? ""));
    expect(labels.length).toBeGreaterThan(5);
    expect(labels.some((label) => label.startsWith("ბათუმი: "))).toBe(true);
    expect(labels.some((label) => label.startsWith("აჭარა: "))).toBe(true);
    expect(labels.every((label) => /^(ბათუმი|აჭარა): /.test(label))).toBe(true);
  });

  test("a lone region word suggests the regions it is part of instead of nothing found, and a suggestion opens the region (N4)", async ({ page }) => {
    for (const [prefix, query, name] of [["", "ქვემო", "ქვემო ქართლი"], ["/en", "Kvemo", "Kvemo Kartli"]] as const) {
      await page.goto(`${prefix}/explorer`);
      await ready(page);
      await search(page).fill(query);
      const suggestions = page.getByTestId("place-suggestion");
      await expect(suggestions).toHaveCount(2);
      await expect(page.getByTestId("search-none")).toHaveCount(0);
      await expect(page.getByTestId("place-card")).toHaveCount(0);
      await expect(page.getByRole("status")).toContainText(name);
      await suggestions.filter({ hasText: name }).click();
      await expect(search(page)).toHaveValue(name);
      await expect(search(page)).toBeFocused();
      await expect(page.getByTestId("place-card")).toContainText(name);
      await expect(page.getByTestId("place-suggestions")).toHaveCount(0);
    }
    // The longest name wraps inside its chip on the narrowest phone.
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`/explorer#q=${encodeURIComponent("სვანეთი")}`);
    await ready(page);
    await expect(page.getByTestId("place-suggestion")).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });

  test("with a places file slower than the wait, says the places are still loading, then shows them (search #10)", async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let requests = 0;
    await page.route("**/explorer-places.*.json", async (route) => {
      requests += 1;
      await held;
      await route.continue();
    });
    await page.goto("/explorer");
    await ready(page);
    await search(page).fill("ბათუმი");
    await expect(page.getByTestId("search-loading")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("search-none")).toHaveCount(0);
    // Another keystroke keeps waiting on the same request.
    await search(page).fill("ბათუმის");
    await expect(page.getByTestId("search-loading")).toBeVisible();
    release();
    await expect(page.getByTestId("place-card")).toBeVisible();
    await expect(page.getByTestId("search-loading")).toHaveCount(0);
    expect(requests).toBe(1);
  });
});

test.describe("the old topic hubs forward (Review Focus 3)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const path of ["/explorer/wages", "/en/explorer/wages", "/explorer/wages/", "/en/explorer/wages/"]) {
    test(`${path} lands on the Wages section of Labour market`, async ({ page }) => {
      await page.goto(path);
      const prefix = path.startsWith("/en/") ? "/en" : "";
      await expect.poll(() => address(page)).toBe(`${prefix}/explorer/labour#t-wages`);
      await ready(page);
      await expect(page.locator("#t-wages")).toBeInViewport();
      await expect(page.locator("#t-wages")).toBeFocused();
    });
  }

  test("an old Unemployment hub view goes on to the page that serves it", async ({ page }) => {
    await page.goto("/explorer/unemployment#breakdown=region");
    await expect.poll(() => address(page)).toBe("/explorer/unemployment/regions#breakdown=region");
    await ready(page);
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-breakdown", "region");
  });

  test("a Wages view hash on Labour market is not handed to Unemployment", async ({ page }) => {
    await page.goto("/explorer/labour?topic=wages#view=table");
    await expect.poll(() => address(page)).toBe("/explorer/labour#t-wages");
    await ready(page);
    await expect(page.locator("#t-wages")).toBeInViewport();
  });

  test("/explorer#nav=analysis lands on Analysis", async ({ page }) => {
    await page.goto("/explorer#nav=analysis");
    await expect.poll(() => address(page)).toBe("/explorer/analysis");
    await ready(page);
    await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  });
});

test("All data, a group page and a chart page render no footer", async ({ page }) => {
  for (const prefix of PREFIXES) {
    for (const path of ["/explorer", "/explorer/labour", "/explorer/wages/overview"]) {
      await page.goto(`${prefix}${path}`);
      await ready(page);
      await expect(page.getByRole("contentinfo"), `${prefix}${path}`).toHaveCount(0);
    }
  }
});

test("no link on All data, the group pages or a page of each group goes through a forward", async ({ page }) => {
  const pages = ["/explorer", ...NAV_GROUPS.flatMap((group) => [group.href, groupPages(group)[0].href])];
  for (const prefix of PREFIXES) {
    for (const path of pages) {
      await page.goto(`${prefix}${path}`);
      const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => new URL(link.getAttribute("href")!, window.location.href).pathname.replace(/\/$/, "")));
      const forwarded = hrefs.map((href) => href.replace(/^\/en(?=\/|$)/, "")).filter((href) => FORWARDED.has(href));
      expect(forwarded, `${prefix}${path}`).toEqual([]);
    }
  }
  expect(FORWARDED.size).toBe(16);
});

for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  test(`All data and Labour market pass axe's WCAG 2.1 A and AA rules at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const failures: string[] = [];
    for (const path of ["/explorer", "/explorer/labour"]) {
      await page.goto(path);
      await ready(page);
      failures.push(...(await axeViolations(page)).map((violation) => `${path} ${violation}`));
    }
    if (viewport.width < 900) {
      await page.getByTestId("sidebar-menu-button").click();
      await expect(page.getByTestId("sidebar-close")).toBeFocused();
      failures.push(...(await axeViolations(page)).map((violation) => `menu ${violation}`));
    }
    expect(failures).toEqual([]);
  });
}

// Shell review (deep-review/shell.md M2): with the phone menu open, axe's best-practice rules pass too, aria-allowed-role
// among them, on All data, a group page and a chart page in both languages.
test("with the phone menu open, All data, a group page and a chart page pass axe's WCAG and best-practice rules", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const failures: string[] = [];
  for (const prefix of PREFIXES) {
    for (const path of ["/explorer", "/explorer/prices", "/explorer/inflation/overview"]) {
      await page.goto(`${prefix}${path}`);
      await ready(page);
      await page.getByTestId("sidebar-menu-button").click();
      await expect(page.getByTestId("sidebar-close")).toBeFocused();
      failures.push(...(await axeViolations(page, [], ["best-practice"])).map((violation) => `${prefix}${path} ${violation}`));
    }
  }
  expect(failures).toEqual([]);
});

test.describe("the sidebar's current row and focus", () => {
  test("the rail's foot links Methodology and AI connection, named and with tooltips", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const prefix of PREFIXES) {
      await page.goto(`${prefix}/explorer/labour`);
      await ready(page);
      if ((await sidebar(page).getAttribute("data-collapsed")) === "false") await page.getByTestId("sidebar-toggle").click();
      await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
      for (const [testId, path, name] of [["rail-methodology-link", "/methodology", prefix ? "Methodology" : "მეთოდოლოგია"], ["rail-connect-link", "/connect", prefix ? "AI connection" : "AI-კავშირი"]] as const) {
        const link = page.getByTestId(testId);
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", `${prefix}${path}`);
        await expect(link).toHaveAccessibleName(name);
        await expect(link).toHaveAttribute("title", name);
        await expect(link.locator("svg")).toHaveAttribute("aria-hidden", "true");
      }
    }
  });

  test("a stored collapse draws the 72px rail from the first paint, with no layout shift", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      window.localStorage.setItem("geodata:sidebar-collapsed", "1");
      (window as unknown as { shifts: number }).shifts = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!entry.hadRecentInput) (window as unknown as { shifts: number }).shifts += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    // Before hydration: the server's HTML, with the page's scripts held back, already reserves the rail.
    const held: Route[] = [];
    await page.route(APP_SCRIPT, (route) => { held.push(route); });
    await page.goto("/explorer/trade/partners", { waitUntil: "domcontentloaded" });
    expect(await width(sidebar(page))).toBe(72);
    await page.unroute(APP_SCRIPT);
    for (const route of held) await route.abort();
    await page.goto("/explorer/trade/partners");
    await ready(page);
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
    expect(await width(sidebar(page))).toBe(72);
    await expect(page.locator("#sidebar-rail-before-hydration")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { shifts: number }).shifts)).toBeLessThan(0.1);
    // Expanding afterwards is the reader's own choice, and nothing left over holds the rail.
    await page.getByTestId("sidebar-toggle").click();
    await expect.poll(() => width(sidebar(page))).toBe(272);
  });

  /** The server's expanded sidebar, every link it renders shown. */
  async function expectServerSidebar(page: Page) {
    expect(await width(sidebar(page))).toBe(272);
    const links = await sidebar(page).getByRole("link").all();
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) await expect(link).toBeVisible();
  }

  test("a stored collapse leaves the server's sidebar usable when the app's scripts fail or never run, or JavaScript is off", async ({ browser, baseURL, page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => window.localStorage.setItem("geodata:sidebar-collapsed", "1"));
    // A chunk that fails to load: its error gives the sidebar back at once.
    await page.route(APP_SCRIPT, (route) => route.abort());
    await page.goto("/explorer/labour");
    await expectServerSidebar(page);
    await page.unroute(APP_SCRIPT);
    // Scripts that load but never mount the sidebar: the rail is held until a while after the page's load.
    await page.clock.install();
    await page.route(APP_SCRIPT, (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
    await page.goto("/explorer/labour");
    expect(await width(sidebar(page))).toBe(72);
    await page.clock.runFor(3000);
    await expectServerSidebar(page);
    // No JavaScript at all: the pre-paint script does not run, and nothing is hidden.
    const origin = new URL(baseURL!).origin;
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 1440, height: 900 },
      storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: "geodata:sidebar-collapsed", value: "1" }] }] } });
    try {
      const noScript = await context.newPage();
      await noScript.goto("/explorer/labour");
      await expectServerSidebar(noScript);
    } finally {
      await context.close();
    }
  });

  test("in the rail, a chart page's group says it holds the current page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/explorer/inflation/overview");
    await ready(page);
    await expect(page.getByTestId("group-link-prices")).not.toHaveAttribute("aria-current");
    await page.getByTestId("sidebar-toggle").click();
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
    await expect(page.getByTestId("group-link-prices")).toHaveAttribute("aria-current", "true");
    await expect(sidebar(page).locator("[aria-current]")).toHaveCount(1);
  });

  test("the sidebar scrolls its current row into view on arrival, and the page does not move", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of ["/explorer/transport/regions", "/explorer/environment/air-quality"]) {
      await page.goto(path);
      await ready(page);
      const row = sidebar(page).locator('[aria-current="page"]');
      await expect.poll(() => row.evaluate((element) => {
        const [box, view] = [element.getBoundingClientRect(), element.closest("nav")!.getBoundingClientRect()];
        return box.top >= view.top && box.bottom <= view.bottom;
      }), path).toBe(true);
      expect(await page.evaluate(() => window.scrollY), path).toBe(0);
    }
  });

  test("the phone menu opens with its current row in view, at once, and the page does not move (shell M4)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    const inView = () => sidebar(page).locator('[aria-current="page"]').evaluate((element) => {
      const [box, view] = [element.getBoundingClientRect(), element.closest("nav")!.getBoundingClientRect()];
      return box.top >= view.top && box.bottom <= view.bottom;
    });
    for (const path of ["/explorer/transport/regions", "/explorer/environment/air-quality"]) {
      await page.goto(path);
      await ready(page);
      await page.evaluate(() => window.scrollTo(0, 120));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(120);
      await page.getByTestId("sidebar-menu-button").click();
      await expect(page.getByTestId("sidebar-close")).toBeFocused();
      // No smooth scrolling: the row is in view as soon as the menu is.
      expect(await inView(), path).toBe(true);
      expect(await sidebar(page).evaluate((nav) => [nav.scrollTop > 0, getComputedStyle(nav).scrollBehavior]), path).toEqual([true, "auto"]);
      await page.keyboard.press("Escape");
      await expect.poll(() => page.evaluate(() => window.scrollY), path).toBe(120);
    }
    // A current row already in view leaves the menu at its top, by the close button.
    await page.goto("/explorer/inflation/overview");
    await ready(page);
    await page.getByTestId("sidebar-menu-button").click();
    await expect(page.getByTestId("sidebar-close")).toBeFocused();
    expect(await inView()).toBe(true);
    expect(await sidebar(page).evaluate((nav) => nav.scrollTop)).toBe(0);
  });

  test("in forced colours the current page and the current group are marked, and other rows are not", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/explorer/inflation/overview");
    await ready(page);
    const style = (testId: string) => page.getByTestId(testId).evaluate((element) => {
      const computed = getComputedStyle(element);
      return { border: `${computed.borderLeftWidth} ${computed.borderLeftStyle} ${computed.borderLeftColor}`, weight: computed.fontWeight };
    });
    const [current, other, group, otherGroup] = await Promise.all([style("inflation-overview-link"), style("inflation-categories-link"), style("group-link-prices"), style("group-link-budget")]);
    expect(current.weight).toBe("600");
    expect(other.weight).toBe("400");
    expect(current.border).not.toBe(other.border);
    expect(group.border).toMatch(/^2px solid/);
    expect(otherGroup.border).not.toMatch(/^2px solid/);
  });

  test("the current page's link in the phone menu closes it and gives focus back to the menu button", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    for (const [path, testId] of [["/explorer/inflation/overview", "inflation-overview-link"], ["/explorer/prices", "group-link-prices"], ["/explorer", "all-data-link"]] as const) {
      await page.goto(path);
      await ready(page);
      await page.getByTestId("sidebar-menu-button").click();
      await expect(page.getByTestId("sidebar-close")).toBeFocused();
      await page.getByTestId(testId).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("sidebar-menu-button"), path).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByTestId("sidebar-menu-button"), path).toBeFocused();
      expect(address(page)).toBe(path);
    }
  });

  test("narrowing below 900px with focus on the collapse toggle moves it to the menu button", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 812 });
    await page.goto("/explorer/labour");
    await ready(page);
    await page.getByTestId("sidebar-toggle").focus();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByTestId("sidebar-menu-button")).toBeFocused();
  });
});

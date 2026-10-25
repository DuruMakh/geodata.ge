import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataSidebar } from "../../components/shell/data-sidebar";
import { PRE_PAINT_RAIL_SCRIPT, PRE_PAINT_RAIL_STYLE_ID, PRE_PAINT_RAIL_TIMEOUT_MS, SIDEBAR_NAV_ID, SIDEBAR_STORAGE_KEY, initialSidebarState, isRailed, sidebarReducer } from "../../components/shell/sidebar-state";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import { LEGACY_TOPIC_FORWARDS, NAV_GROUPS, NAV_TREE, PAGE_COUNT } from "../../lib/navigation/navTree";
import type { Locale } from "../../lib/i18n/types";

const navigation = vi.hoisted(() => ({ pathname: "/explorer" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

afterEach(() => {
  navigation.pathname = "/explorer";
});

async function render(pathname: string, locale: Locale = "ka") {
  navigation.pathname = pathname;
  const messages = await getMessages(locale, ["common"]);
  return renderToStaticMarkup(<I18nProvider locale={locale} messages={messages}><DataSidebar /></I18nProvider>);
}

/** The opening tag of the element with this test id. */
function tag(markup: string, testId: string): string {
  return new RegExp(`<[a-z]+\\b[^>]*data-testid="${testId}"[^>]*>`).exec(markup)?.[0] ?? "";
}

/** The element with this test id, up to its closing tag (for elements with no nested element of the same name). */
function element(markup: string, testId: string, name: string): string {
  return new RegExp(`<${name}\\b[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</${name}>`).exec(markup)?.[0] ?? "";
}

/** A group's open list: from its panel to the next group's row, or to the end of the sidebar for the last group. */
function panel(markup: string, id: string): string {
  const start = markup.indexOf(`data-testid="group-panel-${id}"`);
  if (start < 0) return "";
  const next = markup.indexOf('data-testid="group-link-', start);
  return markup.slice(start, next < 0 ? markup.indexOf("</nav>", start) : next);
}

describe("the explorer sidebar", () => {
  it("opens the current page's group and marks its row on a place page below it", async () => {
    const markup = await render("/explorer/wages/regions/adjara");
    expect(markup).toContain('data-testid="group-panel-labour"');
    expect(tag(markup, "wages-regions-link")).toContain('aria-current="page"');
    expect(tag(markup, "wages-regions-link")).toContain('href="/explorer/wages/regions"');
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("renders no other group's panel", async () => {
    const markup = await render("/explorer/wages/regions/adjara");
    expect([...markup.matchAll(/data-testid="group-panel-([a-z]+)"/g)].map((match) => match[1])).toEqual(["labour"]);
  });

  it("lists the eight groups in order with their page counts, and All data with every page", async () => {
    const markup = await render("/explorer/wages/regions/adjara");
    const groups = [...markup.matchAll(/data-testid="group-link-([a-z]+)"/g)].map((match) => match[1]);
    expect(groups).toEqual(["budget", "economy", "prices", "labour", "living", "external", "demography", "society"]);
    const counts = groups.map((id) => />(\d+)<\/span><\/a>$/.exec(element(markup, `group-link-${id}`, "a"))?.[1]);
    expect(counts).toEqual(["8", "13", "10", "11", "12", "11", "5", "34"]);
    expect(element(markup, "all-data-link", "a")).toMatch(new RegExp(`>${PAGE_COUNT}</span></a>$`));
    expect(tag(markup, "group-link-labour")).toContain('aria-label="შრომის ბაზარი, 11 გვერდი"');
  });

  it("marks All data current on /explorer and opens no group", async () => {
    for (const [pathname, locale] of [["/explorer", "ka"], ["/en/explorer", "en"]] as const) {
      const markup = await render(pathname, locale);
      expect(tag(markup, "all-data-link")).toContain('aria-current="page"');
      expect(tag(markup, "all-data-link")).toContain(`href="${locale === "en" ? "/en" : ""}/explorer"`);
      expect(markup).not.toContain('data-testid="group-panel-');
      expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    }
  });

  it("marks a group page's own link current and opens its list", async () => {
    const markup = await render("/en/explorer/labour", "en");
    expect(tag(markup, "group-link-labour")).toContain('aria-current="page"');
    expect(tag(markup, "group-link-labour")).toContain('href="/en/explorer/labour"');
    expect(markup).toContain('data-testid="group-panel-labour"');
    expect(tag(markup, "all-data-link")).not.toContain("aria-current");
  });

  it("gives every chevron its state, its list and a name that says what it does", async () => {
    const markup = await render("/explorer/wages/regions/adjara");
    for (const group of NAV_GROUPS) {
      const toggle = tag(markup, `group-toggle-${group.id}`);
      expect(toggle).toContain(`aria-expanded="${group.id === "labour"}"`);
      expect(toggle).toContain(`aria-controls="sidebar-group-${group.id}"`);
    }
    expect(tag(markup, "group-panel-labour")).toContain('id="sidebar-group-labour"');
    expect(tag(markup, "group-toggle-labour")).toContain('aria-label="ჩაკეცვა: შრომის ბაზარი"');
    expect(tag(markup, "group-toggle-society")).toContain('aria-label="გაშლა: საზოგადოება და გარემო"');
  });

  it("heads a group's topics only when it has more than one", async () => {
    const labour = panel(await render("/en/explorer/wages/overview", "en"), "labour");
    expect(labour).toContain(">Unemployment and jobs</p>");
    expect(labour).toContain(">Wages</p>");
    const budget = await render("/en/explorer/expenditure", "en");
    expect(panel(budget, "budget")).toContain('data-testid="section-link-expenditure"');
    expect(panel(budget, "budget")).not.toContain("<p");
  });

  it("keeps every page row's test id", async () => {
    for (const hub of NAV_TREE) {
      const markup = await render(hub.sections[0]!.href);
      for (const section of hub.sections) expect(tag(markup, section.testId!), section.href).toContain(`href="${section.href}"`);
    }
    const budget = await render("/explorer/expenditure");
    expect(["expenditure", "expenditure-types", "revenue", "municipalities", "analysis", "debt", "deficit"].map((id) => tag(budget, `section-link-${id}`) !== "")).not.toContain(false);
  });

  it("shows the search row's / key hint on desktop only, not in the phone menu", async () => {
    const hint = /<kbd[^>]*>\/<\/kbd>/.exec(element(await render("/explorer/labour"), "sidebar-search", "a"))?.[0] ?? "";
    expect(hint).toContain("max-[900px]:hidden");
  });

  it("links search to All data with the box focused, in both languages", async () => {
    expect(tag(await render("/explorer/labour"), "sidebar-search")).toContain('href="/explorer#q="');
    expect(tag(await render("/en/explorer/labour", "en"), "sidebar-search")).toContain('href="/en/explorer#q="');
  });

  it("links only groups, All data, chart pages and the site's own pages", async () => {
    const forwarded = new Set(LEGACY_TOPIC_FORWARDS.map(({ from }) => from));
    const allowed = new Set(["/", "/explorer", "/explorer#q=", "/methodology", "/connect", ...NAV_GROUPS.map((group) => group.href), ...NAV_TREE.flatMap((hub) => hub.sections.map((section) => section.href))]);
    for (const pathname of ["/explorer", "/explorer/expenditure", "/explorer/wages/regions/adjara", "/explorer/society", "/explorer/external/reserves"]) {
      const markup = await render(pathname);
      const hrefs = [...element(markup, "data-sidebar", "nav").matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]!).filter((href) => !href.startsWith("/en"));
      expect(hrefs.length, pathname).toBeGreaterThan(12);
      expect(hrefs.filter((href) => !allowed.has(href) || forwarded.has(href)), pathname).toEqual([]);
    }
    expect(tag(await render("/explorer/expenditure"), "group-link-budget")).toContain('href="/explorer/budget"');
  });

  it("offers the phone bar's search and menu buttons, the menu closed", async () => {
    const markup = await render("/explorer/labour");
    expect(tag(markup, "sidebar-menu-button")).toContain('aria-expanded="false"');
    expect(tag(markup, "sidebar-menu-button")).toContain('aria-controls="data-sidebar-navigation"');
    expect(tag(markup, "data-sidebar")).toContain('id="data-sidebar-navigation"');
    expect(tag(markup, "topbar-search")).toContain('href="/explorer#q="');
    expect(markup).not.toContain('data-testid="sidebar-close"');
    expect(tag(markup, "data-sidebar")).not.toContain("data-menu-open");
    // The closed menu's wrapper is no dialog, and adds no box beside the nav.
    expect(tag(markup, "sidebar-menu-dialog")).not.toContain("role=");
    expect(tag(markup, "sidebar-menu-dialog")).toContain('class="contents"');
    expect(tag(markup, "data-sidebar")).not.toContain("role=");
  });

  it("marks the current page's row at 600 and draws a group's chevron without animating it (DESIGN.md §6.7, §14)", async () => {
    const markup = await render("/explorer/wages/regions");
    expect(tag(markup, "wages-regions-link")).toContain("font-semibold");
    expect(tag(markup, "wages-overview-link")).not.toContain("font-semibold");
    const chevrons = [...markup.matchAll(/data-testid="group-toggle-[a-z]+"[\s\S]*?<svg[^>]*>/g)].map((match) => match[0]);
    expect(chevrons).toHaveLength(NAV_GROUPS.length);
    for (const chevron of chevrons) expect(chevron).not.toMatch(/transition|duration-/);
    expect(markup).not.toMatch(/translate-x|transition-transform/);
  });
});

describe("the pre-paint rail script", () => {
  type Style = { id: string; textContent: string; remove: () => void };
  type Listener = (event: { target: { tagName?: string; src?: string } | null }) => void;
  function runWithEvents(stored: string | null, failing = false) {
    const head: Style[] = [];
    const listeners: Record<string, Listener[]> = {};
    const timers: { run: () => void; ms: number }[] = [];
    const localStorage = { getItem: (key: string) => { if (failing) throw new Error("denied"); return key === SIDEBAR_STORAGE_KEY ? stored : null; } };
    const document = {
      createElement: (): Style => { const style: Style = { id: "", textContent: "", remove: () => { head.splice(head.indexOf(style), 1); } }; return style; },
      head: { appendChild: (style: Style) => head.push(style) },
    };
    const addEventListener = (type: string, listener: Listener) => { (listeners[type] ??= []).push(listener); };
    const setTimeout = (run: () => void, ms: number) => { timers.push({ run, ms }); };
    new Function("localStorage", "document", "addEventListener", "setTimeout", PRE_PAINT_RAIL_SCRIPT)(localStorage, document, addEventListener, setTimeout);
    const fire = (type: string, target: { tagName?: string; src?: string } | null = null) => { for (const listener of listeners[type] ?? []) listener({ target }); };
    return { head, fire, timers };
  }
  const run = (stored: string | null, failing = false) => runWithEvents(stored, failing).head;

  it("reserves the 72px rail from 900px when the collapse is stored, and only then", () => {
    const [style] = run("1");
    expect(style.id).toBe(PRE_PAINT_RAIL_STYLE_ID);
    expect(style.textContent).toContain("@media (min-width:900px)");
    expect(style.textContent).toContain(`#${SIDEBAR_NAV_ID}[data-collapsed=false]{width:72px}`);
    expect(run("0")).toEqual([]);
    expect(run(null)).toEqual([]);
  });

  it("does nothing when storage is denied", () => {
    expect(run("1", true)).toEqual([]);
  });

  it("gives the server's sidebar back when one of the app's scripts fails to load, but not for another script or resource", () => {
    const { head, fire } = runWithEvents("1");
    fire("error", { tagName: "SCRIPT", src: "https://www.clarity.ms/tag/x" });
    fire("error", { tagName: "IMG", src: "https://fiscal.ge/_next/static/media/a.png" });
    fire("error", null);
    expect(head).toHaveLength(1);
    fire("error", { tagName: "SCRIPT", src: "https://fiscal.ge/_next/static/chunks/main.js" });
    expect(head).toEqual([]);
  });

  it("gives the server's sidebar back a while after the page's load, should the sidebar not have mounted by then", () => {
    const { head, fire, timers } = runWithEvents("1");
    expect(timers).toEqual([]);
    fire("load");
    expect(timers.map((timer) => timer.ms)).toEqual([PRE_PAINT_RAIL_TIMEOUT_MS]);
    expect(head).toHaveLength(1);
    timers[0]!.run();
    expect(head).toEqual([]);
  });
});

describe("the sidebar's state", () => {
  const desktop = (state: ReturnType<typeof initialSidebarState>) => sidebarReducer(state, { type: "width", desktop: true });

  it("seeds the open groups with the current page's group, keeps them open, and re-adds the current one on arrival", () => {
    let state = initialSidebarState("/explorer/wages/regions/adjara");
    expect([...state.open]).toEqual(["labour"]);
    state = sidebarReducer(state, { type: "toggleGroup", id: "society" });
    state = sidebarReducer(state, { type: "toggleGroup", id: "labour" });
    expect([...state.open]).toEqual(["society"]);
    state = sidebarReducer(state, { type: "navigate", page: "/explorer/unemployment/overview" });
    expect([...state.open].sort()).toEqual(["labour", "society"]);
    expect([...initialSidebarState("/explorer").open]).toEqual([]);
  });

  it("closes the phone menu when the width reaches the desktop (Review Focus 5)", () => {
    let state = sidebarReducer(initialSidebarState("/explorer/labour"), { type: "width", desktop: false });
    state = sidebarReducer(state, { type: "menu", open: true });
    expect(state.menu).toBe(true);
    state = desktop(state);
    expect(state.menu).toBe(false);
  });

  it("closes the menu on arrival at another page", () => {
    let state = sidebarReducer(sidebarReducer(initialSidebarState("/explorer/labour"), { type: "width", desktop: false }), { type: "menu", open: true });
    state = sidebarReducer(state, { type: "navigate", page: "/explorer/wages/overview" });
    expect(state.menu).toBe(false);
  });

  it("opens a pop-out only on the rail, and closes it when the rail expands or the width drops (Review Focus 5)", () => {
    let state = desktop(initialSidebarState("/explorer/labour"));
    expect(sidebarReducer(state, { type: "fly", id: "society" }).fly).toBeNull();
    state = sidebarReducer(state, { type: "collapse", collapsed: true });
    expect(isRailed(state)).toBe(true);
    state = sidebarReducer(state, { type: "fly", id: "society" });
    expect(state.fly).toBe("society");
    expect(sidebarReducer(state, { type: "collapse", collapsed: false }).fly).toBeNull();
    expect(sidebarReducer(state, { type: "width", desktop: false }).fly).toBeNull();
    expect(sidebarReducer(state, { type: "navigate", page: "/explorer/society" }).fly).toBeNull();
  });

  it("ignores the stored collapse below 900px", () => {
    const state = sidebarReducer(sidebarReducer(initialSidebarState("/explorer/labour"), { type: "collapse", collapsed: true }), { type: "width", desktop: false });
    expect(isRailed(state)).toBe(false);
    expect(isRailed(initialSidebarState("/explorer/labour"))).toBe(false);
  });
});

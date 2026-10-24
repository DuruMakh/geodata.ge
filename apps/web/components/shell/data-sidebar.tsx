"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { ChevronRight, LayoutGrid, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GROUP_ICONS } from "./group-icons";
import { SidebarSectionLink } from "./section-nav";
import { initialSidebarState, isRailed, sidebarReducer } from "./sidebar-state";
import { SEARCH_PATH, useSlashSearch } from "./use-slash-search";
import { LanguageSwitch } from "../site/language-switch";
import { focusExplorerSearch } from "../explorer-groups/explorer-search-focus";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref, splitLanguagePath } from "../../lib/i18n/routes";
import { pagesLabel } from "../../lib/explorer/pagesLabel";
import { ALL_DATA_PATH, NAV_GROUPS, PAGE_COUNT, currentEntry, currentGroup, groupPages, topicHub, type GroupId } from "../../lib/navigation/navTree";

// The explorer sidebar (spec 2026-10-24-explorer-regroup §4, DESIGN.md §6.7): from 900px a 272px column or a 72px icon
// rail whose groups open a 320px pop-out; below 900px a 56px bar whose menu opens this same column full screen.

const STORAGE_KEY = "geodata:sidebar-collapsed";
const DESKTOP_MIN_WIDTH = 900;
const NAV_ID = "data-sidebar-navigation";
const ACTIVE_BG = "bg-[var(--ink-active)]";
const COUNT = "ml-auto pl-2 font-[family-name:var(--font-numeric)] text-[11px] font-normal text-[var(--ink-fg-muted)]";
const ICON = { "aria-hidden": true, size: 18, strokeWidth: 1.5, className: "flex-none" } as const;

const panelId = (id: GroupId) => `sidebar-group-${id}`;
const groupLinkId = (id: GroupId) => `sidebar-group-link-${id}`;

function BrandMark({ testId }: { testId?: string }) {
  // Local SVG brand asset; native img avoids adding a raster optimization path.
  // eslint-disable-next-line @next/next/no-img-element
  return <img data-testid={testId} src="/brand/fiscal-logo-mark-reversed.svg" width="520" height="650" alt="" className="h-auto w-6 flex-none" />;
}

export function DataSidebar() {
  const { locale, messages } = useI18n();
  const pathname = usePathname();
  // The navigation config's addresses carry no language prefix.
  const page = splitLanguagePath(pathname).pathname;
  const [state, dispatch] = useReducer(sidebarReducer, page, initialSidebarState);
  // The explorer layout persists across its pages, so arriving at one is a render with a new page, not a new sidebar.
  if (state.page !== page) dispatch({ type: "navigate", page });
  const [animateWidth, setAnimateWidth] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const focusAfterMenu = useRef<"close" | "menu" | null>(null);
  /** Where the reader was when the menu opened: the page behind it is hidden, which takes the scroll position with it. */
  const menuOpenedAt = useRef<{ page: string; scrollY: number } | null>(null);
  const railed = isRailed(state);
  const current = currentEntry(page);
  const currentGroupId = currentGroup(page)?.id;

  // Read after mount: the server render cannot see localStorage, and guessing would flash the wrong width on every load.
  useEffect(() => {
    try {
      dispatch({ type: "collapse", collapsed: window.localStorage.getItem(STORAGE_KEY) === "1" });
    } catch {
      // Storage access denials (blocked cookies, sandboxed iframes) must not break the render — default to expanded.
    }
  }, []);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const sync = () => dispatch({ type: "width", desktop: query.matches });
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // The menu works as a modal: opening it hands focus to its close button, closing it hands focus back to the button
  // that opened it, once the bar is shown again. Closing it without leaving the page (Escape, the close button, a
  // widening past 900px, the search box on All data) puts the reader back where they were, should the hidden page have
  // scrolled under the menu. A layout effect, so the page is in place before it paints and before the search box takes focus.
  useLayoutEffect(() => {
    const target = focusAfterMenu.current;
    focusAfterMenu.current = null;
    if (state.menu) {
      if (target === "close") closeRef.current?.focus();
      return;
    }
    const opened = menuOpenedAt.current;
    menuOpenedAt.current = null;
    if (!opened) return;
    if (opened.page === state.page) window.scrollTo(0, opened.scrollY);
    if (target === "menu") menuButtonRef.current?.focus({ preventScroll: true });
    // Widened past 900px: the close button that held focus is gone; the collapse toggle sits where it was.
    else if (state.desktop && (document.activeElement === null || document.activeElement === document.body)) toggleRef.current?.focus({ preventScroll: true });
  }, [state.menu, state.page, state.desktop]);

  // The open menu is modal: the page column behind it is inert as well as hidden, so neither Tab nor a screen reader
  // reaches it. The column is the layout's (lib/pages/explorer-layout.tsx); the bar below is inert by the same flag.
  useLayoutEffect(() => {
    document.querySelector("[data-shell-page]")?.toggleAttribute("inert", state.menu);
  }, [state.menu]);

  const closeMenu = useCallback(() => {
    focusAfterMenu.current = "menu";
    dispatch({ type: "menu", open: false });
  }, []);

  useEffect(() => {
    if (!state.menu && !state.fly) return;
    const fly = state.fly;
    const onKey = (event: KeyboardEvent) => {
      // A modal menu wraps Tab at its ends, so focus never leaves it for the inert page or the browser's own controls.
      if (event.key === "Tab" && state.menu) {
        const nav = document.getElementById(NAV_ID);
        const stops = nav ? [...nav.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])")].filter((element) => element.checkVisibility()) : [];
        const [first, last] = [stops[0], stops.at(-1)];
        if (!first || !last) return;
        const active = document.activeElement;
        if (event.shiftKey ? active === first || !nav!.contains(active) : active === last) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
        return;
      }
      if (event.key !== "Escape") return;
      if (state.menu) {
        closeMenu();
        return;
      }
      // Focus inside the pop-out goes back to the rail icon it hangs from before it closes, or it would be lost with the list.
      const link = fly ? document.getElementById(groupLinkId(fly)) : null;
      if (link?.closest("li")?.contains(document.activeElement)) link.focus();
      dispatch({ type: "fly", id: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.menu, state.fly, closeMenu]);

  // On All data the search box is already on the page, under the menu while it is open: the menu closes first.
  const focusSearchHere = useCallback(() => {
    flushSync(() => dispatch({ type: "menu", open: false }));
    return focusExplorerSearch();
  }, []);
  useSlashSearch(focusSearchHere);

  function onSearchClick(event: MouseEvent<HTMLAnchorElement>) {
    // A link to /explorer#q= from /explorer itself fires no hashchange, so the page would not see it.
    if (focusSearchHere()) event.preventDefault();
  }

  function toggleCollapsed() {
    // Arm the width transition on the first click, not on mount: a mount-time class would animate the restored rail on
    // every cold load (DESIGN.md §14: nothing animates on load).
    setAnimateWidth(true);
    const next = !state.collapsed;
    dispatch({ type: "collapse", collapsed: next });
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Private-mode storage denials must not break the toggle itself.
    }
  }

  const searchLabel = message(messages, "common.searchAll");
  const searchHref = pageHref(SEARCH_PATH, locale);
  const onAllData = page === ALL_DATA_PATH;

  return (
    <>
      <header
        data-testid="sidebar-topbar"
        inert={state.menu}
        className={`flex ${state.menu ? "invisible" : ""} sticky top-0 z-40 h-[calc(56px+env(safe-area-inset-top))] flex-none items-center gap-1 bg-[var(--ink)] pt-[env(safe-area-inset-top)] pr-1.5 pl-4 text-[var(--paper)] min-[900px]:hidden`}
      >
        {/* Reload across the Explorer/public layout boundary so stale route metadata cannot remain in <head>. */}
        <a href={pageHref("/", locale)} aria-label={message(messages, "common.brandHome")} className="mr-auto flex min-h-11 items-center gap-2.5 font-[family-name:var(--font-display)] text-[17px] font-semibold text-[var(--paper)] no-underline">
          <BrandMark />
          <span>Fiscal.ge</span>
        </a>
        <Link href={searchHref} prefetch={false} data-testid="topbar-search" aria-label={searchLabel} onClick={onSearchClick} className="flex size-11 items-center justify-center text-[var(--paper)]">
          <Search aria-hidden="true" size={22} strokeWidth={1.5} />
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          data-testid="sidebar-menu-button"
          aria-label={message(messages, "common.menu")}
          aria-expanded={state.menu}
          aria-controls={NAV_ID}
          onClick={() => {
            focusAfterMenu.current = "close";
            menuOpenedAt.current = { page, scrollY: window.scrollY };
            dispatch({ type: "menu", open: true });
          }}
          className="flex size-11 cursor-pointer items-center justify-center text-[var(--paper)]"
        >
          <Menu aria-hidden="true" size={22} strokeWidth={1.5} />
        </button>
      </header>

      <nav
        id={NAV_ID}
        // Open below 900px, the menu covers the page as a modal dialog.
        role={state.menu ? "dialog" : undefined}
        aria-modal={state.menu ? true : undefined}
        aria-label={message(messages, state.menu ? "common.menu" : "common.dataPanel")}
        data-testid="data-sidebar"
        data-collapsed={railed ? "true" : "false"}
        data-menu-open={state.menu ? "true" : undefined}
        // Every link closes the menu, the current page's included: arriving at a new page closes it, but that one is no
        // arrival. A modified click opens a new tab or window, and the menu stays.
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const link = (event.target as Element).closest("a");
          if (!link) return;
          // A link to another page lands at its top; only the page the menu covered gets its place back.
          if (link.pathname !== window.location.pathname) menuOpenedAt.current = null;
          dispatch({ type: "menu", open: false });
        }}
        className={`${state.menu ? "flex max-[900px]:fixed max-[900px]:inset-0 max-[900px]:z-[60] max-[900px]:overflow-y-auto max-[900px]:overscroll-contain max-[900px]:px-3.5 max-[900px]:pt-[max(10px,env(safe-area-inset-top))] max-[900px]:pb-[22px]" : "hidden"} flex-col bg-[var(--ink)] text-[var(--paper)] [scrollbar-color:var(--ink-line)_transparent] [scrollbar-width:thin] min-[900px]:sticky min-[900px]:top-0 min-[900px]:z-30 min-[900px]:flex min-[900px]:h-screen min-[900px]:flex-none min-[900px]:overflow-y-auto ${
          railed ? "min-[900px]:w-[72px] min-[900px]:px-2.5 min-[900px]:py-4" : "min-[900px]:w-[272px] min-[900px]:px-3 min-[900px]:pt-[18px] min-[900px]:pb-3.5"
        } ${animateWidth ? "transition-[width] duration-150 ease-in-out" : ""}`}
      >
        <div className={`flex items-center ${railed ? "flex-col gap-3.5" : "min-h-10 gap-2 pr-0.5 pl-1.5"}`}>
          <a href={pageHref("/", locale)} aria-label={message(messages, "common.brandHome")} className={`flex min-w-0 items-center gap-2.5 no-underline max-[900px]:min-h-11 ${railed ? "" : "mr-auto"}`}>
            <BrandMark testId="sidebar-brand-mark" />
            {railed ? null : (
              <span className="flex min-w-0 flex-col">
                <span className="font-[family-name:var(--font-display)] text-[17px] leading-[1.1] font-semibold text-[var(--paper)]">Fiscal.ge</span>
                <span className="mt-[3px] font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--ink-fg-muted)]">{message(messages, "common.openData")}</span>
              </span>
            )}
          </a>
          <button
            ref={toggleRef}
            type="button"
            data-testid="sidebar-toggle"
            aria-expanded={!railed}
            aria-label={message(messages, railed ? "common.expandPanel" : "common.collapsePanel")}
            onClick={toggleCollapsed}
            className="flex size-9 flex-none cursor-pointer items-center justify-center border border-[var(--ink-line)] text-[var(--ink-fg-muted)] transition-colors duration-150 hover:border-[rgba(247,242,233,0.18)] hover:text-[var(--paper)] max-[900px]:hidden"
          >
            {railed ? <PanelLeftOpen {...ICON} /> : <PanelLeftClose {...ICON} />}
          </button>
          {state.menu ? (
            <button ref={closeRef} type="button" data-testid="sidebar-close" aria-label={message(messages, "common.closeMenu")} onClick={closeMenu} className="flex size-11 flex-none cursor-pointer items-center justify-center border border-[var(--ink-line)] text-[var(--ink-fg-muted)] hover:text-[var(--paper)] min-[900px]:hidden">
              <X aria-hidden="true" size={22} strokeWidth={1.5} />
            </button>
          ) : null}
        </div>

        <Link
          href={searchHref}
          prefetch={false}
          data-testid="sidebar-search"
          aria-label={searchLabel}
          title={railed ? searchLabel : undefined}
          onClick={onSearchClick}
          className={`mt-[18px] flex min-h-10 w-full items-center gap-2.5 border border-[var(--ink-line)] text-[13px] text-[var(--ink-fg-muted)] no-underline transition-colors duration-150 hover:border-[rgba(247,242,233,0.18)] hover:text-[var(--paper)] max-[900px]:min-h-12 max-[900px]:text-sm ${railed ? "justify-center" : "pr-2 pl-2.5"}`}
        >
          <Search {...ICON} />
          {railed ? null : (
            <>
              <span>{searchLabel}</span>
              <kbd className="ml-auto border border-[var(--ink-line)] px-1.5 max-[900px]:hidden font-[family-name:var(--font-numeric)] text-[11px] leading-5">/</kbd>
            </>
          )}
        </Link>

        <Link
          href={pageHref(ALL_DATA_PATH, locale)}
          prefetch={false}
          data-testid="all-data-link"
          aria-current={onAllData ? "page" : undefined}
          aria-label={message(messages, "common.allData")}
          title={railed ? message(messages, "common.allData") : undefined}
          className={`mt-2.5 flex min-h-[42px] items-center gap-2.5 text-[13.5px] font-semibold text-[var(--paper)] no-underline hover:bg-[var(--ink-active)] max-[900px]:min-h-12 ${railed ? "justify-center" : "px-2.5"} ${onAllData ? `${ACTIVE_BG} shadow-[inset_2px_0_0_var(--accent)]` : ""}`}
        >
          <LayoutGrid {...ICON} />
          {railed ? null : (
            <>
              <span>{message(messages, "common.allData")}</span>
              <span className={COUNT}>{PAGE_COUNT}</span>
            </>
          )}
        </Link>

        {railed ? null : <p className="mx-2.5 mt-5 mb-1.5 font-[family-name:var(--font-numeric)] text-[10.5px] tracking-[0.06em] text-[var(--ink-fg-faint)]">{message(messages, "common.hubsOverline")}</p>}
        <ul className={`list-none ${railed ? "mt-4" : ""}`}>
          {NAV_GROUPS.map((group) => {
            const { id, href, topics } = group;
            const Icon = GROUP_ICONS[id];
            const name = message(messages, group.labelKey);
            const pages = groupPages(group).length;
            const open = railed ? state.fly === id : state.open.has(id);
            const isCurrent = currentGroupId === id;
            return (
              <li
                key={id}
                className="border-t border-[var(--ink-divider)]"
                onMouseEnter={railed ? () => dispatch({ type: "fly", id }) : undefined}
                onMouseLeave={railed ? () => dispatch({ type: "fly", id: null }) : undefined}
                onFocus={railed ? () => dispatch({ type: "fly", id }) : undefined}
                onBlur={railed ? (event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) dispatch({ type: "fly", id: null });
                } : undefined}
              >
                <div className="flex items-stretch">
                  <Link
                    id={groupLinkId(id)}
                    href={pageHref(href, locale)}
                    prefetch={false}
                    data-testid={`group-link-${id}`}
                    aria-current={page === href ? "page" : undefined}
                    aria-label={`${name}, ${pagesLabel(messages, pages)}`}
                    className={`group/link flex min-w-0 flex-1 items-start gap-2.5 no-underline max-[900px]:min-h-11 ${railed ? "justify-center py-[13px]" : "py-2.5 pr-1 pl-2.5 max-[900px]:py-[13px]"} ${isCurrent ? "text-[var(--paper)] shadow-[inset_2px_0_0_var(--accent)]" : "text-[var(--ink-fg-muted)]"} ${railed && open ? `${ACTIVE_BG} text-[var(--paper)]` : ""}`}
                  >
                    <Icon {...ICON} className="mt-px flex-none" />
                    {railed ? null : (
                      <>
                        <span className="text-[13.5px] leading-[1.38] font-semibold text-[var(--paper)] decoration-[var(--accent)] decoration-[1.5px] underline-offset-[3px] group-hover/link:underline">{name}</span>
                        <span className={`${COUNT} pt-0.5`}>{pages}</span>
                      </>
                    )}
                  </Link>
                  {railed ? null : (
                    <button
                      type="button"
                      data-testid={`group-toggle-${id}`}
                      aria-expanded={open}
                      aria-controls={panelId(id)}
                      aria-label={message(messages, open ? "common.groupToggleClose" : "common.groupToggleOpen", { name })}
                      onClick={() => dispatch({ type: "toggleGroup", id })}
                      className="flex w-9 flex-none cursor-pointer items-start justify-center pt-[11px] text-[var(--ink-fg-faint)] hover:text-[var(--paper)] max-[900px]:w-12 max-[900px]:pt-[13px]"
                    >
                      <ChevronRight aria-hidden="true" size={16} strokeWidth={1.5} className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
                    </button>
                  )}
                </div>
                {open ? (
                  <div
                    id={panelId(id)}
                    data-testid={`group-panel-${id}`}
                    className={railed
                      // Fixed to the viewport beside the rail, so the rail can scroll on a short screen without clipping it.
                      ? "fixed top-0 bottom-0 left-[72px] z-40 w-[320px] overflow-y-auto border-l border-[var(--ink-line)] bg-[var(--ink)] px-[22px] pt-[22px] pb-6 shadow-[14px_0_36px_rgba(30,27,22,0.16)]"
                      : "pr-1.5 pb-3 pl-[38px]"}
                  >
                    {railed ? (
                      <p className="mb-2 border-b border-[var(--ink-line)] pb-3 font-[family-name:var(--font-display)] text-xl leading-[1.3] font-semibold text-[var(--paper)]">
                        <Link href={pageHref(href, locale)} prefetch={false} className="no-underline decoration-[var(--accent)] underline-offset-4 hover:underline">{name}</Link>
                        <span className="mt-1 block font-[family-name:var(--font-numeric)] text-[11px] font-normal text-[var(--ink-fg-faint)]">
                          {topics.length > 1 ? `${message(messages, "common.topicsCount", { n: topics.length })} · ` : ""}{pagesLabel(messages, pages)}
                        </span>
                      </p>
                    ) : null}
                    {topics.map((topic) => (
                      <div key={topic}>
                        {topics.length > 1 ? <p className={`${railed ? "mt-4" : "mt-2.5"} mb-1 text-[11px] leading-[1.35] font-semibold text-[var(--ink-fg-faint)]`}>{message(messages, `common.topic.${topic}`)}</p> : null}
                        <ul className="list-none border-l border-[var(--ink-line)]">
                          {topicHub(topic).sections.map((section) => (
                            <li key={section.href}>
                              <SidebarSectionLink
                                href={pageHref(section.href, locale)}
                                testId={section.testId}
                                label={message(messages, section.labelKey)}
                                active={current === section.href}
                                current={page === section.href}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className={`mt-auto flex flex-wrap items-center gap-x-3.5 gap-y-2.5 text-xs text-[var(--ink-fg-muted)] ${railed ? "justify-center pt-3.5" : "px-1.5 pt-[18px]"}`}>
          <div className="max-[900px]:[&_a]:min-h-11"><LanguageSwitch compact={railed} /></div>
          {railed ? null : (
            <span className="flex items-center gap-1.5">
              {/* Reload across the Explorer/public layout boundary, as the brand link does. */}
              <a href={pageHref("/methodology", locale)} className="inline-flex min-h-6 items-center no-underline hover:text-[var(--paper)] max-[900px]:min-h-11">{message(messages, "common.methodology")}</a>
              <span aria-hidden="true">·</span>
              <a href={pageHref("/connect", locale)} className="inline-flex min-h-6 items-center no-underline hover:text-[var(--paper)] max-[900px]:min-h-11">{message(messages, "common.aiConnection")}</a>
            </span>
          )}
        </div>
      </nav>
    </>
  );
}

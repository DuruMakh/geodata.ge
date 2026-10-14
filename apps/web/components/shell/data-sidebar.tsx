"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsLeft, ChevronsRight, House, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SectionNav, SidebarSectionLink } from "./section-nav";
import { LanguageSwitch } from "../site/language-switch";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref, splitLanguagePath } from "../../lib/i18n/routes";
import { BUDGET_HUB_PATH, NAV_TREE, currentEntry, openHub } from "../../lib/navigation/navTree";

// Platform sidebar (DESIGN.md §6.7). Two desktop states — 232px expanded and a
// 52px reading rail — plus a top bar with a sheet below 900px. Fiscal.ge is a data
// platform whose first dataset is the budget.

const STORAGE_KEY = "geodata:sidebar-collapsed";
const DESKTOP_MIN_WIDTH = 900;
const MOBILE_NAV_ID = "data-sidebar-navigation";

export function DataSidebar() {
  const { locale, messages } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Unknown until mounted: the server cannot see the width, and the toggle's state and
  // label differ by it (the rail on desktop, the closed sheet on a phone).
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [animateWidth, setAnimateWidth] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  // The navigation tree's addresses carry no language prefix.
  const page = splitLanguagePath(pathname).pathname;
  const activeHub = openHub(page);
  const current = currentEntry(page);

  // Read after mount: the server render cannot see localStorage, and guessing
  // would flash the wrong width on every load.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Storage access denials (blocked cookies, sandboxed iframes) must not
      // break the render — default to expanded.
    }
  }, []);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const sync = () => {
      setIsDesktop(query.matches);
      // A sheet opened below 900px must not survive into the desktop rail —
      // otherwise a stray Escape keypress anywhere on the page steals focus.
      if (query.matches) setSheetOpen(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // The explorer layout persists across section routes, so navigating never
  // unmounts the sheet. Close it on arrival or the user lands on the nav list
  // they just used — and a phone has no Escape key to undo that.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSheetOpen(false);
      // Escape usually arrives with focus on a link inside the sheet, which is
      // about to become display:none — hand focus back rather than drop it.
      toggleRef.current?.focus();
    };
    // The open panel now covers the page, so a tap on the page below it closes it.
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !asideRef.current?.contains(event.target)) setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [sheetOpen]);

  // Collapse is a desktop posture. A preference set on a laptop must not follow
  // the user to a phone, where it would render as a mystery-narrow rail.
  const railed = collapsed && isDesktop === true;
  // One control, two jobs, so "expanded" means different things by width: the
  // rail on desktop, the sheet on mobile. The label, the glyph and aria-expanded
  // must all describe whichever one the next click will change. Before the width
  // is known the toggle states nothing: a neutral "Menu" and no aria-expanded.
  const navVisible = isDesktop === null ? undefined : isDesktop ? !railed : sheetOpen;

  function handleToggle() {
    if (!isDesktop) {
      setSheetOpen((open) => !open);
      return;
    }
    // Arm the width transition on the first click, not on mount: a browser
    // starts a transition whenever the transition property and the width land in
    // the same style change, so a mount-time class would animate the restored
    // rail on every cold load (DESIGN.md §14: nothing animates on load).
    setAnimateWidth(true);
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Private-mode storage denials must not break the toggle itself.
    }
  }

  return (
    <aside
      aria-label={message(messages, "common.dataPanel")}
      data-testid="data-sidebar"
      data-collapsed={railed ? "true" : "false"}
      ref={asideRef}
      className={`sticky top-0 z-30 flex w-full flex-none flex-col bg-[var(--ink)] px-4 pt-[max(6px,env(safe-area-inset-top))] pb-1.5 min-[900px]:h-screen min-[900px]:pt-[18px] min-[900px]:pb-4 ${
        animateWidth ? "transition-[width] duration-150 ease-in-out" : ""
      } ${railed ? "min-[900px]:w-[52px] min-[900px]:px-3" : "min-[900px]:w-[232px]"}`}
    >
      <div className="flex items-center justify-between gap-2.5">
        {railed ? null : (
          // Reload across the Explorer/public layout boundary so stale route metadata cannot remain in <head>.
          <a
            href={pageHref("/", locale)}
            aria-label={message(messages, "common.brandHome")}
            className="flex min-w-0 items-center gap-2.5 no-underline max-[900px]:min-h-11"
          >
            {/* Local SVG brand asset; native img avoids adding a raster optimization path. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-testid="sidebar-brand-mark"
              src="/brand/fiscal-logo-mark-reversed.svg"
              width="520"
              height="650"
              alt=""
              className="h-auto w-[30px] flex-none"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--paper)]">
                Fiscal.ge
              </span>
              <span className="font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[8.5px] tracking-[0.1em] text-[var(--ink-fg-faint)]">
                {message(messages, "common.openData")}
              </span>
            </span>
          </a>
        )}
        <button
          ref={toggleRef}
          type="button"
          data-testid="sidebar-toggle"
          aria-expanded={navVisible}
          aria-controls={isDesktop === false ? MOBILE_NAV_ID : undefined}
          aria-label={message(messages, isDesktop ? (navVisible ? "common.collapsePanel" : "common.expandPanel") : "common.menu")}
          onClick={handleToggle}
          className="-mr-2 flex size-11 flex-none cursor-pointer items-center justify-center rounded-[3px] font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink-fg-muted)] hover:text-[var(--paper)] min-[900px]:mr-0 min-[900px]:size-[26px] min-[900px]:border min-[900px]:border-[rgba(247,242,233,0.18)]"
        >
          {/* Below 900px this is the site-wide ☰ menu (the landing header uses the
              same Menu/X pair); the chevrons belong to the desktop collapse only.
              CSS picks the glyph so the first paint is right before hydration. */}
          {sheetOpen ? <X aria-hidden="true" size={22} strokeWidth={1.5} className="min-[900px]:hidden" /> : <Menu aria-hidden="true" size={22} strokeWidth={1.5} className="min-[900px]:hidden" />}
          {railed ? <ChevronsRight aria-hidden="true" size={18} strokeWidth={1.5} className="hidden min-[900px]:block" /> : <ChevronsLeft aria-hidden="true" size={18} strokeWidth={1.5} className="hidden min-[900px]:block" />}
        </button>
      </div>

      {railed ? (
        <>
          <p
            className="mt-6 flex-1 font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9.5px] tracking-[0.1em] text-[var(--ink-fg-faint)]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {message(messages, activeHub.railLabelKey)}
          </p>
          <div className="self-center text-[var(--ink-fg-muted)]"><LanguageSwitch compact /></div>
          <Link
            href={pageHref("/", locale)}
            prefetch={false}
            aria-label={message(messages, "common.home")}
            title={message(messages, "common.home")}
            className="mt-auto flex size-[26px] items-center justify-center self-center text-[var(--ink-fg-muted)] no-underline hover:text-[var(--paper)]"
          >
            <House aria-hidden="true" size={18} strokeWidth={1.5} />
          </Link>
        </>
      ) : (
        // Below 900px the bar is pinned, so the open panel hangs from it over the
        // page and scrolls on its own: an in-flow panel inside a pinned bar would
        // grow the document above the reader's position and jump the page. From
        // 900px the expanded panel scrolls inside the full-height bar when its links overflow; its 4px inner
        // padding keeps the 2px focus ring (offset 2px) from being clipped by the scroll box.
        <div
          id={MOBILE_NAV_ID}
          className={`${sheetOpen ? "flex" : "hidden min-[900px]:flex"} flex-1 flex-col max-[900px]:absolute max-[900px]:inset-x-0 max-[900px]:top-full max-[900px]:max-h-[calc(100dvh-56px-env(safe-area-inset-top))] max-[900px]:overflow-y-auto max-[900px]:overscroll-contain max-[900px]:border-b max-[900px]:border-[rgba(247,242,233,0.12)] max-[900px]:bg-[var(--ink)] max-[900px]:px-4 max-[900px]:pb-4 min-[900px]:flex-col min-[900px]:min-h-0 min-[900px]:overflow-y-auto min-[900px]:-mx-1 min-[900px]:px-1 min-[900px]:pb-1`}
        >
          <div aria-hidden className="mt-4 mb-3.5 h-px bg-[rgba(247,242,233,0.12)] max-[900px]:mt-0" />
          <p className="mb-3 font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9.5px] tracking-[0.12em] text-[var(--ink-fg-faint)]">
            {message(messages, "common.dataSection")}
          </p>
          {/* Every link closes the sheet here, the current page's included: the pathname effect above never fires for it. */}
          <nav aria-label={message(messages, "common.datasets")} className="flex flex-col gap-0.5" onClick={(event) => { if ((event.target as Element).closest("a")) setSheetOpen(false); }}>
            {/* Each hub is a list item and its pages a nested list (U02-09); the list boxes carry the gaps the rows had as siblings. */}
            <ul className="flex list-none flex-col gap-0.5">
              {NAV_TREE.map((hub) => {
                const open = hub === activeHub;
                return (
                  <li key={hub.href} className={`${hub.spaced ? "mt-2 max-[900px]:mt-0 " : ""}flex flex-col gap-0.5`}>
                    <Link
                      href={pageHref(hub.href, locale)}
                      prefetch={false}
                      data-testid={hub.testId}
                      aria-current={current === hub.href ? "page" : undefined}
                      className={`flex items-baseline gap-2 border-l-2 max-[900px]:min-h-11 max-[900px]:items-center px-2.5 py-2 text-[12.5px] font-semibold no-underline ${open ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}
                    >
                      {message(messages, hub.labelKey)}
                    </Link>
                    {/* Budget's sections render as SectionNav's list, with its coming-soon rows. */}
                    {open && hub.href === BUDGET_HUB_PATH ? <SectionNav /> : null}
                    {open && hub.href !== BUDGET_HUB_PATH ? (
                      <ul className="flex list-none flex-col gap-0.5 pl-[18px]">
                        {hub.sections.map((section) => (
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
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-auto border-t border-[rgba(247,242,233,0.12)] pt-3">
            <div className="mb-2 text-[var(--ink-fg-muted)] max-[900px]:mb-0 max-[900px]:[&_a]:min-h-11"><LanguageSwitch /></div>
            <Link href={pageHref("/", locale)} prefetch={false} data-testid="sidebar-back-home" className="text-[11.5px] font-medium text-[var(--ink-fg-muted)] no-underline hover:text-[var(--paper)] max-[900px]:flex max-[900px]:min-h-11 max-[900px]:w-full max-[900px]:items-center max-[900px]:px-2.5 max-[900px]:text-[12.5px]">
              {message(messages, "common.backHome")}
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}

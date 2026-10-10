"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsLeft, ChevronsRight, House, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComingSoonBadge } from "../ui/coming-soon-badge";
import { SectionNav } from "./section-nav";
import { LanguageSwitch } from "../site/language-switch";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { UNEMPLOYMENT_SECTIONS } from "../../lib/explorer/unemploymentSections";
import { DEMOGRAPHY_HUB_PATH, LIVE_DEMOGRAPHY_PAGES } from "../../lib/explorer/demographyRoutes";

// Platform sidebar (DESIGN.md §6.7). Two desktop states — 232px expanded and a
// 52px reading rail — plus a top bar with a sheet below 900px. Fiscal.ge is a data
// platform whose first dataset is the budget; teaser rows are markers only.

// Keys of `common.{key}` labels for datasets not live yet; none today, so no teaser list renders.
const TEASERS: readonly string[] = [];
const STORAGE_KEY = "geodata:sidebar-collapsed";
const DESKTOP_MIN_WIDTH = 900;
const MOBILE_NAV_ID = "data-sidebar-navigation";

export function DataSidebar() {
  const { locale, messages } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [animateWidth, setAnimateWidth] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const economyActive = pathname.includes("/explorer/economy");
  const inflationActive = pathname.includes("/explorer/inflation");
  const unemploymentActive = pathname.includes("/explorer/unemployment");
  const tradeActive = pathname.includes("/explorer/trade");
  const tradeOverviewActive = pathname.endsWith("/explorer/trade/overview");
  const tradePartnersActive = pathname.endsWith("/explorer/trade/partners");
  const externalActive = pathname.includes("/explorer/external");
  const moneyFromAbroadActive = pathname.endsWith("/explorer/external/money-from-abroad");
  const foreignInvestmentActive = pathname.endsWith("/explorer/external/foreign-investment");
  const tradeProductsActive = pathname.endsWith("/explorer/trade/products");
  const demographyActive = pathname.includes("/explorer/demography");
  const budgetActive = !economyActive && !inflationActive && !unemploymentActive && !tradeActive && !externalActive && !demographyActive;
  const gdpActive = pathname.endsWith("/explorer/economy/gdp");
  const sectorsActive = pathname.endsWith("/explorer/economy/sectors");
  const regionsActive = pathname.includes("/explorer/economy/regions");
  const inflationOverviewActive = pathname.endsWith("/explorer/inflation/overview");
  const inflationCategoriesActive = pathname.endsWith("/explorer/inflation/categories");
  const inflationProductsActive = pathname.endsWith("/explorer/inflation/products");
  const inflationCitiesActive = pathname.includes("/explorer/inflation/cities");

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
  const railed = collapsed && isDesktop;
  // One control, two jobs, so "expanded" means different things by width: the
  // rail on desktop, the sheet on mobile. The label, the glyph and aria-expanded
  // must all describe whichever one the next click will change.
  const navVisible = isDesktop ? !railed : sheetOpen;

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
            className="flex min-w-0 items-center gap-2.5 no-underline"
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
          aria-controls={!isDesktop ? MOBILE_NAV_ID : undefined}
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
            {message(messages, tradeActive ? "common.dataTrade" : externalActive ? "common.dataExternal" : demographyActive ? "common.dataDemography" : unemploymentActive ? "common.dataUnemployment" : inflationActive ? "common.dataInflation" : economyActive ? "common.dataEconomy" : "common.dataBudget")}
          </p>
          <div className="self-center text-[var(--ink-fg-muted)]"><LanguageSwitch compact /></div>
          <Link
            href={pageHref("/", locale)}
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
        // grow the document above the reader's position and jump the page.
        <div
          id={MOBILE_NAV_ID}
          className={`${sheetOpen ? "flex" : "hidden min-[900px]:flex"} flex-1 flex-col max-[900px]:absolute max-[900px]:inset-x-0 max-[900px]:top-full max-[900px]:max-h-[calc(100dvh-56px-env(safe-area-inset-top))] max-[900px]:overflow-y-auto max-[900px]:overscroll-contain max-[900px]:border-b max-[900px]:border-[rgba(247,242,233,0.12)] max-[900px]:bg-[var(--ink)] max-[900px]:px-4 max-[900px]:pb-4 min-[900px]:flex-col`}
        >
          <div aria-hidden className="mt-4 mb-3.5 h-px bg-[rgba(247,242,233,0.12)] max-[900px]:mt-0" />
          <p className="mb-3 font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[9.5px] tracking-[0.12em] text-[var(--ink-fg-faint)]">
            {message(messages, "common.dataSection")}
          </p>
          <nav aria-label={message(messages, "common.datasets")} className="flex flex-col gap-0.5">
            <Link href={pageHref("/explorer",locale)} className={`flex items-baseline gap-2 border-l-2 max-[900px]:min-h-11 max-[900px]:items-center px-2.5 py-2 text-[12.5px] font-semibold no-underline ${budgetActive ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}>
              {message(messages, "common.budget")}
            </Link>
            {budgetActive ? <SectionNav /> : null}
            <Link href={pageHref("/explorer/economy",locale)} data-testid="economy-link" aria-current={pathname.endsWith('/economy')?'page':undefined} className={`flex items-baseline gap-2 border-l-2 max-[900px]:min-h-11 max-[900px]:items-center px-2.5 py-2 text-[12.5px] font-semibold no-underline ${economyActive ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}>
              {message(messages,"common.economy")}
            </Link>
            {economyActive ? (
              <Link
                href={pageHref("/explorer/economy/gdp", locale)}
                aria-current={gdpActive ? "page" : undefined}
                className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${gdpActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}
              >
                <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${gdpActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                {message(messages, "common.gdpOverview")}
              </Link>
            ) : null}
            {economyActive ? (
              <Link
                href={pageHref("/explorer/economy/sectors", locale)}
                aria-current={sectorsActive ? "page" : undefined}
                className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${sectorsActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}
              >
                <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${sectorsActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                {message(messages, "common.economicSectors")}
              </Link>
            ) : null}
            {economyActive ? (
              <Link
                href={pageHref("/explorer/economy/regions", locale)}
                aria-current={regionsActive ? "page" : undefined}
                className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${regionsActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}
              >
                <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${regionsActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                {message(messages, "common.regionalEconomies")}
              </Link>
            ) : null}
            <Link
              href={pageHref("/explorer/inflation", locale)}
              data-testid="inflation-link"
              aria-current={pathname.endsWith("/explorer/inflation") ? "page" : undefined}
              className={`flex items-baseline gap-2 border-l-2 max-[900px]:min-h-11 max-[900px]:items-center px-2.5 py-2 text-[12.5px] font-semibold no-underline ${inflationActive ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}
            >
              {message(messages, "common.inflation")}
            </Link>
            {inflationActive ? (
              <Link
                href={pageHref("/explorer/inflation/overview", locale)}
                data-testid="inflation-overview-link"
                aria-current={inflationOverviewActive ? "page" : undefined}
                className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${inflationOverviewActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}
              >
                <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${inflationOverviewActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                {message(messages, "common.inflationOverview")}
              </Link>
            ) : null}
            {inflationActive ? (
              <Link
                href={pageHref("/explorer/inflation/categories", locale)}
                data-testid="inflation-categories-link"
                aria-current={inflationCategoriesActive ? "page" : undefined}
                className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${inflationCategoriesActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}
              >
                <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${inflationCategoriesActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                {message(messages, "common.inflationCategories")}
              </Link>
            ) : null}
            {inflationActive ? (
              <Link
                href={pageHref("/explorer/inflation/products", locale)}
                data-testid="inflation-products-link"
                aria-current={inflationProductsActive ? "page" : undefined}
                className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${inflationProductsActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}
              >
                <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${inflationProductsActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                {message(messages, "common.inflationProducts")}
              </Link>
            ) : null}
            {inflationActive ? (
              <Link
                href={pageHref("/explorer/inflation/cities", locale)}
                data-testid="inflation-cities-link"
                aria-current={inflationCitiesActive ? "page" : undefined}
                className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${inflationCitiesActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}
              >
                <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${inflationCitiesActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                {message(messages, "common.inflationCities")}
              </Link>
            ) : null}

            <Link href={pageHref("/explorer/unemployment", locale)} data-testid="unemployment-link" aria-current={pathname.endsWith("/explorer/unemployment") ? "page" : undefined}
              className={`mt-2 flex items-baseline gap-2 max-[900px]:mt-0 border-l-2 max-[900px]:min-h-11 max-[900px]:items-center px-2.5 py-2 text-[12.5px] font-semibold no-underline ${unemploymentActive ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}>
              {message(messages, "common.unemployment")}
            </Link>
            {unemploymentActive ? UNEMPLOYMENT_SECTIONS.map(section => {
              const active = pathname.endsWith(section.href) || section.id === "regions" && pathname.includes(`${section.href}/`);
              return <Link key={section.id} href={pageHref(section.href, locale)} data-testid={`unemployment-${section.id}-link`} aria-current={active ? "page" : undefined}
                className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${active ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}>
                <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${active ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                {message(messages, section.labelKey)}
              </Link>;
            }) : null}
            <Link href={pageHref("/explorer/trade", locale)} data-testid="trade-link" aria-current={pathname.endsWith("/explorer/trade") ? "page" : undefined}
              className={`mt-2 flex items-baseline gap-2 max-[900px]:mt-0 border-l-2 max-[900px]:min-h-11 max-[900px]:items-center px-2.5 py-2 text-[12.5px] font-semibold no-underline ${tradeActive ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}>
              {message(messages, "common.trade")}
            </Link>
            {tradeActive ? <Link href={pageHref("/explorer/trade/overview", locale)} data-testid="trade-overview-link" aria-current={tradeOverviewActive ? "page" : undefined}
              onNavigate={(event) => {
                if (tradeOverviewActive) event.preventDefault();
                setSheetOpen(false);
              }}
              className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${tradeOverviewActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}>
              <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${tradeOverviewActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
              {message(messages, "common.tradeOverview")}
            </Link> : null}
            {tradeActive ? <Link href={pageHref("/explorer/trade/partners", locale)} data-testid="trade-partners-link" aria-current={tradePartnersActive ? "page" : undefined}
              onNavigate={(event) => {
                if (tradePartnersActive) event.preventDefault();
                setSheetOpen(false);
              }}
              className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${tradePartnersActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}>
              <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${tradePartnersActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
              {message(messages, "common.tradePartners")}
            </Link> : null}
            {tradeActive ? <Link href={pageHref("/explorer/trade/products", locale)} data-testid="trade-products-link" aria-current={tradeProductsActive ? "page" : undefined}
              onNavigate={(event) => {
                if (tradeProductsActive) event.preventDefault();
                setSheetOpen(false);
              }}
              className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${tradeProductsActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}>
              <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${tradeProductsActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
              {message(messages, "common.tradeProducts")}
            </Link> : null}
            <Link href={pageHref("/explorer/external", locale)} data-testid="external-link" aria-current={pathname.endsWith("/explorer/external") ? "page" : undefined}
              className={`mt-2 flex items-baseline gap-2 max-[900px]:mt-0 border-l-2 max-[900px]:min-h-11 max-[900px]:items-center px-2.5 py-2 text-[12.5px] font-semibold no-underline ${externalActive ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}>
              {message(messages, "common.external")}
            </Link>
            {externalActive ? <Link href={pageHref("/explorer/external/money-from-abroad", locale)} data-testid="money-from-abroad-link" aria-current={moneyFromAbroadActive ? "page" : undefined}
              onNavigate={(event) => {
                if (moneyFromAbroadActive) event.preventDefault();
                setSheetOpen(false);
              }}
              className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${moneyFromAbroadActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}>
              <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${moneyFromAbroadActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
              {message(messages, "common.moneyFromAbroad")}
            </Link> : null}
            {externalActive ? <Link href={pageHref("/explorer/external/foreign-investment", locale)} data-testid="foreign-investment-link" aria-current={foreignInvestmentActive ? "page" : undefined}
              onNavigate={(event) => {
                if (foreignInvestmentActive) event.preventDefault();
                setSheetOpen(false);
              }}
              className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${foreignInvestmentActive ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}>
              <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${foreignInvestmentActive ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
              {message(messages, "common.foreignInvestment")}
            </Link> : null}
            <Link
              href={pageHref(DEMOGRAPHY_HUB_PATH, locale)}
              data-testid="demography-link"
              aria-current={pathname.endsWith(DEMOGRAPHY_HUB_PATH) ? "page" : undefined}
              className={`mt-2 flex items-baseline gap-2 max-[900px]:mt-0 border-l-2 max-[900px]:min-h-11 max-[900px]:items-center px-2.5 py-2 text-[12.5px] font-semibold no-underline ${demographyActive ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}
            >
              {message(messages, "common.demography")}
            </Link>
            {demographyActive
              ? LIVE_DEMOGRAPHY_PAGES.map((page) => {
                  // `includes`, as for Regions and Cities: a page's own place pages sit under its path.
                  const active = pathname.includes(page.path);
                  return (
                    <Link
                      key={page.id}
                      href={pageHref(page.path, locale)}
                      data-testid={`demography-${page.id}-link`}
                      aria-current={active ? "page" : undefined}
                      className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 max-[900px]:min-h-11 max-[900px]:items-center text-[12px] no-underline transition-colors duration-150 ${active ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}
                    >
                      <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${active ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                      {message(messages, page.labelKey)}
                    </Link>
                  );
                })
              : null}
            {/* No aria-disabled on the rows: the listitem role ignores it (jsx-a11y
                flags it), and the ComingSoonBadge text already reads out. */}
            {TEASERS.length > 0 ? (
            <ul className="mt-2 flex list-none flex-col gap-0.5 max-[900px]:mt-0">
              {TEASERS.map((label) => (
                // Reduced emphasis: a marker must not read as a live dataset row.
                <li
                  key={label}
                  data-testid={`teaser-${label}`}
                  className="flex items-baseline gap-2 border-l-2 max-[900px]:min-h-11 max-[900px]:items-center border-transparent px-2.5 py-2 text-[12.5px] font-medium text-[var(--ink-fg-muted)] opacity-60"
                >
                  <span className="min-w-0 flex-1 truncate">{message(messages, `common.${label}`)}</span>
                  <ComingSoonBadge />
                </li>
              ))}
            </ul>
            ) : null}
          </nav>
          <div className="mt-auto border-t border-[rgba(247,242,233,0.12)] pt-3">
            <div className="mb-2 text-[var(--ink-fg-muted)] max-[900px]:mb-0 max-[900px]:[&_a]:min-h-11"><LanguageSwitch /></div>
            <Link href={pageHref("/", locale)} data-testid="sidebar-back-home" className="text-[11.5px] font-medium text-[var(--ink-fg-muted)] no-underline hover:text-[var(--paper)] max-[900px]:flex max-[900px]:min-h-11 max-[900px]:w-full max-[900px]:items-center max-[900px]:px-2.5 max-[900px]:text-[12.5px]">
              {message(messages, "common.backHome")}
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}

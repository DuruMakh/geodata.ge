"use client";

import { useEffect, useRef, type SyntheticEvent } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { LANGUAGE_NAMES, pageHref, switchLanguageHref } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";

export function LanguageSwitch({ compact = false, abbreviatedOnMobile = false }: { compact?: boolean; abbreviatedOnMobile?: boolean }) {
  const { locale, messages } = useI18n();
  const pathname = usePathname();
  const target: Locale = locale === "ka" ? "en" : "ka";
  const linkRef = useRef<HTMLAnchorElement>(null);

  function refreshHref(event: SyntheticEvent<HTMLAnchorElement>) {
    event.currentTarget.setAttribute("href", switchLanguageHref(window.location, target));
  }

  useEffect(() => {
    const refresh = () => linkRef.current?.setAttribute("href", switchLanguageHref(window.location, target));
    refresh();
    window.addEventListener("hashchange", refresh);
    return () => window.removeEventListener("hashchange", refresh);
  }, [pathname, target]);

  // The abbreviation is followed by the full name, visually hidden: the link's name starts with what it
  // shows, so a voice-control user can say "KA" (WCAG 2.5.3), and a screen reader still hears "ქართული".
  const abbreviation = (language: Locale) => <>{language.toUpperCase()}<span className="sr-only"> {LANGUAGE_NAMES[language]}</span></>;

  function displayLabel(language: Locale) {
    return abbreviatedOnMobile ? (
      <>
        <span className="min-[900px]:hidden">{abbreviation(language)}</span>
        <span className="hidden min-[900px]:inline">{LANGUAGE_NAMES[language]}</span>
      </>
    ) : LANGUAGE_NAMES[language];
  }

  // No aria-label: the link is named by its own text, "EN English" on a phone or in the rail and "English" from 900px.
  const otherLanguage = (
    <a
      ref={linkRef}
      href={pageHref(pathname, target)}
      lang={target}
      hrefLang={target}
      onFocus={refreshHref}
      onPointerDown={refreshHref}
      onContextMenu={refreshHref}
      onClick={refreshHref}
      className="inline-flex min-h-8 items-center px-1 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {compact ? abbreviation(target) : displayLabel(target)}
    </a>
  );

  return (
    <div data-testid="language-switch" role="group" aria-label={message(messages, "common.language")} className={`inline-flex items-center gap-1 font-[family-name:var(--font-ui)] text-[11px] ${abbreviatedOnMobile ? "[&_a]:min-h-11 [&_a]:min-w-11 [&_a]:justify-center min-[900px]:[&_a]:min-h-8 min-[900px]:[&_a]:min-w-0" : ""}`}>
      {compact ? otherLanguage : (
        <>
          {locale === "ka" ? <span lang="ka" aria-current="true" className="px-1 font-semibold">{displayLabel("ka")}</span> : otherLanguage}
          <span aria-hidden="true" className="opacity-60">/</span>
          {locale === "en" ? <span lang="en" aria-current="true" className="px-1 font-semibold">{displayLabel("en")}</span> : otherLanguage}
        </>
      )}
    </div>
  );
}

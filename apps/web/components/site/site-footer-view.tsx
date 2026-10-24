import Link from "next/link";
import { message } from "../../lib/i18n/messages";
import { LANGUAGE_NAMES, pageHref } from "../../lib/i18n/routes";
import type { Locale, Messages } from "../../lib/i18n/types";
import { DATASET_HUBS } from "../../lib/navigation/datasetHubs";

// Every dataset hub, then the site's own pages (owner decision D3, 2026-10-07; all hubs since Q3, 2026-10-12).
const FOOTER_LINKS = [
  ...DATASET_HUBS,
  { href: "/methodology", labelKey: "common.methodology" },
  { href: "/connect", labelKey: "common.aiConnection" },
  { href: "/about", labelKey: "common.about" },
] as const;

// The larger footer of the homepage and the site's own pages: the mission, the data list and the platform list.
const PLATFORM_LINKS = FOOTER_LINKS.slice(DATASET_HUBS.length);
const SITE_LINK_CLASS = "flex min-h-11 items-center text-[0.8125rem] text-[var(--body)] hover:text-[var(--accent)] min-[768px]:inline-flex min-[768px]:min-h-[30px]";

// The markup, with the common catalogue handed in. It is split from the
// lookup below because the explorer footer is a client component: importing
// common.server.ts from here put BOTH locales' catalogue in every explorer
// route's client bundle.
// `year` is the build's: the explorer footer is a client component, so its server layout passes it in rather than each
// browser reading its own clock and disagreeing with the prerendered HTML.
// `variant="site"` is the larger footer; leaving it out gives the explorer's, which is unchanged. The site footer needs
// `path`, the page it sits on, so its language link leads to the same page in the other language.
export type FooterVariantProps = { variant?: "compact"; path?: never } | { variant: "site"; path: `/${string}` };

export function SiteFooterView({ updatedAt, locale = "ka", sourceNote, messages, year, variant, path }: { updatedAt?: string; locale?: Locale; sourceNote?: string; messages: Messages; year: number } & FooterVariantProps) {
  const [sourcePrefix, sourceSuffix] = (sourceNote ?? messages["common.sourceNote"]).split("{updatedAt}");
  const sourceText = (
    <>
      {sourcePrefix}{sourceSuffix !== undefined && <span className="font-[family-name:var(--font-numeric)]">{updatedAt}</span>}{sourceSuffix}{" "}
      {message(messages, "common.footerLicence")}
    </>
  );
  if (variant === "site") {
    const otherLocale: Locale = locale === "ka" ? "en" : "ka";
    return (
      <footer data-testid="site-footer" className="mt-16 border-t-2 border-[var(--ink)] pb-8 pt-7 min-[768px]:mt-28 min-[768px]:pb-10">
        <div data-testid="landing-footer" className="grid grid-cols-1 gap-9 min-[1000px]:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,2fr)] min-[1000px]:gap-12">
          <div>
            <Link href={pageHref("/", locale)} prefetch={false} aria-label={message(messages, "common.brandHome")} className="block w-[220px]">
              {/* Local SVG brand asset, lazy like the compact footer's. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-testid="site-footer-logo"
                src={locale === "en" ? "/brand/fiscal-logo-compact-en.svg" : "/brand/fiscal-logo-compact.svg"}
                width="1080"
                height="340"
                loading="lazy"
                alt=""
                className="block h-auto w-full"
              />
            </Link>
            <p className="mt-4 max-w-[42ch] font-[family-name:var(--font-display)] text-[1.0625rem] leading-normal text-[var(--ink)]">{message(messages, "common.footerMission")}</p>
            <a
              href="mailto:info@fiscal.ge"
              className="mt-2 inline-flex min-h-11 items-center font-[family-name:var(--font-numeric)] text-[0.8125rem] text-[var(--ink)] underline decoration-[var(--accent)] underline-offset-4"
            >
              info@fiscal.ge
            </a>
          </div>
          <nav aria-label={message(messages, "common.footerData")}>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{message(messages, "common.footerData")}</div>
            <ul className="mt-3 grid list-none grid-cols-2 gap-x-6">
              {DATASET_HUBS.map(({ href, labelKey }) => (
                <li key={href}>
                  <Link href={pageHref(href, locale)} prefetch={false} className={SITE_LINK_CLASS}>
                    {message(messages, labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={message(messages, "common.footerPlatform")}>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{message(messages, "common.footerPlatform")}</div>
            <ul className="mt-3 grid list-none grid-cols-2 gap-x-6 min-[1000px]:grid-cols-1">
              {PLATFORM_LINKS.map(({ href, labelKey }) => (
                <li key={href}>
                  <Link href={pageHref(href, locale)} prefetch={false} className={SITE_LINK_CLASS}>
                    {message(messages, labelKey)}
                  </Link>
                </li>
              ))}
              <li>
                <a data-testid="footer-language-link" href={pageHref(path, otherLocale)} lang={otherLocale} hrefLang={otherLocale} className={SITE_LINK_CLASS}>
                  {LANGUAGE_NAMES[otherLocale]}
                </a>
              </li>
            </ul>
          </nav>
          <div className="flex flex-wrap justify-between gap-x-8 gap-y-3 border-t border-[var(--hairline-soft)] pt-4 text-[0.75rem] leading-relaxed text-[var(--muted)] min-[1000px]:col-span-full">
            <p className="max-w-[80ch] text-pretty">{sourceText}</p>
            <p className="font-[family-name:var(--font-numeric)]">© {year} Fiscal.ge · CC BY 4.0</p>
          </div>
        </div>
      </footer>
    );
  }
  return (
    <footer data-testid="site-footer" className="mt-10 border-t-2 border-[var(--ink)] pb-5 pt-5 min-[768px]:mt-[72px] min-[768px]:pb-10 min-[768px]:pt-[26px]">
      <div data-testid="landing-footer">
        <div className="flex flex-col gap-4 min-[768px]:grid min-[768px]:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] min-[768px]:gap-9">
          {/* Phones: lockup and address share one row. */}
          <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 min-[768px]:flex min-[768px]:flex-col min-[768px]:items-stretch min-[768px]:gap-2.5">
            <Link href={pageHref("/", locale)} prefetch={false} aria-label={message(messages, "common.brandHome")} className="block w-[150px]">
              {/* Local SVG brand asset; native img avoids adding a raster optimization path. Lazy, so React does not
                  preload this below-the-fold logo ahead of the header logo and the hero. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-testid="site-footer-logo"
                src={locale === "en" ? "/brand/fiscal-logo-compact-en.svg" : "/brand/fiscal-logo-compact.svg"}
                width="1080"
                height="340"
                loading="lazy"
                alt=""
                className="block h-auto w-full"
              />
            </Link>
            <a
              href="mailto:info@fiscal.ge"
              className="max-[768px]:col-start-2 max-[768px]:row-start-1 max-[768px]:inline-flex max-[768px]:min-h-11 max-[768px]:items-center max-[768px]:justify-self-end font-[family-name:var(--font-numeric)] text-[0.6875rem] text-[var(--accent)] underline underline-offset-[3px] min-[768px]:self-start"
            >
              info@fiscal.ge
            </a>
          </div>
          <div className="flex flex-col gap-[9px]">
            <span className="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] min-[768px]:block">{message(messages, "common.navigation")}</span>
            {/* Below 768px a two-column grid of 44px rows replaces the long list of 24px links. */}
            <ul className="grid list-none grid-cols-2 gap-x-4 min-[768px]:flex min-[768px]:flex-col min-[768px]:gap-[9px]">
              {FOOTER_LINKS.map(({ href, labelKey }) => (
                <li key={href}>
                  <Link href={pageHref(href, locale)} prefetch={false} className="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0">
                    {message(messages, labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {/* One fine-print paragraph. The source sentence already opens with
              "მონაცემები:", so the old "მონაცემები" heading above it said it twice. */}
          <p className="text-pretty text-[0.75rem] leading-relaxed text-[var(--muted)] min-[768px]:max-w-[340px]">
            {sourceText}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-4 border-t border-[var(--hairline-soft)] pt-2.5 min-[768px]:mt-[30px] min-[768px]:pt-3.5">
          <span className="font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] text-[var(--faint)]">© {year} Fiscal.ge</span>
          <span className="font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] text-[var(--faint)]">CC BY 4.0</span>
        </div>
      </div>
    </footer>
  );
}

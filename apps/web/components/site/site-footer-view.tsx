import Link from "next/link";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale, Messages } from "../../lib/i18n/types";

// The four datasets, then the site's own pages (owner decision D3, 2026-10-07).
const FOOTER_LINKS = [
  { href: "/explorer", labelKey: "common.budget" },
  { href: "/explorer/economy", labelKey: "common.economy" },
  { href: "/explorer/inflation", labelKey: "common.inflation" },
  { href: "/explorer/unemployment", labelKey: "common.unemployment" },
  { href: "/methodology", labelKey: "common.methodology" },
  { href: "/connect", labelKey: "common.aiConnection" },
  { href: "/about", labelKey: "common.about" },
] as const;

// The markup, with the common catalogue handed in. It is split from the
// lookup below because the explorer footer is a client component: importing
// common.server.ts from here put BOTH locales' catalogue in every explorer
// route's client bundle.
export function SiteFooterView({ updatedAt, locale = "ka", sourceNote, messages }: { updatedAt?: string; locale?: Locale; sourceNote?: string; messages: Messages }) {
  const [sourcePrefix, sourceSuffix] = (sourceNote ?? messages["common.sourceNote"]).split("{updatedAt}");
  return (
    <footer data-testid="site-footer" className="mt-10 border-t-2 border-[var(--ink)] pb-5 pt-5 min-[768px]:mt-[72px] min-[768px]:pb-10 min-[768px]:pt-[26px]">
      <div data-testid="landing-footer">
        <div className="flex flex-col gap-4 min-[768px]:grid min-[768px]:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] min-[768px]:gap-9">
          {/* Phones: lockup and address share the first row, the tagline runs full width under them. */}
          <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 min-[768px]:flex min-[768px]:flex-col min-[768px]:items-stretch min-[768px]:gap-2.5">
            <Link href={pageHref("/", locale)} aria-label={message(messages, "common.brandHome")} className="block w-[150px]">
              {/* Local SVG brand asset; native img avoids adding a raster optimization path. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-testid="site-footer-logo"
                src={locale === "en" ? "/brand/fiscal-logo-compact-en.svg" : "/brand/fiscal-logo-compact.svg"}
                width="1080"
                height="340"
                alt=""
                className="block h-auto w-full"
              />
            </Link>
            <p className="col-span-2 text-pretty text-[0.78125rem] leading-relaxed text-[var(--body)] min-[768px]:max-w-[300px]">
              {message(messages, "common.footerDescription")}
            </p>
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
                  <Link href={pageHref(href, locale)} className="flex min-h-11 items-center text-[0.78125rem] text-[var(--body)] hover:text-[var(--ink)] min-[768px]:inline min-[768px]:min-h-0">
                    {message(messages, labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {/* One fine-print paragraph. The source sentence already opens with
              "მონაცემები:", so the old "მონაცემები" heading above it said it twice. */}
          <p className="text-pretty text-[0.75rem] leading-relaxed text-[var(--muted)] min-[768px]:max-w-[340px]">
            {sourcePrefix}{sourceSuffix !== undefined && <span className="font-[family-name:var(--font-numeric)]">{updatedAt}</span>}{sourceSuffix}{" "}
            {message(messages, "common.footerLicence")}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-4 border-t border-[var(--hairline-soft)] pt-2.5 min-[768px]:mt-[30px] min-[768px]:pt-3.5">
          <span className="font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] text-[var(--faint)]">© 2026 Fiscal.ge</span>
          <span className="font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] text-[var(--faint)]">CC BY 4.0</span>
        </div>
      </div>
    </footer>
  );
}

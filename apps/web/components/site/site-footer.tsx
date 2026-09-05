import Link from "next/link";
import { getCommonMessages } from "../../lib/i18n/common.server";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";

const ANALYSIS_HREF = "/explorer/analysis";

export function SiteFooter({ updatedAt, locale = "ka" }: { updatedAt: string; locale?: Locale }) {
  const messages = getCommonMessages(locale);
  const [sourcePrefix, sourceSuffix] = messages["common.sourceNote"].split("{updatedAt}");
  return (
    <footer data-testid="site-footer" className="mt-[72px] border-t-2 border-[var(--ink)] pb-10 pt-[26px]">
      <div data-testid="landing-footer">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-9">
          <div className="flex flex-col gap-2.5">
            <Link href={pageHref("/", locale)} aria-label={message(messages, "common.brandHome")} className="block w-[150px]">
              {/* Local SVG brand asset; native img avoids adding a raster optimization path. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-testid="site-footer-logo"
                src="/brand/fiscal-logo-compact.svg"
                width="1080"
                height="340"
                alt=""
                className="block h-auto w-full"
              />
            </Link>
            <p className="max-w-[260px] text-pretty text-[12.5px] leading-relaxed text-[var(--body)]">
              {message(messages, "common.footerDescription")}
            </p>
            <a
              href="mailto:info@fiscal.ge"
              className="max-[768px]:inline-flex max-[768px]:min-h-6 max-[768px]:items-center max-[768px]:self-start font-[family-name:var(--font-numeric)] text-[11px] text-[var(--accent)] underline underline-offset-[3px]"
            >
              info@fiscal.ge
            </a>
          </div>
          <div className="flex flex-col gap-[9px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{message(messages, "common.navigation")}</span>
            <Link href={pageHref("/explorer", locale)} className="max-[768px]:inline-flex max-[768px]:min-h-6 max-[768px]:items-center max-[768px]:self-start text-[12.5px] text-[var(--body)] hover:text-[var(--ink)]">
              {message(messages, "common.multiYear")}
            </Link>
            <Link href={pageHref(ANALYSIS_HREF, locale)} className="max-[768px]:inline-flex max-[768px]:min-h-6 max-[768px]:items-center max-[768px]:self-start text-[12.5px] text-[var(--body)] hover:text-[var(--ink)]">
              {message(messages, "common.singleYear")}
            </Link>
            <Link href={pageHref("/methodology", locale)} className="max-[768px]:inline-flex max-[768px]:min-h-6 max-[768px]:items-center max-[768px]:self-start text-[12.5px] text-[var(--body)] hover:text-[var(--ink)]">
              {message(messages, "common.methodology")}
            </Link>
            <Link href={pageHref("/connect", locale)} className="max-[768px]:inline-flex max-[768px]:min-h-6 max-[768px]:items-center max-[768px]:self-start text-[12.5px] text-[var(--body)] hover:text-[var(--ink)]">
              {message(messages, "common.aiConnection")}
            </Link>
            <Link href={pageHref("/about", locale)} className="max-[768px]:inline-flex max-[768px]:min-h-6 max-[768px]:items-center max-[768px]:self-start text-[12.5px] text-[var(--body)] hover:text-[var(--ink)]">
              {message(messages, "common.about")}
            </Link>
          </div>
          <div className="flex max-w-[340px] flex-col gap-[9px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{message(messages, "common.data")}</span>
            <p className="text-pretty text-[12px] leading-relaxed text-[var(--muted)]">
              {sourcePrefix}<span className="font-[family-name:var(--font-numeric)]">{updatedAt}</span>{sourceSuffix}
            </p>
            <p className="text-pretty text-[12px] leading-relaxed text-[var(--muted)]">
              {message(messages, "common.footerLicence")}
            </p>
          </div>
        </div>
        <div className="mt-[30px] flex flex-wrap justify-between gap-4 border-t border-[var(--hairline-soft)] pt-3.5">
          <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">© 2026 Fiscal.ge</span>
          <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">CC BY 4.0</span>
        </div>
      </div>
    </footer>
  );
}

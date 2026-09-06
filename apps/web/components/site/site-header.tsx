import Link from "next/link";
import { LanguageSwitch } from "./language-switch";
import { getCommonMessages } from "../../lib/i18n/common.server";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";

type SiteHeaderProps = {
  locale?: Locale;
  active?: "home" | "explorer" | "mission" | "connect";
  testId: string;
};

function navLinkClass(isActive: boolean) {
  return isActive
    ? "flex h-full items-center border-b-2 border-transparent pb-3.5 text-[13px] font-semibold text-[var(--ink)] underline decoration-2 decoration-[var(--accent)] underline-offset-[5px] min-[900px]:min-h-8 min-[900px]:border-b-0 min-[900px]:pb-0"
    : "flex h-full items-center border-b-2 border-transparent pb-3.5 text-[13px] font-medium text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)] min-[900px]:min-h-8 min-[900px]:border-b-0 min-[900px]:pb-0";
}

export function SiteHeader({ active, testId, locale = "ka" }: SiteHeaderProps) {
  const messages = getCommonMessages(locale);
  return (
    <header
      data-testid={testId}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 min-[768px]:gap-5 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[900px]:gap-x-2.5 min-[1100px]:gap-x-5"
    >
      <Link
        href={pageHref("/", locale)}
        aria-label={message(messages, "common.brandHome")}
        className="mb-3.5 block aspect-[1080/340] w-[118px] flex-none min-[768px]:mb-1 min-[768px]:aspect-[1600/400] min-[768px]:w-[280px]"
      >
        <picture>
          <source media="(max-width: 767px)" srcSet={locale === "en" ? "/brand/fiscal-logo-compact-en.svg" : "/brand/fiscal-logo-compact.svg"} />
          <img
            data-testid="site-header-logo"
            src={locale === "en" ? "/brand/fiscal-logo-horizontal-en.svg" : "/brand/fiscal-logo-horizontal.svg"}
            width="1600"
            height="545"
            alt=""
            className="block h-full w-full object-contain min-[768px]:object-cover"
          />
        </picture>
      </Link>
      <nav
        aria-label={message(messages, "common.navigation")}
        className="order-3 flex w-full basis-full justify-center gap-[18px] self-stretch border-t border-[var(--hairline)] pt-2 min-[900px]:order-none min-[900px]:w-auto min-[900px]:basis-auto min-[900px]:self-auto min-[900px]:border-t-0 min-[900px]:pt-0 min-[1100px]:gap-[26px]"
      >
        <Link
          href={pageHref("/", locale)}
          aria-current={active === "home" ? "page" : undefined}
          className={navLinkClass(active === "home")}
        >
          {message(messages, "common.home")}
        </Link>
        <Link
          href={pageHref("/explorer", locale)}
          aria-current={active === "explorer" ? "page" : undefined}
          className={navLinkClass(active === "explorer")}
        >
          {message(messages, "common.data")}
        </Link>
        <Link
          href={pageHref("/connect", locale)}
          aria-current={active === "connect" ? "page" : undefined}
          className={navLinkClass(active === "connect")}
        >
          {message(messages, "common.ai")}
        </Link>
        <Link
          href={pageHref("/about", locale)}
          aria-current={active === "mission" ? "page" : undefined}
          className={navLinkClass(active === "mission")}
        >
          {message(messages, "common.about")}
        </Link>
      </nav>
      <div className="flex items-center min-[900px]:justify-self-end">
        <LanguageSwitch />
      </div>
    </header>
  );
}

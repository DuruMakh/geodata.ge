import Link from "next/link";
import { SiteNavigation } from "./site-navigation";
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
    ? "flex min-h-11 items-center text-[13px] font-semibold text-[var(--ink)] underline decoration-2 decoration-[var(--accent)] underline-offset-[5px] min-[900px]:min-h-8"
    : "flex min-h-11 items-center text-[13px] font-medium text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)] min-[900px]:min-h-8";
}

export function SiteHeader({ active, testId, locale = "ka" }: SiteHeaderProps) {
  const messages = getCommonMessages(locale);
  return (
    <header
      data-testid={testId}
      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 min-[900px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[900px]:gap-x-2.5 min-[1100px]:gap-x-5"
    >
      <Link
        href={pageHref("/", locale)}
        aria-label={message(messages, "common.brandHome")}
        className="flex h-12 w-11 items-center min-[900px]:mb-1 min-[900px]:block min-[900px]:h-auto min-[900px]:aspect-[1600/400] min-[900px]:w-[280px]"
      >
        <picture className="block h-full w-full">
          <source media="(max-width: 899px)" srcSet="/icon.svg" />
          <img
            data-testid="site-header-logo"
            src={locale === "en" ? "/brand/fiscal-logo-horizontal-en.svg" : "/brand/fiscal-logo-horizontal.svg"}
            width="1600"
            height="545"
            alt=""
            className="block h-full w-full object-contain min-[900px]:object-cover"
          />
        </picture>
      </Link>
      <SiteNavigation label={message(messages, "common.menu")}>
        <nav
          aria-label={message(messages, "common.navigation")}
          className="flex flex-col min-[900px]:flex-row min-[900px]:justify-center min-[900px]:gap-[18px] min-[1100px]:gap-[26px]"
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
        <div className="mt-2 flex items-center border-t border-[var(--hairline)] py-2 min-[900px]:mt-0 min-[900px]:justify-self-end min-[900px]:border-t-0 min-[900px]:py-0">
          <LanguageSwitch abbreviatedOnMobile />
        </div>
      </SiteNavigation>
    </header>
  );
}

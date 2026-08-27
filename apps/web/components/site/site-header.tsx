import Link from "next/link";

type SiteHeaderProps = {
  active?: "home" | "explorer";
  yearsLabel: string;
  testId: string;
};

function navLinkClass(isActive: boolean) {
  return isActive
    ? "flex h-full items-center border-b-2 border-[var(--accent)] pb-3.5 text-[13px] font-semibold text-[var(--ink)]"
    : "flex h-full items-center border-b-2 border-transparent pb-3.5 text-[13px] font-medium text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)]";
}

export function SiteHeader({ active, yearsLabel, testId }: SiteHeaderProps) {
  return (
    <header
      data-testid={testId}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b-2 border-[var(--ink)] min-[768px]:gap-5"
    >
      <Link
        href="/"
        aria-label="Fiscal.ge — მთავარი"
        className="mb-3.5 block aspect-[1080/340] w-[118px] flex-none min-[768px]:aspect-[1600/545] min-[768px]:w-[280px]"
      >
        <picture>
          <source media="(max-width: 767px)" srcSet="/brand/fiscal-logo-compact.svg" />
          <img
            data-testid="site-header-logo"
            src="/brand/fiscal-logo-horizontal.svg"
            width="1600"
            height="545"
            alt=""
            className="block h-full w-full object-contain"
          />
        </picture>
      </Link>
      <nav aria-label="ნავიგაცია" className="flex self-stretch gap-4 min-[768px]:gap-[26px]">
        <Link
          href="/"
          aria-current={active === "home" ? "page" : undefined}
          className={navLinkClass(active === "home")}
        >
          მთავარი
        </Link>
        <Link
          href="/explorer"
          aria-current={active === "explorer" ? "page" : undefined}
          className={navLinkClass(active === "explorer")}
        >
          მონაცემები
        </Link>
      </nav>
      <span className="hidden self-stretch items-center pb-3.5 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)] min-[768px]:flex">
        {yearsLabel}
      </span>
    </header>
  );
}

import Link from "next/link";

type SiteHeaderProps = {
  active?: "home" | "explorer";
  yearsLabel: string;
  testId: string;
};

function navLinkClass(isActive: boolean) {
  return isActive
    ? "-mb-3.5 border-b-2 border-[var(--accent)] pb-3 text-[13px] font-semibold text-[var(--ink)]"
    : "-mb-3.5 border-b-2 border-transparent pb-3 text-[13px] font-medium text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)]";
}

export function SiteHeader({ active, yearsLabel, testId }: SiteHeaderProps) {
  return (
    <header
      data-testid={testId}
      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 border-b-2 border-[var(--ink)] pb-3.5 min-[768px]:gap-5"
    >
      <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.01em]">
        GeoData
      </span>
      <nav aria-label="ნავიგაცია" className="flex gap-4 min-[768px]:gap-[26px]">
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
          ექსპლორერი
        </Link>
      </nav>
      <span className="hidden font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)] min-[768px]:inline">
        {yearsLabel}
      </span>
    </header>
  );
}

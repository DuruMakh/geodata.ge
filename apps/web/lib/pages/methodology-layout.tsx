import type { Locale } from "../i18n/types";
import { SiteHeader } from "../../components/site/site-header";

export async function renderMethodologyLayout(locale: Locale, children: React.ReactNode) {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="px-5 pt-[22px] min-[768px]:px-7 min-[768px]:pt-[30px]">
        <div className="mx-auto max-w-[1240px]">
          <SiteHeader locale={locale} testId="methodology-header" />
        </div>
      </div>
      {children}
    </div>
  );
}

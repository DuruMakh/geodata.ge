import type { ReactNode } from "react";
import { DataSidebar } from "../../components/shell/data-sidebar";
import { SiteFooter } from "../../components/site/site-footer";
import { loadServedLandingData } from "../data/servedData";
import { buildLandingContext } from "../landing/landingData";
import type { Locale } from "../i18n/types";

export async function renderExplorerLayout(locale: Locale, children: ReactNode) {
  const { updatedAt } = buildLandingContext(await loadServedLandingData());
  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)] min-[900px]:flex-row">
      <DataSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <div className="px-5 min-[768px]:px-[34px]">
          <div className="mx-auto max-w-[1180px]"><SiteFooter updatedAt={updatedAt} locale={locale} /></div>
        </div>
      </div>
    </div>
  );
}

import type { Locale } from "../i18n/types";
import { SiteHeader } from "../../components/site/site-header";
import { loadServedLandingData } from "../data/servedData";
import { buildLandingContext } from "../landing/landingData";

export async function renderMethodologyLayout(locale: Locale, children: React.ReactNode) {
  const model = buildLandingContext(await loadServedLandingData());

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="px-5 pt-[22px] min-[768px]:px-7 min-[768px]:pt-[30px]">
        <div className="mx-auto max-w-[1240px]">
          <SiteHeader locale={locale} yearsLabel={model.yearsLabel} testId="methodology-header" />
        </div>
      </div>
      {children}
    </div>
  );
}

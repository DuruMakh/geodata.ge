import { SiteHeader } from "../../components/site/site-header";
import { loadServedLandingData } from "../../lib/data/servedData";
import { buildLandingModel } from "../../lib/landing/landingData";

export default async function MethodologyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const model = buildLandingModel(await loadServedLandingData());

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="px-5 pt-[22px] min-[768px]:px-7 min-[768px]:pt-[30px]">
        <div className="mx-auto max-w-[1240px]">
          <SiteHeader yearsLabel={model.yearsLabel} testId="methodology-header" />
        </div>
      </div>
      {children}
    </div>
  );
}

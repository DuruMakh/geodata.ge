import type { Presentation } from "../../lib/i18n/types";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import Link from "next/link";
import type { LandingModel } from "../../lib/landing/landingData";
import type { LandingDatasetLink } from "../../lib/landing/landingDatasets";
import { SiteFooter } from "../site/site-footer";
import { SiteHeader } from "../site/site-header";
import { HeroReliefLazy } from "./hero-relief-lazy";
import { LandingDatasetSection } from "./landing-dataset-section";
import { LandingFiscalSections } from "./landing-fiscal-sections";

// Country snapshots are maintained by hand; every budget value below them is
// derived from the same active facts as the matching explorer.
const KEY_NUMBERS = [
  {
    label: "landing.population",
    value: "3.9",
    unit: "landing.million",
    caption: "landing.populationCaption",
    mobileCaption: "landing.populationMobile",
    unitTestId: "population-unit",
  },
  {
    label: "landing.area",
    value: "69.7",
    unit: "landing.areaUnit",
    caption: "landing.areaCaption",
    mobileCaption: "landing.areaMobile",
    unitTestId: "area-unit",
  },
  {
    label: "landing.economy",
    value: "104.6",
    unit: "landing.bnGel",
    caption: "landing.economyCaption",
    mobileCaption: "landing.economyMobile",
    unitTestId: "gdp-unit",
  },
] as const;

const HERO_ARIA_LABEL =
  "landing.heroAria";

const METHODOLOGY_STEPS = [
  "landing.methodStep1",
  "landing.methodStep2",
  "landing.methodStep3",
  "landing.methodStep4",
] as const;

export function LandingPage({ model, datasets, presentation }: { model: LandingModel; datasets: readonly LandingDatasetLink[]; presentation: Presentation }) {
  const { locale, messages } = presentation;
  return (
    <main
      data-testid="landing-shell"
      className="min-h-screen bg-[var(--paper)] px-5 pt-[22px] text-[var(--ink)] min-[768px]:px-7 min-[768px]:pt-[30px]"
    >
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader locale={locale} active="home" testId="landing-header" />

        <section className="relative min-[768px]:grid min-[768px]:grid-cols-1">
          <div
            data-hero-copy
            className="pb-[18px] pt-7 min-[768px]:pointer-events-none min-[768px]:col-start-1 min-[768px]:row-start-1 min-[768px]:z-10 min-[768px]:mb-6 min-[768px]:mt-[42px] min-[768px]:flex min-[768px]:w-[340px] min-[768px]:flex-col min-[768px]:items-end min-[768px]:self-start min-[768px]:justify-self-end min-[768px]:p-0 min-[768px]:text-right min-[1100px]:w-[470px]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)] min-[768px]:text-[11px]">
              {message(messages, "landing.portal")}
            </p>
            <h1
              className="hero-display mt-2.5 whitespace-pre-line text-pretty text-[33px] font-semibold leading-[1.12] tracking-[-0.015em] min-[768px]:mt-3 min-[768px]:text-[30px] min-[1100px]:text-[40px]"
            >
              {message(messages, "landing.heading")}
            </h1>
            <div className="mt-1 min-[768px]:pointer-events-auto min-[768px]:mt-5">
              <Link
                href={pageHref("/explorer", locale)}
                data-testid="hero-cta"
                className="inline-flex min-h-11 items-center text-[12px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222] min-[768px]:min-h-0 min-[768px]:text-[12.5px]"
              >
                {message(messages, "landing.explore")}
              </Link>
            </div>
          </div>
          <figure
            role="img"
            aria-label={message(messages, HERO_ARIA_LABEL)}
            className="landing-hero-frame relative m-0 ml-[calc(50%-50vw)] w-screen min-w-0 overflow-hidden p-0 min-[768px]:col-start-1 min-[768px]:row-start-1"
          >
            <HeroReliefLazy locale={locale} copy={{ million: message(messages, "landing.heroMillion"), thousand: message(messages, "landing.heroThousand"), peakShkhara: message(messages, "landing.peakShkhara"), peakKazbek: message(messages, "landing.peakKazbek"), unavailable: message(messages, "landing.heroUnavailable") }} />
          </figure>
        </section>

        <section
          data-testid="key-numbers"
          className="grid grid-cols-3 gap-3 border-t border-[var(--hairline-soft)] pt-[18px] min-[768px]:gap-8"
        >
          {KEY_NUMBERS.map((entry) => (
            <div key={message(messages, entry.label)} data-country-stat className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] max-[380px]:min-h-[27px] min-[768px]:text-[11px] min-[768px]:tracking-[0.08em]">
                {message(messages, entry.label)}
              </div>
              <div className="mt-2 min-h-[58px] font-[family-name:var(--font-display)] text-[clamp(22px,7vw,46px)] font-semibold leading-[1.05] tracking-[-0.02em] min-[768px]:min-h-0">
                {entry.value}{" "}
                <span
                  data-testid={entry.unitTestId}
                  className="mt-1 block text-[clamp(11px,3vw,25px)] min-[768px]:mt-0 min-[768px]:inline"
                >
                  {message(messages, entry.unit)}
                </span>
              </div>
              <div className="mt-2 text-[9px] leading-snug text-[var(--muted)] min-[768px]:text-[12px]">
                <span className="hidden min-[381px]:inline">{message(messages, entry.caption)}</span>
                <span aria-hidden="true" className="min-[381px]:hidden">
                  {message(messages, entry.mobileCaption)}
                </span>
                <span className="sr-only min-[381px]:hidden">{message(messages, entry.caption)}</span>
              </div>
            </div>
          ))}
        </section>

        {/* One row per dataset hub, each with its latest served figure: the
            budget ledger below is one dataset of four (owner decision D3). */}
        <nav
          aria-label={message(messages, "landing.datasetsLabel")}
          data-testid="landing-datasets"
          className="mt-7 grid grid-cols-2 border-t border-[var(--hairline-soft)] min-[768px]:mt-10 min-[768px]:grid-cols-4"
        >
          {datasets.map((dataset) => (
            <Link
              key={dataset.href}
              href={pageHref(dataset.href, locale)}
              className="group flex min-h-11 min-w-0 flex-col justify-center gap-1 border-b border-[var(--hairline-soft)] py-3 pr-3 text-[var(--ink)] no-underline"
            >
              <span className="text-[14px] font-semibold group-hover:text-[var(--accent)]">
                {dataset.title} <span aria-hidden="true" className="text-[var(--accent)]">→</span>
              </span>
              <span className="text-[11.5px] leading-snug text-[var(--muted)]">
                {dataset.measure} · {dataset.period}:{" "}
                <span className="whitespace-nowrap font-[family-name:var(--font-numeric)] text-[var(--ink)]">{dataset.value}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div id="data" data-testid="landing-data" className="mt-14 scroll-mt-4">
          <LandingDatasetSection
            presentation={presentation}
            kind="expenditure"
            index="01"
            overline={message(messages, "landing.expenditureOverline")}
            heading={message(messages, "landing.expenditureHeading")}
            description={message(messages, "landing.expenditureDescription", { year: model.expenditure.latestYear })}
            href="/explorer/expenditure"
            linkLabel={message(messages, "landing.expenditureLink")}
            totalLabel={message(messages, "landing.expenditureTotal")}
            firstColumnLabel={message(messages, "landing.expenditureColumn")}
            summary={model.expenditure}
          />
          <LandingDatasetSection
            presentation={presentation}
            kind="revenue"
            index="02"
            overline={message(messages, "landing.revenueOverline")}
            heading={message(messages, "landing.revenueHeading")}
            description={message(messages, "landing.revenueDescription", { year: model.revenue.latestYear })}
            href="/explorer/revenue"
            linkLabel={message(messages, "landing.revenueLink")}
            totalLabel={message(messages, "landing.revenueTotal")}
            firstColumnLabel={message(messages, "landing.revenueColumn")}
            summary={model.revenue}
          />
          <LandingDatasetSection
            presentation={presentation}
            kind="municipalities"
            index="03"
            overline={message(messages, "landing.municipalOverline")}
            heading={message(messages, "landing.municipalHeading")}
            description={message(messages, "landing.municipalDescription", { year: model.municipalities.latestYear, ...model.municipalCoverage })}
            href="/explorer/municipalities"
            linkLabel={message(messages, "landing.municipalLink")}
            totalLabel={message(messages, "landing.municipalTotal")}
            firstColumnLabel={message(messages, "landing.municipalColumn")}
            summary={model.municipalities}
          />

          <LandingFiscalSections presentation={presentation} debt={model.debt} deficit={model.deficit} />

          <section
            data-testid="landing-methodology"
            aria-labelledby="landing-methodology-title"
            className="grid gap-5 border-t border-[var(--hairline)] py-8 min-[850px]:grid-cols-[52px_minmax(230px,0.82fr)_minmax(0,1.35fr)] min-[850px]:gap-8 min-[850px]:py-11"
          >
            <div aria-hidden="true" className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--accent)]">
              06
            </div>
            <div data-testid="landing-methodology-copy" className="min-w-0">
              <h2
                id="landing-methodology-title"
                className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-[1.16]"
              >
                {message(messages, "landing.methodologyHeading")}
              </h2>
              <p data-testid="landing-methodology-intro" className="mt-4 text-[13px] leading-[1.75] text-[var(--body)]">
                {message(messages, "landing.methodologyDescription")}
              </p>
              <Link
                data-testid="landing-methodology-link"
                href={pageHref("/methodology", locale)}
                className="mt-1 inline-flex min-h-11 items-center text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4"
              >
                {message(messages, "landing.methodologyLink")}
              </Link>
            </div>
            <ol className="border-t border-[var(--hairline-soft)]">
              {METHODOLOGY_STEPS.map((label, index) => (
                <li
                  key={label}
                  className="grid grid-cols-[28px_1fr] gap-3 border-b border-[var(--hairline-soft)] py-2.5 text-[11.5px] text-[var(--body)]"
                >
                  <span aria-hidden="true" className="font-[family-name:var(--font-numeric)] text-[var(--faint)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{message(messages, label)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <SiteFooter locale={locale} updatedAt={model.updatedAt} />
      </div>
    </main>
  );
}

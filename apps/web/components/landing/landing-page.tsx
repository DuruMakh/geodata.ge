import type { Presentation } from "../../lib/i18n/types";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import Link from "next/link";
import type { HomeChapters } from "../../lib/landing/chapters/types";
import type { LandingGdpFigure } from "../../lib/landing/landingData";
import { SiteFooter } from "../site/site-footer";
import { SiteHeader } from "../site/site-header";
import { AiSection, type AiLabels } from "./chapters/ai-section";
import { Chapter } from "./chapters/chapter";
import { DeficitChart, type DeficitLabels } from "./chapters/deficit-chart";
import { MunicipalRelief, type MunicipalLabels } from "./chapters/municipal-relief";
import { RevenueChart, type RevenueLabels } from "./chapters/revenue-chart";
import { ScaleChapter, type ScaleLabels } from "./chapters/scale-chapter";
import { SourcesSection, type SourcesLabels } from "./chapters/sources-section";
import { SpendingChapter, type SpendingLabels } from "./chapters/spending-chapter";
import { HeroReliefLazy } from "./hero-relief-lazy";

// Population and area are maintained by hand; the GDP figure and every budget
// value below them are derived from the same served facts as the matching explorer.
const COUNTRY_NUMBERS = [
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
] as const;

const HERO_ARIA_LABEL =
  "landing.heroAria";

const STEPS = [1, 2, 3, 4] as const;
const NODES = [1, 2, 3, 4, 5] as const;

export function LandingPage({ chapters, gdpFigure, presentation, updatedAt }: { chapters: HomeChapters; gdpFigure: LandingGdpFigure; presentation: Presentation; updatedAt: string }) {
  const { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const keyNumbers = [
    ...COUNTRY_NUMBERS.map((entry) => ({
      ...entry,
      label: message(messages, entry.label),
      unit: message(messages, entry.unit),
      caption: message(messages, entry.caption),
      mobileCaption: message(messages, entry.mobileCaption),
    })),
    { label: message(messages, "landing.economy"), unit: message(messages, "landing.bnGel"), unitTestId: "gdp-unit", ...gdpFigure },
  ];
  const chapterLink = (n: number, path: string) => ({ title: t(`landing.ch${n}.title`), href: pageHref(path, locale), hint: t(`landing.ch${n}.hint`) });
  const units = { bnGel: t("landing.bnGel"), mlnGel: t("landing.mlnGel") };
  const unavailable = t("landing.heroUnavailable");

  const scaleLabels: ScaleLabels = {
    squareNote: t("landing.scale.squareNote"),
    ofGdp: t("landing.scale.ofGdp"),
    cumulative: t("landing.scale.cumulative"),
    included: t("landing.scale.included"),
    notIncluded: t("landing.scale.notIncluded"),
    bnGel: units.bnGel,
    square: t("landing.scale.square"),
    squareNoteSpoken: t("landing.scale.squareNoteSpoken"),
    measureGroup: t("landing.scale.measureGroup"),
    unavailable,
  };
  const { spending } = chapters;
  const largestYear = spending.years[spending.totals.indexOf(Math.max(...spending.totals))];
  const spendingLabels: SpendingLabels = {
    ...units,
    year: t("landing.spending.year"),
    total: t("landing.expenditureTotal"),
    planned: t("landing.planned"),
    maxFrame: t("landing.spending.maxFrame", { year: largestYear }),
    play: t("landing.spending.play"),
    pause: t("landing.spending.pause"),
    replay: t("landing.spending.replay", { year: spending.years[0] }),
    yearPicker: t("landing.spending.yearPicker"),
    axisCaption: t("landing.spending.axisCaption"),
    listCaption: t("landing.spending.listCaption"),
    share: t("landing.spending.share"),
    vsPrevious: t("landing.spending.vsPrevious"),
    chartSummary: t("landing.spending.chartSummary"),
    largest: t("landing.spending.largest"),
    unavailable,
  };
  const revenueLabels: RevenueLabels = {
    ...units,
    title: t("landing.revenue.title"),
    planned: t("landing.planned"),
    total: t("landing.revenue.total"),
    taxes: t("landing.revenue.taxes"),
    peakFrom: t("landing.revenue.peakFrom"),
    chartSummary: t("landing.revenue.chartSummary"),
    unavailable,
  };
  const municipalLabels: MunicipalLabels = {
    ...units,
    gel: t("landing.municipal.gel"),
    budget: t("landing.municipal.budget"),
    perResident: t("landing.municipal.perResident"),
    rank: t("landing.municipal.rank"),
    occupied: t("landing.municipal.occupied"),
    occupiedNote: t("landing.municipal.occupiedNote"),
    total: t("landing.revenue.total"),
    share: t("landing.share"),
    chartSummary: t("landing.municipal.chartSummary"),
    unavailable,
  };
  const deficitLabels: DeficitLabels = {
    ...units,
    title: t("landing.deficit.title"),
    deficit: t("landing.deficit.deficit"),
    surplus: t("landing.deficit.surplus"),
    forecast: t("landing.deficit.forecast"),
    imf: t("landing.deficit.imf"),
    surplusRun: t("landing.deficit.surplus"),
    vsGdp: t("landing.deficit.vsGdp"),
    inGel: t("landing.deficit.inGel"),
    deepest: t("landing.deficit.deepest"),
    chartSummary: t("landing.deficit.chartSummary"),
    unavailable,
  };
  const collections = chapters.sources.rows.length;
  const sourcesLabels: SourcesLabels = {
    title: t("landing.sources.title"),
    lede: t("landing.methodologyDescription"),
    meta: t("landing.sources.meta", { count: collections, date: chapters.sources.reviewedAt }),
    methodologyLink: t("landing.methodologyLink"),
    flow: t("landing.sources.flow"),
    steps: STEPS.map((n) => ({ title: t(`landing.sourceStep${n}Title`), text: t(`landing.sourceStep${n}Text`) })),
    coverageTitle: t("landing.sources.coverageTitle"),
    coverageHint: t("landing.sources.coverageHint"),
    axisName: t("landing.sources.axisName"),
    since: (year) => t("landing.sources.since", { year }),
    total: t("landing.sources.total", { count: collections }),
  };
  const aiLabels: AiLabels = {
    title: t("landing.ai.title"),
    lede: t("landing.ai.lede"),
    meta: t("landing.ai.meta"),
    copy: t("landing.ai.copy"),
    copied: t("landing.ai.copied"),
    copyLabel: t("landing.ai.copyLabel"),
    copiedLabel: t("landing.ai.copiedLabel"),
    facts: [t("landing.ai.fact1"), t("landing.ai.fact2"), t("landing.ai.fact3")],
    tools: t("landing.ai.tools"),
    cta: t("landing.ai.cta"),
    cardTitle: t("landing.ai.cardTitle"),
    cardKicker: t("landing.ai.cardKicker"),
    nodes: NODES.map((n) => ({ title: t(`landing.ai.node${n}Title`), text: t(`landing.ai.node${n}Text`) })),
  };
  return (
    <div
      data-testid="landing-shell"
      className="min-h-screen bg-[var(--paper)] px-5 pt-[22px] text-[var(--ink)] min-[768px]:px-7 min-[768px]:pt-[30px]"
    >
      <div className="mx-auto max-w-[1240px]">
        <SiteHeader locale={locale} active="home" testId="landing-header" />

        <main id="content" tabIndex={-1} className="outline-none">
          <section className="relative min-[768px]:grid min-[768px]:grid-cols-1">
            <div
              data-hero-copy
              className="pb-[18px] pt-7 min-[768px]:pointer-events-none min-[768px]:col-start-1 min-[768px]:row-start-1 min-[768px]:z-10 min-[768px]:mb-6 min-[768px]:mt-[42px] min-[768px]:flex min-[768px]:w-[340px] min-[768px]:flex-col min-[768px]:items-end min-[768px]:self-start min-[768px]:justify-self-end min-[768px]:p-0 min-[768px]:text-right min-[1100px]:w-[470px]"
            >
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-[var(--muted)] min-[768px]:text-[0.6875rem]">
                {message(messages, "landing.portal")}
              </p>
              <h1
                className="hero-display mt-2.5 whitespace-pre-line text-pretty text-[33px] font-semibold leading-[1.12] tracking-[-0.015em] min-[768px]:mt-3 min-[768px]:text-[30px] min-[1100px]:text-[40px]"
              >
                {message(messages, "landing.heading")}
              </h1>
              <div className="mt-1 min-[768px]:pointer-events-auto min-[768px]:mt-2">
                <Link
                  href={pageHref("/explorer", locale)}
                  data-testid="hero-cta"
                  className="inline-flex min-h-11 items-center text-[0.75rem] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222] min-[768px]:text-[0.78125rem]"
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
            {keyNumbers.map((entry) => (
              <div key={entry.label} data-country-stat className="min-w-0">
                <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] max-[380px]:min-h-[27px] min-[768px]:text-[0.6875rem] min-[768px]:tracking-[0.08em]">
                  {entry.label}
                </div>
                <div className="mt-2 min-h-[58px] font-[family-name:var(--font-display)] text-[clamp(22px,7vw,46px)] font-semibold leading-[1.05] tracking-[-0.02em] min-[768px]:min-h-0">
                  {entry.value}{" "}
                  <span
                    data-testid={entry.unitTestId}
                    className="mt-1 block whitespace-nowrap text-[clamp(11px,3vw,25px)] min-[768px]:mt-0 min-[768px]:inline"
                  >
                    {entry.unit}
                  </span>
                </div>
                <div className="mt-2 text-[0.6875rem] leading-snug text-[var(--muted)] min-[768px]:text-[0.75rem]">
                  <span className="hidden min-[381px]:inline">{entry.caption}</span>
                  <span aria-hidden="true" className="min-[381px]:hidden">
                    {entry.mobileCaption}
                  </span>
                  <span className="sr-only min-[381px]:hidden">{entry.caption}</span>
                </div>
              </div>
            ))}
          </section>

          <Chapter id="ch-01" first link={chapterLink(1, "/explorer/analysis")} title={t("landing.ch1.title")} lede={t("landing.ch1.lede")}>
            <ScaleChapter data={chapters.scale} labels={scaleLabels} />
          </Chapter>
          <Chapter id="ch-02" link={chapterLink(2, "/explorer/expenditure")} title={t("landing.ch2.title")} lede={chapters.sentences.spending}>
            <SpendingChapter data={chapters.spending} labels={spendingLabels} />
          </Chapter>
          <Chapter id="ch-03" link={chapterLink(3, "/explorer/revenue")} title={t("landing.ch3.title")} lede={chapters.sentences.revenue}>
            <RevenueChart data={chapters.revenue} labels={revenueLabels} />
          </Chapter>
          <Chapter id="ch-04" link={chapterLink(4, "/explorer/municipalities")} title={t("landing.ch4.title")} lede={chapters.sentences.municipal}>
            <MunicipalRelief data={chapters.municipal} labels={municipalLabels} />
          </Chapter>
          <Chapter id="ch-05" link={chapterLink(5, "/explorer/deficit")} title={t("landing.ch5.title")} lede={chapters.sentences.deficit}>
            <DeficitChart data={chapters.deficit} labels={deficitLabels} />
          </Chapter>
          <SourcesSection sources={chapters.sources} labels={sourcesLabels} locale={locale} />
          <AiSection tools={chapters.tools} labels={aiLabels} locale={locale} />
        </main>

        <SiteFooter variant="site" path="/" locale={locale} updatedAt={updatedAt} />
      </div>
    </div>
  );
}

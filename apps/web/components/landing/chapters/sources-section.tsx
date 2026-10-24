import Link from "next/link";
import type { HomeChapters } from "../../../lib/landing/chapters/types";
import { pageHref } from "../../../lib/i18n/routes";
import type { Locale } from "../../../lib/i18n/types";
import { Chapter } from "./chapter";
import { Reveal } from "./reveal";

// The sources chapter: the four steps from an official document to a download, and one coverage bar
// per methodology entry on a shared 1990-2030 axis, its file count on the right. Ported from the
// design board's section 15. A server component; the bars grow in through CSS once Reveal marks
// the list as seen.

export type SourcesLabels = {
  title: string; // "ყოველი ციფრი — პირველწყარომდე"
  lede: string; // "თითოეული რიცხვი უკავშირდება ოფიციალურ წყაროს…"
  meta: string; // "28 კრებული · ბოლო გადამოწმება 2026-10-20" (already filled in)
  methodologyLink: string; // "მეთოდოლოგიის ნახვა →"
  flow: string; // above the steps: "წყარო → მეთოდი → შემოწმება → მონაცემი"
  steps: { title: string; text: string }[]; // four
  coverageTitle: string; // "კრებულები და მათი დროითი დაფარვა"
  coverageHint: string; // "მარჯვნივ — პირველწყაროების რაოდენობა"
  axisName: string; // sr-only column name of the collections: "კრებული"
  since: (year: number) => string; // tag before a bar that starts before the axis: "1960-დან"
  total: string; // "28 კრებული · მითითებული პირველწყაროები" (already filled in)
};

const AXIS_FROM = 1990;
const AXIS_TO = 2030;
const AXIS_SPAN = AXIS_TO - AXIS_FROM;
const TICKS = [1990, 2000, 2010, 2020, 2030];
const STAGGER_MS = 30;

/** Left edge and width of a coverage bar, in percent of the axis. Years outside the axis are cut off at its ends. */
export function coverageBar(firstYear: number, lastYear: number): { left: number; width: number } {
  const start = Math.max(AXIS_FROM, firstYear);
  const end = Math.min(AXIS_TO, lastYear + 1);
  return { left: ((start - AXIS_FROM) / AXIS_SPAN) * 100, width: ((end - start) / AXIS_SPAN) * 100 };
}

export function SourcesSection({
  sources,
  labels,
  locale,
}: {
  sources: HomeChapters["sources"];
  labels: SourcesLabels;
  locale: Locale;
}) {
  return (
    <Chapter
      id="sources"
      link={null}
      title={labels.title}
      lede={labels.lede}
      meta={
        <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs leading-normal text-[var(--faint)]">
          <span>{labels.meta}</span>
          <Link
            href={pageHref("/methodology", locale)}
            prefetch={false}
            className="-my-3 inline-flex min-h-11 items-center text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4"
          >
            {labels.methodologyLink}
          </Link>
        </p>
      }
    >
      <div className="mt-[22px] grid grid-cols-1 gap-10 min-[768px]:mt-7 min-[1000px]:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] min-[1000px]:gap-14">
        <Reveal>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{labels.flow}</div>
          <div className="relative mt-3">
            <i aria-hidden="true" className="home-flow" />
            <i aria-hidden="true" className="home-flow" />
            <i aria-hidden="true" className="home-flow" />
            <ol className="home-steps">
              {labels.steps.map((step, index) => (
                <li key={step.title} className="home-step">
                  <div className="font-[family-name:var(--font-numeric)] text-[11px] tracking-[0.06em] text-[var(--accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-0.5 text-[15px] font-semibold leading-[1.35]">{step.title}</div>
                  <p className="mt-[5px] text-[13px] leading-[1.55] text-[var(--body)]">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
        <Reveal className="home-src-list">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
            <b className="text-[13.5px] font-semibold">{labels.coverageTitle}</b>
            <span className="text-[11.5px] text-[var(--muted)]">{labels.coverageHint}</span>
          </div>
          <div className="border-t-[1.5px] border-[var(--ink)]">
            <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-x-[14px] gap-y-1 px-1 pb-1.5 pt-2 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)] min-[700px]:grid-cols-[minmax(0,230px)_minmax(0,1fr)_44px]">
              <span className="sr-only">{labels.axisName}</span>
              <div aria-hidden="true" className="relative col-start-1 h-3.5 min-[700px]:col-start-2">
                {TICKS.map((year, index) => (
                  <span
                    key={year}
                    className={`absolute top-0 ${index === 0 ? "" : index === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
                    style={{ left: `${((year - AXIS_FROM) / AXIS_SPAN) * 100}%` }}
                  >
                    {year}
                  </span>
                ))}
              </div>
              <span />
            </div>
            {sources.rows.map((row, index) => {
              const bar = coverageBar(row.firstYear, row.lastYear);
              return (
                <div
                  key={row.name}
                  className="home-cov-row grid grid-cols-[minmax(0,1fr)_44px] items-center gap-x-[14px] gap-y-1 border-b border-[var(--row-border)] px-1 py-[7px] transition-colors hover:bg-[var(--tint)] min-[700px]:grid-cols-[minmax(0,230px)_minmax(0,1fr)_44px]"
                >
                  <span className="min-w-0 text-[12.5px] leading-[1.3]">
                    {row.name}
                    {row.firstYear < AXIS_FROM ? (
                      <span aria-hidden="true" className="ml-2 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)] min-[700px]:hidden">
                        {labels.since(row.firstYear)}
                      </span>
                    ) : null}
                  </span>
                  <div className="relative col-start-1 h-2.5 min-[700px]:col-start-2">
                    {row.firstYear < AXIS_FROM ? (
                      <span aria-hidden="true" className="absolute left-0 top-1/2 hidden -translate-x-full -translate-y-1/2 whitespace-nowrap pr-1.5 min-[700px]:block font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">
                        {labels.since(row.firstYear)}
                      </span>
                    ) : null}
                    <span className="sr-only">{`${row.firstYear}–${row.lastYear}`}</span>
                    <i
                      aria-hidden="true"
                      className="home-cov-bar absolute top-[3px] h-1 rounded-sm bg-[var(--ink)]"
                      style={{ left: `${bar.left.toFixed(2)}%`, width: `${bar.width.toFixed(2)}%`, transitionDelay: `${index * STAGGER_MS}ms` }}
                    />
                  </div>
                  <span className="col-start-2 row-span-2 row-start-1 text-right font-[family-name:var(--font-numeric)] text-xs font-semibold min-[700px]:col-start-3 min-[700px]:row-auto">
                    {row.files}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-baseline justify-between px-1 pt-3 text-[12.5px] text-[var(--body)]">
            <span>{labels.total}</span>
            <b className="font-[family-name:var(--font-numeric)] text-[13px] text-[var(--ink)]">{sources.totalFiles}</b>
          </div>
        </Reveal>
      </div>
    </Chapter>
  );
}

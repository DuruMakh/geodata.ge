import Link from "next/link";
import { FUTURE_METHODOLOGY_DATASETS } from "../../lib/methodology/catalog";
import type { MethodologyHubEntry } from "../../lib/methodology/types";
import type { BreadcrumbItem } from "../../lib/seo/structuredData";
import { BreadcrumbTrail } from "../seo/breadcrumb-json-ld";
import { ComingSoonBadge } from "../ui/editorial";
import { OpenDocumentVisual } from "./document-visuals";

export function MethodologyHub({
  liveEntries,
  breadcrumbItems,
}: {
  liveEntries: readonly MethodologyHubEntry[];
  breadcrumbItems: readonly BreadcrumbItem[];
}) {
  return (
    <main data-testid="methodology-hub" className="mx-auto w-full max-w-[1240px] px-5 pt-8 min-[768px]:px-7 min-[768px]:pt-14">
      <BreadcrumbTrail items={breadcrumbItems} />
      <section className="grid items-center gap-10 border-b-2 border-[var(--ink)] pb-14 min-[860px]:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] min-[860px]:gap-16 min-[860px]:pb-20">
        <div className="max-w-[620px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">ღია მონაცემების საფუძველი</p>
          <h1 className="mt-4 text-balance font-[family-name:var(--font-display)] text-[38px] font-semibold leading-[1.12] tracking-[-0.02em] min-[768px]:text-[52px]">
            მეთოდოლოგია და პირველწყაროები
          </h1>
          <p className="mt-6 max-w-[570px] text-pretty text-[15px] leading-[1.75] text-[var(--body)]">
            ნახეთ, რომელი ოფიციალური დოკუმენტებიდან იქმნება Fiscal.ge-ს მონაცემები, რა გადაწყვეტილებებია მიღებული დამუშავებისას და როგორ მოწმდება შედეგი.
          </p>
          <Link
            href="#datasets"
            className="mt-7 inline-block text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[var(--ink)]"
          >
            მონაცემთა მეთოდოლოგიები ↓
          </Link>
        </div>
        <OpenDocumentVisual />
      </section>

      <section id="datasets" aria-labelledby="datasets-title" className="scroll-mt-6 py-14 min-[768px]:py-20">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-[var(--ink)] pb-4">
          <h2 id="datasets-title" className="font-[family-name:var(--font-display)] text-[26px] font-semibold tracking-[-0.01em]">
            გამოქვეყნებული მონაცემები
          </h2>
          <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">{liveEntries.length} კრებული</span>
        </div>
        <div>
          {liveEntries.map((entry) => (
            <Link
              key={entry.id}
              data-testid="methodology-live-row"
              href={entry.href}
              className="group grid gap-5 border-b border-[var(--hairline)] py-7 transition-[background-color,transform] duration-150 hover:translate-x-1 hover:bg-[var(--tint)] focus-visible:translate-x-1 focus-visible:bg-[var(--tint)] motion-reduce:transform-none motion-reduce:transition-none min-[768px]:grid-cols-[minmax(180px,0.75fr)_minmax(300px,1.25fr)_auto] min-[768px]:items-center min-[768px]:gap-8 min-[768px]:px-3"
            >
              <h3 className="font-[family-name:var(--font-display)] text-[24px] font-semibold tracking-[-0.01em]">{entry.titleKa}</h3>
              <div>
                <p className="text-[13.5px] leading-relaxed text-[var(--body)]">{entry.summaryKa}</p>
                <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">
                  <span>{entry.coverage.firstYear}–{entry.coverage.lastYear}</span>
                  <span>{entry.originalFileCount} პირველწყარო</span>
                  <span>განხილულია {entry.reviewedAt}</span>
                </p>
              </div>
              <span
                aria-hidden="true"
                className="text-xl text-[var(--accent)] transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="future-title" className="border-t border-[var(--hairline)] py-12 min-[768px]:py-16">
        <h2 id="future-title" className="font-[family-name:var(--font-display)] text-[22px] font-semibold">შემდეგი მონაცემები</h2>
        <p className="mt-3 max-w-[650px] text-[13px] leading-relaxed text-[var(--muted)]">
          გვერდი მაშინ გახდება ხელმისაწვდომი, როცა მონაცემები, მეთოდოლოგია, შემოწმება და პირველწყაროები ერთად იქნება მზად.
        </p>
        <div className="mt-7 grid gap-x-10 min-[640px]:grid-cols-2">
          {FUTURE_METHODOLOGY_DATASETS.map((entry) => (
            <div
              key={entry.titleKa}
              data-testid="methodology-future-row"
              className="flex items-center justify-between gap-4 border-b border-[var(--hairline-soft)] py-4 text-[13.5px] text-[var(--muted)]"
            >
              <span>{entry.titleKa}</span>
              <ComingSoonBadge surface="paper" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import type { LandingDebtSummary, LandingDeficitSummary } from "../../lib/landing/landingData";

const sectionClassName =
  "grid gap-5 border-t border-[var(--hairline)] py-8 min-[850px]:grid-cols-[52px_minmax(230px,0.82fr)_minmax(0,1.35fr)] min-[850px]:gap-8 min-[850px]:py-11";
const indexClassName = "font-[family-name:var(--font-numeric)] text-[12px] text-[var(--accent)]";
const overlineClassName = "text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)]";
const headingClassName =
  "mt-2.5 text-balance font-[family-name:var(--font-display)] text-[26px] font-semibold leading-[1.16] tracking-[-0.015em]";
const linkClassName =
  "mt-4 inline-flex text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222]";

export function LandingFiscalSections({
  debt,
  deficit,
}: {
  debt: LandingDebtSummary;
  deficit: LandingDeficitSummary;
}) {
  const debtParts = [
    { label: "საშინაო ვალი", value: debt.domesticGel },
    { label: "საგარეო ვალი", value: debt.externalGel },
  ];

  return (
    <>
      <section data-testid="landing-debt" aria-labelledby="landing-debt-title" className={sectionClassName}>
        <div aria-hidden="true" className={indexClassName}>
          04
        </div>
        <div className="min-w-0">
          <p className={overlineClassName}>სახელმწიფო ვალი</p>
          <h2 id="landing-debt-title" className={headingClassName}>
            რამდენია საქართველოს მთავრობის ვალი
          </h2>
          <p className="mt-4 max-w-[470px] text-[13px] leading-[1.75] text-[var(--body)]">
            მთავრობის ვალის მოცულობა, საშინაო და საგარეო ნაწილებად.
          </p>
          <Link href="/explorer/debt" className={linkClassName}>
            ვალის მონაცემები →
          </Link>
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-y-2 border-[var(--ink)] py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">მთლიანი ვალი</p>
              <p className="mt-2 whitespace-nowrap font-[family-name:var(--font-display)] text-[clamp(21px,5vw,42px)] font-semibold leading-none tracking-[-0.02em]">
                {formatAmount(debt.totalGel)}
              </p>
            </div>
            <div className="text-right">
              <span className="block text-[9px] uppercase tracking-[0.06em] text-[var(--faint)]">ბოლო ფაქტობრივი წელი</span>
              <strong className="mt-1 block font-[family-name:var(--font-numeric)] text-[18px]">{debt.latestYear}</strong>
              <span className="mt-1 block text-[10px] text-[var(--muted)]">ფაქტობრივი მონაცემი</span>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-5">
            {debtParts.map((part) => (
              <div key={part.label} className="min-w-0 border-b border-[var(--hairline-soft)] py-3">
                <dt className="text-[10px] leading-snug text-[var(--muted)]">{part.label}</dt>
                <dd className="mt-1.5 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[clamp(14px,4.5vw,17px)] font-semibold leading-tight">
                  {formatAmount(part.value)}
                </dd>
                <dd className="mt-1 text-[10px] text-[var(--faint)]">{formatShare(part.value / debt.totalGel)} მთლიან ვალში</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section data-testid="landing-deficit" aria-labelledby="landing-deficit-title" className={sectionClassName}>
        <div aria-hidden="true" className={indexClassName}>
          05
        </div>
        <div className="min-w-0">
          <p className={overlineClassName}>ზოგადი მთავრობის დეფიციტი</p>
          <h2 id="landing-deficit-title" className={headingClassName}>
            რამდენია საქართველოს ბიუჯეტის დეფიციტი
          </h2>
          <p className="mt-4 max-w-[470px] text-[13px] leading-[1.75] text-[var(--body)]">
            IMF-ის მიერ გამოქვეყნებული ზოგადი მთავრობის წლიური დეფიციტი.
          </p>
          <Link href="/explorer/deficit" className={linkClassName}>
            დეფიციტის მონაცემები →
          </Link>
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-y-2 border-[var(--ink)] py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">დეფიციტი მშპ-სთან მიმართებით</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-[clamp(24px,5vw,42px)] font-semibold leading-none tracking-[-0.02em]">
                {formatShare(deficit.percentGdp / 100)}
              </p>
            </div>
            <div className="text-right">
              <span className="block text-[9px] uppercase tracking-[0.06em] text-[var(--faint)]">ბოლო ფაქტობრივი წელი</span>
              <strong className="mt-1 block font-[family-name:var(--font-numeric)] text-[18px]">{deficit.latestActualYear}</strong>
              <span className="mt-1 block text-[10px] text-[var(--muted)]">ფაქტობრივი მონაცემი</span>
            </div>
          </div>
          <ul data-testid="landing-deficit-history" aria-label="ბოლო სამი ფაქტობრივი წელი" className="mt-3 grid grid-cols-3 gap-x-5">
            {deficit.recentActual.map((fact) => (
              <li key={fact.year} className="min-w-0 border-b border-[var(--hairline-soft)] py-3">
                <span className="block text-[10px] leading-snug text-[var(--muted)]">{fact.year}</span>
                <strong className="mt-1.5 block whitespace-nowrap font-[family-name:var(--font-numeric)] text-[17px] leading-tight">
                  {formatShare(fact.percentGdp / 100)}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

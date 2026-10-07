import type { Presentation } from "../../lib/i18n/types";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import Link from "next/link";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { withLari } from "../ui/lari";
import type { LandingDebtSummary, LandingDeficitSummary } from "../../lib/landing/landingData";

const sectionClassName =
  "grid gap-5 border-t border-[var(--hairline)] py-8 min-[850px]:grid-cols-[52px_minmax(230px,0.82fr)_minmax(0,1.35fr)] min-[850px]:gap-8 min-[850px]:py-11";
const indexClassName = "font-[family-name:var(--font-numeric)] text-[0.75rem] text-[var(--accent)]";
const overlineClassName = "text-[0.6875rem] min-[768px]:text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)]";
const headingClassName =
  "mt-2.5 text-balance font-[family-name:var(--font-display)] text-[26px] font-semibold leading-[1.16] tracking-[-0.015em]";
const linkClassName =
  "mt-1 inline-flex min-h-11 items-center text-[0.78125rem] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222]";

export function LandingFiscalSections({
  presentation,
  debt,
  deficit,
}: {
  presentation: Presentation;
  debt: LandingDebtSummary;
  deficit: LandingDeficitSummary;
}) {
  const { locale, messages } = presentation;
  const debtParts = [
    { label: message(messages, "landing.domesticDebt"), value: debt.domesticGel },
    { label: message(messages, "landing.externalDebt"), value: debt.externalGel },
  ];

  return (
    <>
      <section data-testid="landing-debt" aria-labelledby="landing-debt-title" className={sectionClassName}>
        <div aria-hidden="true" className={indexClassName}>
          04
        </div>
        <div className="min-w-0">
          <p className={overlineClassName}>{message(messages, "landing.debtOverline")}</p>
          <h2 id="landing-debt-title" className={headingClassName}>
            {message(messages, "landing.debtHeading")}
          </h2>
          <p className="mt-4 max-w-[470px] text-[0.8125rem] leading-[1.75] text-[var(--body)]">
            {message(messages, "landing.debtDescription")}
          </p>
          <Link href={pageHref("/explorer/debt", locale)} className={linkClassName}>
            {message(messages, "landing.debtLink")}
          </Link>
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-y-2 border-[var(--ink)] py-4">
            <div className="min-w-0">
              <p className="text-[0.6875rem] min-[768px]:text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{message(messages, "landing.debtTotal")}</p>
              <p className="mt-2 whitespace-nowrap font-[family-name:var(--font-display)] text-[clamp(21px,5vw,42px)] font-semibold leading-none tracking-[-0.02em]">
                {formatAmount(debt.totalGel, locale)}
              </p>
            </div>
            <div className="text-right">
              <span className="block text-[0.6875rem] min-[768px]:text-[9px] uppercase tracking-[0.06em] text-[var(--faint)]">{message(messages, "landing.latestActualYear")}</span>
              <strong className="mt-1 block font-[family-name:var(--font-numeric)] text-[18px]">{debt.latestYear}</strong>
              <span className="mt-1 block text-[0.6875rem] min-[768px]:text-[10px] text-[var(--muted)]">{message(messages, "landing.actualData")}</span>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-5">
            {debtParts.map((part) => (
              <div key={part.label} className="min-w-0 border-b border-[var(--hairline-soft)] py-3">
                <dt className="text-[0.6875rem] min-[768px]:text-[10px] leading-snug text-[var(--muted)]">{part.label}</dt>
                <dd className="mt-1.5 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[clamp(14px,4.5vw,17px)] font-semibold leading-tight">
                  {withLari(formatAmount(part.value, locale))}
                </dd>
                <dd className="mt-1 text-[0.6875rem] min-[768px]:text-[10px] text-[var(--faint)]">{message(messages, "landing.inTotalDebt", { share: formatShare(part.value / debt.totalGel) })}</dd>
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
          <p className={overlineClassName}>{message(messages, "landing.deficitOverline")}</p>
          <h2 id="landing-deficit-title" className={headingClassName}>
            {message(messages, "landing.deficitHeading")}
          </h2>
          <p className="mt-4 max-w-[470px] text-[0.8125rem] leading-[1.75] text-[var(--body)]">
            {message(messages, "landing.deficitDescription")}
          </p>
          <Link href={pageHref("/explorer/deficit", locale)} className={linkClassName}>
            {message(messages, "landing.deficitLink")}
          </Link>
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-y-2 border-[var(--ink)] py-4">
            <div className="min-w-0">
              <p className="text-[0.6875rem] min-[768px]:text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{message(messages, "landing.deficitShare")}</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-[clamp(24px,5vw,42px)] font-semibold leading-none tracking-[-0.02em]">
                {formatShare(deficit.percentGdp / 100)}
              </p>
            </div>
            <div className="text-right">
              <span className="block text-[0.6875rem] min-[768px]:text-[9px] uppercase tracking-[0.06em] text-[var(--faint)]">{message(messages, "landing.latestActualYear")}</span>
              <strong className="mt-1 block font-[family-name:var(--font-numeric)] text-[18px]">{deficit.latestActualYear}</strong>
              <span className="mt-1 block text-[0.6875rem] min-[768px]:text-[10px] text-[var(--muted)]">{message(messages, "landing.actualData")}</span>
            </div>
          </div>
          <ul data-testid="landing-deficit-history" aria-label={message(messages, "landing.recentActualAria")} className="mt-3 grid grid-cols-3 gap-x-5">
            {deficit.recentActual.map((fact) => (
              <li key={fact.year} className="min-w-0 border-b border-[var(--hairline-soft)] py-3">
                <span className="block text-[0.6875rem] min-[768px]:text-[10px] leading-snug text-[var(--muted)]">{fact.year}</span>
                <strong className="mt-1.5 block whitespace-nowrap font-[family-name:var(--font-numeric)] text-[1.0625rem] leading-tight">
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

import Link from "next/link";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import type { LandingBasisStatus, LandingDatasetSummary } from "../../lib/landing/landingData";

const STATUS_LABEL: Record<LandingBasisStatus, string> = {
  actual: "ფაქტობრივი შესრულება",
  planned: "გეგმა",
  mixed: "ფაქტი და გეგმა",
};

type LandingDatasetSectionProps = {
  kind: "expenditure" | "revenue" | "municipalities";
  index: "01" | "02" | "03";
  overline: string;
  heading: string;
  description: string;
  href: string;
  linkLabel: string;
  totalLabel: string;
  firstColumnLabel: string;
  summary: LandingDatasetSummary;
};

export function LandingDatasetSection({
  kind,
  index,
  overline,
  heading,
  description,
  href,
  linkLabel,
  totalLabel,
  firstColumnLabel,
  summary,
}: LandingDatasetSectionProps) {
  const headingId = `landing-${kind}-title`;

  return (
    <section
      data-testid={`landing-dataset-${kind}`}
      aria-labelledby={headingId}
      className={`grid gap-5 py-8 min-[850px]:grid-cols-[52px_minmax(230px,0.82fr)_minmax(0,1.35fr)] min-[850px]:gap-8 min-[850px]:py-11 ${
        kind === "expenditure" ? "" : "border-t border-[var(--hairline)]"
      }`}
    >
      <div
        data-testid="landing-dataset-index"
        aria-hidden="true"
        className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--accent)]"
      >
        {index}
      </div>
      <div data-testid="landing-dataset-copy" className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)]">{overline}</p>
        <h2
          id={headingId}
          className="mt-2.5 text-balance font-[family-name:var(--font-display)] text-[26px] font-semibold leading-[1.16] tracking-[-0.015em]"
        >
          {heading}
        </h2>
        <p className="mt-4 max-w-[470px] text-[13px] leading-[1.75] text-[var(--body)]">{description}</p>
        <Link
          href={href}
          className="mt-4 inline-flex text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222]"
        >
          {linkLabel}
        </Link>
      </div>
      <div data-testid="landing-dataset-data" className="min-w-0">
        <div
          data-testid="landing-dataset-total"
          className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-y-2 border-[var(--ink)] py-4"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{totalLabel}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-[clamp(24px,5vw,42px)] font-semibold leading-none tracking-[-0.02em]">
              {formatAmount(summary.totalGel)}
            </p>
          </div>
          <div className="text-right">
            <span className="block text-[9px] uppercase tracking-[0.06em] text-[var(--faint)]">ბოლო ხელმისაწვდომი წელი</span>
            <strong className="mt-1 block font-[family-name:var(--font-numeric)] text-[18px]">{summary.latestYear}</strong>
            <span className="mt-1 block text-[10px] text-[var(--muted)]">{STATUS_LABEL[summary.basis]}</span>
          </div>
        </div>
        <div className="min-w-0 overflow-hidden">
          <table
            className="mt-3 w-full table-fixed text-[11px] max-[380px]:text-[10px]"
          >
            <caption className="sr-only">{`${heading} — ${summary.latestYear} წლის მონაცემები`}</caption>
            <colgroup>
              <col className="w-[52%]" />
              <col className="w-[30%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="text-[var(--muted)]">
              <tr className="border-b border-[var(--hairline-soft)]">
                <th scope="col" className="py-2 pr-2 text-left font-medium">
                  {firstColumnLabel}
                </th>
                <th scope="col" className="px-1 py-2 text-right font-medium">
                  {summary.latestYear}
                </th>
                <th scope="col" className="py-2 pl-1 text-right font-medium">
                  წილი
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--hairline-soft)] last:border-b-0">
                  <th scope="row" className="break-words py-2.5 pr-2 text-left font-medium leading-snug">
                    {row.labelKa}
                  </th>
                  <td className="whitespace-nowrap px-1 py-2.5 text-right font-[family-name:var(--font-numeric)]">
                    {formatAmount(row.amountGel)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-1 text-right font-[family-name:var(--font-numeric)]">
                    {formatShare(row.share)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

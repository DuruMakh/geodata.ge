import type { CSSProperties } from "react";
import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";
import type { ExplorerTableRow, PeriodSummary } from "../../lib/explorer/types";
import { ContentSection } from "../ui/surfaces";

type PeriodSummaryProps = {
  years: number[];
  summary: PeriodSummary;
  totalRow: ExplorerTableRow | null;
  rows: ExplorerTableRow[];
  topGrowth: ExplorerTableRow[];
  bottomGrowth: ExplorerTableRow[];
};

export function PeriodSummaryPanel({ years, summary, totalRow, rows, topGrowth, bottomGrowth }: PeriodSummaryProps) {
  const startYear = years[0];
  const endYear = years.at(-1);

  if (startYear === undefined || endYear === undefined) return null;

  const largestShare = [...rows].sort((a, b) => (b.shareEndYear ?? -Infinity) - (a.shareEndYear ?? -Infinity))[0] ?? null;
  const totalStart = totalRow?.valuesByYear[startYear] ?? null;
  const totalEnd = totalRow?.valuesByYear[endYear] ?? null;
  const formulaRows = [
    ...(totalRow ? [totalRow] : []),
    ...[...rows].sort((a, b) => (b.valuesByYear[endYear] ?? -Infinity) - (a.valuesByYear[endYear] ?? -Infinity)),
  ];

  return (
    <ContentSection testId="period-summary">
      <SectionHeader title="ძირითადი ინდიკატორები" subtitle="ბიუჯეტის ზრდის ტემპები პერიოდის ჭრილში" badge="KPIs" />

      <div data-testid="period-kpi-cards" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCell
          accent="var(--primary)"
          title="Period"
          value={formatSignedPercent(summary.totalChange)}
          detail={`${formatGel(totalStart)} -> ${formatGel(totalEnd)}`}
        />
        <SummaryCell
          accent="var(--yellow)"
          title="Increase"
          value={formatSignedGel(amountChange(summary.largestGelIncrease, startYear, endYear))}
          detail={summary.largestGelIncrease?.kaLabel ?? "მონაცემი არ არის"}
        />
        <SummaryCell
          accent="var(--teal)"
          title="Lowest increase"
          value={formatSignedGel(amountChange(summary.lowestGrowth, startYear, endYear))}
          detail={summary.lowestGrowth?.kaLabel ?? "მონაცემი არ არის"}
        />
        <SummaryCell
          accent="var(--blue)"
          title="Largest share"
          value={formatPercent(largestShare?.shareEndYear ?? null)}
          detail={largestShare ? `${largestShare.kaLabel}, ${endYear}` : "მონაცემი არ არის"}
        />
      </div>

      <div className="mt-8">
        <SectionHeader title="მზარდი და კლებადი მუხლები" subtitle="ყველაზე დიდი ცვლილებები არჩეულ პერიოდში" badge="Top Movers" />
        <div
          data-testid="period-movers"
          className="mt-6 grid gap-4 md:grid-cols-2 xl:h-[360px] xl:grid-cols-6 xl:items-end"
        >
          <MovementCards label="Gainer" rows={topGrowth} tone="gain" />
          <MovementCards label="Loser" rows={bottomGrowth} tone="loss" />
        </div>
      </div>

      <div className="mt-8">
        <FormulaAnalysis rows={formulaRows} startYear={startYear} endYear={endYear} />
      </div>
    </ContentSection>
  );
}

function SectionHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--hairline)] pb-4">
      <div>
        <h2 className="text-[24px] font-bold leading-tight tracking-[-0.03em] text-[var(--ink)] md:text-[28px]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--mute)]">{subtitle}</p>
      </div>
      <span className="rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">
        {badge}
      </span>
    </div>
  );
}

function SummaryCell({ title, value, detail, accent }: { title: string; value: string; detail?: string; accent: string }) {
  return (
    <div className="min-h-[156px] rounded-[18px] border border-[var(--hairline)] bg-[var(--soft)] p-6 shadow-sm" style={{ borderTop: `4px solid ${accent}` }}>
      <p className="text-xs font-semibold uppercase text-[var(--mute)]">{title}</p>
      <p className="mt-5 text-[28px] font-bold leading-none tracking-[-0.03em] text-[var(--ink)] md:text-[32px]">{value}</p>
      {detail ? <p className="mt-6 text-sm font-semibold text-[var(--body)]">{detail}</p> : null}
    </div>
  );
}

function MovementCards({ label, rows, tone }: { label: string; rows: ExplorerTableRow[]; tone: "gain" | "loss" }) {
  return rows.map((row, index) => {
    const height = tone === "gain" ? 340 - index * 28 : 228 + index * 32;

    return (
      <div
        key={row.itemId}
        className="flex min-h-[190px] min-w-0 flex-col justify-between rounded-[18px] border border-[var(--hairline)] bg-[var(--soft)] p-4 shadow-sm xl:h-[var(--card-height)]"
        data-rank={index + 1}
        data-tone={tone}
        style={{ "--card-height": `${height}px` } as CSSProperties}
      >
        <p className="text-xs font-semibold text-[var(--mute)]">
          {label} {String(index + 1).padStart(2, "0")}
        </p>
        <p className="min-w-0 text-[14px] font-bold leading-6 text-[var(--ink)] [overflow-wrap:anywhere]">{row.kaLabel}</p>
        <p className={`text-[24px] font-bold tracking-[-0.03em] ${tone === "gain" ? "text-[var(--primary)]" : "text-green-500"}`}>
          {formatSignedPercent(row.change)}
        </p>
      </div>
    );
  });
}

function FormulaAnalysis({
  rows,
  startYear,
  endYear,
}: {
  rows: ExplorerTableRow[];
  startYear: number;
  endYear: number;
}) {
  return (
    <div data-testid="period-start-end">
      <SectionHeader title="ფორმულის ანალიზი" subtitle="მატების კომპონენტები საწყისი პერიოდიდან" badge="Math Breakdown" />
      <div data-testid="formula-analysis" className="mt-6 flex flex-col gap-4">
        {rows.map((row) => {
          const start = row.valuesByYear[startYear] ?? null;
          const end = row.valuesByYear[endYear] ?? null;
          const increase = amountChange(row, startYear, endYear);

          return (
            <div
              key={row.itemId}
              className="grid gap-4 rounded-[16px] border border-[var(--hairline)] bg-[var(--soft)] p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,264px)_24px_minmax(0,264px)_24px_minmax(0,264px)] lg:items-center"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="size-4 shrink-0 rounded-[5px]" style={{ backgroundColor: row.color }} />
                <span className="truncate text-base font-bold text-[var(--ink)]">{row.kaLabel}</span>
              </div>
              <FormulaValue label={String(startYear)} value={formatBillions(start)} />
              <FormulaOperator value="+" />
              <FormulaValue label="მატება" value={formatBillions(increase)} />
              <FormulaOperator value="=" />
              <FormulaValue label={String(endYear)} value={formatBillions(end)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormulaValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-5 py-3 text-center">
      <p className="text-xs font-semibold text-[var(--body)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function FormulaOperator({ value }: { value: string }) {
  return <span className="hidden text-center text-base font-bold text-[var(--primary)] lg:block">{value}</span>;
}

function amountChange(row: ExplorerTableRow | null, startYear: number, endYear: number): number | null {
  const start = row?.valuesByYear[startYear];
  const end = row?.valuesByYear[endYear];

  if (start === null || start === undefined || end === null || end === undefined) return null;
  return end - start;
}

function formatSignedGel(value: number | null) {
  if (value === null) return "n/a";
  return value > 0 ? `+${formatGel(value)}` : formatGel(value);
}

function formatBillions(value: number | null) {
  if (value === null) return "n/a";
  return new Intl.NumberFormat("en", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value / 1_000_000_000);
}

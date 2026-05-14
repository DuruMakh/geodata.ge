import { formatGel, formatSignedPercent } from "../../lib/explorer/format";
import type { ExplorerTableRow, PeriodSummary } from "../../lib/explorer/types";

type PeriodSummaryProps = {
  years: number[];
  summary: PeriodSummary;
  rows: ExplorerTableRow[];
  topGrowth: ExplorerTableRow[];
  bottomGrowth: ExplorerTableRow[];
};

export function PeriodSummaryPanel({ years, summary, rows, topGrowth, bottomGrowth }: PeriodSummaryProps) {
  const startYear = years[0];
  const endYear = years.at(-1);

  if (startYear === undefined || endYear === undefined) return null;

  return (
    <section data-testid="period-summary" className="grid gap-4 lg:grid-cols-4">
      <SummaryCell title="ჯამური ცვლილება" value={formatSignedPercent(summary.totalChange)} />
      <SummaryCell
        title="ყველაზე დიდი GEL მატება"
        value={summary.largestGelIncrease?.kaLabel ?? "მონაცემი არ არის"}
        detail={summary.largestGelIncrease ? `${startYear}-${endYear}` : undefined}
      />
      <SummaryCell
        title="ყველაზე სწრაფი ზრდა"
        value={summary.fastestGrowth?.kaLabel ?? "მონაცემი არ არის"}
        detail={formatSignedPercent(summary.fastestGrowth?.change ?? null)}
      />
      <SummaryCell
        title="ყველაზე დაბალი ზრდა"
        value={summary.lowestGrowth?.kaLabel ?? "მონაცემი არ არის"}
        detail={formatSignedPercent(summary.lowestGrowth?.change ?? null)}
      />
      <MovementList title="ზრდის Top 3" rows={topGrowth} />
      <MovementList title="ყველაზე დაბალი ზრდის 3" rows={bottomGrowth} />
      <StartEndComparison rows={rows} startYear={startYear} endYear={endYear} />
    </section>
  );
}

function SummaryCell({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <div className="border border-cyan-400/20 bg-black/45 p-4">
      <p className="text-xs uppercase text-zinc-500">{title}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-zinc-400">{detail}</p> : null}
    </div>
  );
}

function MovementList({ title, rows }: { title: string; rows: ExplorerTableRow[] }) {
  return (
    <div className="border border-cyan-400/20 bg-black/45 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3 flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-400">საკმარისი შედარებითი მონაცემი არ არის.</p>
        ) : (
          rows.map((row, index) => (
            <div key={row.itemId} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-zinc-300">
                {index + 1}. {row.kaLabel}
              </span>
              <span className="font-mono text-zinc-100">{formatSignedPercent(row.change)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StartEndComparison({
  rows,
  startYear,
  endYear,
}: {
  rows: ExplorerTableRow[];
  startYear: number;
  endYear: number;
}) {
  return (
    <div className="border border-cyan-400/20 bg-black/45 p-4 lg:col-span-2">
      <h3 className="text-sm font-semibold text-white">პერიოდის დასაწყისი და დასასრული</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-2 pr-4">მუხლი</th>
              <th className="py-2 pr-4">{startYear}</th>
              <th className="py-2 pr-4">{endYear}</th>
              <th className="py-2">ცვლილება</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((row) => (
              <tr key={row.itemId} className="border-t border-zinc-900">
                <td className="py-2 pr-4 text-zinc-200">{row.kaLabel}</td>
                <td className="py-2 pr-4 text-zinc-400">{formatGel(row.valuesByYear[startYear] ?? null)}</td>
                <td className="py-2 pr-4 text-zinc-400">{formatGel(row.valuesByYear[endYear] ?? null)}</td>
                <td className="py-2 text-zinc-300">{formatSignedPercent(row.change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

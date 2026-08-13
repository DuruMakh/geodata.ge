import type { ExplorerModel } from "../../lib/explorer/explorerData";
import type { ExplorerScope, ExplorerTableRow } from "../../lib/explorer/types";
import { ACCENT, NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { buildKpiShareSeries } from "../../lib/explorer/sparkline";
import { Sparkline } from "../ui/sparkline";
import { formatAmount, formatAmountParts, formatBn, formatShare, MISSING } from "../../lib/explorer/format";
import { Overline, SectionTitle, SwatchBar } from "../ui/editorial";

// "ძირითადი ინდიკატორები" per DESIGN.md §8.5: hero KPI with a two-segment gauge and
// an editorial sentence, three side KPIs, the movers board, and the period comparison.

type IndicatorsProps = {
  model: ExplorerModel;
  scope: ExplorerScope;
};

const FIRST_COL_LABEL: Record<ExplorerScope, string> = {
  fields: "სფერო",
  ministries: "უწყება",
  revenue: "საბიუჯეტო მუხლი",
};

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

type MoverRowProps = {
  row: ExplorerTableRow;
  rank: number;
  maxAbsChange: number;
};

function MoverRow({ row, rank, maxAbsChange }: MoverRowProps) {
  const change = row.change ?? 0;
  const color = change >= 0 ? POSITIVE : NEGATIVE;
  const barWidth = `${Math.max(4, Math.round((Math.abs(change) / maxAbsChange) * 100))}%`;

  return (
    <div
      title={row.kaLabel}
      className="grid grid-cols-[24px_minmax(0,1fr)_96px_72px] items-center gap-3 border-t border-[var(--hairline-soft)] py-2.5"
    >
      <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
        {String(rank).padStart(2, "0")}
      </span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-medium leading-[1.4] text-[var(--ink)]">
        {row.kaLabel}
      </span>
      <span className="block h-[3px] overflow-hidden bg-[var(--hairline-soft)]">
        <span className="block h-full" style={{ background: color, width: barWidth }} />
      </span>
      <span className="text-right font-[family-name:var(--font-numeric)] text-xs" style={{ color }}>
        {formatShare(row.change, true)}
      </span>
    </div>
  );
}

export function Indicators({ model, scope }: IndicatorsProps) {
  const { years, totalRow, tableRows, comparisonRows, topGrowth, bottomGrowth } = model;
  const startYear = years[0];
  const endYear = years.at(-1);
  if (startYear === undefined || endYear === undefined) return null;

  const totalStart = totalRow?.valuesByYear[startYear] ?? 0;
  const totalEnd = totalRow?.valuesByYear[endYear] ?? 0;
  const totalChange = totalRow?.change ?? null;
  const gaugeMax = Math.max(totalStart, totalEnd);
  const gaugeBase = gaugeMax > 0 ? Math.min(totalStart, totalEnd) / gaugeMax : 0;
  const grew = totalEnd >= totalStart;
  const cagr =
    totalStart > 0 && totalEnd > 0 && endYear > startYear ? (totalEnd / totalStart) ** (1 / (endYear - startYear)) - 1 : null;
  // The sentence already states the direction (გაიზარდა/შემცირდა), so the amount is unsigned.
  const deltaParts = formatAmountParts(Math.abs(totalEnd - totalStart));
  const sideNoun = scope === "revenue" ? "ჯამური შემოსავლები" : "ჯამური ხარჯები";
  const showSentence = totalStart > 0 && totalEnd > 0 && totalStart !== totalEnd;

  // Side KPIs rank ALL top-level scope rows — the same population as the movers
  // board below, so identical headings never contradict each other on one screen.
  // The comparison table further down stays scoped to the user's selection.
  const scopeRows = comparisonRows.filter((row) => row.level !== "major_program");
  // Rows missing either endpoint have no meaningful period delta, and a delta
  // measured against a non-positive start is mostly the unwind of a correction
  // (e.g. revenue.other_taxes 2020→2021) — exclude both.
  const withDelta = scopeRows.flatMap((row) => {
    const startValue = row.valuesByYear[startYear];
    const endValue = row.valuesByYear[endYear];
    if (startValue === undefined || startValue === null || startValue <= 0 || endValue === undefined || endValue === null) return [];
    return [{ row, delta: endValue - startValue }];
  });
  const biggestIncrease = [...withDelta].sort((a, b) => b.delta - a.delta)[0] ?? null;
  const biggestParts = biggestIncrease ? formatAmountParts(biggestIncrease.delta, true) : { num: MISSING, unit: "" };
  const slowest = scopeRows.filter((row) => row.change !== null).sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0] ?? null;
  const largestShare = [...scopeRows].sort((a, b) => (b.valuesByYear[endYear] ?? 0) - (a.valuesByYear[endYear] ?? 0))[0] ?? null;

  const seriesValues = (source: ExplorerTableRow | null) =>
    source === null ? null : years.map((year) => source.valuesByYear[year] ?? null);

  const sideKpis = [
    {
      label: "ყველაზე დიდი ზრდა",
      value: biggestParts.num,
      unit: biggestParts.unit,
      color: "var(--ink)",
      detail: biggestIncrease ? truncate(biggestIncrease.row.kaLabel, 46) : MISSING,
      spark: biggestIncrease ? { values: seriesValues(biggestIncrease.row) ?? [], color: biggestIncrease.row.color } : null,
    },
    {
      label: "ყველაზე ნელი ზრდა",
      value: slowest ? formatShare(slowest.change, true) : MISSING,
      unit: "",
      color: slowest && (slowest.change ?? 0) < 0 ? NEGATIVE : "var(--ink)",
      detail: slowest ? truncate(slowest.kaLabel, 46) : MISSING,
      spark: slowest ? { values: seriesValues(slowest) ?? [], color: slowest.color } : null,
    },
    {
      label: "ყველაზე დიდი წილი მშპ-ში",
      value: largestShare ? formatShare(largestShare.shareEndYear) : MISSING,
      unit: "",
      color: "var(--ink)",
      detail: largestShare ? `${truncate(largestShare.kaLabel, 40)}, ${endYear}` : MISSING,
      spark: largestShare ? { values: buildKpiShareSeries(largestShare, years), color: ACCENT } : null,
    },
  ];

  const maxAbsChange = Math.max(
    ...comparisonRows.filter((row) => row.level !== "major_program").map((row) => Math.abs(row.change ?? 0)),
    0.001,
  );
  const comparisonSorted = tableRows
    .filter((row) => row.level !== "total")
    .sort((a, b) => (b.valuesByYear[endYear] ?? 0) - (a.valuesByYear[endYear] ?? 0));
  const selectedTotal = totalRow !== null && tableRows.some((row) => row.itemId === totalRow.itemId);

  const comparisonCell = (value: number | null | undefined) => (value === null || value === undefined ? MISSING : formatBn(value));

  return (
    <section data-testid="period-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <SectionTitle>ძირითადი ინდიკატორები</SectionTitle>
        <p className="text-[12.5px] text-[var(--muted)]">
          არჩეული პერიოდი: <span className="font-[family-name:var(--font-numeric)]">{startYear}–{endYear}</span>
        </p>
      </div>

      <div data-testid="period-kpi-cards" className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0 @min-[1100px]:pr-11">
          <Overline>პერიოდის ცვლილება</Overline>
          <p
            className="mt-3.5 whitespace-nowrap font-[family-name:var(--font-display)] text-[44px] font-semibold leading-none tracking-[-0.02em] min-[768px]:text-[62px]"
            style={{ color: totalChange !== null && totalChange < 0 ? NEGATIVE : "var(--ink)" }}
          >
            {formatShare(totalChange, true)}
          </p>
          <div className="mt-7 max-w-[480px]">
            <div className="flex h-[3px] bg-[var(--hairline-soft)]">
              <div className="h-[3px] bg-[var(--ink)]" style={{ width: `${(gaugeBase * 100).toFixed(1)}%` }} />
              <div className="h-[3px] bg-[var(--accent)]" style={{ width: `${((1 - gaugeBase) * 100).toFixed(1)}%` }} />
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <p className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                {startYear} · {formatAmount(totalStart)}
              </p>
              <p className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                {endYear} · {formatAmount(totalEnd)}
              </p>
            </div>
            {showSentence ? (
              <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
                {startYear}–{endYear} წლებში {sideNoun} {grew ? "გაიზარდა" : "შემცირდა"}{" "}
                <span className="font-[family-name:var(--font-numeric)] text-xs">{`${deltaParts.num} ${deltaParts.unit}`.trim()}</span>
                -ით
                {cagr !== null ? (
                  <>
                    {" — საშუალო წლიური "}
                    {cagr >= 0 ? "ზრდა " : "ცვლილება "}
                    <span className="font-[family-name:var(--font-numeric)] text-xs">{formatShare(cagr, true)}</span>.
                  </>
                ) : (
                  "."
                )}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-[26px] flex min-w-0 flex-col border-t border-[var(--hairline)] pt-[18px] @min-[1100px]:mt-0 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:pt-0 @min-[1100px]:pl-9">
          {sideKpis.map((kpi, index) => (
            <div
              key={kpi.label}
              data-testid="side-kpi"
              className={index === 0 ? "pt-0.5 pb-3.5" : index === sideKpis.length - 1 ? "border-t border-[var(--hairline-soft)] pt-3.5" : "border-t border-[var(--hairline-soft)] py-3.5"}
            >
              <Overline>{kpi.label}</Overline>
              <div className="mt-[7px] flex items-baseline justify-between gap-4">
                <p
                  className="whitespace-nowrap font-[family-name:var(--font-display)] text-2xl font-semibold leading-[1.1] tracking-[-0.02em]"
                  style={{ color: kpi.color }}
                >
                  {kpi.value}
                  {kpi.unit ? (
                    <span className="ml-1.5 font-[family-name:var(--font-numeric)] text-xs font-medium tracking-normal text-[var(--body)]">
                      {kpi.unit}
                    </span>
                  ) : null}
                </p>
                <p title={kpi.detail} className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-xs text-[var(--muted)]">
                  {kpi.detail}
                </p>
              </div>
              {kpi.spark ? <Sparkline values={kpi.spark.values} color={kpi.spark.color} /> : null}
            </div>
          ))}
        </div>
      </div>

      <div data-testid="period-movers" className="mt-9 grid gap-7 border-t border-[var(--hairline)] pt-6 @min-[1100px]:grid-cols-2 @min-[1100px]:gap-x-10">
        <div className="min-w-0">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--ink)]">ყველაზე მზარდი</h3>
          <div className="flex flex-col">
            {topGrowth.map((row, index) => (
              <MoverRow key={row.itemId} row={row} rank={index + 1} maxAbsChange={maxAbsChange} />
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--ink)]">ყველაზე ნელი ზრდა</h3>
          <div className="flex flex-col">
            {bottomGrowth.map((row, index) => (
              <MoverRow key={row.itemId} row={row} rank={index + 1} maxAbsChange={maxAbsChange} />
            ))}
          </div>
        </div>
      </div>

      <div data-testid="period-comparison" className="mt-9 border-t border-[var(--hairline)] pt-6">
        <h3 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">პერიოდის შედარება</h3>
        <p className="mb-3 text-xs text-[var(--muted)]">საწყისი მნიშვნელობა, ცვლილება და საბოლოო მნიშვნელობა (მლრდ ₾)</p>
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[44%]" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className="border-b-2 border-[var(--ink)] pr-3 pt-1.5 pb-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                {FIRST_COL_LABEL[scope]}
              </th>
              <th className="border-b-2 border-[var(--ink)] px-3 pt-1.5 pb-2 text-right font-[family-name:var(--font-numeric)] text-[11px] font-semibold text-[var(--muted)]">
                {startYear}
              </th>
              <th className="border-b-2 border-[var(--ink)] px-3 pt-1.5 pb-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                ცვლილება
              </th>
              <th className="border-b-2 border-[var(--ink)] pl-3 pt-1.5 pb-2 text-right font-[family-name:var(--font-numeric)] text-[11px] font-semibold text-[var(--muted)]">
                {endYear}
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              selectedTotal && totalRow ? { row: totalRow, label: totalRow.kaLabel, weight: 600, color: "var(--ink)" } : null,
              ...comparisonSorted.map((row) => ({ row, label: truncate(row.kaLabel, 40), weight: 500, color: row.color })),
            ]
              .filter((entry): entry is { row: ExplorerTableRow; label: string; weight: number; color: string } => entry !== null)
              .map(({ row, label, weight, color }) => {
                const startValue = row.valuesByYear[startYear] ?? null;
                const endValue = row.valuesByYear[endYear] ?? null;
                const delta = startValue === null || endValue === null ? null : endValue - startValue;

                return (
                  <tr key={row.itemId} className="border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)]">
                    <td className="py-2.5 pr-3" title={row.kaLabel}>
                      <span className="inline-flex min-w-0 items-start gap-[9px]">
                        <SwatchBar color={color} className="mt-[7px]" />
                        <span className="text-[12.5px] leading-[1.4] text-[var(--ink)]" style={{ fontWeight: weight }}>
                          {label}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap text-[var(--muted)]" style={{ fontWeight: weight }}>
                      {comparisonCell(startValue)}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap"
                      style={{ color: delta === null ? "var(--muted)" : delta >= 0 ? POSITIVE : NEGATIVE }}
                    >
                      {delta === null ? MISSING : `${delta >= 0 ? "+" : "−"}${formatBn(Math.abs(delta))}`}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap text-[var(--ink)]" style={{ fontWeight: weight }}>
                      {comparisonCell(endValue)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

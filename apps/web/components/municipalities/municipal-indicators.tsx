import type { MunicipalComparisonRow, MunicipalIndicatorPresentation, MunicipalKpi, MunicipalMover } from "../../lib/explorer/municipalData";
import { formatAmount, formatAmountParts, formatShare } from "../../lib/explorer/format";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { Sparkline } from "../ui/sparkline";
import { Overline, SectionTitle, SwatchBar } from "../ui/editorial";

// KPI row (DESIGN.md §7.11), movers board (§7.13) and the period comparison.

function MoverRow({ mover, maxAbs }: { mover: MunicipalMover; maxAbs: number }) {
  const growth = mover.growth;
  const width = growth === null || maxAbs === 0 ? 0 : (Math.abs(growth) / maxAbs) * 100;

  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)_96px_72px] items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2">
      <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
        {String(mover.rank).padStart(2, "0")}
      </span>
      <span className="truncate text-[12.5px]">{mover.kaLabel}</span>
      <span className="h-[3px] bg-[var(--hairline-soft)]">
        <span
          className="block h-[3px]"
          style={{ width: `${width.toFixed(0)}%`, backgroundColor: growthColor(growth) }}
        />
      </span>
      <span className="text-right font-[family-name:var(--font-numeric)] text-[11.5px]" style={{ color: growthColor(growth) }}>
        {formatShare(growth, true)}
      </span>
    </div>
  );
}

/** Positive/negative token for a growth figure; muted when there is no value. */
function growthColor(growth: number | null): string {
  if (growth === null) return "var(--muted)";
  return growth >= 0 ? POSITIVE : NEGATIVE;
}

type MunicipalIndicatorsProps = {
  kpis: MunicipalKpi[];
  movers: { up: MunicipalMover[]; down: MunicipalMover[] };
  comparison: MunicipalComparisonRow[];
  presentation: MunicipalIndicatorPresentation;
  startYear: number;
  endYear: number;
};

export function MunicipalIndicators({ kpis, movers, comparison, presentation, startYear, endYear }: MunicipalIndicatorsProps) {
  const maxAbs = Math.max(
    ...[...movers.up, ...movers.down].map((mover) => Math.abs(mover.growth ?? 0)),
    Number.EPSILON,
  );
  const { headline, sideSeries } = presentation;
  const gaugeMax = Math.max(headline.start ?? 0, headline.end ?? 0);
  const gaugeBase = gaugeMax > 0 ? Math.min(headline.start ?? 0, headline.end ?? 0) / gaugeMax : 0;
  const grew = (headline.end ?? 0) >= (headline.start ?? 0);
  const deltaParts = formatAmountParts(Math.abs((headline.end ?? 0) - (headline.start ?? 0)));
  const showSentence = headline.start !== null && headline.end !== null && headline.start !== headline.end;
  const sideKpis = [kpis[0]!, kpis[2]!, kpis[3]!];

  return (
    <section data-testid="period-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <SectionTitle>ძირითადი ინდიკატორები</SectionTitle>
          <p className="text-[12.5px] text-[var(--muted)]">
            არჩეული პერიოდი: <span className="font-[family-name:var(--font-numeric)]">{startYear}–{endYear}</span>
          </p>
        </div>

        <div data-testid="entity-kpi-grid" className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div data-testid="entity-kpi" className="min-w-0 @min-[1100px]:pr-11">
            <Overline>პერიოდის ცვლილება</Overline>
            <p
              className="mt-3.5 whitespace-nowrap font-[family-name:var(--font-display)] text-[44px] font-semibold leading-none tracking-[-0.02em] min-[768px]:text-[62px]"
              style={{ color: headline.change !== null && headline.change < 0 ? NEGATIVE : "var(--ink)" }}
            >
              {formatShare(headline.change, true, 0)}
            </p>
            <div className="mt-7 max-w-[480px]">
              <div data-testid="municipal-change-gauge" className="flex h-[3px] bg-[var(--hairline-soft)]">
                <div className="h-[3px] bg-[var(--ink)]" style={{ width: `${(gaugeBase * 100).toFixed(1)}%` }} />
                <div className="h-[3px] bg-[var(--accent)]" style={{ width: `${((1 - gaugeBase) * 100).toFixed(1)}%` }} />
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <p data-testid="municipal-change-start" className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                  {startYear} · {formatAmount(headline.start)}
                </p>
                <p data-testid="municipal-change-end" className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                  {endYear} · {formatAmount(headline.end)}
                </p>
              </div>
              {showSentence ? (
                <p data-testid="municipal-change-sentence" className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
                  {startYear}–{endYear} წლებში ოფიციალური ბიუჯეტი {grew ? "გაიზარდა" : "შემცირდა"}{" "}
                  <span className="font-[family-name:var(--font-numeric)] text-xs">{`${deltaParts.num} ${deltaParts.unit}`.trim()}</span>
                  -ით
                  {headline.cagr !== null ? (
                    <>
                      {" — საშუალო წლიური "}
                      {headline.cagr >= 0 ? "ზრდა " : "ცვლილება "}
                      <span className="font-[family-name:var(--font-numeric)] text-xs">{formatShare(headline.cagr, true)}</span>.
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
              <div key={kpi.label} data-testid="entity-kpi" className={index === 0 ? "pt-0.5 pb-3.5" : index === 2 ? "border-t border-[var(--hairline-soft)] pt-3.5" : "border-t border-[var(--hairline-soft)] py-3.5"}>
                <div data-testid="side-kpi">
                  <Overline>{kpi.label}</Overline>
                  <div className="mt-[7px] flex items-baseline justify-between gap-4">
                    <span className="whitespace-nowrap font-[family-name:var(--font-display)] text-2xl font-semibold leading-[1.1] tracking-[-0.02em]">{kpi.value}</span>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-xs text-[var(--muted)]" title={kpi.detail}>{kpi.detail}</span>
                  </div>
                  <Sparkline values={sideSeries[index]!} color="var(--ink)" />
                </div>
              </div>
            ))}
          </div>
        </div>

      <div data-testid="period-movers" className="mt-9 grid grid-cols-1 gap-7 border-t border-[var(--hairline)] pt-6 @min-[1100px]:grid-cols-2 @min-[1100px]:gap-x-10">
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">ყველაზე მზარდი</div>
          {movers.up.map((mover) => (
            <MoverRow key={mover.kaLabel} mover={mover} maxAbs={maxAbs} />
          ))}
        </div>
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">ყველაზე ნელი ზრდა</div>
          {movers.down.map((mover) => (
            <MoverRow key={mover.kaLabel} mover={mover} maxAbs={maxAbs} />
          ))}
        </div>
      </div>

      <div data-testid="period-comparison" className="mt-9 border-t border-[var(--hairline)] pt-6">
        <div className="mb-3.5 flex items-baseline justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold whitespace-nowrap">პერიოდის შედარება</h2>
          <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
            {startYear} → {endYear}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table data-testid="comparison-table" className="w-full border-collapse" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                {["ფუნქცია", String(startYear), "ცვლილება", String(endYear)].map((label, index) => (
                  <th
                    key={`comparison-header-${index}`}
                    className={`border-b-2 border-[var(--ink)] pb-[7px] text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)] ${
                      index === 0 ? "text-left" : "text-right"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr
                  key={row.kaLabel}
                  className={`border-b border-[var(--hairline-soft)] ${row.isTotal ? "bg-[var(--tint)]" : ""}`}
                >
                  <td className="py-[9px]">
                    <span className="inline-flex items-center gap-[9px]">
                      <SwatchBar color={row.color} />
                      <span className={`truncate text-[12.5px] ${row.isTotal ? "font-semibold" : "font-medium"}`}>
                        {row.kaLabel}
                      </span>
                    </span>
                  </td>
                  <td className="py-[9px] text-right font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--body)]">
                    {formatAmount(row.fromGel)}
                  </td>
                  <td
                    data-testid="comparison-change-cell"
                    className="py-[9px] text-right font-[family-name:var(--font-numeric)] text-[11.5px]"
                    style={{ color: growthColor(row.changeShare) }}
                  >
                    {formatAmount(row.changeGel)}
                  </td>
                  <td className="py-[9px] text-right font-[family-name:var(--font-numeric)] text-[11.5px] font-semibold">
                    {formatAmount(row.toGel)}
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

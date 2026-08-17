import type { SnapshotItem } from "../../lib/explorer/types";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { Callout } from "../ui/editorial";

// Budget field per DESIGN.md §9.6: bubble scatter — x share of total, y growth vs
// previous year, compact solid radius by amount; labels only on notable points.

type BudgetFieldProps = {
  items: SnapshotItem[];
};

const W = 920;
const H = 380;
const PAD_L = 52;
const PAD_R = 24;
const PAD_T = 18;
const PAD_B = 36;

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function BudgetField({ items }: BudgetFieldProps) {
  // Negative rows have no meaningful share/size geometry; growth from a
  // non-positive base is already null upstream, but guard the amount too.
  const withGrowth = items.filter(
    (item): item is SnapshotItem & { changeFromPreviousYear: number } =>
      item.changeFromPreviousYear !== null && item.amountGel > 0,
  );

  if (withGrowth.length === 0) {
    return (
      <div data-testid="budget-field" className="mt-9 border-t border-[var(--hairline)] pt-6">
        <h3 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">ბიუჯეტის ველი</h3>
        <p className="mb-4 text-xs text-[var(--muted)]">x — წილი მთლიანიდან · y — ზრდა წინა წელთან · ზომა — მოცულობა</p>
        <Callout>
          წინა წლის მონაცემები არ არის ხელმისაწვდომი — ზრდის მაჩვენებლები ამ წლისთვის ვერ გამოჩნდება. აირჩიე უფრო გვიანი წელი.
        </Callout>
      </div>
    );
  }

  const shares = withGrowth.map((item) => item.shareOfTotal * 100);
  const growths = withGrowth.map((item) => item.changeFromPreviousYear * 100);
  const xMax = Math.max(5, Math.ceil((Math.max(...shares) * 1.15) / 5) * 5);
  const growthMin = Math.min(0, ...growths);
  const growthMax = Math.max(0, ...growths);
  const yPad = Math.max(4, (growthMax - growthMin) * 0.15);
  const yMin = Math.floor((growthMin - yPad) / 10) * 10;
  const yMax = Math.ceil((growthMax + yPad) / 10) * 10;
  const x = (share: number) => PAD_L + (share / xMax) * (W - PAD_L - PAD_R);
  const y = (growth: number) => PAD_T + (1 - (growth - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const ySpan = yMax - yMin;
  const roughYStep = Math.max(10, ySpan / 8);
  const yMagnitude = 10 ** Math.floor(Math.log10(roughYStep));
  const normalizedYStep = roughYStep / yMagnitude;
  const yMultiplier = normalizedYStep <= 1 ? 1 : normalizedYStep <= 2 ? 2 : normalizedYStep <= 5 ? 5 : 10;
  const yStep = Math.max(10, yMultiplier * yMagnitude);
  const yTicks: number[] = [];
  for (let tick = Math.ceil(yMin / yStep) * yStep; tick <= yMax; tick += yStep) yTicks.push(tick);
  const xStep = xMax <= 20 ? 5 : 10;
  const xTicks: number[] = [];
  for (let tick = xStep; tick <= xMax; tick += xStep) xTicks.push(tick);

  const maxAmount = Math.max(...withGrowth.map((item) => item.amountGel), 1);
  const byAmount = [...withGrowth].sort((a, b) => b.amountGel - a.amountGel);
  const labeled = new Set(byAmount.slice(0, 3).map((item) => item.itemId));
  for (const item of withGrowth) {
    if (Math.abs(item.changeFromPreviousYear) >= 0.2 && labeled.size < 5) labeled.add(item.itemId);
  }
  const placedLabels: Array<{ x: number; y: number }> = [];

  return (
    <div data-testid="budget-field" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h3 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">ბიუჯეტის ველი</h3>
      <p className="mb-4 text-xs text-[var(--muted)]">x — წილი მთლიანიდან · y — ზრდა წინა წელთან · ზომა — მოცულობა</p>
      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ბიუჯეტის ველი" className="block h-auto w-full min-w-[720px]">
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#1E1B16" : "#E7DECF"} strokeWidth={1} />
            <text x={PAD_L - 8} y={y(tick) + 3} fontSize={11} fill="#6A6050" textAnchor="end" style={{ fontFamily: "var(--font-numeric)" }}>
              {tick > 0 ? `+${tick}%` : `${tick}%`.replace("-", "−")}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text key={`x-${tick}`} x={x(tick)} y={H - 14} fontSize={11} fill="#6A6050" textAnchor="middle" style={{ fontFamily: "var(--font-numeric)" }}>
            {tick}%
          </text>
        ))}
        <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={H - PAD_B} stroke="#D9CFBE" strokeWidth={1} />
        {byAmount.map((item) => {
          const radius = 6 + Math.sqrt(item.amountGel / maxAmount) * 16;
          const cx = x(item.shareOfTotal * 100);
          const cy = y(item.changeFromPreviousYear * 100);

          let label = null;
          if (labeled.has(item.itemId)) {
            let anchor: "start" | "middle" | "end" = "middle";
            let lx = cx;
            if (cx < PAD_L + 60) {
              anchor = "start";
              lx = Math.max(PAD_L + 2, cx - radius);
            } else if (cx > W - 80) {
              anchor = "end";
              lx = Math.min(W - 2, cx + radius);
            }
            let ly = Math.max(PAD_T + 10, cy - radius - 6);
            const collides = (px: number, py: number) =>
              placedLabels.some((placed) => Math.abs(placed.x - px) < 150 && Math.abs(placed.y - py) < 14);
            if (collides(lx, ly)) ly = Math.min(H - PAD_B - 4, cy + radius + 13);
            if (!collides(lx, ly)) {
              placedLabels.push({ x: lx, y: ly });
              label = (
                <text x={lx} y={ly} fontSize={11} fill="#55503F" textAnchor={anchor} fontWeight={500} style={{ fontFamily: "var(--font-ui)" }}>
                  {truncate(item.kaLabel, 26)}
                </text>
              );
            }
          }

          return (
            <g key={item.itemId}>
              <circle cx={cx} cy={cy} r={radius} fill={item.color} stroke="var(--paper)" strokeWidth={2}>
                <title>
                  {`${item.kaLabel} · ${formatAmount(item.amountGel)} · წილი ${formatShare(item.shareOfTotal)} · ზრდა ${formatShare(item.changeFromPreviousYear, true)}`}
                </title>
              </circle>
              {label}
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

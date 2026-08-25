"use client";

import { useState } from "react";
import type { SnapshotItem } from "../../lib/explorer/types";
import { formatAmount } from "../../lib/explorer/format";
import { Callout } from "../ui/editorial";

// Budget field per DESIGN.md §9.6: bubble scatter — x share of total, y growth vs
// previous year, compact solid radius by amount; names live in hover tooltips.

type BudgetFieldProps = {
  items: SnapshotItem[];
};

const W = 920;
const H = 380;
const PAD_L = 52;
const PAD_R = 24;
const PAD_T = 18;
const PAD_B = 36;

export function BudgetField({ items }: BudgetFieldProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Negative rows have no meaningful share/size geometry; growth from a
  // non-positive base is already null upstream, but guard the amount too.
  const withGrowth = items.filter(
    (item): item is SnapshotItem & { changeFromPreviousYear: number } =>
      item.changeFromPreviousYear !== null && item.amountGel > 0,
  );

  if (withGrowth.length === 0) {
    return (
      <div data-testid="budget-field" className="mt-9 border-t border-[var(--hairline)] pt-6">
        <h2 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">ბიუჯეტის ველი</h2>
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
  const roughYStep = ySpan / 8;
  const yMagnitude = 10 ** Math.floor(Math.log10(roughYStep));
  const normalizedYStep = roughYStep / yMagnitude;
  const yMultiplier = normalizedYStep <= 1 ? 1 : normalizedYStep <= 2 ? 2 : normalizedYStep <= 5 ? 5 : 10;
  const yStep = ySpan <= 100 ? 10 : Math.max(10, yMultiplier * yMagnitude);
  const yTicks: number[] = [];
  for (let tick = Math.ceil(yMin / yStep) * yStep; tick <= yMax; tick += yStep) yTicks.push(tick);
  const xStep = xMax <= 20 ? 5 : 10;
  const xTicks: number[] = [];
  for (let tick = xStep; tick <= xMax; tick += xStep) xTicks.push(tick);

  const maxAmount = Math.max(...withGrowth.map((item) => item.amountGel), 1);
  const byAmount = [...withGrowth].sort((a, b) => b.amountGel - a.amountGel);
  const activeItem = byAmount.find((item) => item.itemId === activeId) ?? null;
  const activeX = activeItem === null ? null : (x(activeItem.shareOfTotal * 100) / W) * 100;
  const activeY = activeItem === null ? null : (y(activeItem.changeFromPreviousYear * 100) / H) * 100;

  return (
    <div data-testid="budget-field" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h2 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">ბიუჯეტის ველი</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">x — წილი მთლიანიდან · y — ზრდა წინა წელთან · ზომა — მოცულობა</p>
      <div className="overflow-x-auto">
      <div className="relative min-w-[720px]">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="ბიუჯეტის ველი" className="block h-auto w-full">
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

          return (
            <g key={item.itemId}>
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={item.color}
                stroke="var(--paper)"
                strokeWidth={2}
                role="img"
                tabIndex={0}
                aria-label={`${item.kaLabel} · ${formatAmount(item.amountGel)}`}
                onPointerEnter={() => setActiveId(item.itemId)}
                onPointerLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(item.itemId)}
                onBlur={() => setActiveId(null)}
              >
                <title>{`${item.kaLabel} · ${formatAmount(item.amountGel)}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      {activeItem !== null && activeX !== null && activeY !== null ? (
        <div
          data-testid="budget-field-tooltip"
          className="pointer-events-none absolute z-[2] max-w-[240px] rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
          style={{
            left: `${activeX}%`,
            top: `${activeY}%`,
            transform: `${activeX > 60 ? "translateX(calc(-100% - 10px))" : "translateX(10px)"} ${activeY > 50 ? "translateY(calc(-100% - 10px))" : "translateY(10px)"}`,
          }}
        >
          <div className="text-[11px] font-medium text-[var(--body)]">{activeItem.kaLabel}</div>
          <div className="mt-0.5 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
            {formatAmount(activeItem.amountGel)}
          </div>
        </div>
      ) : null}
      </div>
      </div>
    </div>
  );
}

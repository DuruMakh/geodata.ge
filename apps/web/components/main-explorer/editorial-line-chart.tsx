"use client";

import { useState } from "react";
import { formatBn, formatShare } from "../../lib/explorer/format";
import { SwatchBar } from "../ui/editorial";

// Bespoke SVG line chart per DESIGN.md §8.3: chart sits directly on paper, grid in
// hairline-soft, ink baseline at zero, mono axis labels, hover crosshair + tooltip.

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  vals: (number | null)[];
  planned: boolean[];
};

type EditorialLineChartProps = {
  years: number[];
  series: ChartSeries[];
  share: boolean;
};

const W = 920;
const H = 320;
// A little wider than the reference prototype's 62 so 8-character axis labels
// ("7.5 მლრდ") never clip at the viewBox edge.
const PAD_L = 74;
const PAD_R = 30;
const PAD_T = 16;
const PAD_B = 26;

function niceMax(rawMax: number): number {
  const raw = rawMax * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function EditorialLineChart({ years, series, share }: EditorialLineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const n = years.length;

  let maxValue = 0;
  for (const line of series) for (const value of line.vals) if (value !== null && value > maxValue) maxValue = value;
  if (maxValue <= 0) maxValue = 1;
  const top = niceMax(maxValue);

  const x = (index: number) => PAD_L + (n <= 1 ? (W - PAD_L - PAD_R) / 2 : (index * (W - PAD_L - PAD_R)) / (n - 1));
  const y = (value: number) => PAD_T + (1 - value / top) * (H - PAD_T - PAD_B);
  // Axis precision follows the gridline step so small-magnitude series (single
  // programs, share mode) never produce duplicate or all-zero labels.
  const shareDigits = Math.max(0, -Math.floor(Math.log10(top / 4)));
  const bnDigits = Math.min(4, Math.max(1, -Math.floor(Math.log10(top / 4 / 1_000_000_000))));
  const formatAxis = (value: number) =>
    share
      ? `${value.toFixed(shareDigits)}%`
      : `${(value / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: bnDigits })} მლრდ`;
  const formatValue = (value: number | null) => (share ? formatShare(value === null ? null : value / 100) : formatBn(value));

  const gridLines = [0, 1, 2, 3, 4].map((step) => (top / 4) * step);
  const labelStep = Math.max(1, Math.ceil(n / 12));

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const step = n <= 1 ? 1 : (W - PAD_L - PAD_R) / (n - 1);
    const index = Math.min(n - 1, Math.max(0, Math.round((px - PAD_L) / step)));
    if (index !== hover) setHover(index);
  }

  const hoverX = hover === null ? null : (x(hover) / W) * 100;

  return (
    <div data-testid="chart-frame" className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="მრავალწლიანი დინამიკა"
        className="block h-auto w-full touch-pan-y"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
      >
        {gridLines.map((value, index) => (
          <g key={`grid-${index}`}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(value)} y2={y(value)} stroke={index === 0 ? "#1E1B16" : "#E7DECF"} strokeWidth={1} />
            <text x={PAD_L - 10} y={y(value) + 3} fontSize={10} fill="#6A6050" textAnchor="end" fontFamily="var(--font-numeric)">
              {formatAxis(value)}
            </text>
          </g>
        ))}
        <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={H - PAD_B} stroke="#D9CFBE" strokeWidth={1} />
        {years.map((year, index) => {
          const isLast = index === n - 1;
          const show = isLast || (index % labelStep === 0 && n - 1 - index >= labelStep);
          if (!show) return null;
          const anchor = index === 0 ? "start" : isLast ? "end" : "middle";
          const tx = index === 0 ? x(index) - 4 : isLast ? x(index) + 4 : x(index);

          return (
            <text key={`year-${year}`} x={tx} y={H - 8} fontSize={10} fill="#6A6050" textAnchor={anchor} fontFamily="var(--font-numeric)">
              {year}
            </text>
          );
        })}
        {hover !== null ? (
          <line x1={x(hover)} x2={x(hover)} y1={PAD_T - 6} y2={H - PAD_B} stroke="#C9BEA9" strokeWidth={1} />
        ) : null}
        {series.map((line) => {
          const points: Array<[number, number, number]> = [];
          for (let index = 0; index < n; index += 1) {
            const value = line.vals[index];
            if (value !== null && value !== undefined) points.push([x(index), y(value), index]);
          }
          if (points.length === 0) return null;
          const path = points.map(([px, py], index) => `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
          const last = points[points.length - 1];

          return (
            <g key={line.id}>
              <path d={path} fill="none" stroke={line.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={last[0]} cy={last[1]} r={3.5} fill={line.color} />
              {points
                .filter(([, , index]) => line.planned[index])
                .map(([px, py, index]) => (
                  <circle key={`planned-${index}`} cx={px} cy={py} r={3} fill="#F7F2E9" stroke={line.color} strokeWidth={1.5} />
                ))}
              {hover !== null && line.vals[hover] !== null && line.vals[hover] !== undefined ? (
                <circle cx={x(hover)} cy={y(line.vals[hover] as number)} r={3.5} fill="#F7F2E9" stroke={line.color} strokeWidth={2} />
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null && hoverX !== null ? (
        <div
          className="pointer-events-none absolute top-0 z-[2] flex min-w-[200px] flex-col gap-1 rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
          style={{
            left: `${hoverX}%`,
            transform: hoverX > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <div className="mb-0.5 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">{years[hover]}</div>
          {series.map((line) => (
            <div key={line.id} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--body)]">
                <SwatchBar color={line.color} className="!w-3" />
                <span className="max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap">{line.label}</span>
              </span>
              <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
                {formatValue(line.vals[hover] ?? null)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

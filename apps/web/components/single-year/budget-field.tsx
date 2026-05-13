"use client";

import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, type TooltipContentProps } from "recharts";
import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type BudgetFieldProps = {
  items: SnapshotItem[];
  hasGrowthData: boolean;
};

type BudgetFieldDatum = {
  itemId: string;
  kaLabel: string;
  color: string;
  amountGel: number;
  shareOfTotal: number;
  changeFromPreviousYear: number | null;
  growthValue: number;
};

const CHART_HEIGHT = 360;
const INITIAL_CHART_DIMENSION = { width: 760, height: CHART_HEIGHT };

function isBudgetFieldDatum(value: unknown): value is BudgetFieldDatum {
  if (typeof value !== "object" || value === null) return false;
  const datum = value as Partial<BudgetFieldDatum>;
  return typeof datum.kaLabel === "string" && typeof datum.amountGel === "number" && typeof datum.shareOfTotal === "number";
}

function BudgetFieldTooltip({ active, payload }: TooltipContentProps) {
  const datum = payload?.[0]?.payload;

  if (!active || !isBudgetFieldDatum(datum)) return null;

  return (
    <div className="border border-cyan-400/35 bg-[#05070b] px-3 py-2 text-sm text-zinc-100 shadow-xl shadow-cyan-950/40">
      <p className="font-semibold text-white">{datum.kaLabel}</p>
      <p className="mt-1 font-mono text-cyan-100">{formatGel(datum.amountGel)}</p>
      <p className="mt-1 text-xs text-zinc-400">Share: {formatPercent(datum.shareOfTotal)}</p>
      <p className="mt-1 text-xs text-zinc-400">Growth: {formatSignedPercent(datum.changeFromPreviousYear)}</p>
    </div>
  );
}

export function BudgetField({ items, hasGrowthData }: BudgetFieldProps) {
  const data: BudgetFieldDatum[] = items.map((item) => ({
    itemId: item.itemId,
    kaLabel: item.kaLabel,
    color: item.color,
    amountGel: item.amountGel,
    shareOfTotal: item.shareOfTotal,
    changeFromPreviousYear: item.changeFromPreviousYear,
    growthValue: item.changeFromPreviousYear ?? 0,
  }));

  return (
    <section data-testid="budget-field" className="mt-4 min-w-[760px]">
      <h3 className="mb-3 text-lg font-semibold text-white">Budget Field</h3>
      <div className="h-[400px] border border-cyan-400/20 bg-black/40 p-3">
        {hasGrowthData ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
            <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 12 }}>
              <CartesianGrid stroke="rgba(34, 211, 238, 0.16)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="shareOfTotal"
                name="Share"
                tickFormatter={formatPercent}
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={{ stroke: "rgba(34, 211, 238, 0.32)" }}
                tickLine={{ stroke: "rgba(34, 211, 238, 0.32)" }}
              />
              <YAxis
                type="number"
                dataKey="growthValue"
                name="Growth"
                tickFormatter={formatSignedPercent}
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={{ stroke: "rgba(34, 211, 238, 0.32)" }}
                tickLine={{ stroke: "rgba(34, 211, 238, 0.32)" }}
              />
              <ZAxis type="number" dataKey="amountGel" range={[90, 1200]} />
              <Tooltip content={BudgetFieldTooltip} cursor={{ stroke: "#22d3ee", strokeWidth: 1 }} />
              <Scatter data={data} isAnimationActive={false}>
                {data.map((item) => (
                  <Cell key={item.itemId} fill={item.color} stroke="#05070b" strokeWidth={1.5} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center border border-amber-300/30 bg-amber-300/10 p-6 text-center text-sm text-amber-100">
            ზრდის საჩვენებლად წინა ხელმისაწვდომი წელი საჭიროა.
          </div>
        )}
      </div>
    </section>
  );
}

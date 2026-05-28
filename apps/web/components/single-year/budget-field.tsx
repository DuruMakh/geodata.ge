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

type SnapshotItemWithGrowth = SnapshotItem & {
  changeFromPreviousYear: number;
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
    <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] shadow-xl">
      <p className="font-semibold">{datum.kaLabel}</p>
      <p className="mt-1 text-[var(--primary)]">{formatGel(datum.amountGel)}</p>
      <p className="mt-1 text-xs text-[var(--body)]">{"\u10ec\u10d8\u10da\u10d8"}: {formatPercent(datum.shareOfTotal)}</p>
      <p className="mt-1 text-xs text-[var(--body)]">{"\u10d6\u10e0\u10d3\u10d0"}: {formatSignedPercent(datum.changeFromPreviousYear)}</p>
    </div>
  );
}

export function BudgetField({ items, hasGrowthData }: BudgetFieldProps) {
  const data: BudgetFieldDatum[] = items
    .filter((item): item is SnapshotItemWithGrowth => item.changeFromPreviousYear !== null)
    .map((item) => ({
      itemId: item.itemId,
      kaLabel: item.kaLabel,
      color: item.color,
      amountGel: item.amountGel,
      shareOfTotal: item.shareOfTotal,
      changeFromPreviousYear: item.changeFromPreviousYear,
      growthValue: item.changeFromPreviousYear,
    }));

  return (
    <section data-testid="budget-field" className="min-w-[760px] rounded-[20px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <h3 className="mb-3 text-lg font-semibold text-[var(--ink)]">{"\u10d1\u10d8\u10e3\u10ef\u10d4\u10e2\u10d8\u10e1 \u10d5\u10d4\u10da\u10d8"}</h3>
      <div className="h-[400px] rounded-[18px] bg-[var(--canvas)] p-3">
        {hasGrowthData && data.length > 0 ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
            <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 12 }}>
              <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="shareOfTotal"
                name={"\u10ec\u10d8\u10da\u10d8"}
                tickFormatter={formatPercent}
                stroke="var(--mute)"
                tick={{ fill: "var(--mute)", fontSize: 11 }}
                axisLine={{ stroke: "var(--hairline)" }}
                tickLine={{ stroke: "var(--hairline)" }}
              />
              <YAxis
                type="number"
                dataKey="growthValue"
                name={"\u10d6\u10e0\u10d3\u10d0"}
                tickFormatter={formatSignedPercent}
                stroke="var(--mute)"
                tick={{ fill: "var(--mute)", fontSize: 11 }}
                axisLine={{ stroke: "var(--hairline)" }}
                tickLine={{ stroke: "var(--hairline)" }}
              />
              <ZAxis type="number" dataKey="amountGel" range={[90, 1200]} />
              <Tooltip content={BudgetFieldTooltip} cursor={{ stroke: "var(--primary)", strokeWidth: 1 }} />
              <Scatter data={data} isAnimationActive={false}>
                {data.map((item) => (
                  <Cell key={item.itemId} fill={item.color} stroke="var(--surface)" strokeWidth={1.5} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[16px] border border-[var(--hairline)] bg-[var(--soft)] p-6 text-center text-sm text-[var(--body)]">
            {"\u10d6\u10e0\u10d3\u10d8\u10e1 \u10e1\u10d0\u10e9\u10d5\u10d4\u10dc\u10d4\u10d1\u10da\u10d0\u10d3 \u10ec\u10d8\u10dc\u10d0 \u10ee\u10d4\u10da\u10db\u10d8\u10e1\u10d0\u10ec\u10d5\u10d3\u10dd\u10db\u10d8 \u10ec\u10d4\u10da\u10d8 \u10e1\u10d0\u10ed\u10d8\u10e0\u10dd\u10d0."}
          </div>
        )}
      </div>
    </section>
  );
}

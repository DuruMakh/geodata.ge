"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMeasureValue } from "../../lib/explorer/format";
import type { ChartMode, ExplorerItem, ExplorerPoint, MeasureMode } from "../../lib/explorer/types";

type ChartFrameProps = {
  mode: Exclude<ChartMode, "table">;
  measure: MeasureMode;
  years: number[];
  points: ExplorerPoint[];
  selectedItems: ExplorerItem[];
};

type ChartDatum = {
  year: number;
  basis?: "actual" | "planned";
  itemId?: string;
  kaLabel?: string;
  value?: number | null;
  [key: string]: string | number | null | undefined;
};

function chartKey(itemId: string): string {
  return itemId.replace(/[^a-z0-9]/gi, "_");
}

export function ChartFrame({ mode, measure, years, points, selectedItems }: ChartFrameProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center border border-cyan-400/20 bg-black/40 p-6 text-sm text-zinc-400">
        არჩეული მონაცემი არ არის.
      </div>
    );
  }

  if (mode === "bar") {
    const barRows = [...points]
      .filter((point) => point.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    return (
      <div className="h-[420px] border border-cyan-400/20 bg-black/40 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barRows} margin={{ top: 20, right: 16, bottom: 72, left: 18 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="kaLabel" stroke="#a1a1aa" tick={{ fontSize: 12 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis stroke="#a1a1aa" tickFormatter={(value) => formatMeasureValue(Number(value), measure)} width={88} />
            <Tooltip
              contentStyle={{ background: "#05070b", border: "1px solid rgba(34, 211, 238, 0.35)", color: "#f4f4f5" }}
              formatter={(value) => formatMeasureValue(Number(value), measure)}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {barRows.map((row) => (
                <Cell key={row.itemId} fill={row.basis === "planned" ? "#facc15" : "#22d3ee"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const rows: ChartDatum[] = years.map((year) => ({ year }));

  for (const point of points) {
    const row = rows.find((entry) => entry.year === point.year);
    if (!row) continue;
    const key = chartKey(point.itemId);
    row[key] = point.value;
    row[`${key}Basis`] = point.basis;
  }

  return (
    <div className="h-[420px] border border-cyan-400/20 bg-black/40 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 18, right: 24, bottom: 12, left: 18 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="year" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
          <YAxis stroke="#a1a1aa" tickFormatter={(value) => formatMeasureValue(Number(value), measure)} width={88} />
          <Tooltip
            contentStyle={{ background: "#05070b", border: "1px solid rgba(34, 211, 238, 0.35)", color: "#f4f4f5" }}
            formatter={(value) => formatMeasureValue(Number(value), measure)}
          />
          {selectedItems.map((item) => {
            const key = chartKey(item.id);
            const hasPlanned = points.some((point) => point.itemId === item.id && point.basis === "planned");

            return (
              <Line
                key={item.id}
                type="monotone"
                dataKey={key}
                name={item.kaLabel}
                stroke={item.color}
                strokeWidth={2}
                strokeDasharray={hasPlanned ? "5 5" : undefined}
                dot={{ r: hasPlanned ? 4 : 3, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

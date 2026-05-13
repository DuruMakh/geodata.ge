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

const CHART_HEIGHT = 396;
const INITIAL_CHART_DIMENSION = { width: 900, height: CHART_HEIGHT };

function chartKey(itemId: string): string {
  return itemId.replace(/[^a-z0-9]/gi, "_");
}

function renderPointDot(props: { cx?: number; cy?: number; payload?: ChartDatum; stroke?: string }, key: string) {
  if (props.cx === undefined || props.cy === undefined) return null;

  const planned = props.payload?.[`${key}Basis`] === "planned";

  return (
    <circle
      cx={props.cx}
      cy={props.cy}
      r={planned ? 5 : 3}
      fill={planned ? "#facc15" : "#05070b"}
      stroke={planned ? "#facc15" : props.stroke ?? "#22d3ee"}
      strokeWidth={2}
    />
  );
}

function buildYearRows(years: number[], points: ExplorerPoint[]): ChartDatum[] {
  const rows: ChartDatum[] = years.map((year) => ({ year }));

  for (const point of points) {
    const row = rows.find((entry) => entry.year === point.year);
    if (!row) continue;
    const key = chartKey(point.itemId);
    row[key] = point.value;
    row[`${key}Basis`] = point.basis;
  }

  return rows;
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
    const colorByItemId = new Map(selectedItems.map((item) => [item.id, item.color]));

    return (
      <div className="h-[420px] border border-cyan-400/20 bg-black/40 p-3">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
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
                <Cell
                  key={row.itemId}
                  fill={colorByItemId.get(row.itemId) ?? "#22d3ee"}
                  opacity={row.basis === "planned" ? 0.6 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (mode === "stacked") {
    const rows = buildYearRows(years, points);
    const stackItems = selectedItems.filter((item) => !item.id.endsWith(".total"));

    if (stackItems.length === 0) {
      return (
        <div className="flex h-[420px] items-center justify-center border border-cyan-400/20 bg-black/40 p-6 text-sm text-zinc-400">
          კომპოზიციისთვის აირჩიე ცალკეული კატეგორიები, არა ჯამის სერია.
        </div>
      );
    }

    return (
      <div className="h-[420px] border border-cyan-400/20 bg-black/40 p-3">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
          <BarChart data={rows} margin={{ top: 20, right: 16, bottom: 28, left: 18 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
            <YAxis stroke="#a1a1aa" tickFormatter={(value) => formatMeasureValue(Number(value), measure)} width={88} />
            <Tooltip
              contentStyle={{ background: "#05070b", border: "1px solid rgba(34, 211, 238, 0.35)", color: "#f4f4f5" }}
              formatter={(value) => formatMeasureValue(Number(value), measure)}
            />
            {stackItems.map((item) => {
              const key = chartKey(item.id);

              return <Bar key={item.id} dataKey={key} name={item.kaLabel} stackId="composition" fill={item.color} />;
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const rows = buildYearRows(years, points);

  return (
    <div className="h-[420px] border border-cyan-400/20 bg-black/40 p-3">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
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

            return (
              <Line
                key={item.id}
                type="monotone"
                dataKey={key}
                name={item.kaLabel}
                stroke={item.color}
                strokeWidth={2}
                dot={(props) => renderPointDot(props, key)}
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

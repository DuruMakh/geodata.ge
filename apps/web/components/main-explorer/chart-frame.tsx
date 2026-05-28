"use client";

import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { isDerivedTotalItemId } from "../../lib/explorer/explorerData";
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

const BILLION = 1_000_000_000;
const CHART_HEIGHT = 360;
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
      fill={planned ? "var(--yellow)" : "var(--surface)"}
      stroke={planned ? "var(--yellow)" : props.stroke ?? "var(--primary)"}
      strokeWidth={3}
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

function formatBillions(value: number) {
  const billions = value / BILLION;
  if (billions === 0) return "0";
  if (billions >= 1) return Number.isInteger(billions) ? String(billions) : billions.toFixed(1).replace(/\.0$/, "");
  return billions.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function niceStep(rawStep: number) {
  if (rawStep <= 0) return 1;

  const power = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / power;

  if (normalized <= 1) return power;
  if (normalized <= 2) return 2 * power;
  if (normalized <= 5) return 5 * power;
  return 10 * power;
}

function buildBillionTicks(points: ExplorerPoint[], targetIntervals = 4) {
  const maxValue = Math.max(...points.map((point) => Number(point.value ?? 0)), 0);
  const maxBillions = maxValue / BILLION;
  const step = niceStep(maxBillions / targetIntervals);
  const top = Math.max(step, Math.ceil(maxBillions / step) * step);
  const ticks = [];

  for (let tick = 0; tick <= top + step / 2; tick += step) {
    ticks.push(Number((tick * BILLION).toPrecision(12)));
  }

  return ticks.length >= 2 ? ticks : [0, top * BILLION];
}

function formatAxisTick(value: number, measure: MeasureMode) {
  return measure === "nominal" ? formatBillions(value) : formatMeasureValue(value, measure);
}

export function ChartFrame({ mode, measure, years, points, selectedItems }: ChartFrameProps) {
  if (points.length === 0) {
    return (
      <div data-testid="chart-frame" className="overflow-x-auto">
        <div className="h-[360px] min-w-[680px]">
          <div className="flex h-full items-center justify-center text-sm text-[var(--body)]">
            არჩეული მონაცემი არ არის.
          </div>
        </div>
      </div>
    );
  }

  if (mode === "bar") {
    const barRows = [...points]
      .filter((point) => point.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const colorByItemId = new Map(selectedItems.map((item) => [item.id, item.color]));

    return (
      <div data-testid="chart-frame" className="overflow-x-auto">
        <div className="h-[360px] min-w-[680px]">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
            <BarChart data={barRows} margin={{ top: 20, right: 16, bottom: 72, left: 18 }}>
              <XAxis dataKey="kaLabel" stroke="var(--mute)" tick={{ fontSize: 12 }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--mute)" tickFormatter={(value) => formatAxisTick(Number(value), measure)} width={72} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
                formatter={(value) => formatMeasureValue(Number(value), measure)}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {barRows.map((row) => (
                  <Cell
                    key={row.itemId}
                    fill={colorByItemId.get(row.itemId) ?? "var(--primary)"}
                    opacity={row.basis === "planned" ? 0.6 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (mode === "stacked") {
    const rows = buildYearRows(years, points);
    const stackItems = selectedItems.filter((item) => !isDerivedTotalItemId(item.id));

    if (stackItems.length === 0) {
      return (
        <div data-testid="chart-frame" className="overflow-x-auto">
          <div className="flex h-[360px] min-w-[680px] items-center justify-center text-sm text-[var(--body)]">
            კომპოზიციისთვის აირჩიე ცალკეული კატეგორიები, არა ჯამის სერია.
          </div>
        </div>
      );
    }

    return (
      <div data-testid="chart-frame" className="flex min-w-0 flex-col gap-2 overflow-x-auto">
        <p className="rounded-[12px] border border-[var(--hairline)] bg-[var(--soft)] px-3 py-2 text-xs text-[var(--body)]">
          კომპოზიცია აჩვენებს არჩეული კატეგორიების წილს მთლიანში; არაარჩეული კატეგორიები გრაფიკში არ ჯამდება.
        </p>
        <div
          className="h-[360px] min-w-[680px]"
          data-chart-mode="stacked"
          data-measure={measure}
          data-series-count={stackItems.length}
          data-testid="stacked-composition-chart"
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
            <BarChart data={rows} margin={{ top: 20, right: 16, bottom: 28, left: 18 }}>
              <XAxis dataKey="year" stroke="var(--mute)" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--mute)" tickFormatter={(value) => formatAxisTick(Number(value), measure)} width={72} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
                formatter={(value) => formatMeasureValue(Number(value), measure)}
              />
              {stackItems.map((item) => {
                const key = chartKey(item.id);

                return <Bar key={item.id} dataKey={key} name={item.kaLabel} stackId="composition" fill={item.color} />;
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const rows = buildYearRows(years, points);
  const yTicks = measure === "nominal" ? buildBillionTicks(points) : undefined;

  return (
    <div data-testid="chart-frame" className="overflow-x-auto">
      <div className="h-[360px] min-w-[680px]">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
          <LineChart data={rows} margin={{ top: 18, right: 24, bottom: 12, left: 36 }}>
            <XAxis dataKey="year" stroke="var(--mute)" tick={{ fontSize: 12 }} padding={{ left: 72, right: 8 }} axisLine={false} tickLine={false} />
            <YAxis
              stroke="var(--mute)"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatAxisTick(Number(value), measure)}
              ticks={yTicks}
              domain={yTicks ? [0, yTicks.at(-1) ?? "auto"] : undefined}
              width={72}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
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
                  strokeWidth={isDerivedTotalItemId(item.id) ? 4 : 3}
                  dot={(props) => renderPointDot(props, key)}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

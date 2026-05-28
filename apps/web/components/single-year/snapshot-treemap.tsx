"use client";

import { ResponsiveContainer, Tooltip, Treemap, type TooltipContentProps, type TreemapNode } from "recharts";
import type { SnapshotItem } from "../../lib/explorer/types";

type SnapshotTreemapProps = {
  items: SnapshotItem[];
};

type StructureCard = {
  itemId: string;
  kaLabel: string;
  enLabel: string;
  color: string;
  amountGel: number;
  shareOfTotal: number;
};

const CHART_HEIGHT = 460;
const INITIAL_CHART_DIMENSION = { width: 980, height: CHART_HEIGHT };

function formatBillionGel(value: number): string {
  const billions = value / 1_000_000_000;
  const rounded = billions >= 10 ? Math.round(billions).toString() : billions.toFixed(1);
  return `${rounded} \u10db\u10da\u10e0\u10d3`;
}

function formatShare(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function isTreemapDatum(value: unknown): value is StructureCard {
  if (typeof value !== "object" || value === null) return false;
  const datum = value as Partial<StructureCard>;
  return typeof datum.kaLabel === "string" && typeof datum.amountGel === "number" && typeof datum.shareOfTotal === "number";
}

function SnapshotTreemapTooltip({ active, payload }: TooltipContentProps) {
  const datum = payload?.[0]?.payload;

  if (!active || !isTreemapDatum(datum)) return null;

  return (
    <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] shadow-xl">
      <p className="font-semibold">{datum.kaLabel}</p>
      <p className="mt-1 text-[var(--primary)]">{formatShare(datum.shareOfTotal)}</p>
      <p className="mt-1 text-xs text-[var(--body)]">{formatBillionGel(datum.amountGel)}</p>
    </div>
  );
}

function structureCards(items: SnapshotItem[]): StructureCard[] {
  return items.map((item) => ({
    itemId: item.itemId,
    kaLabel: item.kaLabel,
    enLabel: item.enLabel,
    color: item.color,
    amountGel: item.amountGel,
    shareOfTotal: item.shareOfTotal,
  }));
}

function clippedLabel(label: string, width: number) {
  const maxChars = Math.max(0, Math.floor((width - 28) / 9));

  if (label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(0, maxChars - 3))}...`;
}

function TreemapCell(node: TreemapNode) {
  if (typeof node.itemId !== "string") return <g />;

  const label = typeof node.kaLabel === "string" ? node.kaLabel : node.name;
  const color = typeof node.color === "string" ? node.color : "var(--primary)";
  const amountGel = typeof node.amountGel === "number" ? node.amountGel : 0;
  const shareOfTotal = typeof node.shareOfTotal === "number" ? node.shareOfTotal : 0;
  const width = Math.max(0, node.width);
  const height = Math.max(0, node.height);
  const showFull = Boolean(label) && width >= 150 && height >= 100;
  const showCompact = Boolean(label) && !showFull && width >= 100 && height >= 72;

  return (
    <g data-testid="snapshot-structure-card">
      <rect x={node.x} y={node.y} width={width} height={height} rx={12} fill="var(--surface)" stroke="var(--hairline)" strokeWidth={1.5} />
      <rect x={node.x} y={node.y} width={Math.min(6, width)} height={height} rx={6} fill={color} />
      {showFull || showCompact ? (
        <>
          <text x={node.x + 18} y={node.y + 28} fill="var(--ink)" fontSize={showFull ? 13 : 11} fontWeight={700}>
            {clippedLabel(String(label), width)}
          </text>
          <text x={node.x + 18} y={node.y + height - (showFull ? 46 : 22)} fill="var(--ink)" fontSize={showFull ? 28 : 20} fontWeight={600}>
            {formatShare(shareOfTotal)}
          </text>
          {showFull ? (
            <text x={node.x + 18} y={node.y + height - 18} fill="var(--mute)" fontSize={13} fontWeight={700}>
              {formatBillionGel(amountGel)}
            </text>
          ) : null}
        </>
      ) : null}
      <title>{`${label}: ${formatShare(shareOfTotal)} / ${formatBillionGel(amountGel)}`}</title>
    </g>
  );
}

export function SnapshotTreemap({ items }: SnapshotTreemapProps) {
  const data = structureCards(items);

  return (
    <section data-testid="snapshot-treemap" className="min-w-0 rounded-[20px] border border-[var(--hairline)] bg-[var(--soft)] p-5">
      <h3 className="text-2xl font-semibold text-[var(--ink)]">{"\u10e1\u10e2\u10e0\u10e3\u10e5\u10e2\u10e3\u10e0\u10d0 \u10e1\u10e4\u10d4\u10e0\u10dd\u10d4\u10d1\u10d8\u10e1 \u10db\u10d8\u10ee\u10d4\u10d3\u10d5\u10d8\u10d7"}</h3>
      <div data-testid="snapshot-structure-grid" className="mt-5 h-[460px] rounded-[18px] bg-[var(--canvas)] p-3">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
          <Treemap data={data} dataKey="amountGel" nameKey="kaLabel" type="flat" content={TreemapCell} isAnimationActive={false} stroke="var(--canvas)">
            <Tooltip content={SnapshotTreemapTooltip} cursor={{ stroke: "var(--primary)", strokeWidth: 1 }} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

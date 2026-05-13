"use client";

import { ResponsiveContainer, Tooltip, Treemap, type TooltipContentProps, type TreemapNode } from "recharts";
import { formatGel, formatPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type SnapshotTreemapProps = {
  items: SnapshotItem[];
};

type TreemapDatum = {
  itemId: string;
  kaLabel: string;
  enLabel: string;
  color: string;
  amountGel: number;
  shareOfTotal: number;
};

const CHART_HEIGHT = 360;
const INITIAL_CHART_DIMENSION = { width: 900, height: CHART_HEIGHT };

function isTreemapDatum(value: unknown): value is TreemapDatum {
  if (typeof value !== "object" || value === null) return false;
  const datum = value as Partial<TreemapDatum>;
  return typeof datum.kaLabel === "string" && typeof datum.amountGel === "number" && typeof datum.shareOfTotal === "number";
}

function SnapshotTreemapTooltip({ active, payload }: TooltipContentProps) {
  const datum = payload?.[0]?.payload;

  if (!active || !isTreemapDatum(datum)) return null;

  return (
    <div className="border border-cyan-400/35 bg-[#05070b] px-3 py-2 text-sm text-zinc-100 shadow-xl shadow-cyan-950/40">
      <p className="font-semibold text-white">{datum.kaLabel}</p>
      <p className="mt-1 font-mono text-cyan-100">{formatGel(datum.amountGel)}</p>
      <p className="mt-1 text-xs text-zinc-400">{formatPercent(datum.shareOfTotal)}</p>
    </div>
  );
}

function TreemapCell(node: TreemapNode) {
  const label = typeof node.kaLabel === "string" ? node.kaLabel : node.name;
  const color = typeof node.color === "string" ? node.color : "#22d3ee";
  const maxLabelChars = Math.max(0, Math.floor((node.width - 20) / 8));
  const showLabel = Boolean(label) && node.width >= 128 && node.height >= 58 && maxLabelChars >= 8;
  const displayLabel =
    showLabel && label.length > maxLabelChars ? `${label.slice(0, Math.max(0, maxLabelChars - 1))}…` : label;

  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={Math.max(0, node.width)}
        height={Math.max(0, node.height)}
        fill={color}
        fillOpacity={0.78}
        stroke="#05070b"
        strokeWidth={2}
      />
      {showLabel ? (
        <text
          x={node.x + 10}
          y={node.y + 22}
          fill="#f4f4f5"
          fontSize={12}
          fontWeight={700}
          textLength={Math.max(0, node.width - 20)}
          lengthAdjust="spacingAndGlyphs"
        >
          {displayLabel}
        </text>
      ) : null}
    </g>
  );
}

export function SnapshotTreemap({ items }: SnapshotTreemapProps) {
  const data: TreemapDatum[] = items.map((item) => ({
    itemId: item.itemId,
    kaLabel: item.kaLabel,
    enLabel: item.enLabel,
    color: item.color,
    amountGel: item.amountGel,
    shareOfTotal: item.shareOfTotal,
  }));

  return (
    <section data-testid="snapshot-treemap" className="mt-4">
      <h3 className="mb-3 text-lg font-semibold text-white">ბიუჯეტის რუკა</h3>
      <div className="h-[384px] border border-cyan-400/20 bg-black/40 p-3">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
          <Treemap
            data={data}
            dataKey="amountGel"
            nameKey="kaLabel"
            type="flat"
            content={TreemapCell}
            isAnimationActive={false}
            stroke="#05070b"
          >
            <Tooltip content={SnapshotTreemapTooltip} cursor={{ stroke: "#22d3ee", strokeWidth: 1 }} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useRef, type ComponentType } from "react";
import type { DeficitChapter, MunicipalChapter, RevenueSeries, ScaleChapter, SpendingSeries } from "../../../lib/landing/chapters/types";
import type { DeficitLabels } from "./deficit-chart";
import type { MunicipalLabels } from "./municipal-relief";
import { useNearViewport } from "./reveal";
import type { RevenueLabels } from "./revenue-chart";
import type { ScaleLabels } from "./scale-chapter";
import type { SpendingLabels } from "./spending-chapter";

// The homepage's one loader for its five charts. Each chart is its own chunk (next/dynamic with
// ssr:false, as hero-relief-lazy.tsx does for the hero), requested only once its chapter comes within
// a screen of view. Until then, and while the chunk loads, a placeholder of the chart's height holds
// its place, so nothing below shifts; if the chunk fails, the placeholder says so.

type ChartProps = {
  scale: { data: ScaleChapter; labels: ScaleLabels };
  spending: { data: SpendingSeries; labels: SpendingLabels };
  revenue: { data: RevenueSeries; labels: RevenueLabels };
  municipal: { data: MunicipalChapter; labels: MunicipalLabels };
  deficit: { data: DeficitChapter; labels: DeficitLabels };
};
type ChartId = keyof ChartProps;
type Loaded<K extends ChartId> = ComponentType<ChartProps[K] & { unavailable: string }>;

// Roughly the chart block's height at each breakpoint, measured on the rendered charts in both languages.
const PLACEHOLDER: Record<ChartId, string> = {
  scale: "mt-8 h-[860px] min-[600px]:h-[950px] min-[768px]:h-[1040px] min-[1000px]:h-[530px]",
  spending: "mt-8 h-[1200px] min-[768px]:h-[1120px] min-[1000px]:h-[715px]",
  revenue: "mt-8 h-[440px] min-[768px]:h-[458px]",
  municipal: "mt-9 h-[330px] min-[600px]:h-[500px] min-[900px]:h-[640px]",
  deficit: "mt-8 h-[390px] min-[768px]:h-[452px]",
};

function Placeholder({ chart, text }: { chart: ChartId; text?: string }) {
  return (
    <div aria-hidden={text ? undefined : true} className={`flex items-center justify-center ${PLACEHOLDER[chart]}`}>
      {text ? <p className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">{text}</p> : null}
    </div>
  );
}

/** Stands in for a chart whose chunk failed to load. */
function unavailable<K extends ChartId>(chart: K): Loaded<K> {
  return function ChartUnavailable({ unavailable: text }) {
    return <Placeholder chart={chart} text={text} />;
  };
}

const CHARTS: { [K in ChartId]: Loaded<K> } = {
  scale: dynamic(() => import("./scale-chapter").then((m) => m.ScaleChapter).catch(() => unavailable("scale")), {
    ssr: false,
    loading: () => <Placeholder chart="scale" />,
  }),
  spending: dynamic(() => import("./spending-chapter").then((m) => m.SpendingChapter).catch(() => unavailable("spending")), {
    ssr: false,
    loading: () => <Placeholder chart="spending" />,
  }),
  revenue: dynamic(() => import("./revenue-chart").then((m) => m.RevenueChart).catch(() => unavailable("revenue")), {
    ssr: false,
    loading: () => <Placeholder chart="revenue" />,
  }),
  municipal: dynamic(() => import("./municipal-relief").then((m) => m.MunicipalRelief).catch(() => unavailable("municipal")), {
    ssr: false,
    loading: () => <Placeholder chart="municipal" />,
  }),
  deficit: dynamic(() => import("./deficit-chart").then((m) => m.DeficitChart).catch(() => unavailable("deficit")), {
    ssr: false,
    loading: () => <Placeholder chart="deficit" />,
  }),
};

export function LazyChart<K extends ChartId>({ chart, unavailable: text, ...props }: { chart: K; unavailable: string } & ChartProps[K]) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref);
  // The props travel with their chart id, which TypeScript cannot follow through the lookup.
  const Chart = CHARTS[chart] as ComponentType<{ unavailable: string }>;
  return <div ref={ref}>{near ? <Chart {...props} unavailable={text} /> : <Placeholder chart={chart} />}</div>;
}

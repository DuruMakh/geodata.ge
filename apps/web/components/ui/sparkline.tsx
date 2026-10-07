import { buildSparklinePath } from "../../lib/explorer/sparkline";

// 64×16 trend mark under a side KPI (DESIGN.md §7.11). Decorative: the KPI value
// and detail line already carry the meaning, so it is hidden from assistive tech.

type SparklineProps = {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
  /** Stretch to the parent's width below 768px (hub cards); the drawn size from 768px. */
  fluidOnMobile?: boolean;
};

export function Sparkline({ values, color, width = 64, height = 16, fluidOnMobile = false }: SparklineProps) {
  const segments = buildSparklinePath(values, width, height);
  if (segments.length === 0) return null;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio={fluidOnMobile ? "none" : undefined}
      className={fluidOnMobile ? "mt-1.5 block max-[768px]:w-full" : "mt-1.5 block"}
    >
      {segments.map((path, index) => (
        <path
          key={index}
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect={fluidOnMobile ? "non-scaling-stroke" : undefined}
        />
      ))}
    </svg>
  );
}

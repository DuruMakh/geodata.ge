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
  /** Tint the area under each drawn run (the explorer group cards' line charts). */
  area?: boolean;
  /** Mark the last drawn point with an accent dot in a paper ring. */
  endDot?: boolean;
};

// The dot is a zero-length stroke with round caps, not a circle: a stretched chart (preserveAspectRatio "none")
// would squash a circle into an ellipse, while a non-scaling stroke stays round at any width.
const END_DOT = 7;
const END_RING = 11;

function endPoint(segment: string): { x: string; y: string } {
  const [x, y] = segment.slice(segment.lastIndexOf("L") + 1).trim().split(" ");
  return { x, y };
}

function areaPath(segment: string, height: number): string {
  const first = segment.slice(1, segment.indexOf(" L")).split(" ");
  const last = endPoint(segment);
  return `${segment} L${last.x} ${height} L${first[0]} ${height} Z`;
}

export function Sparkline({ values, color, width = 64, height = 16, fluidOnMobile = false, area = false, endDot = false }: SparklineProps) {
  const segments = buildSparklinePath(values, width, height);
  if (segments.length === 0) return null;
  const end = endPoint(segments.at(-1)!);

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio={fluidOnMobile ? "none" : undefined}
      className={fluidOnMobile ? "mt-1.5 block max-[768px]:w-full" : "mt-1.5 block"}
      style={endDot ? { overflow: "visible" } : undefined}
    >
      {area
        ? segments.map((path, index) => (
            <path key={`area-${index}`} d={areaPath(path, height)} fill="var(--tint)" stroke="none" className="group-hover:fill-[var(--hairline-soft)]" />
          ))
        : null}
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
      {endDot
        ? [
            { stroke: "var(--tile)", size: END_RING },
            { stroke: "var(--accent)", size: END_DOT },
          ].map(({ stroke, size }) => (
            <path key={size} d={`M${end.x} ${end.y} L${end.x} ${end.y}`} fill="none" stroke={stroke} strokeWidth={size} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))
        : null}
    </svg>
  );
}

import { buildSparklinePath, sparklinePoint } from "../../lib/explorer/sparkline";

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
  /** With `endDot`: the last point is a plan, so the dot is hollow, as the explorer chart draws a planned point. */
  hollowEnd?: boolean;
  /** With `endDot`: the dot marks this point (the year review's chosen year) instead of the last drawn one. */
  dotIndex?: number;
  /** With `endDot`: the dot's colour (the year review's ranking draws it in the category's); accent by default. */
  dotColor?: string;
  /**
   * The first plan or projection point of a series that ends in them: the line from the point before it on is dashed
   * and has no area, so a planned value stays marked wherever the dot is (the year review's sparklines).
   */
  planFrom?: number;
};

// The dot is a zero-length stroke with round caps, not a circle: a stretched chart (preserveAspectRatio "none")
// would squash a circle into an ellipse, while a non-scaling stroke stays round at any width.
const END_DOT = 7;
const END_RING = 11;
const END_HOLE = 3;
const PLAN_DOT = 6;

function endPoint(segment: string): { x: string; y: string } {
  const [x, y] = segment.slice(segment.lastIndexOf("L") + 1).trim().split(" ");
  return { x, y };
}

function areaPath(segment: string, height: number): string {
  const first = segment.slice(1, segment.indexOf(" L")).split(" ");
  const last = endPoint(segment);
  return `${segment} L${last.x} ${height} L${first[0]} ${height} Z`;
}

export function Sparkline({ values, color, width = 64, height = 16, fluidOnMobile = false, area = false, endDot = false, hollowEnd = false, dotIndex, dotColor = "var(--accent)", planFrom }: SparklineProps) {
  const segments = buildSparklinePath(values, width, height, 1, 0, planFrom);
  const planned = planFrom === undefined ? [] : buildSparklinePath(values, width, height, 1, Math.max(0, planFrom - 1));
  const drawn = [...segments, ...planned];
  if (drawn.length === 0) return null;
  const end = dotIndex === undefined ? endPoint(drawn.at(-1)!) : sparklinePoint(values, dotIndex, width, height);
  // A dot on an actual point before the plan hides the dashed tail under its halo, so the plan's last point
  // gets its own hollow mark, painted between the halo and the dot.
  const planEnd = endDot && planFrom !== undefined && dotIndex !== undefined && dotIndex < planFrom && planned.length > 0 ? endPoint(planned.at(-1)!) : null;
  const dots = [
    { id: "ring", stroke: "var(--tile)", size: END_RING, at: end },
    ...(planEnd
      ? [
          { id: "plan", stroke: dotColor, size: PLAN_DOT, at: planEnd },
          { id: "plan-hole", stroke: "var(--tile)", size: END_HOLE, at: planEnd, testId: "sparkline-plan-end" },
        ]
      : []),
    { id: "dot", stroke: dotColor, size: END_DOT, at: end },
    ...(hollowEnd ? [{ id: "hole", stroke: "var(--tile)", size: END_HOLE, at: end, testId: "sparkline-hollow-end" }] : []),
  ];

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
      {planned.map((path, index) => (
        <path
          key={`plan-${index}`}
          data-testid="sparkline-plan"
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeDasharray="2 1.5"
          strokeLinejoin="round"
          vectorEffect={fluidOnMobile ? "non-scaling-stroke" : undefined}
        />
      ))}
      {endDot && end
        ? dots.map(({ id, stroke, size, at, testId }) => (
            <path key={id} data-testid={testId} d={`M${at!.x} ${at!.y} L${at!.x} ${at!.y}`} fill="none" stroke={stroke} strokeWidth={size} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))
        : null}
    </svg>
  );
}

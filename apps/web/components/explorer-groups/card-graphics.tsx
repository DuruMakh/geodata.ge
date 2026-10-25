import { Map as MapIcon } from "lucide-react";
import { Fragment } from "react";
import { buildSparklinePath } from "../../lib/explorer/sparkline";
import type { RegionSpread } from "../../lib/explorer/regionSpread";
import type { CardGraphic } from "../../lib/explorer/topicHub";
import { Sparkline } from "../ui/sparkline";

// The graphics an explorer card can carry in its band (DESIGN.md: group page cards). All of them are decorative: the card's value
// text states what they show, and the whole band is `aria-hidden`.

const NUMERIC = "font-[family-name:var(--font-numeric)]";

const percent = (value: number) => `${Math.round(value * 10) / 10}%`;

/** The small line chart: area, line and an end dot, stretched over the band. */
export function LineGraphic({ series, color, planned = false }: { series: (number | null)[]; color: string; planned?: boolean }) {
  return (
    <span className="absolute inset-0 block [&>svg]:mt-0 [&>svg]:h-full [&>svg]:w-full">
      <Sparkline values={series} color={color} width={200} height={58} fluidOnMobile area endDot hollowEnd={planned} />
    </span>
  );
}

/** Where the line ends, in percent of the chart's height: the end label sits level with it. */
function endHeight(series: (number | null)[], height: number): number {
  const last = buildSparklinePath(series, 600, height).at(-1);
  return last ? (Number(last.slice(last.lastIndexOf(" ") + 1)) / height) * 100 : 50;
}

/**
 * The lead card's large area chart. Its last value is written at the line's end, in a gutter sized to the text, and the first and last year
 * under it. A planned last value (`planned`) is drawn as a hollow point.
 */
export function LeadGraphic({ series, color, endLabel, years, planned = false }: { series: (number | null)[]; color: string; endLabel: string | null; years: string | undefined; planned?: boolean }) {
  const [first, last = ""] = (years ?? "").split("–");
  const gutter = endLabel ? Math.round(endLabel.length * 7.4 + 16) : 0;
  return (
    <>
      <span className="absolute top-0 left-0 block h-full [&>svg]:mt-0 [&>svg]:h-full [&>svg]:w-full" style={{ width: `calc(100% - ${gutter}px)` }}>
        <Sparkline values={series} color={color} width={600} height={160} fluidOnMobile area endDot hollowEnd={planned} />
      </span>
      {endLabel ? (
        <span
          className={`absolute right-0 -translate-y-1/2 ${NUMERIC} text-[11px] leading-none font-semibold whitespace-nowrap text-[var(--accent)]`}
          style={{ top: `${endHeight(series, 160)}%`, width: gutter - 9 }}
        >
          {endLabel}
        </span>
      ) : null}
      <span className={`absolute -bottom-[18px] left-0 ${NUMERIC} text-[10.5px] text-[var(--faint)]`}>{first}</span>
      <span className={`absolute -bottom-[18px] ${NUMERIC} text-[10.5px] text-[var(--faint)]`} style={{ right: gutter }}>{last}</span>
    </>
  );
}

/** A spread's end: the region's name, then its figure, which go onto two lines (name, then figure) when they do not fit beside each other. */
function SpreadEnd({ end }: { end: RegionSpread["low"] }) {
  return (
    <>
      <span className="inline-block">{end.name}</span>{" "}<span className="inline-block whitespace-nowrap">{end.value}</span>
    </>
  );
}

/**
 * One dot per region on a shared scale, Georgia as a dashed line, the lowest and highest named. Each name stays inside the band: the
 * lowest starts 12px before its dot (or, past the middle, ends 12px after it) in the band's flow under the line, so a name too long
 * for the band wraps and makes the band taller instead of running off the card or into the value below.
 */
export function SpreadGraphic({ spread }: { spread: RegionSpread }) {
  const label = `${NUMERIC} text-[10.5px] leading-[1.2] text-[var(--body)]`;
  const lowOnRight = spread.lowX > 50;
  const lowEdge = `max(0px, calc(${percent(lowOnRight ? 100 - spread.lowX : spread.lowX)} - 12px))`;
  return (
    <>
      <span className="absolute inset-x-0 top-[26px] block h-0.5">
        <i className="absolute inset-x-0 top-0 h-px bg-[var(--hairline)]" />
        {spread.georgiaX === null ? null : (
          <i className="absolute -top-[13px] h-[13px] border-l-[1.5px] border-dashed border-[var(--accent)]" style={{ left: percent(spread.georgiaX) }} />
        )}
        {spread.points.map((point, index) => (
          <i
            key={index}
            data-testid="region-spread-dot"
            className={`absolute -top-[5px] -ml-[5px] size-2.5 rounded-full shadow-[0_0_0_1.5px_var(--tile)] ${point.key ? "bg-[var(--ink)]" : "bg-[var(--control)] opacity-85"}`}
            style={{ left: percent(point.x) }}
          />
        ))}
        <span data-testid="region-spread-high" className={`${label} absolute right-0 bottom-3 max-w-full text-right`}><SpreadEnd end={spread.high} /></span>
      </span>
      <span
        data-testid="region-spread-low"
        className={`${label} block pt-[39px] ${lowOnRight ? "text-right" : ""}`}
        style={lowOnRight ? { marginRight: lowEdge } : { marginLeft: lowEdge }}
      >
        <SpreadEnd end={spread.low} />
      </span>
    </>
  );
}

/** A bar per band, tallest full height, the marked ones in accent, the first and last band named under them. */
export function BarsGraphic({ graphic }: { graphic: Extract<CardGraphic, { kind: "bars" }> }) {
  const max = Math.max(0, ...graphic.bars.map((bar) => bar.value)) || 1;
  return (
    <>
      <span className="absolute inset-x-0 top-0 bottom-4 flex items-end gap-[3px]">
        {graphic.bars.map((bar) => (
          <i
            key={bar.label}
            data-testid="card-bar"
            data-accent={bar.accent ? "true" : undefined}
            className={`block flex-1 ${bar.accent ? "bg-[var(--accent)]" : "bg-[var(--control)]"}`}
            style={{ height: percent((bar.value / max) * 100) }}
          />
        ))}
      </span>
      <span className={`absolute inset-x-0 bottom-0 flex justify-between ${NUMERIC} text-[10.5px] text-[var(--faint)]`}>
        <span>{graphic.first}</span>
        <span>{graphic.last}</span>
      </span>
    </>
  );
}

/**
 * Two or three labelled bars side by side, scaled to the page's maximum. Flows in the band instead of filling it. One grid holds
 * every row, so the value column is as wide as the widest value and the bars stay comparable; a value never wraps from its unit.
 */
export function PairGraphic({ graphic }: { graphic: Extract<CardGraphic, { kind: "pair" }> }) {
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-x-2.5">
      {graphic.rows.map((row, index) => (
        <Fragment key={row.label}>
          <span className={`col-span-2 block text-[11.5px] leading-[1.3] text-[var(--body)] ${index > 0 ? "mt-[9px]" : ""}`}>{row.label}</span>
          <span className="mt-1 block h-2">
            <i className={`block h-full ${row.accent ? "bg-[var(--accent)]" : "bg-[var(--control)]"}`} style={{ width: percent(graphic.max > 0 ? (row.value / graphic.max) * 100 : 0) }} />
          </span>
          <b data-testid="card-pair-value" className={`mt-1 text-right ${NUMERIC} text-[11.5px] font-semibold whitespace-nowrap text-[var(--ink)]`}>{row.text}</b>
        </Fragment>
      ))}
    </span>
  );
}

/** A Regions page with no region values to spread: the map and list it offers. */
export function MapGraphic({ text }: { text: string }) {
  return (
    <span className="absolute inset-0 flex items-center gap-2.5 text-[12px] text-[var(--muted)]">
      <MapIcon aria-hidden size={26} strokeWidth={1.4} className="text-[var(--control)]" />
      {text}
    </span>
  );
}

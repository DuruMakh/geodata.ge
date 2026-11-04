"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { stepPeriodIndex } from "../../lib/explorer/chartNavigation";
import { formatAmount, formatInUnit, formatShare, UNIT_BN } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { groupOf, longView } from "../../lib/yearReview/yearView";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { ChartTooltip } from "../main-explorer/chart-frame";
import { niceTicks, stackLabels } from "../landing/chapters/canvas";
import { HATCH_SWATCH, SegmentedTabs } from "../ui/editorial";
import { ChartFoot, pointerHover, Section, type YearReviewSectionProps } from "./section";

// Section 06, "The long view" (spec §4, board `an-area`): every category of the side (expenditure in the chosen
// grouping, or receipts) over all its years as stacked areas, in shares or GEL. The plan year is hatched, the chosen
// year is a line with its label on top, the last year's bands are named at the right edge, and a pointer over the
// plot draws a crosshair and a readout of the band under it; with the plot focused, the arrow keys, Home and End step
// the readout's year (as the column charts do) and Escape closes it. The readout floats over the plot from 640px of
// section width and sits under the chart below it (DESIGN.md §8.3). Hovering a band, an edge label or a legend item
// focuses that category on the page (spec §5); a click or tap pins it.

const WIDTH = 1000; // the drawing's viewBox width; it stretches to the plot
const HEIGHT = 400; // the plot's height from 640px of section width, and the viewBox height
// The right-edge labels: a band thinner than this (px) at the last year has none, the others keep this far apart (px).
const LABEL_MIN_BAND = 9;
const LABEL_GAP = 18;
const LABEL_EDGE = 6;

type Props = Pick<YearReviewSectionProps, "data" | "year" | "grouping" | "side" | "measure" | "focus" | "pin" | "onFocus" | "onPin" | "onSide" | "onMeasure">;
type Hover = { column: number; band: string | null };

/** Section 06 on the chosen side, grouping and measure. */
export function LongView({ data, year, grouping, side, measure, focus, pin, onFocus, onPin, onSide, onMeasure }: Props) {
  const { locale, messages } = useI18n();
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const [hover, setHover] = useState<Hover | null>(null);
  // The readout was moved by a key, not the pointer: only then is it also spoken (a live region), so a hover is not announced.
  const [byKey, setByKey] = useState(false);
  // The drawn view, and the same in GEL for the readout's amounts and shares; neither follows a hover.
  const { view, gel } = useMemo(
    () => ({ view: longView(data, grouping, side, measure), gel: longView(data, grouping, side, "gel") }),
    [data, grouping, side, measure],
  );
  const { years, planned, bands } = view;
  const count = years.length;
  const from = years[0]!;
  const to = years.at(-1)!;
  const pos = (column: number) => (count > 1 ? (column / (count - 1)) * 100 : 50);

  // The vertical scale: shares to 100%, GEL to a round number of billions.
  const axis = measure === "share" ? null : niceTicks(Math.max(...view.top) / 1e9, 5);
  const top = axis ? axis.top * 1e9 : 1;
  const yTicks = axis
    ? axis.ticks.map((tick) => ({
        value: tick,
        at: tick / axis.top,
        label: tick === 0 ? "0" : `${formatInUnit(tick * 1e9, { ...UNIT_BN, decimals: Number.isInteger(axis.step) ? 0 : 1 })} ${text("yearReview.bnS")}`,
      }))
    : [0, 0.25, 0.5, 0.75, 1].map((tick) => ({ value: tick, at: tick, label: tick === 0 ? "0" : formatShare(tick, false, 0) }));

  // The drawing: each band's lower and upper edge per year, stacked in the view's order from the bottom, its path,
  // and the categories named at the right edge (wide enough at the last year, the widest kept when they cannot all
  // fit). It follows the view and the scale only, not a hover.
  const last = count - 1;
  const { edges, paths, named, labelTops } = useMemo(() => {
    const y = (value: number) => HEIGHT - (value / top) * HEIGHT;
    const x = (column: number) => ((last > 0 ? column / last : 0.5) * WIDTH).toFixed(1);
    const cumulative = years.map(() => 0);
    const edges = bands.map((band) => {
      const low = [...cumulative];
      band.values.forEach((value, column) => {
        cumulative[column] = cumulative[column]! + value;
      });
      return { low, high: [...cumulative] };
    });
    const paths = edges.map(({ low, high }) => {
      const upper = high.map((value, column) => `${column ? "L" : "M"}${x(column)} ${y(value).toFixed(1)}`);
      const lower = low.map((value, column) => `L${x(column)} ${y(value).toFixed(1)}`).reverse();
      return `${upper.join("")}${lower.join("")}Z`;
    });
    const fits = Math.floor((HEIGHT - 2 * LABEL_EDGE) / LABEL_GAP) + 1;
    const named = bands
      .map((band, index) => ({ band, index, height: ((edges[index]!.high[last]! - edges[index]!.low[last]!) / top) * HEIGHT }))
      .filter((entry) => entry.height >= LABEL_MIN_BAND)
      .sort((left, right) => right.height - left.height)
      .slice(0, fits)
      .sort((left, right) => left.index - right.index);
    const labelTops = stackLabels(
      named.map((entry) => y((edges[entry.index]!.low[last]! + edges[entry.index]!.high[last]!) / 2)),
      LABEL_GAP,
      LABEL_EDGE,
      HEIGHT - LABEL_EDGE,
    );
    return { edges, paths, named, labelTops };
  }, [bands, years, top, last]);

  // The chosen year, or the nearest end of the view when the side has no such year.
  const chosen = years.includes(year) ? years.indexOf(year) : year < from ? 0 : last;
  const chosenLabel = `${years[chosen]}${planned[chosen] ? ` · ${text("yearReview.plan")}` : ""}`;
  const planFrom = planned.indexOf(true);
  const planYears = years.filter((_, column) => planned[column]);

  // Only a category of this chart is focused here: a spending type or another grouping's category leaves it as is.
  const ids = new Set(bands.map((band) => band.id));
  const picked = focus !== null && ids.has(focus) ? focus : null;
  const markOf = (id: string, still: boolean) => {
    const on = !still && picked === id;
    return { on, dim: !still && picked !== null && !on };
  };

  // Shares at a year's column, whatever the measure.
  const shareAt = (index: number, column: number) => (gel.top[column] ? gel.bands[index]!.values[column]! / gel.top[column]! : 0);
  // The readout's amount is the category's own, a negative one included; its share is of the drawn total.
  const categories = side === "expenditure" ? groupOf(data, grouping) : data.budget.receipts;
  const rawValue = (id: string, target: number) => categories.find((category) => category.id === id)?.values[data.budget.years.indexOf(target)] ?? null;
  // The drawing counts a missing value as 0; the description says it is missing.
  const sharedAt = (index: number, column: number) => formatShare(rawValue(bands[index]!.id, years[column]!) === null ? null : shareAt(index, column));
  const gainLoss = [
    { key: "yearReview.s3Up", move: view.gain },
    { key: "yearReview.s3Down", move: view.loss },
  ].flatMap(({ key, move }) => (move ? [{ key, move, label: bands.find((band) => band.id === move.id)!.label }] : []));
  const lastActual = years[planned.findLastIndex((plan) => !plan)] ?? to;
  const ariaLabel = text("yearReview.s3Aria", {
    a: from,
    b: to,
    items: bands
      .map((band, index) => `${band.label} ${sharedAt(index, 0)} → ${sharedAt(index, last)}`)
      .join("; "),
  });

  // The pointer: the year under it, and the band under it at that year.
  const at = (event: MouseEvent<HTMLDivElement>): Hover | null => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const fx = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const fy = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    const column = Math.round(fx * last);
    const value = (1 - fy) * top;
    const index = edges.findIndex(({ low, high }) => value >= low[column]! && value < high[column]!);
    return { column, band: index < 0 ? null : bands[index]!.id };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const next = at(event);
    if (!next) return;
    if (next.column === hover?.column && next.band === hover.band) return;
    setByKey(false);
    setHover(next);
    if (event.pointerType !== "touch" && next.band !== hover?.band) onFocus(next.band);
  };
  const leave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    setByKey(false);
    setHover(null);
    onFocus(null);
  };
  // The keys step the readout's year; it shows the focused category's band, if it has one here.
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = stepPeriodIndex(event.key, hover?.column ?? null, count);
    if (next === undefined) return;
    event.preventDefault();
    setByKey(next !== null);
    setHover(next === null ? null : { column: next, band: hover?.band ?? picked });
  };
  // The readout (DESIGN.md §8.3): the year, the drawn total, and the band under the pointer with its amount and share.
  const tip = hover === null ? null : (() => {
    const index = hover.band === null ? -1 : bands.findIndex((band) => band.id === hover.band);
    const raw = index < 0 ? null : rawValue(hover.band!, years[hover.column]!);
    return {
      x: pos(hover.column),
      header: `${years[hover.column]}${planned[hover.column] ? ` · ${text("yearReview.plan")}` : ""}`,
      total: `${text("yearReview.tipTotal")} ${formatAmount(gel.top[hover.column]!, locale)}`,
      rows: index < 0 || raw === null ? [] : [{ id: bands[index]!.id, label: bands[index]!.label, color: bands[index]!.color, value: raw }],
      format: (value: number) => `${formatAmount(value, locale)} · ${formatShare(shareAt(index, hover.column))}`,
    };
  })();

  const heading = text("yearReview.s3Title", { from, to });
  const planLabel = planYears.length ? `${text("yearReview.planLabel")} · ${planYears.join(", ")}` : null;

  const chart = (still: boolean) => (
    <div className="relative mt-[30px] grid grid-cols-[40px_minmax(0,1fr)] grid-rows-[24px_260px_30px] @min-[640px]:grid-cols-[56px_minmax(0,1fr)_216px] @min-[640px]:grid-rows-[24px_400px_30px]">
      <div aria-hidden="true" className="relative col-start-2 row-start-1">
        <span
          data-chosen-label=""
          className={`absolute bottom-[5px] whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11px] font-semibold ${pos(chosen) > 92 ? "-translate-x-full" : "-translate-x-1/2"}`}
          style={{ left: `${pos(chosen)}%` }}
        >
          {chosenLabel}
        </span>
      </div>
      <div aria-hidden="true" className="relative col-start-1 row-start-2">
        {yTicks.map((tick) => (
          <span
            key={tick.value}
            data-y-tick={tick.value}
            className="absolute right-2.5 translate-y-1/2 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11px] leading-none text-[var(--faint)] min-[768px]:text-[10.5px]"
            style={{ bottom: `${tick.at * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <div
        role="img"
        aria-label={ariaLabel}
        className={`relative col-start-2 row-start-2 ${
          still ? "" : "cursor-crosshair touch-pan-y [&:focus:not(:focus-visible)]:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        }`}
        {...(still
          ? {}
          : {
              tabIndex: 0,
              onKeyDown: step,
              onBlur: () => {
                setByKey(false);
                setHover(null);
              },
              onPointerMove: move,
              onPointerDown: move,
              onPointerLeave: leave,
              onClick: (event: MouseEvent<HTMLDivElement>) => {
                const target = at(event);
                if (target?.band) onPin(target.band);
              },
            })}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 block h-full w-full overflow-visible">
          {bands.map((band, index) => {
            const { on, dim } = markOf(band.id, still);
            return (
              <path
                key={band.id}
                data-band={band.id}
                data-focus={on ? "" : undefined}
                data-dim={dim ? "" : undefined}
                d={paths[index]}
                fill={band.color}
                stroke="var(--paper)"
                strokeWidth={1}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className={`transition-opacity duration-200 ${dim ? "opacity-25" : ""}`}
              />
            );
          })}
        </svg>
        {planFrom >= 0 ? (
          <i
            data-plan-hatch=""
            className="pointer-events-none absolute inset-y-0 block [background-image:repeating-linear-gradient(135deg,color-mix(in_srgb,var(--paper)_55%,transparent)_0_2px,transparent_2px_6px)]"
            style={{ left: `${pos(Math.max(0, planFrom - 1))}%`, width: `${pos(last) - pos(Math.max(0, planFrom - 1))}%` }}
          />
        ) : null}
        <i className="pointer-events-none absolute -top-1.5 bottom-0 block w-0 border-l-[1.5px] border-[var(--ink)]" style={{ left: `${pos(chosen)}%` }} />
        {!still && tip ? (
          <>
            <i className="pointer-events-none absolute inset-y-0 block w-0 border-l border-dashed border-[var(--ink)] opacity-70" style={{ left: `${tip.x}%` }} />
            <div className="hidden @min-[640px]:contents">
              <ChartTooltip testId="long-view-tooltip" leftPercent={tip.x} header={tip.header} headerRight={tip.total} rows={tip.rows} hidden={0} formatValue={tip.format} />
            </div>
          </>
        ) : null}
      </div>
      <div aria-hidden="true" className="relative col-start-3 row-start-2 hidden @min-[640px]:block">
        {named.map((entry, position) => {
          const { band } = entry;
          const { on, dim } = markOf(band.id, still);
          return (
            <span
              key={band.id}
              data-edge-label={band.id}
              onPointerEnter={still ? undefined : pointerHover(() => onFocus(band.id))}
              onPointerLeave={still ? undefined : () => onFocus(null)}
              onClick={still ? undefined : () => onPin(band.id)}
              className={`absolute right-0 left-3.5 flex -translate-y-1/2 items-center gap-[7px] text-xs leading-[1.25] transition-opacity duration-200 ${still ? "" : "cursor-pointer"} ${
                on ? "font-semibold text-[var(--ink)]" : dim ? "text-[var(--muted)]" : "text-[var(--body)]"
              }`}
              style={{ top: `${labelTops[position]!.toFixed(1)}px` }}
            >
              <i className={`block size-[9px] flex-none rounded-[2px] ${dim ? "opacity-25" : ""}`} style={{ backgroundColor: band.color }} />
              <span className="min-w-0 truncate">{band.label}</span>
            </span>
          );
        })}
      </div>
      {/* Every fourth year, and every second from 900px of section width: below it the edge labels, pinned to the plot's
          ends, would touch their centred neighbours. */}
      <div aria-hidden="true" className="relative col-start-2 row-start-3">
        {years.map((label, column) =>
          column % 2 === 0 ? (
            <span
              key={label}
              className={`absolute top-[9px] whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11px] leading-none text-[var(--faint)] min-[768px]:text-[10.5px] ${column % 4 === 0 ? "" : "hidden @min-[900px]:block"} ${
                column === 0 ? "" : column === last ? "-translate-x-full" : "-translate-x-1/2"
              }`}
              style={{ left: `${pos(column)}%` }}
            >
              {label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );

  return (
    <Section
      number="06"
      id="year-review-long"
      heading={heading}
      controls={
        <div className="flex flex-wrap gap-2">
          <SegmentedTabs<"expenditure" | "revenue">
            ariaLabel={text("yearReview.sideLabel")}
            value={side}
            onChange={onSide}
            options={[
              { value: "expenditure", label: text("yearReview.exp") },
              { value: "revenue", label: text("yearReview.rev") },
            ]}
          />
          <SegmentedTabs<"share" | "gel">
            ariaLabel={text("yearReview.modeLabel")}
            value={measure}
            onChange={onMeasure}
            options={[
              { value: "share", label: text("yearReview.share") },
              { value: "gel", label: text("yearReview.abs") },
            ]}
          />
        </div>
      }
    >
      {gainLoss.length ? (
        <dl className="mt-[22px] grid grid-cols-1 gap-x-8 gap-y-4 @min-[640px]:grid-cols-3">
          {gainLoss.map((fact) => (
            <div key={fact.key} data-long-fact={fact.move.id} className="border-t border-[var(--hairline)] pt-2.5">
              <dt className="font-[family-name:var(--font-numeric)] text-[11px] leading-[1.4] text-[var(--muted)]">{text(fact.key, { a: from, b: lastActual })}</dt>
              <dd className="m-0">
                <b className="mt-1.5 block text-[15px] font-semibold leading-[1.35]">{fact.label}</b>
                <span className="mt-[3px] block font-[family-name:var(--font-numeric)] text-[12.5px] text-[var(--body)]">
                  {`${formatShare(fact.move.from)} → ${formatShare(fact.move.to)}`}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {chart(false)}
      <p role="status" aria-live="polite" data-testid="long-view-said" className="sr-only">
        {byKey && tip ? [tip.header, tip.total, ...tip.rows.map((row) => `${row.label} ${tip.format(row.value)}`)].join(", ") : ""}
      </p>
      {tip ? (
        <div className="@min-[640px]:hidden">
          <ChartTooltip testId="long-view-panel" variant="panel" leftPercent={tip.x} header={tip.header} headerRight={tip.total} rows={tip.rows} hidden={0} formatValue={tip.format} />
        </div>
      ) : null}
      {/* Below 768px each item is a 36px target (DESIGN.md §12); the rows then need no gap. */}
      <ul className="m-0 mt-[18px] flex list-none flex-wrap gap-x-[18px] gap-y-0 p-0 min-[768px]:gap-y-2">
        {bands.map((band) => {
          const { on, dim } = markOf(band.id, false);
          return (
            <li key={band.id}>
              <button
                type="button"
                data-legend={band.id}
                aria-pressed={pin === band.id}
                onClick={() => onPin(band.id)}
                onPointerEnter={pointerHover(() => onFocus(band.id))}
                onPointerLeave={() => onFocus(null)}
                onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) onFocus(band.id); }}
                onBlur={() => onFocus(null)}
                className={`inline-flex min-h-9 cursor-pointer items-center min-[768px]:min-h-6 gap-[7px] text-left text-[12.5px] transition-opacity duration-200 ${
                  on ? "font-semibold text-[var(--ink)]" : dim ? "text-[var(--muted)]" : "text-[var(--body)]"
                }`}
              >
                <i aria-hidden="true" className={`block size-2.5 flex-none rounded-[2px] ${dim ? "opacity-25" : ""}`} style={{ backgroundColor: band.color }} />
                {band.label}
              </button>
            </li>
          );
        })}
        {planLabel ? (
          <li aria-hidden="true" className="inline-flex min-h-9 items-center min-[768px]:min-h-6 gap-[7px] text-[12.5px] text-[var(--muted)]">
            <i className={`block h-2.5 w-4 rounded-[2px] ${HATCH_SWATCH}`} />
            {planLabel}
          </li>
        ) : null}
      </ul>
      <ChartFoot
        share={
          <ChartShareButton
            testId="long-view-share"
            title={heading}
            caption={`${measure === "share" ? "%" : text("yearReview.bn")} · ${from}–${to}${planLabel ? ` · ${planLabel}` : ""}`}
            legend={bands.map(({ label, color }) => ({ label, color }))}
            source={text("main.sourceData")}
            chart={<div className="@container">{chart(true)}</div>}
            period={`${from}-${to}`}
          />
        }
      />
    </Section>
  );
}

"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatInUnit, formatShare, UNIT_BN } from "../../../lib/explorer/format";
import type { SpendingSeries } from "../../../lib/landing/chapters/types";
import { blockTone, placeTip, sparkPoints } from "./canvas";
import { money } from "./chart-format";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";
import type { Engine } from "./spending-engine";

// Chapter 02: a squarified treemap of the 13 spending fields. The block area of a year follows
// sqrt(total / largest total) anchored bottom-left, so a small year is a small copy of the same
// picture; a year slider, a play button and a side list drive it. The controls and list are server
// HTML; the drawing engine (spending-engine.ts) loads near view.

export type SpendingLabels = {
  year: string; // "წელი"
  total: string; // "მთლიანი ხარჯი"
  bnGel: string; // "მლრდ ₾"
  mlnGel: string; // "მლნ ₾"
  planned: string; // suffix after a planned year: "გეგმა"
  maxFrame: string; // dashed-frame caption, the largest year already in it: "2025 წლის ბიუჯეტის მასშტაბი"
  play: string; // button while paused part-way: "გაგრძელება"
  pause: string; // button while playing: "პაუზა"
  replay: string; // button at the latest year (play restarts from the first): "ჩართე 2004-დან"
  yearPicker: string; // sr-only label of the range input: "წლის არჩევა"
  axisCaption: string; // under the sparkline: "ხარჯები წლების მიხედვით"
  listCaption: string; // above the side list, the year follows: "სფეროები"
  share: string; // tooltip row: "ბიუჯეტის წილი"
  vsPrevious: string; // tooltip foot prefix, the change follows: "წინა წელთან: "
  chartSummary: string; // canvas aria-label lead: "სახელმწიფო ბიუჯეტის ხარჯები სფეროების მიხედვით; ფართობი ხარჯის პროპორციულია"
  largest: string; // canvas aria-label: "ყველაზე დიდი"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./spending-engine");

const STEP_MS = 900; // one year per step while playing

const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]";
// The range input is a transparent hit area over the sparkline; the accent marker shows the year.
const RANGE_CLASS =
  "absolute left-0 top-0 m-0 h-[44px] w-full cursor-ew-resize appearance-none bg-transparent " +
  "[&::-webkit-slider-runnable-track]:h-[44px] [&::-webkit-slider-runnable-track]:bg-transparent " +
  "[&::-webkit-slider-thumb]:h-[44px] [&::-webkit-slider-thumb]:w-[22px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-transparent " +
  "[&::-moz-range-track]:h-[44px] [&::-moz-range-track]:bg-transparent " +
  "[&::-moz-range-thumb]:h-[44px] [&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent";

export function SpendingChapter({ data, labels }: { data: SpendingSeries; labels: SpendingLabels }) {
  const last = data.years.length - 1;
  const [index, setIndex] = useState(last);
  const [playing, setPlaying] = useState(false);
  const year = data.years[index];
  const planned = data.planned[index] ?? false;
  const total = data.totals[index];

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipTitleRef = useRef<HTMLDivElement>(null);
  const tipKeyRef = useRef<HTMLElement>(null);
  const tipValueRef = useRef<HTMLElement>(null);
  const tipNameRef = useRef<HTMLSpanElement>(null);
  const tipShareRef = useRef<HTMLElement>(null);
  const tipShareNameRef = useRef<HTMLSpanElement>(null);
  const tipFootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const timerRef = useRef(0);
  const cursorRef = useRef(last); // the year index the controls last chose; the interval steps from it
  const rangeId = useId();
  // Read by the long-lived engine callbacks, so a year change never rebuilds the engine.
  const live = useRef({ index, labels, data });
  useEffect(() => {
    live.current = { index, labels, data };
  });

  const { lib, failed } = useEngine(wrapRef, loadEngine);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!lib || !wrap || !canvas || !tip) return;
    const text = (el: HTMLElement | null, value: string) => {
      if (el) el.textContent = value;
    };
    const { index: initial } = live.current;
    const engine = lib.createTreemap({
      wrap,
      canvas,
      data,
      initial,
      frameText: () => live.current.labels.maxFrame,
      amount: (gel) => money(gel, live.current.labels),
      onHover(field, x, y) {
        const { index: i, labels: lab, data: d } = live.current;
        const f = d.fields[field];
        const v = f.values[i];
        const before = i > 0 ? f.values[i - 1] : 0;
        text(tipTitleRef.current, f.label);
        if (tipKeyRef.current) tipKeyRef.current.style.background = blockTone(field, d.fields.length);
        text(tipValueRef.current, money(v, lab));
        text(tipNameRef.current, d.planned[i] ? `${d.years[i]} (${lab.planned})` : String(d.years[i]));
        text(tipShareRef.current, formatShare(d.totals[i] > 0 ? v / d.totals[i] : 0));
        text(tipShareNameRef.current, lab.share);
        text(tipFootRef.current, before > 0 ? `${lab.vsPrevious}${formatShare(v / before - 1, true, 1)}` : "");
        placeTip(tip, x, y, wrap.clientWidth, wrap.clientHeight);
      },
      onLeave() {
        tip.style.opacity = "0";
      },
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [lib, data]);

  useEffect(() => {
    engineRef.current?.setYear(index);
  }, [index]);

  useEffect(
    () => () => {
      window.clearInterval(timerRef.current);
    },
    [],
  );

  const select = (i: number) => {
    cursorRef.current = i;
    setIndex(i);
  };
  const stop = () => {
    window.clearInterval(timerRef.current);
    timerRef.current = 0;
    setPlaying(false);
  };
  // Pause while playing; otherwise step one year per STEP_MS, from the first year when already at the latest.
  const toggle = () => {
    if (timerRef.current) {
      stop();
      return;
    }
    if (cursorRef.current >= last) select(0);
    setPlaying(true);
    timerRef.current = window.setInterval(() => {
      const next = cursorRef.current + 1;
      select(next);
      if (next >= last) stop();
    }, STEP_MS);
  };

  const rows = data.fields.filter((f) => f.values[index] > 0).sort((a, b) => b.values[index] - a.values[index]);
  const top = rows[0];
  const yearText = planned ? `${year} (${labels.planned})` : String(year);
  const ariaLabel =
    `${labels.chartSummary}; ${yearText}: ${formatInUnit(total, UNIT_BN)} ${labels.bnGel}` +
    (top ? `; ${labels.largest}: ${top.label}, ${money(top.values[index], labels)}, ${formatShare(top.values[index] / total)}` : "");
  const playLabel = playing ? labels.pause : index >= last ? labels.replay : labels.play;

  const spark = sparkPoints(data.totals, 1000, 6, 39.5);
  const line = spark.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const markShare = last > 0 ? index / last : 0;

  return (
    <Reveal className="mt-8">
      <div className="mb-[22px] flex flex-wrap items-end gap-x-8 gap-y-[18px]">
        <div>
          <div className={LABEL_CLASS}>{labels.year}</div>
          <div className="font-[family-name:var(--font-display)] text-[clamp(46px,5vw,66px)] font-semibold leading-[0.92] tracking-[-0.02em] [font-variant-numeric:lining-nums]">
            {year}
            {planned && <small className="ml-[0.3em] text-[0.3em] font-semibold tracking-normal text-[var(--muted)]">{labels.planned}</small>}
          </div>
        </div>
        <div>
          <div className={LABEL_CLASS}>{labels.total}</div>
          <div className="font-[family-name:var(--font-display)] text-[clamp(28px,2.8vw,36px)] font-semibold leading-none tracking-[-0.015em]">
            {formatInUnit(total, UNIT_BN)}
            <small className="ml-[0.25em] text-[0.45em] font-semibold tracking-normal">{labels.bnGel}</small>
          </div>
        </div>
        <button
          type="button"
          aria-label={playLabel}
          onClick={toggle}
          className="inline-flex min-h-[44px] items-center gap-[9px] rounded-full border-[1.5px] border-[var(--ink)] pl-[13px] pr-4 text-[12.5px] font-semibold transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
        >
          {playing ? <Pause aria-hidden="true" size={14} strokeWidth={1.5} /> : <Play aria-hidden="true" size={14} strokeWidth={1.5} />}
          <span>{playLabel}</span>
        </button>
        <div className="relative h-[60px] min-w-[240px] flex-[1_1_300px] self-stretch">
          <svg viewBox="0 0 1000 44" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-x-[11px] top-0 h-[44px] w-[calc(100%-22px)]">
            <path d={`${line} L1000 44 L0 44 Z`} fill="var(--hairline-soft)" />
            <path d={line} fill="none" stroke="var(--control)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <i
            aria-hidden="true"
            style={{ left: `calc(11px + (100% - 22px) * ${markShare})` }}
            className="pointer-events-none absolute top-0 -ml-px h-[44px] w-0.5 bg-[var(--accent)] transition-[left] duration-[250ms] ease-[cubic-bezier(.22,.7,.18,1)] after:absolute after:-left-1 after:-top-[3px] after:h-2.5 after:w-2.5 after:rounded-full after:border-2 after:border-[var(--paper)] after:bg-[var(--accent)] after:content-[''] motion-reduce:transition-none"
          />
          <label htmlFor={rangeId} className="sr-only">
            {labels.yearPicker}
          </label>
          <input
            id={rangeId}
            type="range"
            min={data.years[0]}
            max={data.years[last]}
            step={1}
            value={year}
            aria-valuetext={yearText}
            onChange={(event) => {
              stop();
              const i = data.years.indexOf(Number(event.target.value));
              if (i >= 0) select(i);
            }}
            className={RANGE_CLASS}
          />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 flex justify-between font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
            <span>{data.years[0]}</span>
            <span>{labels.axisCaption}</span>
            <span>{data.years[last]}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-[30px] min-[1000px]:grid-cols-[minmax(0,1fr)_330px] min-[1000px]:gap-10">
        <figure>
          <div ref={wrapRef} className="relative h-[360px] w-full min-[601px]:h-[440px] min-[1000px]:h-[520px]">
            {failed ? (
              <ChartUnavailable text={labels.unavailable} summary={ariaLabel} />
            ) : (
              <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />
            )}
            <div
              ref={tipRef}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 z-[6] min-w-[156px] max-w-[270px] rounded-[4px] border border-[var(--hairline)] bg-[var(--tile)] px-3 pb-[9px] pt-2.5 text-xs leading-[1.35] text-[var(--ink)] opacity-0 shadow-[0_10px_28px_rgba(30,27,22,.13)] transition-opacity duration-[120ms]"
            >
              <div ref={tipTitleRef} className="mb-[5px] text-xs font-semibold" />
              <div className="mt-1 flex items-center gap-2">
                <i ref={tipKeyRef} className="h-0.5 w-3 flex-none rounded-[1px]" />
                <b ref={tipValueRef} className="whitespace-nowrap font-[family-name:var(--font-numeric)] text-xs font-semibold" />
                <span ref={tipNameRef} className="text-[11.5px] text-[var(--muted)]" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <b ref={tipShareRef} className="whitespace-nowrap font-[family-name:var(--font-numeric)] text-xs font-semibold" />
                <span ref={tipShareNameRef} className="text-[11.5px] text-[var(--muted)]" />
              </div>
              <div ref={tipFootRef} className="mt-1.5 border-t border-[var(--row-border)] pt-1.5 text-[11px] text-[var(--muted)] empty:hidden" />
            </div>
          </div>
        </figure>
        <div>
          <div className={LABEL_CLASS}>
            {labels.listCaption} · {yearText}
          </div>
          <div className="mt-2.5 flex flex-col border-t border-[var(--hairline-soft)]">
            {rows.map((f) => (
              <button
                key={f.id}
                type="button"
                data-field={f.id}
                onMouseEnter={() => engineRef.current?.highlight(f.id)}
                onMouseLeave={() => engineRef.current?.highlight(null)}
                onFocus={() => engineRef.current?.highlight(f.id)}
                onBlur={() => engineRef.current?.highlight(null)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-[5px] border-b border-[var(--row-border)] px-1 pb-2.5 pt-[9px] text-left transition-colors hover:bg-[var(--tint)] focus-visible:bg-[var(--tint)]"
              >
                <span className="text-[13px] font-medium leading-[1.3]">{f.label}</span>
                <span className="whitespace-nowrap font-[family-name:var(--font-numeric)] text-xs">
                  {money(f.values[index], labels)}
                  <em className="ml-1.5 not-italic text-[var(--muted)]">{formatShare(f.values[index] / total)}</em>
                </span>
                <span aria-hidden="true" className="relative col-span-full h-[3px] overflow-hidden rounded-sm bg-[var(--hairline-soft)]">
                  <i
                    style={{ width: `${((f.values[index] / top.values[index]) * 100).toFixed(1)}%` }}
                    className="absolute inset-y-0 left-0 rounded-sm bg-[var(--ink)] transition-[width] duration-500 ease-[cubic-bezier(.22,.7,.18,1)] group-hover:bg-[var(--accent)] group-focus-visible:bg-[var(--accent)] motion-reduce:transition-none"
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

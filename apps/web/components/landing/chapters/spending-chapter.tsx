"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatInUnit, formatShare, UNIT_BN, UNIT_MLN } from "../../../lib/explorer/format";
import type { SpendingSeries } from "../../../lib/landing/chapters/types";
import {
  anchoredRect,
  blockLabelTier,
  blockTone,
  clamp,
  fitText,
  lerpRect,
  placeTip,
  prefersReducedMotion,
  sizeCanvas,
  sparkPoints,
  squarify,
  type Rect,
} from "./canvas";
import { Reveal, useNearViewport } from "./reveal";

// Chapter 02: a squarified treemap of the 13 spending fields. The block area of a year follows
// sqrt(total / largest total) anchored bottom-left, so a small year is a small copy of the same
// picture; a year slider, a play button and a side list drive it. Ported from the design board's
// createTree.

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
};

const FALLBACK = {
  paper: "#f7f2e9",
  ink: "#1e1b16",
  accent: "#b3402a",
  control: "#95846a",
  muted: "#6a6050",
  ui: '"Noto Sans Georgian","Helvetica Neue",Arial,sans-serif',
  num: '"Geist Mono",ui-monospace,Menlo,monospace',
};
const NB = " ";
const DARK_BLOCKS = 6; // the six largest fields take light text
const STEP_MS = 900; // one year per step while playing
const TWEEN_MS = 520;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

type Amounts = Pick<SpendingLabels, "bnGel" | "mlnGel">;
/** Billions with two decimals (one from 9.95), below one billion millions with 0 or 1 decimals. */
function money(gel: number, l: Amounts): string {
  const a = Math.abs(gel);
  if (a >= 1e9) return `${formatInUnit(gel, { ...UNIT_BN, decimals: a >= 9.95e9 ? 1 : 2 })}${NB}${l.bnGel}`;
  return `${formatInUnit(gel, { ...UNIT_MLN, decimals: a >= 1e8 ? 0 : 1 })}${NB}${l.mlnGel}`;
}
const percent = (fraction: number, decimals = 1) => formatShare(fraction, false, decimals);

type Engine = { setYear(index: number, ms?: number): void; highlight(id: string | null): void; destroy(): void };

type EngineOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  data: SpendingSeries;
  initial: number;
  frameText(): string;
  amount(gel: number): string;
  onHover(field: number, x: number, y: number): void;
  onLeave(): void;
};

function createTreemap({ wrap, canvas, data, initial, frameText, amount, onHover, onLeave }: EngineOptions): Engine {
  const style = getComputedStyle(wrap);
  const token = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  };
  const font = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const paper = token("--paper", FALLBACK.paper);
  const ink = token("--ink", FALLBACK.ink);
  const accent = token("--accent", FALLBACK.accent);
  const control = token("--control", FALLBACK.control);
  const muted = token("--muted", FALLBACK.muted);
  const ui = font("--font-ui", FALLBACK.ui);
  const num = font("--font-numeric", FALLBACK.num);
  const reduced = prefersReducedMotion();

  const { fields, totals } = data;
  const maxTotal = Math.max(...totals);
  const tones = fields.map((_, i) => blockTone(i, fields.length));

  let W = 0;
  let H = 0;
  let idx = initial;
  let cur: Rect[] | null = null;
  let from: Rect[] = [];
  let to: Rect[] = [];
  let t0 = 0;
  let dur = TWEEN_MS;
  let tweenRaf = 0;
  let introRaf = 0;
  let alive = true;
  let seen = false;
  let intro = reduced ? 1 : 0;
  let hover = -1;
  let ext: string | null = null;

  const target = (i: number): Rect[] => {
    const [x, y, w, h] = anchoredRect(totals[i], maxTotal, W, H);
    return squarify(fields.map((f) => f.values[i]), x, y, w, h);
  };

  const label = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, f: string, color: string, align: CanvasTextAlign = "left") => {
    ctx.font = f;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(s, x, y);
  };

  const draw = () => {
    if (!W || !alive || !cur) return;
    const ctx = sizeCanvas(canvas, W, H);
    const k = easeOut(intro);
    if (intro > 0 && totals[idx] < maxTotal) {
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = control;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      ctx.restore();
      label(ctx, frameText(), W - 12, 22, `500 11.5px ${ui}`, muted, "right");
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, H - H * k, W * k, H * k);
    ctx.clip();
    fields.forEach((field, i) => {
      const rect = cur?.[i];
      if (!rect) return;
      const x = rect[0] + 1;
      const y = rect[1] + 1;
      const w = rect[2] - 2;
      const h = rect[3] - 2;
      if (w < 0.5 || h < 0.5) return;
      const lit = hover === i || ext === field.id;
      const dark = lit || i < DARK_BLOCKS;
      ctx.fillStyle = lit ? accent : tones[i];
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = dark ? "rgba(247,242,233,.085)" : "rgba(30,27,22,.07)";
      for (let yy = y + 4; yy < y + h - 2; yy += 7) for (let xx = x + 4; xx < x + w - 2; xx += 7) ctx.fillRect(xx, yy, 1.3, 1.3);
      const tier = blockLabelTier(w, h);
      if (tier === "none") return;
      const v = field.values[idx];
      const fraction = totals[idx] > 0 ? v / totals[idx] : 0;
      if (tier === "share") {
        ctx.font = `500 10.5px ${num}`;
        label(ctx, fitText(ctx, percent(fraction, 0), w - 12), x + 6, y + 16, `500 10.5px ${num}`, dark ? paper : ink);
        return;
      }
      const sub = dark ? "rgba(247,242,233,.8)" : "rgba(30,27,22,.82)";
      ctx.font = `600 12.5px ${ui}`;
      label(ctx, fitText(ctx, field.label, w - 20), x + 10, y + 21, `600 12.5px ${ui}`, dark ? paper : ink);
      label(ctx, amount(v), x + 10, y + 39, `500 11.5px ${num}`, sub);
      if (tier === "nameAmountShare") label(ctx, percent(fraction), x + 10, y + 56, `500 11.5px ${num}`, sub);
    });
    ctx.restore();
  };

  const tween = (ms: number) => {
    to = target(idx);
    from = cur ? cur.map((r) => [...r] as Rect) : to;
    t0 = performance.now();
    dur = ms;
    cancelAnimationFrame(tweenRaf);
    if (reduced || ms <= 0) {
      cur = to;
      draw();
      return;
    }
    const frame = (t: number) => {
      if (!alive) return;
      const k = clamp((t - t0) / dur, 0, 1);
      const e = easeInOut(k);
      cur = to.map((r, i) => lerpRect(from[i] ?? r, r, e));
      draw();
      if (k < 1) tweenRaf = requestAnimationFrame(frame);
    };
    tweenRaf = requestAnimationFrame(frame);
  };

  const size = () => {
    const w = Math.round(wrap.clientWidth);
    const h = Math.round(wrap.clientHeight);
    if (!w || !h || (w === W && h === H)) return;
    W = w;
    H = h;
    cancelAnimationFrame(tweenRaf);
    cur = to = target(idx);
    draw();
  };

  const hit = (px: number, py: number) => {
    if (!cur) return -1;
    return cur.findIndex((r) => r[2] > 1 && r[3] > 1 && px >= r[0] && px <= r[0] + r[2] && py >= r[1] && py <= r[1] + r[3]);
  };
  const move = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    const i = hit(px, py);
    if (i !== hover) {
      hover = i;
      draw();
    }
    if (i < 0) onLeave();
    else onHover(i, px, py);
  };
  const leave = () => {
    if (hover !== -1) {
      hover = -1;
      draw();
    }
    onLeave();
  };
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", move);
  canvas.addEventListener("pointerleave", leave);

  const startIntro = () => {
    if (seen) return;
    seen = true;
    if (intro >= 1) {
      draw();
      return;
    }
    const s0 = performance.now();
    const frame = (t: number) => {
      if (!alive) return;
      intro = clamp((t - s0) / 900, 0, 1);
      draw();
      if (intro < 1) introRaf = requestAnimationFrame(frame);
    };
    introRaf = requestAnimationFrame(frame);
  };

  let resizeObserver: ResizeObserver | null = null;
  let introObserver: IntersectionObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(size);
    resizeObserver.observe(wrap);
  }
  size();
  if (typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        startIntro();
      },
      { threshold: 0.3 },
    );
    introObserver = observer;
    observer.observe(wrap);
  } else {
    intro = 1;
    seen = true;
    draw();
  }

  return {
    setYear(index, ms = TWEEN_MS) {
      if (index === idx && cur) return;
      idx = index;
      // The tooltip and an outside highlight describe the old year: drop both.
      hover = -1;
      ext = null;
      onLeave();
      if (W) tween(ms);
    },
    highlight(id) {
      ext = id;
      draw();
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(tweenRaf);
      cancelAnimationFrame(introRaf);
      resizeObserver?.disconnect();
      introObserver?.disconnect();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", move);
      canvas.removeEventListener("pointerleave", leave);
    },
  };
}

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

  const near = useNearViewport(wrapRef);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!near || !wrap || !canvas || !tip) return;
    const text = (el: HTMLElement | null, value: string) => {
      if (el) el.textContent = value;
    };
    const { index: initial } = live.current;
    const engine = createTreemap({
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
        text(tipShareRef.current, percent(d.totals[i] > 0 ? v / d.totals[i] : 0));
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
  }, [near, data]);

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
    (top ? `; ${labels.largest}: ${top.label}, ${money(top.values[index], labels)}, ${percent(top.values[index] / total)}` : "");
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
            <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />
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
                  <em className="ml-1.5 not-italic text-[var(--muted)]">{percent(f.values[index] / total)}</em>
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

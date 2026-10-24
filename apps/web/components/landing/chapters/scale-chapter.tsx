"use client";

import { useEffect, useRef, useState } from "react";
import { formatInUnit, formatShare, UNIT_BN, UNIT_PERSONS } from "../../../lib/explorer/format";
import { GEL_PER_SQUARE, type ScaleChapter as ScaleData } from "../../../lib/landing/chapters/types";
import { OFF_SQUARE, placeTip, TOKEN_FALLBACKS } from "./canvas";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";
import type { Engine } from "./scale-engine";

// Chapter 01: one square per GEL 10 million, GDP is the whole grid. Squares fill column by column
// from the bottom left; picking a measure tweens the fill and moves the marker. The measure buttons
// and readout are server HTML; the drawing engine (scale-engine.ts) loads near view.

export type ScaleLabels = {
  squareNote: string; // "■ = 10 მლნ ₾"
  ofGdp: string; // "of GDP" (follows a percentage)
  cumulative: string; // tooltip: running total up to the hovered square
  included: string; // tooltip foot prefix: the square is inside the measure
  notIncluded: string; // tooltip foot prefix: the square is beyond the measure
  bnGel: string; // "მლრდ ₾"
  planned: string; // after a planned value: "გეგმა"
  square: string; // the unit word: "კვადრატი" / "squares"
  squareNoteSpoken: string; // squareNote without the glyph, for the canvas aria-label: "თითოეული 10 მილიონი ლარი"
  measureGroup: string; // aria-label of the measure button group
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./scale-engine");

const BN_2 = { ...UNIT_BN, decimals: 2 };

const count = (n: number) => formatInUnit(n, UNIT_PERSONS);
const share = (fraction: number) => formatShare(fraction, false, fraction > 0.999 ? 0 : 1);
/** The measure's name, with the planned mark when its value is planned: "სახელმწიფო ბიუჯეტის ხარჯები (გეგმა)". */
const measureName = (measure: ScaleData["measures"][number], planned: string) => (measure.planned ? `${measure.label} (${planned})` : measure.label);

export function ScaleChapter({ data, labels }: { data: ScaleData; labels: ScaleLabels }) {
  const [selectedId, setSelectedId] = useState<string>(data.defaultId);
  const selected = data.measures.find((m) => m.id === selectedId) ?? data.measures[0];
  const gdp = data.measures.find((m) => m.id === "gdp");

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const markerLabelRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipTitleRef = useRef<HTMLDivElement>(null);
  const tipKeyRef = useRef<HTMLElement>(null);
  const tipValueRef = useRef<HTMLElement>(null);
  const tipNameRef = useRef<HTMLSpanElement>(null);
  const tipShareRef = useRef<HTMLElement>(null);
  const tipShareNameRef = useRef<HTMLSpanElement>(null);
  const tipFootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  // Read by the long-lived engine callbacks, so a measure change never rebuilds the engine.
  const live = useRef({ selected, labels, data });
  useEffect(() => {
    live.current = { selected, labels, data };
  });

  const { lib, failed } = useEngine(wrapRef, loadEngine);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const marker = markerRef.current;
    const markerLabel = markerLabelRef.current;
    const tip = tipRef.current;
    if (!lib || !wrap || !canvas || !marker || !markerLabel || !tip) return;
    const text = (el: HTMLElement | null, value: string) => {
      if (el) el.textContent = value;
    };
    const engine = lib.createSquares({
      wrap,
      canvas,
      marker,
      markerLabel,
      total: data.squares,
      initial: live.current.selected.squares,
      onHover(index, x, y, filled) {
        const { selected: measure, labels: l, data: d } = live.current;
        const cumulativeGel = (index + 1) * GEL_PER_SQUARE;
        text(tipTitleRef.current, `${count(index + 1)} / ${count(d.squares)} ${l.square}`);
        if (tipKeyRef.current) tipKeyRef.current.style.background = filled ? TOKEN_FALLBACKS.ink : OFF_SQUARE;
        text(tipValueRef.current, `${formatInUnit(cumulativeGel, BN_2)} ${l.bnGel}`);
        text(tipNameRef.current, l.cumulative);
        text(tipShareRef.current, share(cumulativeGel / d.gdpGel));
        text(tipShareNameRef.current, l.ofGdp);
        text(tipFootRef.current, `${filled ? l.included : l.notIncluded}${measureName(measure, l.planned)}`);
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
  }, [lib, data.squares]);

  useEffect(() => {
    engineRef.current?.set(selected.squares);
  }, [selected.squares]);

  const markerText = `${share(selected.share)} ${labels.ofGdp}`;
  const ariaLabel =
    `${count(data.squares)} ${labels.square}, ${labels.squareNoteSpoken}; ` +
    `${measureName(selected, labels.planned)}: ${formatInUnit(selected.valueGel, UNIT_BN)} ${labels.bnGel}, ${markerText} (${count(selected.squares)} ${labels.square})`;

  return (
    <Reveal className="mt-8 grid grid-cols-1 gap-8 min-[1000px]:grid-cols-[300px_minmax(0,1fr)] min-[1000px]:gap-12">
      <div>
        <div role="group" aria-label={labels.measureGroup} className="flex flex-col border-t border-[var(--hairline-soft)]">
          {data.measures.map((measure) => (
            <button
              key={measure.id}
              type="button"
              aria-pressed={measure.id === selected.id}
              onClick={() => setSelectedId(measure.id)}
              className="group grid min-h-[50px] grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--hairline-soft)] px-1.5 py-[9px] text-left transition-colors hover:bg-[var(--tint)]"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-[1px] border-[1.5px] border-[var(--control)] transition-colors group-aria-pressed:border-[var(--accent)] group-aria-pressed:bg-[var(--accent)]"
              />
              <span className="text-[13.5px] font-medium leading-[1.3] group-aria-pressed:font-semibold">{measure.label}</span>
              <span className="whitespace-nowrap font-[family-name:var(--font-numeric)] text-xs text-[var(--muted)]">
                {formatInUnit(measure.valueGel, UNIT_BN)}&nbsp;{labels.bnGel}
                {measure.planned && <span className="ml-1.5">{labels.planned}</span>}
              </span>
            </button>
          ))}
        </div>
        <div aria-live="polite" className="mt-[26px]">
          <span className="sr-only">{measureName(selected, labels.planned)}</span>
          <div className="font-[family-name:var(--font-display)] text-[clamp(40px,4.4vw,58px)] font-semibold leading-none tracking-[-0.02em]">
            {formatInUnit(selected.valueGel, UNIT_BN)}
            <small className="ml-[0.2em] text-[0.4em] font-semibold tracking-normal">{labels.bnGel}</small>
            {selected.planned && (
              <small aria-hidden="true" className="ml-[0.4em] text-[0.3em] font-semibold tracking-normal text-[var(--muted)]">
                {labels.planned}
              </small>
            )}
          </div>
          <div className="mt-3 font-[family-name:var(--font-numeric)] text-[13px] text-[var(--body)]">
            <b className="font-semibold text-[var(--ink)]">{markerText}</b> · {count(selected.squares)} {labels.square}
          </div>
        </div>
      </div>
      <figure>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
          <span aria-hidden className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{labels.squareNote}</span>
          <span className="font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)]">
            {count(data.squares)} {labels.square} = {gdp?.label ?? ""}, {data.year}
          </span>
        </div>
        <div ref={wrapRef} className="relative h-[280px] w-full cursor-crosshair min-[1000px]:h-[420px]">
          {failed ? (
            <ChartUnavailable text={labels.unavailable} summary={ariaLabel} />
          ) : (
            <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />
          )}
          <div
            ref={markerRef}
            className="pointer-events-none absolute -bottom-2.5 -top-2.5 left-0 w-0 border-l-[1.5px] border-[var(--accent)] opacity-0 [transition:transform_.9s_cubic-bezier(.22,.7,.18,1),opacity_.3s] motion-reduce:[transition:none]"
          >
            <span
              ref={markerLabelRef}
              className="absolute left-2 top-[14px] whitespace-nowrap border border-[var(--hairline)] bg-[var(--paper)] px-2 py-1 font-[family-name:var(--font-numeric)] text-xs font-semibold text-[var(--ink)] shadow-[0_4px_14px_rgba(30,27,22,.12)]"
            >
              {markerText}
            </span>
          </div>
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
            <div ref={tipFootRef} className="mt-1.5 border-t border-[var(--row-border)] pt-1.5 text-[11px] text-[var(--muted)]" />
          </div>
        </div>
      </figure>
    </Reveal>
  );
}

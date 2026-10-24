"use client";

import { useEffect, useRef, useState } from "react";
import { formatShare } from "../../../lib/explorer/format";
import type { MunicipalChapter } from "../../../lib/landing/chapters/types";
import { money } from "./chart-format";
import { ChartTip, hideTip, showTip } from "./chart-tip";
import { reliefTip } from "./chart-tips";
import type { Engine } from "./relief-engine";
import { ChartUnavailable, Reveal, useEngine } from "./reveal";

// Chapter 04: every municipal budget as a column rising from a dot map of Georgia, drawn with raw WebGL,
// or on a 2D canvas where WebGL is unavailable or loses its context. The scene drifts slowly while it is
// on screen; the three largest places carry labels. The accessible name is server HTML; the drawing
// engine (relief-engine.ts) loads near view.

export type MunicipalLabels = {
  bnGel: string; // "მლრდ ₾"
  mlnGel: string; // "მლნ ₾"
  gel: string; // after the budget per resident: "₾"
  budget: string; // tooltip row, ", 2025" follows: "ბიუჯეტი"
  perResident: string; // tooltip row: "ერთ მცხოვრებზე"
  rank: string; // tooltip foot, ": 2 / 64" follows: "რანგი ბიუჯეტით"
  occupied: string; // tooltip title over an occupied area: "ოკუპირებული ტერიტორია"
  occupiedNote: string; // its foot: "მუნიციპალური ბიუჯეტის მონაცემები არ არსებობს"
  total: string; // canvas aria-label, before the total of all places: "სულ"
  share: string; // canvas aria-label, before the largest place's share: "წილი"
  chartSummary: string; // canvas aria-label lead: "საქართველოს მუნიციპალიტეტების ბიუჯეტის სამგანზომილებიანი რელიეფი"
  unavailable: string; // in place of the chart when its engine fails to load
};

const loadEngine = () => import("./relief-engine");
const LABELLED = 3; // the largest places named on the stage

export function MunicipalRelief({ data, labels }: { data: MunicipalChapter; labels: MunicipalLabels }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // Read by the long-lived engine callbacks, so a label change never rebuilds the engine.
  const live = useRef({ data, labels });
  useEffect(() => {
    live.current = { data, labels };
  });

  const { lib, failed } = useEngine(stageRef, loadEngine);
  // Off once WebGL fails to start or loses its context: the canvas is remounted (its key changes),
  // because a canvas that has handed out a WebGL context cannot give a 2D one.
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!lib || !stage || !canvas || !tip) return;
    let engine: Engine | null = null;
    let retry = 0;
    try {
      engine = lib.createRelief({
        stage,
        canvas,
        labelEls: labelRefs.current.slice(0, LABELLED),
        data,
        webgl,
        onHover(hit, x, y) {
          const { data: d, labels: lab } = live.current;
          showTip(tip, reliefTip(d, lab, hit), x, y, stage.clientWidth, stage.clientHeight);
        },
        onLeave: () => hideTip(tip),
        onLost: () => {
          console.warn("[fiscal] municipal relief: WebGL context lost, drawing in 2D");
          setWebgl(false);
        },
      });
    } catch (error) {
      if (!webgl) throw error;
      console.warn("[fiscal] municipal relief: WebGL unavailable, drawing in 2D", error);
      // WebGL started but its shaders would not build: retry in 2D on a fresh canvas.
      retry = window.setTimeout(() => setWebgl(false), 0);
    }
    return () => {
      window.clearTimeout(retry);
      engine?.destroy();
      hideTip(tip);
    };
  }, [lib, data, webgl]);

  const top = data.places[0];
  const ariaLabel =
    `${labels.chartSummary}, ${data.year}: ${labels.total} ${money(data.totalGel, labels)}; ` +
    `${top.name} ${money(top.totalGel, labels)}, ${labels.share} ${formatShare(top.totalGel / data.totalGel)}`;

  return (
    <Reveal className="home-muni">
      <figure>
        <div ref={stageRef} className="home-muni-stage">
          {failed ? (
            <ChartUnavailable text={labels.unavailable} summary={ariaLabel} />
          ) : (
            <canvas key={webgl ? "webgl" : "2d"} ref={canvasRef} role="img" aria-label={ariaLabel} className="absolute left-0 top-0" />
          )}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {data.places.slice(0, LABELLED).map((place, i) => (
              <span
                key={place.code}
                ref={(el) => {
                  labelRefs.current[i] = el;
                }}
                className="absolute left-0 top-0 whitespace-nowrap border-l-[1.5px] border-[var(--ink)] bg-[rgba(247,242,233,.86)] px-1.5 py-0.5 font-[family-name:var(--font-numeric)] text-[11px] font-semibold text-[var(--ink)] opacity-0 transition-opacity duration-300 will-change-transform motion-reduce:transition-none"
              >
                {`${place.name} · ${money(place.totalGel, labels)}`}
              </span>
            ))}
          </div>
          <ChartTip tipRef={tipRef} rows={2} />
        </div>
      </figure>
    </Reveal>
  );
}

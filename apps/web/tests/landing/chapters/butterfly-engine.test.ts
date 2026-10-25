import { afterEach, describe, expect, it, vi } from "vitest";
import { createButterfly } from "../../../components/landing/chapters/butterfly-engine";
import type { ButterflyLabels } from "../../../components/landing/chapters/butterfly-chart";
import type { TradeChapter } from "../../../lib/landing/chapters/types";

// The partners engine against a recording 2D context whose text is 6.5 px per character wide: what it prints for the
// real, long name of the United States, and where.

const USA = "ამერიკის შეერთებული შტატები";
const partners: TradeChapter["partners"] = [
  { id: "p.tr", label: "თურქეთი", exportsUsd: 0.33e9, importsUsd: 2.78e9, turnoverUsd: 3.11e9 },
  { id: "p.us", label: USA, exportsUsd: 0.12e9, importsUsd: 2.79e9, turnoverUsd: 2.91e9 },
];
const labels = { exportsHead: "← ექსპორტი", importsHead: "იმპორტი →" } as ButterflyLabels;

function draw(width: number, height: number) {
  const texts: { text: string; x: number; y: number; font: string }[] = [];
  const noop = () => {};
  const ctx = new Proxy(
    {
      clearRect: () => void (texts.length = 0), // each draw starts on a cleared canvas
      measureText: (s: string) => ({ width: s.length * 6.5 }),
      fillText: function (this: { font: string }, text: string, x: number, y: number) {
        texts.push({ text, x, y, font: this.font });
      },
    } as Record<string, unknown>,
    { get: (target, key: string) => (key in target ? target[key] : noop), set: (target, key: string, value) => ((target[key] = value), true) },
  );
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener: noop, removeEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLCanvasElement;
  const wrap = { clientWidth: width, clientHeight: height } as HTMLElement;
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("addEventListener", noop);
  vi.stubGlobal("removeEventListener", noop);
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("cancelAnimationFrame", noop);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  vi.stubGlobal("document", { addEventListener: noop, removeEventListener: noop });
  const engine = createButterfly({ wrap, canvas, partners, labels: () => labels, onHover: noop, onLeave: noop });
  engine.destroy();
  return texts;
}

afterEach(() => vi.unstubAllGlobals());

describe("createButterfly names", () => {
  it("prints the full name on one line when the plot is wide enough, centred on the column", () => {
    const texts = draw(695, 400);
    const names = texts.filter((t) => t.text.includes("ამერიკის"));
    expect(names.map((t) => t.text)).toEqual([USA]);
    expect(texts.some((t) => t.text.includes("…"))).toBe(false);
    expect(names[0].x).toBe(texts.find((t) => t.text === "თურქეთი")!.x);
  });

  it("wraps the name onto two lines in the narrow column, one above the other in the same font", () => {
    const texts = draw(335, 340);
    const lines = texts.filter((t) => t.text !== "თურქეთი" && /^[ა-ჰ]/.test(t.text) && !t.text.includes("ექსპორტი") && !t.text.includes("იმპორტი"));
    expect(lines).toHaveLength(2);
    expect(lines.map((t) => t.text)).toEqual(["ამერიკის შეერთებული", "შტატები"]);
    expect(lines[0].y).toBeLessThan(lines[1].y);
    expect(lines[0].x).toBe(lines[1].x);
    expect(lines[0].font).toBe(lines[1].font);
  });
});

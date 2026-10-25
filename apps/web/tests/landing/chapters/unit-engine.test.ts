import { afterEach, describe, expect, it, vi } from "vitest";
import { unitLayout } from "../../../components/landing/chapters/chart-layout";
import { createUnits } from "../../../components/landing/chapters/unit-engine";
import type { DeathsChapter } from "../../../lib/landing/chapters/types";

// The causes-of-death engine against a recording 2D context whose text is 6.5 px per character wide: how many
// squares of each kind it draws, what it prints for each group, and how it sets the chart's height.

const groups: DeathsChapter["groups"] = [
  { id: "circulatory", label: "სისხლის მიმოქცევის სისტემის ავადმყოფობები", count: 16711, kind: "top" },
  { id: "ill_defined", label: "არაზუსტად განსაზღვრული მიზეზები", count: 9389, kind: "unknown" },
  { id: "cancer", label: "სიმსივნეები", count: 6877, kind: "established" },
  { id: "other", label: "სხვა მიზეზები", count: 5836, kind: "other" },
];
const total = 38813;
const ruler = (s: string) => s.length * 6.5;

function draw(width: number, height: number, hoverY?: number, grouped = groups) {
  const hovers: { index: number; x: number; y: number }[] = [];
  const handlers: Record<string, (event: unknown) => void> = {};
  const calls: { op: string; args: unknown[]; fill: unknown; stroke: unknown; font: string }[] = [];
  const noop = () => {};
  const record = (op: string) =>
    function (this: { fillStyle: unknown; strokeStyle: unknown; font: string }, ...args: unknown[]) {
      calls.push({ op, args, fill: this.fillStyle, stroke: this.strokeStyle, font: this.font });
    };
  const ctx = new Proxy(
    {
      clearRect: () => void (calls.length = 0), // each draw starts on a cleared canvas
      measureText: (s: string) => ({ width: ruler(s) }),
      fillRect: record("fillRect"),
      strokeRect: record("strokeRect"),
      fillText: record("fillText"),
    } as Record<string, unknown>,
    { get: (target, key: string) => (key in target ? target[key] : noop), set: (target, key: string, value) => ((target[key] = value), true) },
  );
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener: (type: string, fn: (event: unknown) => void) => void (handlers[type] = fn), removeEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLCanvasElement;
  const wrap = { clientWidth: width, clientHeight: height, style: {} as Record<string, string> } as unknown as HTMLElement;
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("addEventListener", noop);
  vi.stubGlobal("removeEventListener", noop);
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("cancelAnimationFrame", noop);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  vi.stubGlobal("document", { addEventListener: noop, removeEventListener: noop });
  const engine = createUnits({ wrap, canvas, groups: grouped, total, onHover: (index, x, y) => hovers.push({ index, x, y }), onLeave: noop });
  if (hoverY !== undefined) handlers.pointermove({ clientX: 300, clientY: hoverY, pointerType: "mouse" });
  engine.destroy();
  return { calls, wrap, hovers };
}

const needed = (width: number) =>
  unitLayout(width, groups.map((group) => group.count), ruler, groups.map((group) => group.label)).height;

afterEach(() => vi.unstubAllGlobals());

describe("createUnits", () => {
  it("asks for the height the rows need before drawing anything", () => {
    const { calls, wrap } = draw(1000, 100);
    expect(wrap.style.height).toBe(`${needed(1000)}px`);
    expect(calls).toHaveLength(0);
  });

  it("draws one square per 100 deaths: filled for the others, hollow for the unestablished", () => {
    const { calls } = draw(1000, needed(1000));
    const filled = calls.filter((call) => call.op === "fillRect");
    const hollow = calls.filter((call) => call.op === "strokeRect");
    expect(filled).toHaveLength(167 + 69 + 58);
    expect(hollow).toHaveLength(94);
    // Accent for the largest cause, ink for the other established ones, the control colour for the remainder and the hollow ones.
    expect(new Set(filled.map((call) => call.fill))).toEqual(new Set(["#b3402a", "#1e1b16", "#95846a"]));
    expect(filled.filter((call) => call.fill === "#b3402a")).toHaveLength(167);
    expect(hollow.every((call) => call.stroke === "#95846a")).toBe(true);
  });

  it("prints each group's name in full beside its squares, over two lines when it is long, with count and share", () => {
    const { calls } = draw(1000, needed(1000));
    const texts = calls.filter((call) => call.op === "fillText").map((call) => call.args[0]);
    expect(texts).toContain("სისხლის მიმოქცევის სისტემის");
    expect(texts).toContain("ავადმყოფობები");
    expect(texts).toContain("სიმსივნეები");
    expect(texts).toContain("16,711 · 43%");
    expect(texts.some((text) => String(text).includes("…"))).toBe(false);
  });

  it("puts the name above the squares and the count at the right edge when narrow", () => {
    const { calls } = draw(375, needed(375));
    const counts = calls.filter((call) => call.op === "fillText" && String(call.args[0]).includes("·"));
    expect(counts).toHaveLength(4);
    expect(counts.every((call) => call.args[1] === 375)).toBe(true);
  });

  it("points the tooltip at the first square of a group too small to draw one, never left of the squares", () => {
    const small = [...groups, { id: "tiny", label: "ფსიქიკური აშლილობები", count: 40, kind: "established" as const }];
    const layout = unitLayout(1000, small.map((group) => group.count), ruler, small.map((group) => group.label));
    const { hovers } = draw(1000, layout.height, layout.rows[4].top + 1, small);
    expect(hovers).toEqual([{ index: 4, x: 256 + 8, y: layout.rows[4].top }]);
  });
});

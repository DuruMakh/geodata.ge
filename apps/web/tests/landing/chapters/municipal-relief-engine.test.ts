import { afterEach, describe, expect, it, vi } from "vitest";
import { createRelief } from "../../../components/landing/chapters/relief-engine";
import type { MunicipalChapter } from "../../../lib/landing/chapters/types";

// The relief engine against fake browser objects: a WebGL context that counts what it creates and
// deletes, a recording 2D context, hand-driven rAF and observers.

type Listener = (...args: unknown[]) => void;

// 6 x 3 grid: places 0 and 1, one occupied cell, the rest empty.
const data: MunicipalChapter = {
  year: 2025,
  totalGel: 3e9,
  places: [
    { code: "04", name: "თბილისი", totalGel: 2e9, perResidentGel: 1700, rank: 1, city: false },
    { code: "06", name: "ბათუმი", totalGel: 1e9, perResidentGel: 2800, rank: 2, city: true },
  ],
  grid: { cols: 6, rows: 3, cells: [-1, 0, 0, -1, -1, -2, -1, 0, 0, 1, 1, -1, -1, -1, -1, 1, -1, -1] },
};

function listeners() {
  const map: Record<string, Listener[]> = {};
  return {
    map,
    add: (type: string, fn: Listener) => void (map[type] ??= []).push(fn),
    remove: (type: string, fn: Listener) => void (map[type] = (map[type] ?? []).filter((f) => f !== fn)),
    fire: (type: string, ...args: unknown[]) => (map[type] ?? []).forEach((fn) => fn(...args)),
    count: () => Object.values(map).reduce((n, l) => n + l.length, 0),
  };
}

function setup({ webgl, reduced }: { webgl: boolean; reduced: boolean }) {
  const frames = new Map<number, (t: number) => void>();
  let nextFrame = 0;
  const doc = { hidden: false, ...listeners() };
  const observers = { intersection: [] as { cb: (entries: { isIntersecting: boolean }[]) => void; live: boolean }[], resize: [] as { live: boolean }[] };

  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("devicePixelRatio", 2);
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  vi.stubGlobal("document", { get hidden() { return doc.hidden; }, addEventListener: doc.add, removeEventListener: doc.remove });
  vi.stubGlobal("requestAnimationFrame", (fn: (t: number) => void) => (frames.set(++nextFrame, fn), nextFrame));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      entry: (typeof observers.intersection)[number];
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        this.entry = { cb, live: false };
        observers.intersection.push(this.entry);
      }
      observe() {
        this.entry.live = true;
      }
      disconnect() {
        this.entry.live = false;
      }
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      entry = { live: false };
      constructor() {
        observers.resize.push(this.entry);
      }
      observe() {
        this.entry.live = true;
      }
      disconnect() {
        this.entry.live = false;
      }
    },
  );

  const gl = { created: {} as Record<string, number>, deleted: {} as Record<string, number> };
  const glContext = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      if (prop === "drawingBufferWidth" || prop === "drawingBufferHeight") return 100;
      if (/^[A-Z_]+$/.test(prop)) return 1;
      return () => {
        const kind = /^(create|delete)(Buffer|Program|Shader)$/.exec(prop);
        if (kind) {
          const book = kind[1] === "create" ? gl.created : gl.deleted;
          book[kind[2]] = (book[kind[2]] ?? 0) + 1;
          return kind[1] === "create" ? { kind: kind[2] } : undefined;
        }
        if (prop === "getShaderParameter" || prop === "getProgramParameter") return true;
        if (prop === "getAttribLocation") return 0;
        if (prop === "getUniformLocation") return {};
        return undefined;
      };
    },
  });
  const draws = { fillRect: 0, clearRect: 0 };
  const context2d = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return () => {
        if (prop === "fillRect" || prop === "clearRect") draws[prop] += 1;
        if (prop === "createLinearGradient") return { addColorStop() {} };
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });

  const canvasEvents = listeners();
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: (type: string) => (type === "webgl" ? (webgl ? glContext : null) : context2d),
    addEventListener: canvasEvents.add,
    removeEventListener: canvasEvents.remove,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  const stage = { clientWidth: 900, clientHeight: 500 };
  const onLost = vi.fn();
  const engine = createRelief({
    stage: stage as unknown as HTMLElement,
    canvas: canvas as unknown as HTMLCanvasElement,
    labelEls: [{ offsetWidth: 120, style: {} } as unknown as HTMLElement],
    data,
    webgl: true,
    onHover: () => {},
    onLeave: () => {},
    onLost,
  })!;

  const tick = (t: number) => {
    const due = [...frames.values()];
    frames.clear();
    due.forEach((fn) => fn(t));
    return due.length;
  };
  const view = (isIntersecting: boolean) => observers.intersection[0].cb([{ isIntersecting }]);
  return { engine, frames, tick, view, doc, observers, gl, draws, canvasEvents, onLost };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createRelief", () => {
  it("runs the drift loop only while the stage is on screen and the page is visible", () => {
    const s = setup({ webgl: true, reduced: false });
    expect(s.frames.size).toBe(0); // nothing before the stage is seen
    s.view(true);
    for (let t = 0; t < 2400; t += 16) s.tick(t);
    expect(s.frames.size).toBe(1); // still looping after the intro

    s.view(false);
    expect(s.frames.size).toBe(0);
    s.view(true);
    expect(s.frames.size).toBe(1);

    s.doc.hidden = true;
    s.doc.fire("visibilitychange");
    expect(s.frames.size).toBe(0);
    s.doc.hidden = false;
    s.doc.fire("visibilitychange");
    expect(s.frames.size).toBe(1);
    s.engine.destroy();
  });

  it("stops and reports once when the WebGL context is lost", () => {
    const s = setup({ webgl: true, reduced: false });
    s.view(true);
    s.tick(0);
    s.canvasEvents.fire("webglcontextlost");
    expect(s.onLost).toHaveBeenCalledTimes(1);
    expect(s.frames.size).toBe(0);
    s.engine.destroy();
  });

  it("deletes every buffer, program and shader, cancels rAF and removes every listener and observer on destroy", () => {
    const s = setup({ webgl: true, reduced: false });
    s.view(true);
    s.tick(0);
    expect(s.gl.created).toEqual({ Program: 2, Shader: 4, Buffer: 5 });
    expect(s.frames.size).toBe(1);
    expect(s.canvasEvents.count()).toBe(4);
    expect(s.doc.count()).toBe(1);

    s.engine.destroy();
    expect(s.gl.deleted).toEqual(s.gl.created);
    expect(s.frames.size).toBe(0);
    expect(s.canvasEvents.count()).toBe(0);
    expect(s.doc.count()).toBe(0);
    expect([...s.observers.intersection, ...s.observers.resize].every((o) => !o.live)).toBe(true);
  });

  it("falls back to 2D without WebGL and, under reduced motion, draws one still frame with no loop", () => {
    const s = setup({ webgl: false, reduced: true });
    s.view(true);
    expect(s.tick(1000)).toBe(1);
    expect(s.frames.size).toBe(0);
    expect(s.draws.clearRect).toBe(1);
    expect(s.draws.fillRect).toBe(data.grid.cols * data.grid.rows);
    expect(s.gl.created).toEqual({});
    s.engine.destroy();
  });
});

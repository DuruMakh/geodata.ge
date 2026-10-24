import type { MunicipalChapter } from "../../../lib/landing/chapters/types";
import { bindChartPointer, clamp, fitCanvas, prefersReducedMotion, readTokens, rgb, sizeCanvas } from "./canvas";
import { easeOut } from "./chart-draw";
import { camFit, camProject, camUpdate, labelX, labelY, makeCam, pickPlace, reliefScene, toScreen, worldX, worldZ, type Vec3 } from "./relief-math";

// The engine of chapter 04's relief, loaded only once the chapter nears the viewport (municipal-relief.tsx): raw
// WebGL, or a 2D canvas where WebGL is unavailable or loses its context. The scene drifts slowly while it is on screen.
// Ported from the design board's createMuni.

const INTRO_MS = 1900;
const SPIKE_HALF_WIDTH = 4.4;
const SPIKE_ALPHA = 0.9;
// Dot colours with no design token: a place's own dots, the ground between places, an occupied area.
const FLAT = "#ded6c7";
const GROUND = "#eeebe3";
const OCCUPIED = "#e6dfd4";
const VIEW_DIR: Vec3 = [0, 640 / Math.hypot(640, 760), 760 / Math.hypot(640, 760)];

const DOT_VS =
  "attribute vec3 position;attribute vec3 col;attribute float psize;uniform mat4 mvp;varying vec3 vc;void main(){vc=col;gl_PointSize=psize;gl_Position=mvp*vec4(position,1.0);}";
const DOT_FS = "precision mediump float;varying vec3 vc;void main(){gl_FragColor=vec4(vc,1.0);}";
const SPIKE_VS = "attribute vec3 position;attribute vec3 col;uniform mat4 mvp;varying vec3 vc;void main(){vc=col;gl_Position=mvp*vec4(position,1.0);}";
const SPIKE_FS = "precision mediump float;varying vec3 vc;uniform float alpha;void main(){gl_FragColor=vec4(vc,alpha);}";

/** What both renderers draw: one dot per grid cell (size in device pixels) and one spike triangle per place. */
type Buffers = {
  n: number;
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  spikes: number;
  spikePos: Float32Array;
  spikeCol: Float32Array;
};

type Renderer = {
  /** Draw a frame through view-projection `M` on a W x H CSS-pixel stage; `changed` when the buffers were rewritten. */
  draw(M: Float32Array, W: number, H: number, pr: number, changed: boolean): void;
  free(): void;
};

function glRenderer(gl: WebGLRenderingContext, b: Buffers): Renderer {
  const shaders: WebGLShader[] = [];
  const programs: WebGLProgram[] = [];
  const buffers: WebGLBuffer[] = [];
  const free = () => {
    buffers.forEach((x) => gl.deleteBuffer(x));
    programs.forEach((x) => gl.deleteProgram(x));
    shaders.forEach((x) => gl.deleteShader(x));
  };
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) throw new Error("WebGL shader unavailable");
    shaders.push(s);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "WebGL shader failed");
    return s;
  };
  const program = (vs: string, fs: string) => {
    const p = gl.createProgram();
    if (!p) throw new Error("WebGL program unavailable");
    programs.push(p);
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "WebGL link failed");
    return p;
  };
  const buffer = () => {
    const x = gl.createBuffer();
    if (!x) throw new Error("WebGL buffer unavailable");
    buffers.push(x);
    return x;
  };
  const attribute = (target: WebGLBuffer, data: Float32Array, changed: boolean, loc: number, size: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, target);
    if (changed) gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };

  try {
    const dots = program(DOT_VS, DOT_FS);
    const spikes = program(SPIKE_VS, SPIKE_FS);
    const d = {
      pos: gl.getAttribLocation(dots, "position"),
      col: gl.getAttribLocation(dots, "col"),
      size: gl.getAttribLocation(dots, "psize"),
      mvp: gl.getUniformLocation(dots, "mvp"),
    };
    const s = {
      pos: gl.getAttribLocation(spikes, "position"),
      col: gl.getAttribLocation(spikes, "col"),
      mvp: gl.getUniformLocation(spikes, "mvp"),
      alpha: gl.getUniformLocation(spikes, "alpha"),
    };
    const dotPos = buffer();
    const dotCol = buffer();
    const dotSize = buffer();
    const spikePos = buffer();
    const spikeCol = buffer();
    return {
      draw(M, _W, _H, _pr, changed) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.BLEND);
        gl.useProgram(dots);
        gl.uniformMatrix4fv(d.mvp, false, M);
        attribute(dotPos, b.pos, changed, d.pos, 3);
        attribute(dotCol, b.col, changed, d.col, 3);
        attribute(dotSize, b.size, changed, d.size, 1);
        gl.drawArrays(gl.POINTS, 0, b.n);
        gl.disableVertexAttribArray(d.pos);
        gl.disableVertexAttribArray(d.col);
        gl.disableVertexAttribArray(d.size);

        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.useProgram(spikes);
        gl.uniformMatrix4fv(s.mvp, false, M);
        gl.uniform1f(s.alpha, SPIKE_ALPHA);
        attribute(spikePos, b.spikePos, changed, s.pos, 3);
        attribute(spikeCol, b.spikeCol, changed, s.col, 3);
        gl.drawArrays(gl.TRIANGLES, 0, b.spikes * 3);
        gl.disableVertexAttribArray(s.pos);
        gl.disableVertexAttribArray(s.col);
        gl.depthMask(true);
      },
      free,
    };
  } catch (error) {
    free();
    throw error;
  }
}

/** The same frame on a 2D canvas: dots as squares, spikes as triangles shaded from foot to tip. */
function softRenderer(canvas: HTMLCanvasElement, b: Buffers): Renderer {
  const css = (A: Float32Array, o: number) => `rgb(${Math.round(A[o] * 255)},${Math.round(A[o + 1] * 255)},${Math.round(A[o + 2] * 255)})`;
  const project = (M: Float32Array, P: Float32Array, o: number, W: number, H: number, out: [number, number]) => {
    const X = P[o];
    const Y = P[o + 1];
    const Z = P[o + 2];
    const w = M[3] * X + M[7] * Y + M[11] * Z + M[15];
    if (w <= 1e-6) return false;
    out[0] = (((M[0] * X + M[4] * Y + M[8] * Z + M[12]) / w) * 0.5 + 0.5) * W;
    out[1] = ((-(M[1] * X + M[5] * Y + M[9] * Z + M[13]) / w) * 0.5 + 0.5) * H;
    return true;
  };
  const p: [number, number] = [0, 0];
  const a: [number, number] = [0, 0];
  const c: [number, number] = [0, 0];
  return {
    draw(M, W, H, pr) {
      const ctx = sizeCanvas(canvas, W, H);
      let last = "";
      for (let i = 0; i < b.n; i++) {
        const s = b.size[i] / pr;
        if (s < 0.3 || !project(M, b.pos, 3 * i, W, H, p)) continue;
        const fill = css(b.col, 3 * i);
        if (fill !== last) {
          ctx.fillStyle = fill;
          last = fill;
        }
        ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
      }
      ctx.globalAlpha = SPIKE_ALPHA;
      for (let j = 0; j < b.spikes; j++) {
        const o = 9 * j;
        if (!project(M, b.spikePos, o, W, H, a) || !project(M, b.spikePos, o + 3, W, H, p) || !project(M, b.spikePos, o + 6, W, H, c)) continue;
        const shade = ctx.createLinearGradient((a[0] + p[0]) / 2, (a[1] + p[1]) / 2, c[0], c[1] - 1e-3);
        shade.addColorStop(0, css(b.spikeCol, o));
        shade.addColorStop(1, css(b.spikeCol, o + 6));
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    free() {},
  };
}

export type Engine = { destroy(): void };

export type EngineOptions = {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Label of places[i], for the labelled largest places. */
  labelEls: (HTMLElement | null)[];
  data: MunicipalChapter;
  webgl: boolean;
  /** The pointer is over place `hit`, or over an occupied area (-2). */
  onHover(hit: number, x: number, y: number): void;
  onLeave(): void;
  /** The WebGL context was lost; the canvas has to be replaced for the 2D path. */
  onLost(): void;
};

export function createRelief(o: EngineOptions): Engine | null {
  const { stage, canvas, labelEls, data } = o;
  const gl = o.webgl ? canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true }) : null;
  if (!gl && !canvas.getContext("2d")) return null;

  const reduced = prefersReducedMotion();
  const scene = reliefScene(data);
  const { cols: C, rows: R, cells, border, centers, heights } = scene;
  const N = C * R;
  const S = data.places.length;
  const tokens = readTokens(stage);
  const unit = (hex: string) => rgb(hex).map((v) => v / 255) as Vec3;
  const PAPER = unit(tokens.paper);
  const INK = unit(tokens.ink);
  const ACCENT = unit(tokens.accent);
  const FLAT_C = unit(FLAT);
  const GROUND_C = unit(GROUND);
  const OCCUPIED_C = unit(OCCUPIED);
  const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  const buf: Buffers = {
    n: N,
    pos: new Float32Array(3 * N),
    col: new Float32Array(3 * N),
    size: new Float32Array(N),
    spikes: S,
    spikePos: new Float32Array(9 * S),
    spikeCol: new Float32Array(9 * S),
  };
  for (let k = 0; k < N; k++) {
    buf.pos[3 * k] = worldX(k % C, C);
    buf.pos[3 * k + 2] = worldZ(Math.floor(k / C), R);
  }
  // Spikes go far to near, so blending stays clean.
  const spikeOrder = data.places.map((_, i) => i).sort((a, b) => centers[a].r - centers[b].r);
  const renderer = gl ? glRenderer(gl, buf) : softRenderer(canvas, buf);

  const cam = makeCam(16, 12000);
  const fitPoints: Vec3[] = [];
  cells.forEach((own, k) => {
    if (own !== -1) fitPoints.push([worldX(k % C, C), 0, worldZ(Math.floor(k / C), R)]);
  });
  centers.forEach((center, i) => fitPoints.push([worldX(center.c, C), heights[i] + 8, worldZ(center.r, R)]));

  let W = 0;
  let H = 0;
  let pr = 1;
  let dotSize = 3;
  let dist = 2000;
  let base: Vec3 = [0, 0, 0];
  let intro = reduced ? 1 : 0;
  let introStart = 0;
  let started = false;
  let hover = -1;
  let dirty = true;
  let changed = true;
  let visible = false;
  let alive = true;
  let raf = 0;
  const mouse = { x: 0, y: 0 };
  const pj: [number, number] = [0, 0];

  const rise = (c: number) => (intro >= 1 ? 1 : easeOut(clamp(intro * 1.7 - (c / C) * 0.7, 0, 1)));
  const update = () => {
    for (let k = 0; k < N; k++) {
      const own = cells[k];
      const depth = 0.86 + 0.28 * (Math.floor(k / C) / R);
      const shown = intro >= 1 ? 1 : clamp(intro * 2.2 - ((k % C) / C) * 0.9, 0, 1);
      let color: Vec3;
      let size: number;
      if (own === -1) {
        color = GROUND_C;
        size = dotSize * 0.42;
      } else if (own === -2) {
        color = OCCUPIED_C;
        size = dotSize * 0.66;
      } else {
        const edge = border[k] === 1;
        color = own === hover ? mix(ACCENT, PAPER, edge ? 0.45 : 0.2) : edge ? mix(FLAT_C, PAPER, 0.5) : FLAT_C;
        size = dotSize * (edge ? 0.82 : 1);
      }
      if (shown < 1) color = mix(PAPER, color, shown);
      buf.col.set(color, 3 * k);
      buf.size[k] = size * depth;
    }
    spikeOrder.forEach((i, j) => {
      const { c, r } = centers[i];
      const x = worldX(c, C);
      const z = worldZ(r, R);
      buf.spikePos.set([x - SPIKE_HALF_WIDTH, 0, z, x + SPIKE_HALF_WIDTH, 0, z, x, heights[i] * rise(c), z], 9 * j);
      const tip = i === hover ? ACCENT : INK;
      const foot = mix(tip, PAPER, 0.6);
      buf.spikeCol.set([...foot, ...foot, ...tip], 9 * j);
    });
    changed = true;
  };

  const placeLabels = (alpha: number) => {
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    labelEls.forEach((el, i) => {
      if (!el || !centers[i]) return;
      const [sx, sy] = toScreen(camProject(cam, [worldX(centers[i].c, C), heights[i] + 2, worldZ(centers[i].r, R)], pj), W, H);
      const w = el.offsetWidth || 120;
      const h = el.offsetHeight || 20;
      const { x, flipped } = labelX(sx, w, W);
      const y = labelY({ x, y: sy - 26, w, h }, placed);
      placed.push({ x, y, w, h });
      el.style.borderLeftWidth = flipped ? "0" : "";
      el.style.borderRightWidth = flipped ? "1.5px" : "";
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      el.style.opacity = String(alpha);
    });
  };

  const frame = (time: number) => {
    raf = 0;
    if (!alive) return;
    const rising = started && intro < 1;
    if (rising) intro = clamp((time - introStart) / INTRO_MS, 0, 1);
    if (rising || dirty) {
      update();
      dirty = false;
    }
    if (reduced) {
      cam.pos = [base[0], base[1], base[2]];
    } else {
      // Slow sideways drift plus a little parallax from the pointer, eased.
      const tx = base[0] + Math.sin((time / 1000) * 0.09) * dist * 0.012 + mouse.x * dist * 0.016;
      const ty = base[1] - mouse.y * dist * 0.01;
      cam.pos[0] += (tx - cam.pos[0]) * 0.05;
      cam.pos[1] += (ty - cam.pos[1]) * 0.05;
      cam.pos[2] += (base[2] - cam.pos[2]) * 0.05;
    }
    camUpdate(cam);
    placeLabels(intro >= 1 ? 1 : 0);
    renderer.draw(cam.M, W, H, pr, changed);
    changed = false;
    if (!reduced) request();
  };
  // Frames run only while the stage is on screen and the page is visible; under reduced motion one
  // still frame is drawn per change (resize, hover) instead of a loop.
  const request = () => {
    if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const layout = () => {
    const w = Math.max(1, Math.round(stage.clientWidth));
    const h = Math.max(1, Math.round(stage.clientHeight));
    if (w === W && h === H) return;
    W = w;
    H = h;
    pr = fitCanvas(canvas, W, H);
    cam.aspect = W / H;
    cam.tgt = [0, 0, 6];
    const narrow = W < 700;
    dist = camFit(cam, VIEW_DIR, fitPoints, narrow ? 0.04 : 0.06, narrow ? 0.14 : 0.11, 12000);
    base = [cam.pos[0], cam.pos[1], cam.pos[2]];
    const left = camProject(cam, [worldX(0, C), 0, 0], [0, 0])[0];
    const right = camProject(cam, [worldX(C - 1, C), 0, 0], [0, 0])[0];
    dotSize = clamp((Math.abs(right - left) / 2) * (W / C) * 0.42, 1.8, 5.4) * pr;
    dirty = true;
    request();
  };

  const at = (event: PointerEvent): [number, number] => {
    const box = canvas.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  };
  const move = (event: PointerEvent) => {
    const [x, y] = at(event);
    mouse.x = (x / W) * 2 - 1;
    mouse.y = (y / H) * 2 - 1;
    if (intro < 1) return;
    const hit = pickPlace(cam, scene, W, H, x, y, Math.max(7, (dotSize / pr) * 1.6));
    const next = hit >= 0 ? hit : -1;
    if (next !== hover) {
      hover = next;
      dirty = true;
      request();
    }
    if (hit === -1) o.onLeave();
    else o.onHover(hit, x, y);
  };
  const leave = () => {
    mouse.x = 0;
    mouse.y = 0;
    if (hover !== -1) {
      hover = -1;
      dirty = true;
      request();
    }
    o.onLeave();
  };
  const onVisibility = () => (document.hidden ? stop() : request());
  const lost = () => {
    alive = false;
    stop();
    o.onLost();
  };
  const unbind = bindChartPointer(canvas, move, leave);
  canvas.addEventListener("webglcontextlost", lost);
  document.addEventListener("visibilitychange", onVisibility);

  let resizeObserver: ResizeObserver | null = null;
  let viewObserver: IntersectionObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(stage);
  }
  if (typeof IntersectionObserver !== "undefined") {
    viewObserver = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible && !started) {
          started = true;
          introStart = performance.now();
        }
        if (visible) request();
        else stop();
      },
      { rootMargin: "100px", threshold: 0.05 },
    );
    viewObserver.observe(stage);
  } else {
    visible = true;
    started = true;
    intro = 1;
  }
  layout();

  return {
    destroy() {
      alive = false;
      stop();
      resizeObserver?.disconnect();
      viewObserver?.disconnect();
      unbind();
      canvas.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.free();
    },
  };
}

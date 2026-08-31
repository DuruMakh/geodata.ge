"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GEORGIA_GEO } from "../../lib/landing/georgiaGeo";

// Living relief of Georgia (landing hero, GeoData Site v2 design): the exact
// country outline as a dotted elevation field, city squares scaled by population
// emitting ripple waves, peak labels, a hoverable city readout, and a national
// pulse sweeping from Tbilisi. Ported 1:1 from the design's Three.js scene;
// all magic numbers are the design's — treat them as tuned constants, not
// derivable values, and keep the design's terse identifiers as they are.
//
// ================= scene structure =================
//
// Module scope (computed once per page load, cached and reused across scene
// rebuilds — none of it depends on viewport or preset):
//   geoProj()      projection between lon/lat and a fixed 1240×640 px "design
//                  plane", the canvas the design was tuned on.
//   geoField()     the terrain: an 8.6px grid over that plane, each cell
//                  jittered into a dot and classified — inside the outline?
//                  edge dot? which region? — with precomputed elevation
//                  (elevGe: analytic Caucasus ridges/lowlands + hash noise),
//                  distances to Tbilisi and the region capital, hill shading,
//                  and two per-dot random seeds.
//   makeDotCloud() a THREE.Points cloud with per-dot position/col/psize
//                  attributes driven by a two-line point shader.
//
// World space: world X/Z = design-plane px minus the plane center (620, 320);
// world Y = elevation × opts.hrel. North is −Z (plane y grows downward).
//
// <HeroRelief /> builds everything inside one effect, keyed on sceneEpoch:
//   1. WebGLRenderer appended to heroRef's div. Any setup failure lands in the
//      catch at the bottom of the try, which disposes what was built and swaps
//      in the static "ვიზუალი ვერ ჩაიტვირთა" note — that IS the no-WebGL path.
//   2. Camera: the preset supplies only a viewing direction and margins (see
//      HeroOpts); fitCameraDistance() binary-searches the camera distance so
//      every sampled dot projects inside the margins, then refit() measures
//      the map's projected vertical band, CROPS the canvas to it with
//      cam.setViewOffset, inside a compact CSS-reserved <figure> so the stats
//      section stays right under the last dots without moving on scene load.
//   3. Geometry: one dot cloud for terrain (N grid dots), one for city squares
//      (NC cities, index 0 = Tbilisi), four reusable LineLoop rings for ripple
//      fronts, and HTML <span>s (labelsRef) for peak labels + hover readout.
//   4. Wiring: mousemove/mouseleave feed parallax + hover; click re-emits a
//      ripple from the hovered city; IntersectionObserver pauses rendering
//      offscreen; ResizeObserver refits on container resize; a window resize
//      listener refits — or bumps sceneEpoch to rebuild the scene when the
//      width crosses a 768/1100px bucket boundary, because the preset is
//      baked into buffers and cannot be patched in place.
//   5. updater(t), once per rAF frame (skipped while the tab is hidden; one
//      seeded frame renders if mounted hidden, for exports/previews):
//      spawn/advance ripples and the national pulse → ease the camera
//      (parallax + drift + shake) → rewrite ring vertices → recompute every
//      dot's height/color/size (entry animation, ripple boost, hover lift,
//      elevation color ramp) → tint city squares → hover hit-test + readout
//      label → project peak labels → render.
//
// Timing: dots "geologically" enter over the first ~2s, staggered by elevation
// and west→east position; a ripple batch spawns every WAVE_EVERY seconds and
// lives ~3.8s (2.6s × 1.45 envelope); the national pulse first fires at t=20s,
// then every 45s, sweeping from Tbilisi for 3.4s with camera shake.
// prefers-reduced-motion skips entry/ripples/pulse/drift/shake and shows the
// static relief with one frozen Tbilisi ring; hover and parallax stay live.
//
// Micro-identifier glossary (the design's names, kept 1:1):
//   h2 / rand01   deterministic sin-hash noise in [-1,1] / [0,1] (stateless)
//   eo            cubic ease-out            cl   clamp to [0,1]
//   vv            scratch Vector3 reused for every projection — never store it
//   dd            a 2D distance, squared or plain depending on call site
//   wd            a band width passed to band()
//   band(dd,R,wd) ripple ring profile: 1 at radius R, fading over wd×0.55
//                 ahead of the front and wd×2.3 behind it (long inner wake)
//   ndcToGround() mouse ray → y=0 plane hit, in design-plane px, into `ground`
//   mk / NC       city-square dot cloud / city count (index 0 is Tbilisi)
//   act           ripples alive this frame; np/npR/npEnv = national pulse
//                 active flag / current radius / sine envelope
//   paper/ink/crimson/tan  RGB triples mirroring the CSS palette; a dot's
//                 color is paper→(tan→ink by elevation) blended by its alpha

// Per-breakpoint scene preset. Every field is a tuned design constant; what
// each one changes on screen:
type HeroOpts = {
  fov: number; // camera vertical field of view, degrees; lower = flatter, tele-lens look
  // camX/camY/camZ define the VIEWING DIRECTION only, never a position — the
  // camera sits along (cam − look), at a distance fitted at runtime; raising
  // camY relative to camZ tilts the view more top-down.
  camX: number;
  camY: number;
  camZ: number;
  // Aim point of that direction. lookX is recentered onto the country (and
  // shifted for the headline gutter) at runtime; negative lookY (below sea
  // level) and negative lookZ (north of the plane center) nudge where the
  // country sits vertically in the frame.
  lookX: number;
  lookY: number;
  lookZ: number;
  hrel: number; // relief height: world-Y of elevation 1.0 — bigger = taller mountains
  parX: number; // mouse-parallax amplitude, world units, horizontal
  parY: number; // mouse-parallax amplitude, vertical (inverted: cursor up = camera down)
  drift: number; // amplitude of the slow autonomous camera sway, X only (off when reduced motion)
  peaks: boolean; // show the two 5000m peak labels and include them in the camera fit
  mkMul: number; // city-square point-size multiplier
  sizeMul: number; // terrain-dot point-size multiplier
  hitScr: number; // city hover hit-test radius, screen px
  npShake: number; // camera-shake amplitude while the national pulse sweeps
  wvShake: number; // max camera shake from ripples of cities with amp > 1.2 (only Tbilisi qualifies)
  maxCities: number; // cap on city markers/ripple emitters: 10 on mobile, 99 = all
  // NDC margins (fractions of the half-frame) the country must stay inside.
  // marginR reserves the gutter under the right-aligned headline overlay.
  marginL: number;
  marginR: number;
  marginY: number;
};

const WAVE_EVERY = 2;

// The camX/camY/camZ preset defines the VIEWING ANGLE only (the design's tilt);
// the actual camera distance is fitted at runtime so the country fills the
// frame as fully as possible at any canvas aspect — the map is the hero's
// main subject.
// Preset bucket boundaries — must match the CSS breakpoints that switch the
// hero copy between stacked (mobile) and right-overlay (desktop) layouts.
function heroBucket(w: number): number {
  return w < 768 ? 0 : w < 1100 ? 1 : 2;
}

function heroOpts(w: number): HeroOpts {
  if (w < 768) {
    // Text sits above the map — fit symmetrically.
    return {
      fov: 30, camX: 110, camY: 1080, camZ: 1260, lookX: 110, lookY: -60, lookZ: -30,
      hrel: 165, parX: 26, parY: 20, drift: 10, peaks: false, mkMul: 0.72, sizeMul: 0.6,
      hitScr: 30, npShake: 8, wvShake: 16, maxCities: 10,
      marginL: 0.06, marginR: 0.06, marginY: 0.08,
    };
  }
  if (w < 1100) {
    return {
      fov: 30, camX: 111, camY: 887, camZ: 1251, lookX: 118, lookY: -40, lookZ: -30,
      hrel: 135, parX: 56, parY: 40, drift: 18, peaks: true, mkMul: 1, sizeMul: 1,
      hitScr: 28, npShake: 15, wvShake: 32, maxCities: 99,
      marginL: 0.05, marginR: 0.3, marginY: 0.07,
    };
  }
  return {
    fov: 30, camX: 111, camY: 613, camZ: 877, lookX: 118, lookY: -38, lookZ: -30,
    hrel: 135, parX: 40, parY: 32, drift: 14, peaks: true, mkMul: 1.05, sizeMul: 1.1,
    hitScr: 28, npShake: 16, wvShake: 34, maxCities: 99,
    marginL: 0.05, marginR: 0.38, marginY: 0.06,
  };
}

// Distance along `dir` from `look` at which every sample point projects inside
// NDC with the given margins. Binary search; smaller distance = bigger map.
function fitCameraDistance(
  cam: THREE.PerspectiveCamera,
  look: THREE.Vector3,
  dir: THREE.Vector3,
  samples: THREE.Vector3[],
  marginX: number,
  marginY: number,
): number {
  const v = new THREE.Vector3();
  const fits = (t: number) => {
    cam.position.copy(look).addScaledVector(dir, t);
    cam.lookAt(look);
    cam.updateMatrixWorld();
    for (const p of samples) {
      v.copy(p).project(cam);
      if (Math.abs(v.x) > 1 - marginX || Math.abs(v.y) > 1 - marginY) return false;
    }
    return true;
  };
  let lo = 150, hi = 4000;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

// ================= shared helpers =================

function h2(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function rand01(a: number, b: number): number {
  return (h2(a, b) + 1) / 2;
}

function pointInPoly(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]![0], yi = poly[i]![1], xj = poly[j]![0], yj = poly[j]![1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Analytic elevation of Georgia: Greater Caucasus crest, Likhi and Lesser
// Caucasus ridges, Kolkheti and Alazani lowlands, plus deterministic noise.
function elevGe(lon: number, lat: number): number {
  const gs = (v: number, s: number) => Math.exp(-(v * v) / (2 * s * s));
  const crest = 43.32 - 0.15 * (lon - 40.5);
  const gate = Math.min(1, Math.max(0.45, (lon - 40.9) / 1.4));
  const e1 = 1.04 * gs(lat - crest, 0.21) * gate;
  const e2 = 0.55 * gs(lat - 41.5, 0.24) * gs(lon - 43.5, 1.15);
  const e3 = 0.36 * gs(lat - 41.8, 0.17) * gs(lon - 42.35, 0.55);
  const e4 = 0.32 * gs(lon - 43.35, 0.12) * gs(lat - 42.15, 0.32);
  const m1 = 1 - 0.88 * gs(lat - 42.25, 0.23) * gs(lon - 41.9, 0.52);
  const m2 = 1 - 0.6 * gs(lat - 41.83, 0.18) * gs(lon - 44.45, 0.6);
  const m3 = 1 - 0.5 * gs(lat - (41.62 + 0.25 * (46.3 - lon)), 0.13) * gs(lon - 45.8, 0.7);
  const noise = 0.055 * h2(lon * 6.1, lat * 6.7) + 0.035 * h2(lon * 13.3, lat * 11.1);
  const e = (0.1 + e1 + e2 + e3 + e4) * m1 * m2 * m3 + noise * m1;
  return Math.min(1, Math.max(0.02, e / 1.25));
}

type Projection = {
  toPx: (lon: number, lat: number) => [number, number];
  toGeo: (x: number, y: number) => [number, number];
};

let projCache: Projection | null = null;

function geoProj(): Projection {
  if (projCache) return projCache;
  const B = GEORGIA_GEO.bbox;
  const W = 1240, H = 640, mw = 1100;
  const cos = Math.cos(((B.latMin + B.latMax) / 2) * Math.PI / 180);
  const mh = mw * ((B.latMax - B.latMin) / ((B.lonMax - B.lonMin) * cos));
  const x0 = (W - mw) / 2, y0 = (H - mh) / 2;
  const sx = mw / (B.lonMax - B.lonMin), sy = mh / (B.latMax - B.latMin);
  projCache = {
    toPx: (lon, lat) => [x0 + (lon - B.lonMin) * sx, y0 + (B.latMax - lat) * sy],
    toGeo: (x, y) => [B.lonMin + (x - x0) / sx, B.latMax - (y - y0) / sy],
  };
  return projCache;
}

type GeoField = {
  n: number;
  cols: number;
  rows: number;
  step: number;
  caps: Array<[number, number]>;
  tb: [number, number];
  px: Float32Array;
  py: Float32Array;
  inside: Uint8Array;
  edge: Uint8Array;
  region: Int8Array;
  dTb: Float32Array;
  dCap: Float32Array;
  elev: Float32Array;
  r1: Float32Array;
  r2: Float32Array;
  shade: Float32Array;
};

let fieldCache: GeoField | null = null;

function geoField(): GeoField {
  if (fieldCache) return fieldCache;
  const G = GEORGIA_GEO;
  const P = geoProj();
  const B = G.bbox;
  const STEP = 8.6, W = 1240, H = 640;
  const cols = Math.floor(W / STEP), rows = Math.floor(H / STEP);
  const caps = G.regions.map((r) => P.toPx(r.cap[0], r.cap[1]));
  const tb = caps[11]!;
  const ringBB = G.regions.map((r) => {
    const a: [number, number] = [99, 99];
    const b: [number, number] = [-99, -99];
    r.ring.forEach(([x, y]) => {
      a[0] = Math.min(a[0], x); a[1] = Math.min(a[1], y);
      b[0] = Math.max(b[0], x); b[1] = Math.max(b[1], y);
    });
    return [a, b] as const;
  });
  const insideGrid = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const [lon, lat] = P.toGeo((c + 0.5) * STEP, (r + 0.5) * STEP);
    if (lon < B.lonMin || lon > B.lonMax || lat < B.latMin || lat > B.latMax) continue;
    insideGrid[r * cols + c] = pointInPoly(lon, lat, G.outline) ? 1 : 0;
  }
  const n = cols * rows;
  const F: GeoField = {
    n, cols, rows, step: STEP, caps, tb,
    px: new Float32Array(n), py: new Float32Array(n),
    inside: new Uint8Array(n), edge: new Uint8Array(n), region: new Int8Array(n),
    dTb: new Float32Array(n), dCap: new Float32Array(n), elev: new Float32Array(n),
    r1: new Float32Array(n), r2: new Float32Array(n), shade: new Float32Array(n),
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    const ins = insideGrid[i]!;
    const x = (c + 0.5) * STEP + 1.7 * h2(c * 3.1, r * 5.7);
    const y = (r + 0.5) * STEP + 1.7 * h2(r * 7.3, c * 2.9);
    const [lon, lat] = P.toGeo(x, y);
    let edge = 0, reg = -1, ev = 0, dc = 9999, sh = 0;
    if (ins) {
      const nb = (rr: number, cc: number) => (rr < 0 || cc < 0 || rr >= rows || cc >= cols ? 0 : insideGrid[rr * cols + cc]!);
      edge = nb(r - 1, c) && nb(r + 1, c) && nb(r, c - 1) && nb(r, c + 1) ? 0 : 1;
      for (let k = 0; k < 12; k++) {
        const bb = ringBB[k]!;
        if (lon < bb[0][0] || lon > bb[1][0] || lat < bb[0][1] || lat > bb[1][1]) continue;
        if (pointInPoly(lon, lat, G.regions[k]!.ring)) { reg = k; break; }
      }
      if (reg < 0) {
        let bd = 1e18;
        for (let k = 0; k < 12; k++) {
          const dd = (x - caps[k]![0]) ** 2 + (y - caps[k]![1]) ** 2;
          if (dd < bd) { bd = dd; reg = k; }
        }
      }
      ev = elevGe(lon, lat);
      dc = Math.hypot(x - caps[reg]![0], y - caps[reg]![1]);
      sh = Math.max(-0.3, Math.min(0.3, (elevGe(lon - 0.055, lat + 0.042) - ev) * 3.2));
    }
    F.px[i] = x; F.py[i] = y; F.inside[i] = ins; F.edge[i] = edge; F.region[i] = reg;
    F.dTb[i] = Math.hypot(x - tb[0], y - tb[1]); F.dCap[i] = dc; F.elev[i] = ev; F.shade[i] = sh;
    F.r1[i] = rand01(c * 13.7, r * 7.1); F.r2[i] = rand01(r * 3.3, c * 11.9);
  }
  fieldCache = F;
  return F;
}

type DotCloud = {
  geo: THREE.BufferGeometry;
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  points: THREE.Points;
};

function makeDotCloud(n: number): DotCloud {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("col", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("psize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader:
      "attribute float psize; attribute vec3 col; varying vec3 vc; void main(){ vc = col; gl_PointSize = psize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec3 vc; void main(){ gl_FragColor = vec4(vc, 1.0); }",
  });
  return { geo, pos, col, size, points: new THREE.Points(geo, mat) };
}

export function HeroRelief() {
  const heroRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // Bumped when the viewport crosses a preset breakpoint: the preset (camera
  // angle, relief height, peaks, city cap) is baked into the scene at build
  // time, so matching the CSS layout switch requires a full scene rebuild.
  const [sceneEpoch, setSceneEpoch] = useState(0);

  useEffect(() => {
    const el = heroRef.current;
    const labelsEl = labelsRef.current;
    if (!el || !labelsEl) return;

    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bucket = heroBucket(window.innerWidth);
    const O = heroOpts(window.innerWidth);
    const disposers: Array<() => void> = [];
    let raf = 0;

    let renderer: THREE.WebGLRenderer;
    let updater: (t: number, dt: number) => void;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.setClearColor(0x000000, 0);
      el.appendChild(renderer.domElement);
      disposers.push(() => {
        renderer.dispose();
        renderer.domElement.parentNode?.removeChild(renderer.domElement);
      });

      const pr = renderer.getPixelRatio();
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(O.fov, el.clientWidth / Math.max(1, el.clientHeight), 1, 6000);
      const F = geoField();
      const N = F.n;
      const G = GEORGIA_GEO;
      const HREL = O.hrel;

      // Fit the camera along the preset's viewing direction so the country
      // (its real dot bounds plus relief height) fills the canvas.
      const lookVec = new THREE.Vector3(O.lookX, O.lookY, O.lookZ);
      const camDir = new THREE.Vector3(O.camX, O.camY, O.camZ).sub(lookVec).normalize();
      const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, maxY: 0 };
      for (let i = 0; i < N; i++) {
        if (!F.inside[i]) continue;
        const x = F.px[i]! - 620, z = F.py[i]! - 320;
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxZ = Math.max(bounds.maxZ, z);
        bounds.maxY = Math.max(bounds.maxY, F.elev[i]! * HREL);
      }
      // Aim at the country's own center so the fit can zoom symmetrically.
      lookVec.x = (bounds.minX + bounds.maxX) / 2;
      // Fit against the real dots (every edge dot + a third of the interior at
      // its relief height) — bounding-box corners are phantom points that
      // would leave the frame under-filled.
      const fitSamples: THREE.Vector3[] = [];
      for (let i = 0; i < N; i++) {
        if (!F.inside[i]) continue;
        if (F.edge[i] || i % 3 === 0) {
          fitSamples.push(new THREE.Vector3(F.px[i]! - 620, F.elev[i]! * HREL + 6, F.py[i]! - 320));
        }
      }
      if (O.peaks) {
        // The peak labels float above the summits; keep them in frame too.
        for (const [lon, lat] of [[43.11, 43.005], [44.521, 42.699]] as const) {
          const [x, y] = geoProj().toPx(lon, lat);
          fitSamples.push(new THREE.Vector3(x - 620, elevGe(lon, lat) * HREL + 42, y - 320));
        }
      }
      const countryMidX = lookVec.x;
      const camBase = new THREE.Vector3();
      const halfFov = Math.tan(((O.fov / 2) * Math.PI) / 180);
      const mSym = (O.marginL + O.marginR) / 2;
      const copyEl = el.closest("section")?.querySelector<HTMLElement>("[data-hero-copy]") ?? null;
      const virtualHeightFor = () =>
        window.innerWidth < 768 ? 340 : window.innerWidth < 1100 ? 500 : Math.min(820, Math.max(560, Math.round(window.innerHeight * 0.78)));
      const vtmp = new THREE.Vector3();
      // Fit the camera in a fixed virtual frame (the framing the design was
      // tuned on), then CROP the canvas to the map's projected vertical band
      // via a camera view offset — the stats section starts right under the
      // last dots without rescaling the map. The headline overlay's height is
      // a hard floor so the copy never overflows into the stats.
      const refit = () => {
        const w = Math.max(1, el.clientWidth);
        const virtualH = virtualHeightFor();
        cam.clearViewOffset();
        cam.aspect = w / virtualH;
        cam.updateProjectionMatrix();
        lookVec.set(countryMidX, O.lookY, O.lookZ);
        const distance = fitCameraDistance(cam, lookVec, camDir, fitSamples, mSym, O.marginY);
        // Shift the aim so the country centers inside the [marginL, 1 - marginR]
        // band — the right gutter stays free for the headline overlay.
        lookVec.x = countryMidX + ((O.marginR - O.marginL) / 2) * halfFov * distance * cam.aspect;
        camBase.copy(lookVec).addScaledVector(camDir, distance);
        // Measure the map's pixel band inside the virtual frame.
        cam.position.copy(camBase);
        cam.lookAt(lookVec);
        cam.updateMatrixWorld();
        let ndcYMin = Infinity, ndcYMax = -Infinity;
        for (const p of fitSamples) {
          vtmp.copy(p).project(cam);
          ndcYMin = Math.min(ndcYMin, vtmp.y);
          ndcYMax = Math.max(ndcYMax, vtmp.y);
        }
        let top = Math.max(0, Math.floor((-ndcYMax * 0.5 + 0.5) * virtualH) - 16);
        let bottom = Math.min(virtualH, Math.ceil((-ndcYMin * 0.5 + 0.5) * virtualH) + 16);
        if (copyEl && window.innerWidth >= 768) {
          const copyNeed = copyEl.offsetTop + copyEl.offsetHeight + 24;
          if (bottom - top < copyNeed) {
            bottom = Math.min(virtualH, top + copyNeed);
            if (bottom - top < copyNeed) top = Math.max(0, bottom - copyNeed);
          }
        }
        const bandH = Math.max(1, bottom - top);
        cam.setViewOffset(w, virtualH, 0, top, w, bandH);
        renderer.setSize(w, bandH);
        el.style.height = `${bandH}px`;
        labelsEl.style.height = `${bandH}px`;
      };
      refit();
      cam.position.copy(camBase);
      disposers.push(() => {
        el.style.height = "";
        labelsEl.style.height = "";
      });
      const cloud = makeDotCloud(N);
      scene.add(cloud.points);
      disposers.push(() => {
        cloud.geo.dispose();
        (cloud.points.material as THREE.Material).dispose();
      });
      for (let i = 0; i < N; i++) {
        cloud.pos[i * 3] = F.px[i]! - 620;
        cloud.pos[i * 3 + 1] = 0;
        cloud.pos[i * 3 + 2] = F.py[i]! - 320;
      }
      cloud.geo.attributes.position!.needsUpdate = true;

      const cities = G.cityMarkers.slice(0, O.maxCities || G.cityMarkers.length).map((c) => {
        const p = geoProj().toPx(c.lon, c.lat);
        return { x: p[0], y: p[1], pop: c.pop, ka: c.ka, ev: elevGe(c.lon, c.lat) };
      });
      const NC = cities.length; // Tbilisi is index 0
      const cityAmp = (pop: number) => 0.42 + 0.98 * Math.sqrt(pop / 1258);
      const mk = makeDotCloud(NC);
      cities.forEach((c, i) => {
        mk.pos[i * 3] = c.x - 620;
        mk.pos[i * 3 + 1] = c.ev * HREL + 4;
        mk.pos[i * 3 + 2] = c.y - 320;
        mk.size[i] = (2.6 + Math.sqrt(c.pop) * 0.3) * O.mkMul * pr;
      });
      mk.geo.attributes.position!.needsUpdate = true;
      scene.add(mk.points);
      disposers.push(() => {
        mk.geo.dispose();
        (mk.points.material as THREE.Material).dispose();
      });

      const RSEG = 72;
      const rings = [0, 1, 2, 3].map(() => {
        const p = new Float32Array(RSEG * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(p, 3));
        const m = new THREE.LineBasicMaterial({ color: 0x1e1b16, transparent: true, opacity: 0 });
        const line = new THREE.LineLoop(g, m);
        scene.add(line);
        disposers.push(() => {
          g.dispose();
          m.dispose();
        });
        return { p, g, m };
      });
      const bigW = cities.slice(0, 5).map((c) => Math.sqrt(c.pop));
      const bigSum = bigW.reduce((a, b) => a + b, 0);
      const pickBig = (rv: number) => {
        let acc = 0;
        for (let k = 0; k < bigW.length; k++) {
          acc += bigW[k]! / bigSum;
          if (rv <= acc) return k;
        }
        return 0;
      };

      const P = geoProj();
      const mkWorld = (lon: number, lat: number, lift: number) => {
        const [x, y] = P.toPx(lon, lat);
        return new THREE.Vector3(x - 620, elevGe(lon, lat) * HREL + lift, y - 320);
      };
      const labelDefs: Record<string, THREE.Vector3> = O.peaks
        ? {
            shkh: mkWorld(43.11, 43.005, 14),
            mkin: mkWorld(44.521, 42.699, 14),
          }
        : {};
      const labelEls: Record<string, HTMLElement> = {};
      labelsEl.querySelectorAll<HTMLElement>("[data-gid]").forEach((s) => {
        labelEls[s.getAttribute("data-gid")!] = s;
      });
      const capLbl = labelEls.cap;

      const mouse = { x: 0, y: 0, on: false };
      const ground = { x: -9999, y: -9999 };
      const manual: Array<{ ci: number; t0: number }> = [];
      const cityScr = new Float32Array(NC * 2);
      let lastT = 0;
      let lastHover = -1;
      const onMouseMove = (e: MouseEvent) => {
        const r = el.getBoundingClientRect();
        mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
        mouse.on = true;
      };
      const onMouseLeave = () => {
        mouse.x = 0;
        mouse.y = 0;
        mouse.on = false;
        ground.x = -9999;
        ground.y = -9999;
      };
      const onClick = () => {
        if (lastHover >= 0) {
          manual.push({ ci: lastHover, t0: lastT });
          if (manual.length > 4) manual.shift();
        }
      };
      el.addEventListener("mousemove", onMouseMove);
      el.addEventListener("mouseleave", onMouseLeave);
      el.addEventListener("click", onClick);
      disposers.push(() => {
        el.removeEventListener("mousemove", onMouseMove);
        el.removeEventListener("mouseleave", onMouseLeave);
        el.removeEventListener("click", onClick);
      });

      const sc = { visible: true };
      if (typeof IntersectionObserver !== "undefined") {
        const io = new IntersectionObserver(
          (es) => {
            sc.visible = !!(es[0] && es[0].isIntersecting);
          },
          { rootMargin: "150px" },
        );
        io.observe(el);
        disposers.push(() => io.disconnect());
      }
      const ro = new ResizeObserver(() => {
        refit(); // recomputes fit, crop, renderer size, and inner scene height
      });
      // Text-only zoom can resize the CSS-owned frame without a window resize.
      ro.observe(el.parentElement!);
      disposers.push(() => ro.disconnect());
      // A viewport-height change can alter the virtual camera frame even when
      // the CSS band is capped; crossing a width breakpoint needs a new preset.
      const onWindowResize = () => {
        if (heroBucket(window.innerWidth) !== bucket) setSceneEpoch((n) => n + 1);
        else refit();
      };
      window.addEventListener("resize", onWindowResize);
      disposers.push(() => window.removeEventListener("resize", onWindowResize));

      const paper = [0.968, 0.949, 0.914] as const;
      const ink = [0.118, 0.106, 0.086] as const;
      const crimson = [0.702, 0.251, 0.165] as const;
      const tan = [0.541, 0.482, 0.396] as const;
      const eo = (x: number) => 1 - Math.pow(1 - x, 3);
      const cl = (x: number) => Math.min(1, Math.max(0, x));
      const vv = new THREE.Vector3();
      const fmtPop = (p: number) => (p >= 1000 ? (p / 1000).toFixed(2).replace(/0$/, "") + " მლნ" : p + " ათ.");
      const band = (dd: number, R: number, wd: number) =>
        dd > R ? Math.max(0, 1 - (dd - R) / (wd * 0.55)) : Math.max(0, 1 - (R - dd) / (wd * 2.3));
      const ndcToGround = () => {
        vv.set(mouse.x, -mouse.y, 0.5).unproject(cam);
        const dx = vv.x - cam.position.x, dy = vv.y - cam.position.y, dz = vv.z - cam.position.z;
        if (dy >= -1e-4) {
          ground.x = -9999;
          return;
        }
        const tt = -cam.position.y / dy;
        ground.x = cam.position.x + dx * tt + 620;
        ground.y = cam.position.z + dz * tt + 320;
      };

      updater = (t) => {
        if (!sc.visible) return;
        lastT = t;
        const W = el.clientWidth, H = Math.max(1, el.clientHeight);
        const still = reduced;
        const WV = Math.max(1.2, WAVE_EVERY);

        // ---- active ripples (population-scaled) ----
        const act: Array<{ cx: number; cy: number; R: number; w: number; amp: number }> = [];
        if (!still) {
          for (let m = 0; m < manual.length; m++) {
            const f = (t - manual[m]!.t0) / 2.6;
            if (f < 0 || f > 1.45) continue;
            const c = cities[manual[m]!.ci]!;
            const amp = cityAmp(c.pop);
            act.push({ cx: c.x, cy: c.y, R: f * 265 * amp, w: Math.max(0, 1 - f / 1.45), amp });
          }
          const rk = Math.floor(t / WV);
          for (let m = 0; m < 2; m++) {
            const k = rk - m;
            if (k < 1) continue; // let the geological entry finish before the first wave
            const f = (t - k * WV) / 2.6;
            if (f < 0 || f > 1.45) continue;
            const w = Math.max(0, 1 - f / 1.45);
            if (NC <= 5 || rand01(k * 7.13, 42.7) < 0.55) {
              const c = cities[pickBig(rand01(k * 3.71, 11.3))]!;
              const amp = cityAmp(c.pop);
              act.push({ cx: c.x, cy: c.y, R: f * 265 * amp, w, amp });
            } else {
              const span = NC - 5;
              const cnt = Math.min(span, 3 + (rand01(k * 5.19, 7.7) > 0.5 ? 1 : 0));
              const used: Record<number, number> = {};
              for (let j = 0; j < cnt; j++) {
                let idx = 5 + Math.floor(rand01(k * 9.13 + j * 17.31, 23.1) * span);
                let guard = 0;
                while (used[idx] && guard++ < span) idx = 5 + ((idx - 5 + 1) % span);
                used[idx] = 1;
                const c = cities[idx]!;
                const amp = cityAmp(c.pop);
                act.push({ cx: c.x, cy: c.y, R: f * 265 * amp, w, amp });
              }
            }
          }
        } else {
          act.push({ cx: cities[0]!.x, cy: cities[0]!.y, R: 205, w: 0.62, amp: 1.4 }); // frozen Tbilisi wave
        }
        // national pulse — Tbilisi sweeps the whole country every 45s
        let np = 0, npR = 0, npEnv = 0;
        if (!still && t > 20) {
          const tn = (t - 20) % 45;
          if (tn < 3.4) {
            np = 1;
            const fN = tn / 3.4;
            npR = fN * 1250;
            npEnv = Math.sin(Math.PI * fN);
          }
        }

        // ---- camera ----
        let shake = 0;
        if (!still) {
          shake = npEnv * O.npShake;
          for (let m = 0; m < act.length; m++) {
            if (act[m]!.amp > 1.2) shake = Math.max(shake, Math.sin(Math.PI * Math.min(1, act[m]!.w)) * (act[m]!.amp - 1.2) * O.wvShake);
          }
        }
        const cx = camBase.x + mouse.x * O.parX + (still ? 0 : Math.sin(t * 0.07) * O.drift);
        const cy = camBase.y - mouse.y * O.parY;
        cam.position.x += (cx - cam.position.x) * 0.05;
        cam.position.y += (cy - cam.position.y) * 0.05;
        cam.position.z += (camBase.z - shake - cam.position.z) * 0.06;
        cam.lookAt(lookVec);
        cam.updateMatrixWorld();
        if (mouse.on) ndcToGround();
        for (let k = 0; k < NC; k++) {
          vv.set(cities[k]!.x - 620, cities[k]!.ev * HREL + 4, cities[k]!.y - 320).project(cam);
          cityScr[k * 2] = (vv.x * 0.5 + 0.5) * W;
          cityScr[k * 2 + 1] = (-vv.y * 0.5 + 0.5) * H;
        }

        rings.forEach((rg2, m) => {
          const ac = act[m];
          if (!ac) {
            rg2.m.opacity = 0;
            return;
          }
          for (let s = 0; s < RSEG; s++) {
            const ang = (s / RSEG) * Math.PI * 2;
            rg2.p[s * 3] = ac.cx - 620 + Math.cos(ang) * ac.R;
            rg2.p[s * 3 + 1] = 1.5;
            rg2.p[s * 3 + 2] = ac.cy - 320 + Math.sin(ang) * ac.R;
          }
          rg2.g.attributes.position!.needsUpdate = true;
          rg2.m.opacity = (0.16 + 0.15 * ac.amp) * ac.w;
        });

        // ---- dots ----
        for (let i = 0; i < N; i++) {
          const x = F.px[i]!, y = F.py[i]!;
          const enter = still ? 1 : eo(cl((t - 0.15 - F.elev[i]! * 0.85 - (x / 1240) * 0.25) / 0.8));
          const depth = y / 640;
          let a: number, size: number, hgt = 0, ec = 0;
          if (F.inside[i]) {
            let boost = 0;
            for (let m = 0; m < act.length; m++) {
              const rp = act[m]!;
              const dd = Math.hypot(x - rp.cx, y - rp.cy);
              boost += band(dd, rp.R, 32 + 17 * rp.amp) * rp.w * rp.amp;
            }
            if (np) boost += band(F.dTb[i]!, npR, 95) * (1 - npR / 1500) * 1.5;
            if (boost > 1.6) boost = 1.6;
            let lift = 0;
            if (ground.x > -999) {
              const dg = Math.hypot(x - ground.x, y - ground.y);
              if (dg < 115) {
                lift = 1 - dg / 115;
                lift *= lift;
              }
            }
            hgt = F.elev[i]! * HREL * enter + 11 * boost + 26 * lift;
            a = 0.26 + 0.5 * F.elev[i]! + F.edge[i]! * 0.08 + 0.3 * boost + F.shade[i]! * 0.22 + 0.28 * lift;
            size = 3.0 + 1.5 * F.elev[i]! + 1.6 * boost + 1.3 * lift;
            ec = Math.min(1, F.elev[i]! * 1.3);
          } else {
            a = 0.05;
            size = 2.3;
            ec = 1;
          }
          a = Math.min(0.92, a * (0.86 + 0.2 * depth)) * enter;
          size *= (0.82 + 0.36 * depth) * O.sizeMul;
          const tr = tan[0] + (ink[0] - tan[0]) * ec, tg = tan[1] + (ink[1] - tan[1]) * ec, tb2 = tan[2] + (ink[2] - tan[2]) * ec;
          cloud.pos[i * 3 + 1] = hgt;
          cloud.col[i * 3] = paper[0] + (tr - paper[0]) * a;
          cloud.col[i * 3 + 1] = paper[1] + (tg - paper[1]) * a;
          cloud.col[i * 3 + 2] = paper[2] + (tb2 - paper[2]) * a;
          cloud.size[i] = size * pr * (0.3 + 0.7 * enter);
        }
        cloud.geo.attributes.position!.needsUpdate = true;
        cloud.geo.attributes.col!.needsUpdate = true;
        cloud.geo.attributes.psize!.needsUpdate = true;

        // ---- city squares ----
        for (let i = 0; i < NC; i++) {
          const isTb = i === 0;
          const cc = isTb ? crimson : ink;
          const en = still ? 1 : eo(cl((t - 0.15 - cities[i]!.ev * 0.85 - (cities[i]!.x / 1240) * 0.25) / 0.8));
          const aa = (isTb ? 0.96 : 0.78) * en;
          mk.col[i * 3] = paper[0] + (cc[0] - paper[0]) * aa;
          mk.col[i * 3 + 1] = paper[1] + (cc[1] - paper[1]) * aa;
          mk.col[i * 3 + 2] = paper[2] + (cc[2] - paper[2]) * aa;
        }
        mk.geo.attributes.col!.needsUpdate = true;

        // ---- city hover readout (screen-space hit test) ----
        let hci = -1;
        if (mouse.on) {
          const mxp = ((mouse.x + 1) / 2) * W, myp = ((mouse.y + 1) / 2) * H;
          let bd = O.hitScr * O.hitScr;
          for (let k = 0; k < NC; k++) {
            const dd = (cityScr[k * 2]! - mxp) ** 2 + (cityScr[k * 2 + 1]! - myp) ** 2;
            if (dd < bd) {
              bd = dd;
              hci = k;
            }
          }
        }
        lastHover = hci;
        if (capLbl) {
          if (hci >= 0) {
            const c = cities[hci]!;
            capLbl.textContent = c.ka + " · " + fmtPop(c.pop);
            capLbl.style.transform = "translate3d(" + (cityScr[hci * 2]! + 12).toFixed(1) + "px," + (cityScr[hci * 2 + 1]! - 34).toFixed(1) + "px,0)";
            capLbl.style.opacity = "1";
            el.style.cursor = "pointer";
          } else {
            capLbl.style.opacity = "0";
            el.style.cursor = "crosshair";
          }
        }

        // ---- peak labels ----
        const lop = still ? 1 : cl((t - 1.6) / 0.5);
        Object.keys(labelDefs).forEach((gid) => {
          const s = labelEls[gid];
          if (!s) return;
          vv.copy(labelDefs[gid]!).project(cam);
          const sx = (vv.x * 0.5 + 0.5) * W, sy = (-vv.y * 0.5 + 0.5) * H;
          s.style.transform = "translate3d(" + (sx + 8).toFixed(1) + "px," + (sy - 10).toFixed(1) + "px,0)";
          s.style.opacity = String(0.85 * lop);
        });
        renderer.render(scene, cam);
      };
    } catch (e) {
      console.warn("hero scene init failed", e);
      // Deferred so the state update happens outside the effect body (lint rule).
      const failTimer = setTimeout(() => setFailed(true), 0);
      disposers.forEach((dispose) => dispose());
      return () => clearTimeout(failTimer);
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      const t = (now - t0) / 1000;
      try {
        updater(t, 0.016);
      } catch (e) {
        console.warn("hero frame failed", e);
        cancelAnimationFrame(raf);
      }
    };
    raf = requestAnimationFrame(tick);
    // rAF never fires in hidden tabs (exports, previews) — seed one representative frame
    if (document.visibilityState === "hidden") {
      try {
        updater(8.4, 0.016);
      } catch {
        // the live loop surfaces real frame errors; the seed frame is best-effort
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      disposers.forEach((dispose) => dispose());
    };
  }, [sceneEpoch]);

  return (
    <>
      <div ref={heroRef} className="absolute inset-0 cursor-crosshair" />
      <div
        ref={labelsRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 font-[family-name:var(--font-numeric)] tracking-[0.05em]"
      >
        <span data-gid="shkh" className="absolute left-0 top-0 text-[10px] text-[var(--muted)] opacity-0 will-change-transform">
          შხარა · 5193 მ
          <span className="absolute -left-2 top-[3px] h-2 w-px bg-[var(--muted)] opacity-70" />
        </span>
        <span data-gid="mkin" className="absolute left-0 top-0 text-[10px] text-[var(--muted)] opacity-0 will-change-transform">
          მყინვარწვერი · 5054 მ
          <span className="absolute -left-2 top-[3px] h-2 w-px bg-[var(--muted)] opacity-70" />
        </span>
        <span
          data-gid="cap"
          className="absolute left-0 top-0 whitespace-nowrap rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-[9px] py-[5px] text-[11px] font-medium text-[var(--ink)] opacity-0 shadow-[0_4px_16px_rgba(30,27,22,0.10)] transition-opacity duration-150 will-change-transform"
        />
      </div>
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
            ვიზუალი ვერ ჩაიტვირთა — მონაცემები ხელმისაწვდომია ექსპლორერში
          </span>
        </div>
      ) : null}
    </>
  );
}

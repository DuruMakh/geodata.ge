"use client";

import dynamic from "next/dynamic";

// Client-side loader for the three.js hero. Importing hero-relief statically
// (landing-page → hero-relief → three) put the whole 3D engine in the landing
// route's first-load JS; next/dynamic splits it into its own chunk fetched
// after hydration. ssr:false skips server markup the scene rebuilds on mount
// anyway — and it must live in a client component (Next forbids it in server
// components), which is this file's whole job. While the chunk loads, the
// placeholder paints the hero figure paper-colored; the <figure> in
// landing-page.tsx owns the height at every breakpoint, so nothing shifts.
// The no-WebGL fallback message and the breakpoint-crossing scene rebuild
// both live inside HeroRelief itself and are unaffected by the deferral.
export const HeroReliefLazy = dynamic(() => import("./hero-relief").then((m) => m.HeroRelief), {
  ssr: false,
  loading: () => <div aria-hidden className="absolute inset-0 bg-[var(--paper)]" />,
});

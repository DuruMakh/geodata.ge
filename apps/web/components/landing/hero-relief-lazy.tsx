"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

function HeroPlaceholder() {
  return <div aria-hidden className="absolute inset-0 bg-[var(--paper)]" />;
}

// Client-side loader for the three.js hero. Importing hero-relief statically
// (landing-page → hero-relief → three) put the whole 3D engine in the landing
// route's first-load JS; next/dynamic splits it into its own chunk, and this
// wrapper renders that dynamic boundary only after `load` reaches browser idle
// time. ssr:false skips server markup the scene rebuilds on mount anyway — and
// it must live in a client component (Next forbids it in server components),
// which is this file's whole job. While the chunk waits or loads, the placeholder
// paints the hero figure paper-colored; the <figure> in
// landing-page.tsx reserves the compact map band in CSS before the scene loads.
// The no-WebGL fallback message and the breakpoint-crossing scene rebuild
// both live inside HeroRelief itself and are unaffected by the deferral.
const DeferredHeroRelief = dynamic(() => import("./hero-relief").then((m) => m.HeroRelief), {
  ssr: false,
  loading: HeroPlaceholder,
});

export function HeroReliefLazy() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let idleId: number | undefined;
    let timerId: number | undefined;
    const activate = () => setActive(true);
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(activate, { timeout: 1500 });
      } else {
        timerId = window.setTimeout(activate, 0);
      }
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      window.removeEventListener("load", schedule);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, []);

  return active ? <DeferredHeroRelief /> : <HeroPlaceholder />;
}

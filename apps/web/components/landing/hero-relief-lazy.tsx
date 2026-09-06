"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { HeroReliefProps } from "./hero-relief";

function HeroPlaceholder() {
  return <div aria-hidden className="absolute inset-0 bg-[var(--paper)]" />;
}

function DesktopHeroPlaceholder() {
  return <div aria-hidden className="absolute inset-0 hidden bg-[var(--paper)] min-[768px]:block" />;
}

const EMPTY_MOBILE_HERO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 780 324'%3E%3C/svg%3E";

function MobileHeroStatic() {
  return (
    <picture
      data-testid="mobile-hero-static"
      className="pointer-events-none absolute inset-0 block min-[768px]:hidden"
    >
      <source media="(max-width: 479px)" srcSet="/landing/hero-relief-mobile-390.webp" type="image/webp" />
      <source media="(max-width: 639px)" srcSet="/landing/hero-relief-mobile-600.webp" type="image/webp" />
      <source media="(max-width: 767px)" srcSet="/landing/hero-relief-mobile-767.webp" type="image/webp" />
      <img
        src={EMPTY_MOBILE_HERO}
        width="780"
        height="324"
        alt=""
        loading="eager"
        fetchPriority="high"
        className="block h-full w-full object-cover"
      />
    </picture>
  );
}

// Client-side loader for the three.js hero. Importing hero-relief statically
// (landing-page → hero-relief → three) put the whole 3D engine in the landing
// route's first-load JS. Below 768px the responsive still is the complete hero
// and this component never mounts the dynamic boundary, so mobile never requests
// Three.js. From 768px, next/dynamic splits the scene into its own chunk and this
// wrapper renders it only after `load` reaches browser idle time. ssr:false skips
// server markup the scene rebuilds on mount anyway — and it must live in a client
// component (Next forbids it in server components), which is this file's whole
// job. While the desktop chunk waits or loads, the placeholder paints the hero
// figure paper-colored; landing-page.tsx reserves the map band in CSS. The
// no-WebGL fallback message and desktop scene rebuild remain inside HeroRelief.
const DeferredHeroRelief = dynamic(() => import("./hero-relief").then((m) => m.HeroRelief), {
  ssr: false,
  loading: HeroPlaceholder,
});

export function HeroReliefLazy(props: HeroReliefProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let idleId: number | undefined;
    let timerId: number | undefined;
    let activated = false;
    const desktop = window.matchMedia("(min-width: 768px)");
    const activate = () => {
      if (!desktop.matches) return;
      activated = true;
      setActive(true);
    };
    const cancelScheduled = () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
      idleId = undefined;
      timerId = undefined;
    };
    const schedule = () => {
      cancelScheduled();
      if (!desktop.matches || activated) return;
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(activate, { timeout: 1500 });
      } else {
        timerId = window.setTimeout(activate, 0);
      }
    };
    const refresh = () => {
      cancelScheduled();
      window.removeEventListener("load", schedule);
      if (!desktop.matches) {
        activated = false;
        setActive(false);
        return;
      }
      if (document.readyState === "complete") schedule();
      else window.addEventListener("load", schedule, { once: true });
    };

    refresh();
    desktop.addEventListener("change", refresh);

    return () => {
      window.removeEventListener("load", schedule);
      desktop.removeEventListener("change", refresh);
      cancelScheduled();
    };
  }, []);

  return (
    <>
      <MobileHeroStatic />
      {active ? <DeferredHeroRelief {...props} /> : <DesktopHeroPlaceholder />}
    </>
  );
}

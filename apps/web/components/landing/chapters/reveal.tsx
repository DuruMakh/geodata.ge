"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

// Fade-in on first view. `.home-rv` (globals.css) holds the hidden state and the reduced-motion
// override; this only adds `data-in` once, straight on the element so React never rerenders it.
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-in", "");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        el.setAttribute("data-in", "");
        observer.disconnect();
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className ? `home-rv ${className}` : "home-rv"}>
      {children}
    </div>
  );
}

// True once the element has come within `rootMargin` of the viewport (one screen by default), and
// stays true. Charts mount their dynamic chunk only then. Without IntersectionObserver it is true.
export function useNearViewport(ref: RefObject<Element | null>, rootMargin = "100% 0px"): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return near;
}

/**
 * A chart's canvas engine module, imported once the element comes near the viewport; the chart's text is already
 * server HTML, so only the drawing code waits. `failed` once the import rejects. `load` must be stable (a
 * module-level function).
 */
export function useEngine<M>(ref: RefObject<Element | null>, load: () => Promise<M>): { lib: M | null; failed: boolean } {
  const near = useNearViewport(ref);
  const [state, setState] = useState<{ lib: M | null; failed: boolean }>({ lib: null, failed: false });

  useEffect(() => {
    if (!near) return;
    let live = true;
    load().then(
      (lib) => {
        if (live) setState({ lib, failed: false });
      },
      (error: unknown) => {
        console.warn("[fiscal] chart engine unavailable", error);
        if (live) setState({ lib: null, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, [near, load]);

  return state;
}

/**
 * Stands in for a chart's canvas when its engine could not load; the chart keeps its reserved height, and the
 * canvas's accessible summary (`summary`) stays readable to assistive technology.
 */
export function ChartUnavailable({ text, summary }: { text: string; summary: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="px-4 text-center font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">{text}</p>
      <p className="sr-only">{summary}</p>
    </div>
  );
}

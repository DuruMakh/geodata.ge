"use client";
import { useEffect, useRef, useState } from "react";

export function useTradeSectionsState<T extends string>(sections: readonly T[], defaultSection: T, eventName: string): { section: T; changeSection: (next: T) => void } {
  const [section, setSection] = useState<T>(defaultSection);
  const saved = useRef<Partial<Record<T, string>>>({});
  useEffect(() => {
    const sectionFromHash = () => {
      const requested = new URLSearchParams(window.location.hash.slice(1)).get("section") as T;
      return sections.includes(requested) ? requested : defaultSection;
    };
    const cache = () => { saved.current[sectionFromHash()] = window.location.hash; };
    const restore = () => { cache(); setSection(sectionFromHash()); };
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    window.addEventListener(eventName, cache);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); window.removeEventListener(eventName, cache); };
  }, [sections, defaultSection, eventName]);
  const changeSection = (next: T) => {
    if (next === section) return;
    saved.current[section] = window.location.hash;
    const hash = saved.current[next] || `#section=${next}`;
    try { window.history.pushState(null, "", hash); } catch { /* The comparison still works in embedded contexts. */ }
    setSection(next);
  };
  return { section, changeSection };
}

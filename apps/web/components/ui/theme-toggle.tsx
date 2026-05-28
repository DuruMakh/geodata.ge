"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "night";

const THEME_EVENT = "geodata-theme-change";

function normalizeTheme(value: string | null): Theme {
  return value === "night" ? "night" : "light";
}

function themeFromCookie(): Theme | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )geodata-theme=(light|night)(?:;|$)/);
  return match?.[1] === "night" ? "night" : match?.[1] === "light" ? "light" : null;
}

function getServerSnapshot(): Theme {
  return "light";
}

function getClientSnapshot(): Theme {
  return normalizeTheme(window.localStorage.getItem("geodata-theme") ?? themeFromCookie());
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(THEME_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(THEME_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function applyTheme(theme: Theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("geodata-theme", theme);
  document.cookie = `geodata-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="inline-flex shrink-0 rounded-full bg-[var(--strong)] p-[3px]" aria-label="Theme">
      <button
        type="button"
        data-testid="theme-light"
        aria-pressed={theme === "light"}
        onClick={() => applyTheme("light")}
        className={[
          "h-[30px] w-20 rounded-full text-[13px] font-medium transition",
          theme === "light" ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--body)]",
        ].join(" ")}
      >
        Light
      </button>
      <button
        type="button"
        data-testid="theme-night"
        aria-pressed={theme === "night"}
        onClick={() => applyTheme("night")}
        className={[
          "h-[30px] w-20 rounded-full text-[13px] font-medium transition",
          theme === "night" ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--body)]",
        ].join(" ")}
      >
        Night
      </button>
    </div>
  );
}

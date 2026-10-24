import type { Ref } from "react";
import { placeTip } from "./canvas";

// Tooltip of the revenue and deficit charts: a title, `rows` rows of key swatch + value + name, and a
// foot. The markup is fixed and `showTip` fills it in place, so hovering never rerenders React.
// Ported from the design board's tipCtl; hidden from assistive technology like every chart tooltip.

export type TipData = {
  title: string;
  rows: { key?: string; val: string; name?: string }[];
  foot?: string;
};

export function ChartTip({ tipRef, rows }: { tipRef: Ref<HTMLDivElement>; rows: number }) {
  return (
    <div
      ref={tipRef}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-[6] min-w-[156px] max-w-[270px] rounded-[4px] border border-[var(--hairline)] bg-[var(--tile)] px-3 pb-[9px] pt-2.5 text-xs leading-[1.35] text-[var(--ink)] opacity-0 shadow-[0_10px_28px_rgba(30,27,22,.13)] transition-opacity duration-[120ms]"
    >
      <div className="mb-[5px] text-xs font-semibold" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mt-1 flex items-center gap-2">
          <i className="h-0.5 w-3 flex-none rounded-[1px]" />
          <b className="whitespace-nowrap font-[family-name:var(--font-numeric)] text-xs font-semibold" />
          <span className="text-[11.5px] text-[var(--muted)]" />
        </div>
      ))}
      <div className="mt-1.5 border-t border-[var(--row-border)] pt-1.5 text-[11px] text-[var(--muted)]" />
    </div>
  );
}

/** Fill the tooltip `el` with `data` and put it next to (x, y) inside a w x h chart. */
export function showTip(el: HTMLElement, data: TipData, x: number, y: number, w: number, h: number): void {
  const parts = Array.from(el.children) as HTMLElement[];
  const title = parts[0];
  const foot = parts[parts.length - 1];
  title.textContent = data.title;
  parts.slice(1, -1).forEach((row, i) => {
    const item = data.rows[i];
    row.style.display = item ? "" : "none";
    if (!item) return;
    const [key, val, name] = Array.from(row.children) as HTMLElement[];
    key.style.display = item.key ? "" : "none";
    key.style.background = item.key ?? "transparent";
    val.textContent = item.val;
    name.textContent = item.name ?? "";
  });
  foot.textContent = data.foot ?? "";
  foot.style.display = data.foot ? "" : "none";
  placeTip(el, x, y, w, h);
}

export function hideTip(el: HTMLElement): void {
  el.style.opacity = "0";
}

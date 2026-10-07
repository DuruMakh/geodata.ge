"use client";
import { useEffect, useRef } from "react";
import type { UnemploymentIndicator } from "../../lib/data/unemployment/types";
import { unemploymentIsRate } from "../../lib/data/unemployment/types";
import { MAP_RAMP } from "../../lib/explorer/colors";
import { unemploymentAgeHeatmapBin, type buildUnemploymentAgeHeatmap } from "../../lib/explorer/unemploymentAge";
import { formatInUnit, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SectionTitle } from "../ui/editorial";

export function UnemploymentAgeHeatmap({ model, indicator }: { model: ReturnType<typeof buildUnemploymentAgeHeatmap>; indicator: UnemploymentIndicator }) {
  const { locale, messages } = useI18n();
  const t = (key: string) => message(messages, `unemployment.${key}`);
  const percent = unemploymentIsRate(indicator), unit = { divisor: 1, decimals: 1, label: t("thousandPersons") };
  const format = (value: number | null) => percent ? formatShare(value === null ? null : value / 100) : formatInUnit(value, unit);
  const caption = `${t(`indicator.${indicator}`)} · ${percent ? "%" : unit.label} · ${model.years[0]}–${model.years.at(-1)}`;
  const scroller = useRef<HTMLDivElement>(null);
  const yearsKey = model.years.join(",");
  // Where the table is wider than its column (phones), open on the newest years.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [yearsKey]);
  return <section data-testid="unemployment-age-heatmap" data-indicator={indicator} data-unit={percent ? "percent" : "thousand_persons"} className="mt-12 border-t-2 border-[var(--ink)] pt-5">
    <SectionTitle>{t("ageHeatmapTitle")}</SectionTitle>
    <p className="mt-2 text-[12px] text-[var(--body)]">{caption}</p>
    <p className="mt-2 max-w-[800px] text-[12px] leading-relaxed text-[var(--muted)]">{t("ageHeatmapNote")}</p>
    <div className="mt-5">
      <div ref={scroller} data-testid="age-heatmap-scroller" role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
      <table className="w-full border-separate border-spacing-1 text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>
          <th scope="col" className="sticky left-0 z-10 bg-[var(--paper)] px-3 py-2 text-left text-[11px] font-medium text-[var(--muted)]">{t("breakdown.age")}</th>
          {model.years.map(year => <th key={year} scope="col" className="min-w-[78px] px-3 py-2 text-center font-[family-name:var(--font-numeric)] text-[11px] font-medium text-[var(--muted)]">{year}</th>)}
        </tr></thead>
        <tbody>{model.rows.map(row => <tr key={row.id} data-heatmap-group={row.id}>
          <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-[var(--paper)] px-3 py-2 text-left font-normal text-[var(--ink)]">{locale === "en" ? row.labelEn : row.labelKa}</th>
          {row.values.map((value, index) => {
            const bin = value === null ? null : unemploymentAgeHeatmapBin(value, model.maximum, MAP_RAMP.length);
            return <td key={model.years[index]} data-heatmap-cell={`${row.id}:${model.years[index]}`} data-value={value ?? ""} data-bin={bin ?? ""} className="px-3 py-2 text-center font-[family-name:var(--font-numeric)] tabular-nums"
              style={bin === null ? { color: "var(--ink)" } : { backgroundColor: MAP_RAMP[bin], color: bin === MAP_RAMP.length - 1 ? "var(--paper)" : "var(--ink)" }}>{format(value)}</td>;
          })}
        </tr>)}</tbody>
      </table>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
      <span>{format(0)}</span><span aria-hidden className="flex">{MAP_RAMP.map(fill => <span key={fill} className="h-2 w-[18px]" style={{ backgroundColor: fill }} />)}</span><span>{format(model.maximum)}</span>
      <span>{t("ageHeatmapScale")}</span>
    </div>
  </section>;
}

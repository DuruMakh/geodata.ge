"use client";
import type { UnemploymentIndicator } from "../../lib/data/unemployment/types";
import { unemploymentIsRate } from "../../lib/data/unemployment/types";
import type { buildUnemploymentAgeHeatmap } from "../../lib/explorer/unemploymentAge";
import { formatInUnit, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeatmapTable } from "../main-explorer/heatmap-table";
import { SectionTitle } from "../ui/editorial";

export function UnemploymentAgeHeatmap({ model, indicator }: { model: ReturnType<typeof buildUnemploymentAgeHeatmap>; indicator: UnemploymentIndicator }) {
  const { locale, messages } = useI18n();
  const t = (key: string) => message(messages, `unemployment.${key}`);
  const percent = unemploymentIsRate(indicator), unit = { divisor: 1, decimals: 1, label: t("thousandPersons") };
  const format = (value: number | null) => percent ? formatShare(value === null ? null : value / 100) : formatInUnit(value, unit);
  const caption = `${t(`indicator.${indicator}`)} · ${percent ? "%" : unit.label} · ${model.years[0]}–${model.years.at(-1)}`;
  return <section data-testid="unemployment-age-heatmap" data-indicator={indicator} data-unit={percent ? "percent" : "thousand_persons"} className="mt-12 border-t-2 border-[var(--ink)] pt-5">
    <SectionTitle>{t("ageHeatmapTitle")}</SectionTitle>
    <p className="mt-2 text-[12px] text-[var(--body)]">{caption}</p>
    <p className="mt-2 max-w-[800px] text-[12px] leading-relaxed text-[var(--muted)]">{t("ageHeatmapNote")}</p>
    <HeatmapTable caption={caption} rowHeader={t("breakdown.age")} years={model.years} rows={model.rows.map(row => ({ id: row.id, label: locale === "en" ? row.labelEn : row.labelKa, values: row.values }))} maximum={model.maximum} format={format} scaleLabel={t("ageHeatmapScale")} />
  </section>;
}

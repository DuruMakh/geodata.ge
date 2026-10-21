"use client";
import type { UnemploymentIndicator } from "../../lib/data/unemployment/types";
import { unemploymentIsRate } from "../../lib/data/unemployment/types";
import type { buildUnemploymentAgeHeatmap } from "../../lib/explorer/unemploymentAge";
import { formatUnemploymentValue, unemploymentCountUnit } from "../../lib/explorer/unemployment";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeatmapSection } from "../main-explorer/heatmap-table";

/** The Unemployment age page's heat map: every age group by year for the chosen indicator, in the page's own wording. */
export function UnemploymentAgeHeatmap({ model, indicator }: { model: Pick<ReturnType<typeof buildUnemploymentAgeHeatmap>, "years" | "maximum"> & { rows: Array<{ id: string; labelKa: string; labelEn: string; values: Array<number | null> }> }; indicator: UnemploymentIndicator }) {
  const { locale, messages } = useI18n();
  const t = (key: string) => message(messages, `unemployment.${key}`);
  const percent = unemploymentIsRate(indicator), unit = unemploymentCountUnit(messages);
  const format = (value: number | null) => formatUnemploymentValue(value, percent, messages);
  const caption = `${t(`indicator.${indicator}`)} · ${percent ? "%" : unit.label} · ${model.years[0]}–${model.years.at(-1)}`;
  return <HeatmapSection testId="unemployment-age-heatmap" indicator={indicator} unit={percent ? "percent" : "thousand_persons"} title={t("ageHeatmapTitle")} caption={caption} note={t("ageHeatmapNote")}
    scaleLabel={t("ageHeatmapScale")} rowHeader={t("breakdown.age")} years={model.years} maximum={model.maximum} format={format}
    rows={model.rows.map(row => ({ id: row.id, label: locale === "en" ? row.labelEn : row.labelKa, values: row.values }))} />;
}

"use client";

import type { ClientInflationTargetRow } from "../../lib/servedRows";
import { periodMonth } from "../../lib/data/inflation/periods";
import { formatShare } from "../../lib/explorer/format";
import { displayedValue } from "../../lib/explorer/inflationGrid";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { INFLATION_COLORS, latestIndicators, type InflationIndex } from "../../lib/explorer/inflationOverview";
import { Message } from "../../lib/i18n/message";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle } from "../ui/editorial";

// ძირითადი ინდიკატორები for inflation: always the latest published month,
// regardless of tab or range (spec §6). No movers, no period comparison, and
// no good/bad colour — the gauge measures against the target in force.

const GAUGE_MAX = 15;
const pct = (value: number | null, signed = false) => formatShare(value === null ? null : displayedValue(value) / 100, signed);
const mono = (text: string) => <span className="font-[family-name:var(--font-numeric)] text-xs">{text}</span>;

function TargetGauge({ value, target }: { value: number; target: number | null }) {
  const { messages } = useI18n();
  const position = (level: number) => Math.max(0, Math.min(100, (level / GAUGE_MAX) * 100));
  const inkWidth = target === null ? position(value) : position(Math.min(value, target));
  const accentWidth = target === null ? 0 : Math.max(0, position(value) - position(target));
  return (
    <div data-testid="inflation-gauge">
      <div className="relative flex h-[3px] bg-[var(--hairline-soft)]">
        <div className="h-[3px] bg-[var(--ink)]" style={{ width: `${inkWidth.toFixed(1)}%` }} />
        <div className="h-[3px] bg-[var(--accent)]" style={{ width: `${accentWidth.toFixed(1)}%` }} />
        {target !== null ? (
          <span aria-hidden className="absolute -top-1.5 h-[15px] border-l border-dashed border-[var(--accent)]" style={{ left: `${position(target).toFixed(1)}%` }} />
        ) : null}
      </div>
      <div className="relative mt-2 h-4 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
        <span className="absolute left-0">0%</span>
        {target !== null ? (
          <span className="absolute -translate-x-1/2 whitespace-nowrap text-[var(--accent)]" style={{ left: `${position(target).toFixed(1)}%` }}>
            {message(messages, "inflation.gaugeTarget", { target: formatShare(target / 100, false, 0) })}
          </span>
        ) : null}
        <span className="absolute right-0">{GAUGE_MAX}%</span>
      </div>
    </div>
  );
}

export function InflationIndicators({ index, targets }: { index: InflationIndex; targets: ClientInflationTargetRow[] }) {
  const { messages } = useI18n();
  const latest = latestIndicators(index, targets);
  if (!latest) return null;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const month = periodMonth(latest.period);
  const previousMonth = periodMonth(latest.period - 1);
  // The sentence argues from the printed figures, so its gap never disagrees with them.
  const shownYoy = displayedValue(latest.yoy);
  const delta = latest.target === null ? null : displayedValue(shownYoy - latest.target);

  const sideKpis: SideKpi[] = [
    { label: t("kpiCore"), value: pct(latest.coreYoy), unit: "", color: "var(--ink)", detail: t("kpiCoreDetail"), spark: { values: latest.sparks.coreYoy, color: INFLATION_COLORS.core } },
    {
      label: t("kpiMonthly"),
      value: pct(latest.mom, true),
      unit: "",
      color: "var(--ink)",
      detail: t("kpiMonthlyDetail", { monthWith: message(messages, `inflation.monthWith.${previousMonth}`) }),
      spark: { values: latest.sparks.mom, color: INFLATION_COLORS.cpi },
    },
    { label: t("kpiAvg12"), value: pct(latest.avg12), unit: "", color: "var(--ink)", detail: t("kpiAvg12Detail"), spark: { values: latest.sparks.avg12, color: INFLATION_COLORS.cpi } },
  ];

  return (
    <section data-testid="inflation-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{message(messages, "main.indicators")}</SectionTitle>
      <div data-testid="period-kpi-cards" className={KPI_GRID_CLASS}>
        <HeroKpi label={`${t("tab.yoy")} · ${periodLabel(messages, latest.period, "long")}`} value={pct(latest.yoy)}>
          <TargetGauge value={latest.yoy} target={latest.target} />
          <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
            <Message
              messages={messages}
              id={shownYoy >= 0 ? "inflation.heroRise" : "inflation.heroFall"}
              values={{ monthIn: message(messages, `inflation.monthIn.${month}`), monthWith: message(messages, `inflation.monthWith.${month}`), value: mono(pct(Math.abs(latest.yoy))) }}
            />
            {delta !== null ? (
              <>
                {" "}
                <Message
                  messages={messages}
                  id={Math.abs(delta) < 0.05 ? "inflation.targetAt" : delta > 0 ? "inflation.targetAbove" : "inflation.targetBelow"}
                  values={{ target: mono(formatShare(latest.target! / 100, false, 0)), delta: mono(`${Math.abs(delta).toFixed(1)} ${t("pp")}`) }}
                />
              </>
            ) : null}
            {latest.coreYoy !== null ? (
              <>
                {" "}
                <Message messages={messages} id="inflation.coreSentence" values={{ core: mono(pct(latest.coreYoy)) }} />
              </>
            ) : null}
          </p>
        </HeroKpi>
        <SideKpiList kpis={sideKpis} />
      </div>
    </section>
  );
}

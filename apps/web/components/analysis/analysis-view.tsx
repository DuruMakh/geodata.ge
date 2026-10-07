"use client";

import { useLayoutEffect, useRef } from "react";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { formatDisplayDate } from "../../lib/explorer/format";
import type { SingleYearSnapshotModel } from "../../lib/explorer/types";
import type { ExpenditureGrouping } from "../../lib/explorer/types";
import { NEGATIVE } from "../../lib/explorer/colors";
import { Callout, Overline, SourceNote, TabDivider, TextTab } from "../ui/editorial";
import { BudgetField } from "./budget-field";
import { Every100Gel } from "./every-100";
import { FullRanking } from "./ranking";
import { BudgetRadar } from "./radar";
import { StructureTreemap } from "./treemap";

// Single-year analysis view per DESIGN.md §9: side/grouping tabs, year selector,
// four headlines, then the fixed section order.

type AnalysisViewProps = {
  model: SingleYearSnapshotModel;
  years: number[];
  plannedYears: Set<number>;
  side: "expenditure" | "revenue";
  grouping: ExpenditureGrouping;
  year: number | null;
  lastUpdatedAt: string;
  onSideChange: (side: "expenditure" | "revenue") => void;
  onGroupingChange: (grouping: ExpenditureGrouping) => void;
  onYearChange: (year: number) => void;
};

export function AnalysisView({
  model,
  years,
  plannedYears,
  side,
  grouping,
  year,
  lastUpdatedAt,
  onSideChange,
  onGroupingChange,
  onYearChange,
}: AnalysisViewProps) {
  const { locale, messages } = useI18n();
  const yearRowRef = useRef<HTMLDivElement>(null);
  // Below 768px the year buttons sit on one scrolling row (§12); keep the active
  // year in view, both when the page opens and when the year changes elsewhere.
  useLayoutEffect(() => {
    const row = yearRowRef.current;
    const active = row?.querySelector<HTMLElement>("button[aria-pressed='true']");
    if (row && active) row.scrollLeft = yearRowScrollLeft(row, active);
  }, [year, years]);
  const structureTitle = message(messages, side === "revenue" ? "analysis.structureRevenue" : grouping === "ministries" ? "analysis.structureMinistries" : "analysis.structureFields");

  return (
    <div data-testid="single-year-snapshot" className="min-w-0">
      <section className="border-t border-[var(--ink)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div data-testid="analysis-tab-groups" className="flex min-w-0 flex-wrap items-center gap-x-[18px] gap-y-3">
            <span className="flex items-center gap-[18px]">
              <TextTab label={message(messages, "analysis.expenditure")} active={side === "expenditure"} onClick={() => onSideChange("expenditure")} testId="analysis-side-expenditure" />
              <TextTab label={message(messages, "analysis.revenue")} active={side === "revenue"} onClick={() => onSideChange("revenue")} testId="analysis-side-revenue" />
            </span>
            {side === "expenditure" ? (
              <span className="flex items-center gap-[18px]">
                <span className="hidden min-[480px]:inline"><TabDivider /></span>
                <TextTab label={message(messages, "analysis.fields")} active={grouping === "fields"} onClick={() => onGroupingChange("fields")} testId="analysis-grouping-fields" />
                <TextTab label={message(messages, "analysis.ministries")} active={grouping === "ministries"} onClick={() => onGroupingChange("ministries")} testId="analysis-grouping-ministries" />
              </span>
            ) : null}
          </div>
          <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
            {message(messages, model.hasPlannedValues ? "analysis.plannedBudget" : "analysis.actualBudget")}
          </span>
        </div>

        <div
          ref={yearRowRef}
          data-testid="analysis-year-selector"
          className="relative mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-0.5 max-[768px]:flex-nowrap max-[768px]:overflow-x-auto"
        >
          {years.map((candidate) => {
            const active = candidate === year;

            return (
              <button
                key={candidate}
                type="button"
                aria-pressed={active}
                onClick={() => onYearChange(candidate)}
                className={`min-h-9 shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-[3px] pt-1.5 pb-[7px] font-[family-name:var(--font-numeric)] text-xs ${
                  active ? "border-[var(--accent)] font-semibold text-[var(--ink)]" : "border-transparent font-normal text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {candidate}
                {plannedYears.has(candidate) ? (
                  <span className="ml-1 align-super text-[11px] min-[768px]:text-[9px] text-[var(--faint)]">{message(messages, "analysis.planned")}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {model.emptyReason ? (
        <div className="mt-8">
          <Callout>{model.emptyReason}</Callout>
        </div>
      ) : (
        <>
          <div className="mt-[34px] grid grid-cols-2 gap-x-8 gap-y-7 border-t border-[var(--hairline)] pt-6 @min-[1100px]:grid-cols-4">
            {model.headlineCards.map((card) => (
              <div key={card.id} className="min-w-0">
                <Overline>{card.label}</Overline>
                <p
                  className="mt-2.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]"
                  style={{ color: card.negative ? NEGATIVE : "var(--ink)" }}
                >
                  <span className="max-w-full break-words">{card.value}</span>
                  {card.unit ? (
                    <span className="max-w-full break-words font-[family-name:var(--font-numeric)] text-[13px] font-medium tracking-normal text-[var(--body)]">
                      {card.unit}
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 text-xs leading-normal text-[var(--muted)]">{card.detail}</p>
              </div>
            ))}
          </div>

          <StructureTreemap items={model.items} title={structureTitle} yearLabel={String(model.year)} />
          <Every100Gel items={model.every100} />
          <BudgetRadar items={model.radarItems} />
          <BudgetField items={model.items} />
          <FullRanking rows={model.rankingRows} side={side} grouping={grouping} year={model.year} />

          <div className="mt-[26px]">
            <SourceNote testId="source-label">
              <Message messages={messages} id="analysis.source" values={{
                year: <span className="font-[family-name:var(--font-numeric)]">{model.year}</span>,
                basis: message(messages, model.hasPlannedValues ? "analysis.plannedBudget" : "analysis.actualBudget"),
              }} />
              {side === "expenditure"
                ? grouping === "ministries"
                  ? message(messages, "analysis.ministryClassification")
                  : message(messages, "analysis.fieldClassification")
                : null}
              {lastUpdatedAt ? (
                <>
                  <Message messages={messages} id="analysis.updated" values={{ date: <span className="font-[family-name:var(--font-numeric)]">{locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt}</span> }} />
                </>
              ) : null}
            </SourceNote>
          </div>
        </>
      )}
    </div>
  );
}

/** Scroll offset that brings `active` fully into the row, centring it only when it
 *  is (partly) out of view, so a tap on a visible year never moves the row. */
export function yearRowScrollLeft(row: Pick<HTMLElement, "scrollLeft" | "clientWidth" | "scrollWidth">, active: Pick<HTMLElement, "offsetLeft" | "offsetWidth">) {
  const start = active.offsetLeft;
  const end = start + active.offsetWidth;
  if (start >= row.scrollLeft && end <= row.scrollLeft + row.clientWidth) return row.scrollLeft;
  const centred = start - (row.clientWidth - active.offsetWidth) / 2;
  return Math.max(0, Math.min(row.scrollWidth - row.clientWidth, centred));
}

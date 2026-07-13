"use client";

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
  const structureTitle =
    side === "revenue"
      ? "სტრუქტურა კატეგორიების მიხედვით"
      : grouping === "ministries"
        ? "სტრუქტურა უწყებების მიხედვით"
        : "სტრუქტურა სფეროების მიხედვით";

  return (
    <div data-testid="single-year-snapshot">
      <section className="border-t border-[var(--ink)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-[18px]">
            <TextTab label="ხარჯები" active={side === "expenditure"} onClick={() => onSideChange("expenditure")} testId="analysis-side-expenditure" />
            <TextTab label="შემოსავლები" active={side === "revenue"} onClick={() => onSideChange("revenue")} testId="analysis-side-revenue" />
            {side === "expenditure" ? (
              <>
                <TabDivider />
                <TextTab label="სფეროები" active={grouping === "fields"} onClick={() => onGroupingChange("fields")} testId="analysis-grouping-fields" />
                <TextTab label="უწყებები" active={grouping === "ministries"} onClick={() => onGroupingChange("ministries")} testId="analysis-grouping-ministries" />
              </>
            ) : null}
          </div>
          <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
            {model.hasPlannedValues ? "გეგმური ბიუჯეტის მონაცემები" : "12-თვიანი ფაქტობრივი შესრულება"}
          </span>
        </div>

        <div data-testid="analysis-year-selector" className="mt-4 flex items-baseline gap-4 overflow-x-auto pb-0.5">
          {years.map((candidate) => {
            const active = candidate === year;

            return (
              <button
                key={candidate}
                type="button"
                aria-pressed={active}
                onClick={() => onYearChange(candidate)}
                className={`cursor-pointer whitespace-nowrap border-b-2 px-[3px] pt-1.5 pb-[7px] font-[family-name:var(--font-numeric)] text-xs ${
                  active ? "border-[var(--accent)] font-semibold text-[var(--ink)]" : "border-transparent font-normal text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {candidate}
                {plannedYears.has(candidate) ? (
                  <span className="ml-1 align-super text-[9px] text-[var(--faint)]">გეგმა</span>
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
          <div className="mt-[34px] grid grid-cols-2 gap-x-8 gap-y-7 border-t border-[var(--hairline)] pt-6 min-[1100px]:grid-cols-4">
            {model.headlineCards.map((card) => (
              <div key={card.id} className="min-w-0">
                <Overline>{card.label}</Overline>
                <p
                  className="mt-2.5 whitespace-nowrap font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]"
                  style={{ color: card.negative ? NEGATIVE : "var(--ink)" }}
                >
                  {card.value}
                  {card.unit ? (
                    <span className="ml-1.5 font-[family-name:var(--font-numeric)] text-[13px] font-medium tracking-normal text-[var(--body)]">
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
          <FullRanking rows={model.rankingRows} side={side} grouping={grouping} />

          <div className="mt-[26px]">
            <SourceNote testId="source-label">
              მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო) ·{" "}
              <span className="font-[family-name:var(--font-numeric)]">{model.year}</span> ·{" "}
              {model.hasPlannedValues ? "გეგმური ბიუჯეტის მონაცემები" : "12-თვიანი ფაქტობრივი შესრულება"}.
              {side === "expenditure"
                ? grouping === "ministries"
                  ? " უწყებრივი დაჯგუფება GeoData-ისაა ბიუჯეტის შესრულების ანგარიშების პროგრამული კლასიფიკაციის მიხედვით."
                  : " კატეგორიებად დაყოფა GeoData-ის კლასიფიკაციაა ოფიციალური ფუნქციური (COFOG) კოდების მიხედვით."
                : null}
              {lastUpdatedAt ? (
                <>
                  {" "}ბოლო განახლება: <span className="font-[family-name:var(--font-numeric)]">{lastUpdatedAt}</span>.
                </>
              ) : null}
            </SourceNote>
          </div>
        </>
      )}
    </div>
  );
}

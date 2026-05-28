import type { SingleYearSnapshotModel } from "../../lib/explorer/types";
import { YearPills } from "../ui/year-pills";
import { BudgetField } from "./budget-field";
import { BudgetRadar } from "./budget-radar";
import { Every100Gel } from "./every-100-gel";
import { SnapshotHeadlineCards } from "./snapshot-headline-cards";
import { SingleYearRanking } from "./single-year-ranking";
import { SnapshotTreemap } from "./snapshot-treemap";

type SingleYearSnapshotProps = {
  model: SingleYearSnapshotModel;
  years: number[];
  onYearChange: (year: number) => void;
};

export function SingleYearSnapshot({ model, years, onYearChange }: SingleYearSnapshotProps) {
  if (model.emptyReason) {
    return (
      <div className="rounded-[16px] border border-[var(--hairline)] bg-[var(--soft)] p-6 text-sm text-[var(--body)]">
        {model.emptyReason}
      </div>
    );
  }

  const subtitle =
    model.side === "expenditure"
      ? "\u10e1\u10d0\u10d3 \u10db\u10d8\u10d3\u10d8\u10e1 \u10e1\u10d0\u10ef\u10d0\u10e0\u10dd \u10e4\u10e3\u10da\u10d8"
      : "\u10e1\u10d0\u10d8\u10d3\u10d0\u10dc \u10db\u10dd\u10d3\u10d8\u10e1 \u10e1\u10d0\u10ef\u10d0\u10e0\u10dd \u10e4\u10e3\u10da\u10d8";

  return (
    <section data-testid="single-year-snapshot" className="rounded-[24px] bg-[var(--surface)]">
      <header className="mb-4">
        <YearPills years={years} value={model.year} onChange={onYearChange} />
        <p className="mt-4 text-xs font-semibold uppercase text-[var(--mute)]">{"\u10d4\u10e0\u10d7\u10ec\u10da\u10d8\u10d0\u10dc\u10d8 \u10e1\u10e3\u10e0\u10d0\u10d7\u10d8"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold text-[var(--ink)]">
            {model.year} {"\u10ec\u10da\u10d8\u10e1 \u10d1\u10d8\u10e3\u10ef\u10d4\u10e2\u10d8\u10e1 \u10e1\u10e3\u10e0\u10d0\u10d7\u10d8"}
          </h2>
          {model.hasPlannedValues ? (
            <span className="rounded-full border border-[var(--orange)] px-2 py-1 text-xs font-semibold uppercase text-[var(--orange)]">
              {"\u10d2\u10d4\u10d2\u10db\u10e3\u10e0\u10d8 \u10d1\u10d8\u10e3\u10ef\u10d4\u10e2\u10d8"}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-[var(--body)]">{subtitle}</p>
      </header>

      <SnapshotHeadlineCards cards={model.headlineCards} />
      <div className="mt-4 grid min-w-0 gap-4">
        <SnapshotTreemap items={model.items} />
        <Every100Gel items={model.every100} side={model.side} />
        <BudgetRadar items={model.radarItems} />
        <div data-testid="budget-field-scroll" className="min-w-0 max-w-full overflow-x-auto">
          <BudgetField items={model.items} hasGrowthData={model.hasGrowthData} />
        </div>
        <SingleYearRanking rows={model.rankingRows} />
      </div>
    </section>
  );
}

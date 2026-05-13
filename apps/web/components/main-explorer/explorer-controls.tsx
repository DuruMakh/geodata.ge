import type { ChartMode, ExplorerSide, MeasureMode, ViewMode } from "../../lib/explorer/types";

type ExplorerControlsProps = {
  side: ExplorerSide;
  viewMode: ViewMode;
  chartMode: ChartMode;
  measure: MeasureMode;
  years: number[];
  startYear: number;
  endYear: number;
  barYear: number;
  singleYear: number;
  onSideChange: (side: ExplorerSide) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onChartModeChange: (mode: ChartMode) => void;
  onMeasureChange: (measure: MeasureMode) => void;
  onStartYearChange: (year: number) => void;
  onEndYearChange: (year: number) => void;
  onBarYearChange: (year: number) => void;
  onSingleYearChange: (year: number) => void;
};

const sideLabels: Record<ExplorerSide, string> = {
  expenditure: "ხარჯები",
  revenue: "შემოსავლები",
};

const viewModeLabels: Record<ViewMode, string> = {
  multi_year: "მრავალწლიანი",
  single_year: "ერთი წელი",
};

const chartModeLabels: Record<ChartMode, string> = {
  line: "ხაზი",
  bar: "სვეტები",
  stacked: "კომპოზიცია",
  table: "ცხრილი",
};

const measureLabels: Record<MeasureMode, string> = {
  nominal: "ნომინალური GEL",
  percent_change: "% ცვლილება",
  share_of_total: "წილი ჯამში",
  share_of_gdp: "წილი მშპ-ში",
};

export function ExplorerControls({
  side,
  viewMode,
  chartMode,
  measure,
  years,
  startYear,
  endYear,
  barYear,
  singleYear,
  onSideChange,
  onViewModeChange,
  onChartModeChange,
  onMeasureChange,
  onStartYearChange,
  onEndYearChange,
  onBarYearChange,
  onSingleYearChange,
}: ExplorerControlsProps) {
  const availableMeasures: MeasureMode[] =
    chartMode === "stacked" ? ["share_of_total"] : ["nominal", "percent_change", "share_of_total", "share_of_gdp"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(["expenditure", "revenue"] as const).map((nextSide) => (
          <button
            key={nextSide}
            type="button"
            onClick={() => onSideChange(nextSide)}
            className={`h-10 border px-4 font-mono text-xs uppercase transition ${
              side === nextSide
                ? "border-cyan-300 bg-cyan-300 text-black"
                : "border-cyan-300/30 bg-black/30 text-cyan-100 hover:border-cyan-200"
            }`}
          >
            {sideLabels[nextSide]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase text-zinc-500">ხედი</p>
        <div className="flex flex-wrap gap-2">
          {(["multi_year", "single_year"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={`h-10 border px-4 font-mono text-xs uppercase transition ${
                viewMode === mode
                  ? "border-cyan-300 bg-cyan-300 text-black"
                  : "border-cyan-300/30 bg-black/30 text-cyan-100 hover:border-cyan-200"
              }`}
            >
              {viewModeLabels[mode]}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "multi_year" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(["line", "bar", "stacked", "table"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChartModeChange(mode)}
                className={`h-9 border px-3 text-sm transition ${
                  chartMode === mode
                    ? "border-lime-300 bg-lime-300 text-black"
                    : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-lime-300/70"
                }`}
              >
                {chartModeLabels[mode]}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <label className="flex flex-col gap-1 text-xs uppercase text-zinc-500">
              საზომი
              <select
                value={measure}
                onChange={(event) => onMeasureChange(event.target.value as MeasureMode)}
                className="h-10 border border-zinc-700 bg-black px-3 text-sm text-zinc-100"
              >
                {availableMeasures.map((nextMeasure) => (
                  <option key={nextMeasure} value={nextMeasure}>
                    {measureLabels[nextMeasure]}
                  </option>
                ))}
              </select>
            </label>

            {chartMode === "bar" ? (
              <label className="flex flex-col gap-1 text-xs uppercase text-zinc-500">
                წელი
                <select
                  value={barYear}
                  onChange={(event) => onBarYearChange(Number(event.target.value))}
                  className="h-10 border border-zinc-700 bg-black px-3 text-sm text-zinc-100"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs uppercase text-zinc-500">
                  საწყისი წელი
                  <select
                    value={startYear}
                    onChange={(event) => onStartYearChange(Number(event.target.value))}
                    className="h-10 border border-zinc-700 bg-black px-3 text-sm text-zinc-100"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs uppercase text-zinc-500">
                  ბოლო წელი
                  <select
                    value={endYear}
                    onChange={(event) => onEndYearChange(Number(event.target.value))}
                    className="h-10 border border-zinc-700 bg-black px-3 text-sm text-zinc-100"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </>
      ) : (
        <label className="flex max-w-[220px] flex-col gap-1 text-xs uppercase text-zinc-500">
          წელი
          <select
            value={singleYear}
            onChange={(event) => onSingleYearChange(Number(event.target.value))}
            className="h-10 border border-zinc-700 bg-black px-3 text-sm text-zinc-100"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

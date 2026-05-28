import type { ChartMode } from "../../lib/explorer/types";

type ChartPanelControlsProps = {
  chartMode: ChartMode;
  shareModeActive: boolean;
  onChartModeChange: (mode: ChartMode) => void;
  onShareModeChange: (active: boolean) => void;
};

const chartModeLabels: Record<"line" | "table", string> = {
  line: "\u10ee\u10d0\u10d6\u10d8",
  table: "\u10ea\u10ee\u10e0\u10d8\u10da\u10d8",
};

export function ChartPanelControls({
  chartMode,
  shareModeActive,
  onChartModeChange,
  onShareModeChange,
}: ChartPanelControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-full bg-[var(--strong)] p-[2px]" aria-label="Chart mode">
        {(["line", "table"] as const).map((mode) => {
          const active = (chartMode === "table" ? "table" : "line") === mode;

          return (
            <button
              key={mode}
              type="button"
              data-testid={`chart-mode-${mode}`}
              aria-pressed={active}
              onClick={() => onChartModeChange(mode)}
              className={[
                "h-8 min-w-20 rounded-full px-4 text-[13px] font-semibold transition",
                active ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--mute)] hover:text-[var(--body)]",
              ].join(" ")}
            >
              {chartModeLabels[mode]}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        data-testid="measure-share-toggle"
        aria-label="Show percent share"
        aria-pressed={shareModeActive}
        onClick={() => onShareModeChange(!shareModeActive)}
        className={[
          "h-8 rounded-full px-4 text-[13px] font-semibold transition",
          shareModeActive
            ? "bg-[var(--primary)] text-[var(--on-primary)]"
            : "border border-[var(--hairline)] bg-[var(--surface)] text-[var(--body)]",
        ].join(" ")}
      >
        {"% \u10ec\u10d8\u10da\u10d8"}
      </button>
    </div>
  );
}

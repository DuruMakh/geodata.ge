import type { ExplorerSide } from "../../lib/explorer/types";
import { SegmentedControl } from "../ui/segmented-control";

type ExplorerControlsProps = {
  side: ExplorerSide;
  onSideChange: (side: ExplorerSide) => void;
};

const sideLabels: Record<ExplorerSide, string> = {
  expenditure: "\u10ee\u10d0\u10e0\u10ef\u10d4\u10d1\u10d8",
  revenue: "\u10e8\u10d4\u10db\u10dd\u10e1\u10d0\u10d5\u10da\u10d4\u10d1\u10d8",
};

export function ExplorerControls({
  side,
  onSideChange,
}: ExplorerControlsProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-center gap-3">
      <SegmentedControl
        label="Budget side"
        value={side}
        onChange={onSideChange}
        options={[
          { value: "expenditure", label: sideLabels.expenditure, testId: "side-expenditure" },
          { value: "revenue", label: sideLabels.revenue, testId: "side-revenue" },
        ]}
      />
    </div>
  );
}

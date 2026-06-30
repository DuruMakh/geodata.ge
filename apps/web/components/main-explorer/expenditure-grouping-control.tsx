"use client";

import type { ExpenditureGrouping } from "../../lib/explorer/types";
import { SegmentedControl } from "../ui/segmented-control";

type ExpenditureGroupingControlProps = {
  value: ExpenditureGrouping;
  onChange: (value: ExpenditureGrouping) => void;
};

export function ExpenditureGroupingControl({ value, onChange }: ExpenditureGroupingControlProps) {
  return (
    <div data-testid="expenditure-grouping-control">
      <SegmentedControl
        label="Expenditure grouping"
        value={value}
        options={[
          { value: "fields", label: "Fields", testId: "grouping-fields" },
          { value: "ministries", label: "Ministries", testId: "grouping-ministries" },
        ]}
        onChange={onChange}
      />
    </div>
  );
}

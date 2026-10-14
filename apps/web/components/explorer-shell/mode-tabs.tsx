"use client";

import type { ChartMode } from "../../lib/explorer/types";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SegmentedTabs } from "../ui/editorial";

/** The Line/Table switch over a chart panel. The buttons' test ids are `{testId}-mode-line` and `{testId}-mode-table`;
 *  `lineLabel` renames the first option where the chart is not a line (columns, the pyramid). */
export function ModeTabs({ value, onChange, testId = "chart", lineLabel }: { value: ChartMode; onChange: (mode: ChartMode) => void; testId?: string; lineLabel?: string }) {
  const { messages } = useI18n();
  return (
    <SegmentedTabs<ChartMode>
      ariaLabel={message(messages, "controls.viewMode")}
      value={value}
      onChange={onChange}
      options={[
        { value: "line", label: lineLabel ?? message(messages, "controls.chart"), testId: `${testId}-mode-line` },
        { value: "table", label: message(messages, "controls.table"), testId: `${testId}-mode-table` },
      ]}
    />
  );
}

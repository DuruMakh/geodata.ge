import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TextTab, TextTabGroup } from "../../components/ui/editorial";
import { SeriesPanel } from "../../components/main-explorer/series-panel";
import { AnalysisView } from "../../components/analysis/analysis-view";
import type { SingleYearSnapshotModel } from "../../lib/explorer/types";
import { renderGeorgianMarkup } from "../helpers/render-localized";
import analysis from "../../lib/i18n/messages/ka/analysis.json";

// The opening tag of the nearest group before the tab with this test id (tab groups do not nest).
function groupOf(markup: string, testId: string): string {
  const at = markup.indexOf(`data-testid="${testId}"`);
  expect(at).toBeGreaterThan(-1);
  const before = markup.slice(0, at);
  const start = before.lastIndexOf('<span role="group"');
  return start === -1 ? "" : (before.slice(start).match(/^<span[^>]*>/)?.[0] ?? "");
}

describe("TextTabGroup", () => {
  it("a tab row is a labelled group", () => {
    const html = renderToStaticMarkup(
      <TextTabGroup ariaLabel="Grouping" className="flex gap-[18px]">
        <TextTab label="Functions" active onClick={() => {}} testId="fields" />
        <TextTab label="Ministries" active={false} onClick={() => {}} testId="ministries" />
      </TextTabGroup>,
    );
    expect(html).toMatch(/^<span role="group" aria-label="Grouping" class="flex gap-\[18px\]">/);
    expect(html).toContain('data-testid="fields"');
    expect(html).toContain('data-testid="ministries"');
  });

  it("the expenditure aside and the Analysis page announce their tab rows as named groups", () => {
    const panel = renderGeorgianMarkup(
      <SeriesPanel
        items={[]}
        rows={[]}
        scope="fields"
        showGrouping
        grouping="fields"
        selectedIds={[]}
        endYear={2025}
        expandedIds={[]}
        onGroupingChange={() => {}}
        onSelectionChange={() => {}}
        onToggle={() => {}}
        onToggleExpanded={() => {}}
        downloadAction={<div />}
      />,
    );
    expect(groupOf(panel, "aside-grouping-fields")).toContain('aria-label="დაჯგუფება"');

    const view = renderGeorgianMarkup(
      <AnalysisView
        model={{ emptyReason: "x", hasPlannedValues: false } as unknown as SingleYearSnapshotModel}
        years={[2024]}
        plannedYears={new Set()}
        side="expenditure"
        grouping="fields"
        year={2024}
        lastUpdatedAt="2026-01-01"
        onSideChange={() => {}}
        onGroupingChange={() => {}}
        onYearChange={() => {}}
      />,
      analysis,
    );
    expect(groupOf(view, "analysis-side-expenditure")).toContain('aria-label="ბიუჯეტის მხარე"');
    expect(groupOf(view, "analysis-grouping-fields")).toContain('aria-label="დაჯგუფება"');
  });
});

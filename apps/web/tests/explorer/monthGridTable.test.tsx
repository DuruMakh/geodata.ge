import { describe, expect, it } from "vitest";
import { MonthGridTable } from "../../components/main-explorer/month-grid-table";
import { makePeriod } from "../../lib/data/inflation/periods";
import { GRID_TINTS, YOY_BINS, buildMonthGrid, legendLabels } from "../../lib/explorer/inflationGrid";
import { renderGeorgianMarkup } from "../helpers/render-localized";

const values = new Map([[makePeriod(2026, 7), 12.4], [makePeriod(2026, 8), 5.6479]]);
const rows = buildMonthGrid({ values, range: { start: makePeriod(2026, 7), end: makePeriod(2026, 8) }, edges: YOY_BINS, summaryByYear: new Map() });
const short = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];
const long = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const markup = renderGeorgianMarkup(
  <MonthGridTable
    caption="საერთო ინფლაცია · წლიური ინფლაცია"
    yearLabel="წელი"
    monthLabels={short}
    monthNames={long}
    summaryLabel="წლის საშუალო"
    rows={rows}
    formatValue={(value) => `${value.toFixed(1)}%`}
    legend={legendLabels(YOY_BINS).map((label, tint) => ({ label, tint }))}
    legendLabel="ფერის სკალა"
  />,
);

describe("MonthGridTable", () => {
  it("is a captioned table with a month header and the summary column", () => {
    expect(markup).toContain("<table");
    expect(markup).toContain("<caption");
    expect(markup).toContain("საერთო ინფლაცია · წლიური ინფლაცია");
    expect(markup).toContain(">აგვ<");
    expect(markup).toContain(">წლის საშუალო<");
  });

  it("always prints the value, titles the cell, and switches to paper text on the top tint", () => {
    expect(markup).toContain('title="აგვისტო 2026: 5.6%"');
    expect(markup).toContain(">5.6%<");
    expect(markup).toMatch(new RegExp(`data-bin="4"[^>]*style="background-color:${GRID_TINTS[4]!.background};color:${GRID_TINTS[4]!.text}"`));
  });

  it("renders a five-step legend", () => {
    expect(markup.match(/data-testid="month-grid-legend-step"/g)).toHaveLength(5);
  });
});

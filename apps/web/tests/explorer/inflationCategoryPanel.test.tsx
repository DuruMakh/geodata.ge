import { describe, expect, it } from "vitest";
import { InflationCategoryPanel } from "../../components/inflation/inflation-category-panel";
import { makePeriod } from "../../lib/data/inflation/periods";
import inflation from "../../lib/i18n/messages/ka/inflation.json";
import { fixtureIndex, fixtureState } from "./fixtures/inflationCategories";
import { renderGeorgianMarkup } from "../helpers/render-localized";

const index = fixtureIndex();
const period = makePeriod(2026, 8);
const baseProps = {
  index,
  state: fixtureState(),
  range: { min: period, max: period, start: period, end: period },
  onToggle: () => {},
  onToggleExpanded: () => {},
  onToggleAll: () => {},
  downloadAction: null,
};

const render = (props: Partial<typeof baseProps> = {}) =>
  renderGeorgianMarkup(<InflationCategoryPanel {...baseProps} {...props} />, inflation);

/** The markup of the one row carrying this category id. */
function row(html: string, categoryId: string): string {
  const start = html.indexOf(`data-series-id="${categoryId}"`);
  if (start === -1) return "";
  return html.slice(start, html.indexOf("</div>", start));
}

describe("InflationCategoryPanel", () => {
  it("lists the divisions and no subgroups until expanded", () => {
    const markup = render();
    expect(markup.match(/data-level="2"/g)).toHaveLength(index.tree.length);
    expect(markup).not.toContain('data-series-id="cpi.cat.01_1"');
  });

  it("shows a division's subgroups when expanded", () => {
    const markup = render({ state: fixtureState({ expanded: ["cpi.cat.01"] }) });
    expect(markup).toContain('data-series-id="cpi.cat.01_1"');
    expect(markup).toContain('data-parent-id="cpi.cat.01"');
  });

  it("counts divisions and subgroups separately", () => {
    const markup = render({ state: fixtureState({ selected: ["cpi.cat.01", "cpi.cat.01_1"] }) });
    expect(markup).toContain("ჯგუფები");
    expect(markup).toContain("ქვეჯგუფები");
    // One division selected out of three, and the subgroup counted on its own.
    expect(markup).toMatch(/1 \/ 3/);
  });

  it("shows each category's basket weight", () => {
    expect(row(render(), "cpi.cat.01")).toContain("33.6%");
  });

  it("shows a dash for a category with no value on the active tab", () => {
    const markup = render({ state: fixtureState({ expanded: ["cpi.cat.04"] }) });
    expect(row(markup, "cpi.cat.04_2")).toContain("—");
  });
});
